import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    CloudFormationClient,
    CreateStackCommand,
    ListStacksCommand,
    DescribeStacksCommand
} from '@aws-sdk/client-cloudformation';
import {
    StackRecord,
    getAvailableAccessCodes,
    updateStackRecord,
    putStackRecord,
    getAccessCodePool
} from '../shared/access-code-utils';
import { EventBridgeManager } from '../shared/eventbridge-utils';
import { loadDeploymentConfig, DeploymentConfig } from '../shared/config-loader';

// Error handling utilities
interface ErrorResponse {
    error: string;
    message?: string;
    code?: string;
    details?: any;
}

class LambdaError extends Error {
    public readonly statusCode: number;
    public readonly code?: string;
    public readonly details?: any;

    constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
        super(message);
        this.name = 'LambdaError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

// CloudFormation error handling
function handleCloudFormationError(error: any, operation: string = 'CloudFormation operation'): LambdaError {
    console.error(`CloudFormation error during ${operation}:`, error);

    if (error.name === 'AlreadyExistsException') {
        return new LambdaError(
            'A stack with this name already exists. Please try again.',
            409,
            'STACK_ALREADY_EXISTS',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'LimitExceededException') {
        return new LambdaError(
            'CloudFormation stack limit exceeded. Please delete unused stacks or contact your administrator.',
            429,
            'STACK_LIMIT_EXCEEDED',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'InsufficientCapabilitiesException') {
        return new LambdaError(
            'Insufficient capabilities to create stack. Please contact your administrator.',
            400,
            'INSUFFICIENT_CAPABILITIES',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'TokenAlreadyExistsException') {
        return new LambdaError(
            'Stack creation token already exists. Please try again.',
            409,
            'TOKEN_ALREADY_EXISTS',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'ThrottlingException' || error.name === 'Throttling') {
        return new LambdaError(
            'CloudFormation service is temporarily busy. Please try again in a few moments.',
            429,
            'CLOUDFORMATION_THROTTLED',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'AccessDenied' || error.name === 'UnauthorizedOperation') {
        return new LambdaError(
            'Insufficient permissions to perform CloudFormation operations. Please contact your administrator.',
            403,
            'CLOUDFORMATION_ACCESS_DENIED',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'ValidationException') {
        return new LambdaError(
            'Invalid CloudFormation template or parameters.',
            400,
            'CLOUDFORMATION_VALIDATION_ERROR',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'ServiceUnavailableException') {
        return new LambdaError(
            'CloudFormation service is temporarily unavailable. Please try again later.',
            503,
            'CLOUDFORMATION_UNAVAILABLE',
            { originalError: error.name, operation }
        );
    }

    // Network/timeout errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return new LambdaError(
            'Unable to connect to CloudFormation service. Please try again.',
            503,
            'CLOUDFORMATION_CONNECTION_ERROR',
            { originalError: error.code, operation }
        );
    }

    // Default CloudFormation error
    return new LambdaError(
        `CloudFormation ${operation} failed. Please try again or contact your administrator.`,
        500,
        'CLOUDFORMATION_ERROR',
        { originalError: error.name || error.code, operation }
    );
}

// Create standardized error response
function createErrorResponse(error: LambdaError | Error, headers: Record<string, string>): APIGatewayProxyResult {
    const statusCode = error instanceof LambdaError ? error.statusCode : 500;
    const errorCode = error instanceof LambdaError ? error.code : 'INTERNAL_ERROR';
    const details = error instanceof LambdaError ? error.details : undefined;

    const errorResponse: ErrorResponse = {
        error: error.message,
        code: errorCode,
        ...(details && { details })
    };

    return {
        statusCode,
        headers,
        body: JSON.stringify(errorResponse)
    };
}

// Validation utilities
function validateStackCount(stackCount: any): void {
    if (stackCount === undefined || stackCount === null) {
        throw new LambdaError(
            'Stack count is required.',
            400,
            'MISSING_STACK_COUNT'
        );
    }

    if (!Number.isInteger(stackCount)) {
        throw new LambdaError(
            'Stack count must be a whole number.',
            400,
            'INVALID_STACK_COUNT_TYPE',
            { provided: stackCount, type: typeof stackCount }
        );
    }

    if (stackCount <= 0) {
        throw new LambdaError(
            'Stack count must be greater than 0.',
            400,
            'INVALID_STACK_COUNT_RANGE',
            { provided: stackCount }
        );
    }

    const maxPoolSize = config?.accessCodePoolSize || 60;
    if (stackCount > maxPoolSize) {
        throw new LambdaError(
            `Cannot deploy more than ${maxPoolSize} stacks (maximum Access Code pool size).`,
            400,
            'STACK_COUNT_EXCEEDS_POOL',
            { provided: stackCount, maximum: maxPoolSize }
        );
    }
}

function validateTemplateUrl(templateUrl: string): void {
    if (!templateUrl) {
        throw new LambdaError(
            'Template URL is not configured.',
            500,
            'TEMPLATE_URL_MISSING'
        );
    }

    try {
        const url = new URL(templateUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Invalid protocol');
        }
    } catch (error) {
        throw new LambdaError(
            'Invalid template URL configuration.',
            500,
            'TEMPLATE_URL_INVALID',
            { templateUrl }
        );
    }
}

// DynamoDB error handling
function handleDynamoDBError(error: any, operation: string = 'DynamoDB operation'): LambdaError {
    console.error(`DynamoDB error during ${operation}:`, error);

    if (error.name === 'ThrottlingException' || error.name === 'ProvisionedThroughputExceededException') {
        return new LambdaError(
            'Database is temporarily busy. Please try again in a few moments.',
            429,
            'DYNAMODB_THROTTLED',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'AccessDeniedException' || error.name === 'UnauthorizedOperation') {
        return new LambdaError(
            'Insufficient permissions to access database. Please contact your administrator.',
            403,
            'DYNAMODB_ACCESS_DENIED',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'ValidationException') {
        return new LambdaError(
            'Invalid database request parameters.',
            400,
            'DYNAMODB_VALIDATION_ERROR',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'ResourceNotFoundException') {
        return new LambdaError(
            'Database table not found. Please contact your administrator.',
            404,
            'DYNAMODB_TABLE_NOT_FOUND',
            { originalError: error.name, operation }
        );
    }

    if (error.name === 'ServiceUnavailableException') {
        return new LambdaError(
            'Database service is temporarily unavailable. Please try again later.',
            503,
            'DYNAMODB_UNAVAILABLE',
            { originalError: error.name, operation }
        );
    }

    // Network/timeout errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return new LambdaError(
            'Unable to connect to database service. Please try again.',
            503,
            'DYNAMODB_CONNECTION_ERROR',
            { originalError: error.code, operation }
        );
    }

    // Default DynamoDB error
    return new LambdaError(
        `Database ${operation} failed. Please try again or contact your administrator.`,
        500,
        'DYNAMODB_ERROR',
        { originalError: error.name || error.code, operation }
    );
}

interface DeployedStack {
    stackName: string;
    stackId: string;
    uniqueId: string;
    status: 'CREATE_IN_PROGRESS' | 'CREATE_COMPLETE' | 'CREATE_FAILED';
    createdAt: Date;
}

interface DeploymentResponse {
    deployedStacks: DeployedStack[];
    assignedAccessCodes: string[];
}

interface DeploymentRequest {
    stackCount: number;
    selectedAccessCodes?: string[]; // Optional: specific Access Codes to use for deployment
    templateParameters?: Record<string, string>; // Optional: parameter overrides
}

// Configuration will be loaded on cold start
let config: DeploymentConfig;
let cloudFormationClient: CloudFormationClient;

/**
 * Initialize configuration and clients on Lambda cold start
 */
function initializeClients(): void {
    if (!config) {
        console.log('Loading deployment configuration...');
        config = loadDeploymentConfig();

        const region = config.region || 'us-east-1';

        cloudFormationClient = new CloudFormationClient({ region });

        console.log('Clients initialized with region:', region);
    }
}

/**
 * Get all active CloudFormation stacks with UniqueId tags
 */
async function getActiveStacksFromCloudFormation(): Promise<string[]> {
    try {
        const command = new ListStacksCommand({
            StackStatusFilter: [
                'CREATE_IN_PROGRESS',
                'CREATE_COMPLETE',
                'UPDATE_IN_PROGRESS',
                'UPDATE_COMPLETE'
            ]
        });

        const response = await cloudFormationClient.send(command);
        const usedAccessCodes: string[] = [];
        let processedStacks = 0;
        let failedStacks = 0;

        const stackPrefix = config?.stackNamePrefix || 'deployment-stack';

        if (response.StackSummaries) {
            for (const stack of response.StackSummaries) {
                if (stack.StackName && stack.StackId) {
                    // Only process stacks with the configured prefix for security
                    if (!stack.StackName.startsWith(`${stackPrefix}-`)) {
                        continue;
                    }

                    try {
                        processedStacks++;

                        // Get stack details to check for UniqueId tag
                        const describeCommand = new DescribeStacksCommand({
                            StackName: stack.StackName
                        });
                        const stackDetails = await cloudFormationClient.send(describeCommand);

                        if (stackDetails.Stacks && stackDetails.Stacks[0]?.Tags) {
                            const uniqueIdTag = stackDetails.Stacks[0].Tags.find(
                                tag => tag.Key === 'UniqueId'
                            );

                            if (uniqueIdTag?.Value) {
                                // Get Access Code pool to validate
                                const accessCodePool = await getAccessCodePool();
                                if (accessCodePool.includes(uniqueIdTag.Value)) {
                                    usedAccessCodes.push(uniqueIdTag.Value);
                                }
                            }
                        }
                    } catch (error) {
                        failedStacks++;
                        console.warn(`Failed to get details for stack ${stack.StackName}:`, error);

                        // If too many individual stack queries fail, it might indicate a broader issue
                        if (failedStacks > 10 && failedStacks / processedStacks > 0.5) {
                            console.error(`High failure rate getting stack details: ${failedStacks}/${processedStacks}`);
                            throw handleCloudFormationError(error, 'stack listing');
                        }
                        // Continue processing other stacks for individual failures
                    }
                }
            }
        }

        console.log(`Found ${usedAccessCodes.length} used Access Codes from ${processedStacks} processed stacks (${failedStacks} failed)`);
        return usedAccessCodes;
    } catch (error) {
        console.error('Error fetching active stacks:', error);
        throw handleCloudFormationError(error, 'stack listing');
    }
}

/**
 * Get available Access Codes from DynamoDB
 */
async function getAvailableAccessCodesFromDB(): Promise<string[]> {
    try {
        // Get Access Code pool from DynamoDB
        const accessCodePool = await getAccessCodePool();

        // Validate Access Code pool
        if (!accessCodePool || accessCodePool.length === 0) {
            throw new LambdaError(
                'Access Code pool is empty. Please contact your administrator.',
                500,
                'ACCESS_CODE_POOL_EMPTY',
                { poolSize: 0 }
            );
        }

        const availableAccessCodes = await getAvailableAccessCodes();

        console.log(`Available Access Codes from DynamoDB: ${availableAccessCodes.length}/${accessCodePool.length}`);
        return availableAccessCodes;
    } catch (error) {
        console.error('Error getting available Access Codes from DynamoDB:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleDynamoDBError(error, 'Access Code availability check');
    }
}

/**
 * Assign Access Codes from the available pool or validate selected Access Codes
 */
async function assignAccessCodes(count: number, selectedAccessCodes?: string[]): Promise<string[]> {
    try {
        const availableAccessCodes = await getAvailableAccessCodesFromDB();
        const accessCodePool = await getAccessCodePool();

        if (selectedAccessCodes && selectedAccessCodes.length > 0) {
            // Validate selected Access Codes
            if (selectedAccessCodes.length !== count) {
                throw new LambdaError(
                    `Selected Access Codes count (${selectedAccessCodes.length}) does not match requested stack count (${count}).`,
                    400,
                    'ACCESS_CODE_COUNT_MISMATCH',
                    { selectedCount: selectedAccessCodes.length, requestedCount: count }
                );
            }

            // Validate all selected Access Codes are in the pool
            const invalidAccessCodes = selectedAccessCodes.filter(accessCode => !accessCodePool.includes(accessCode));
            if (invalidAccessCodes.length > 0) {
                throw new LambdaError(
                    `Invalid Access Codes selected: ${invalidAccessCodes.join(', ')}. Access Codes must be from the predefined pool.`,
                    400,
                    'INVALID_ACCESS_CODES',
                    { invalidAccessCodes }
                );
            }

            // Validate all selected Access Codes are available
            const unavailableAccessCodes = selectedAccessCodes.filter(accessCode => !availableAccessCodes.includes(accessCode));
            if (unavailableAccessCodes.length > 0) {
                throw new LambdaError(
                    `Selected Access Codes are not available: ${unavailableAccessCodes.join(', ')}. These Access Codes are already in use.`,
                    409,
                    'ACCESS_CODES_NOT_AVAILABLE',
                    { unavailableAccessCodes, availableAccessCodes: availableAccessCodes.length }
                );
            }

            // Check for duplicates in selected Access Codes
            const duplicates = selectedAccessCodes.filter((accessCode, index) => selectedAccessCodes.indexOf(accessCode) !== index);
            if (duplicates.length > 0) {
                throw new LambdaError(
                    `Duplicate Access Codes selected: ${duplicates.join(', ')}. Each Access Code can only be used once.`,
                    400,
                    'DUPLICATE_ACCESS_CODES',
                    { duplicates }
                );
            }

            console.log(`Using ${selectedAccessCodes.length} selected Access Codes for deployment`);
            return selectedAccessCodes;
        } else {
            // Auto-assign from available pool
            if (availableAccessCodes.length < count) {
                throw new LambdaError(
                    `Not enough available Access Codes. Requested: ${count}, Available: ${availableAccessCodes.length}. Please wait for existing stacks to be deleted or contact your administrator.`,
                    409,
                    'INSUFFICIENT_ACCESS_CODES',
                    { requested: count, available: availableAccessCodes.length, total: accessCodePool.length }
                );
            }

            const assignedAccessCodes = availableAccessCodes.slice(0, count);
            console.log(`Auto-assigned ${assignedAccessCodes.length} Access Codes for deployment`);
            return assignedAccessCodes;
        }
    } catch (error) {
        console.error('Error assigning Access Codes:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleCloudFormationError(error, 'Access Code assignment');
    }
}

/**
 * Deploy multiple CloudFormation stacks with assigned Access Codes
 */
async function deployStacks(
    stackCount: number,
    selectedAccessCodes?: string[],
    parameterOverrides?: Record<string, string>
): Promise<DeploymentResponse> {
    try {
        // Ensure configuration is loaded
        initializeClients();

        // Validate inputs
        validateStackCount(stackCount);
        validateTemplateUrl(config.templateUrl);

        console.log(`Starting deployment of ${stackCount} stacks with template: ${config.templateUrl}`);

        // Get available Access Codes (either selected or auto-assigned)
        const assignedAccessCodes = await assignAccessCodes(stackCount, selectedAccessCodes);

        // Merge template parameters: config defaults + overrides
        const templateParameters = {
            ...(config.templateParameters || {}),
            ...(parameterOverrides || {})
        };

        const deployedStacks: DeployedStack[] = [];
        const timestamp = Date.now();
        let successfulDeployments = 0;
        let failedDeployments = 0;

        const stackPrefix = config.stackNamePrefix || 'deployment-stack';

        // Deploy stacks sequentially to avoid race conditions and better error handling
        for (let i = 0; i < stackCount; i++) {
            const accessCode = assignedAccessCodes[i];
            const stackName = `${stackPrefix}-${accessCode}-${timestamp}-${i + 1}`;

            // Validate stack name follows required prefix pattern
            if (!stackName.startsWith(`${stackPrefix}-`)) {
                throw new LambdaError(
                    `Stack name must start with "${stackPrefix}-" prefix for security compliance.`,
                    400,
                    'INVALID_STACK_NAME_PREFIX',
                    { stackName, requiredPrefix: stackPrefix }
                );
            }

            try {
                console.log(`Deploying stack ${i + 1}/${stackCount}: ${stackName}`);

                // Build CloudFormation parameters from template parameters
                const cfParameters = Object.entries(templateParameters).map(([key, value]) => ({
                    ParameterKey: key,
                    ParameterValue: value
                }));

                const createStackCommand = new CreateStackCommand({
                    StackName: stackName,
                    TemplateURL: config.templateUrl,
                    Parameters: cfParameters.length > 0 ? cfParameters : undefined,
                    Tags: [
                        {
                            Key: 'UniqueId',
                            Value: accessCode
                        },
                        {
                            Key: 'ManagedBy',
                            Value: 'CloudFormationDeploymentPortal'
                        },
                        {
                            Key: 'CreatedAt',
                            Value: new Date().toISOString()
                        },
                        {
                            Key: 'BatchId',
                            Value: timestamp.toString()
                        }
                    ],
                    Capabilities: ['CAPABILITY_IAM', 'CAPABILITY_NAMED_IAM'],
                    OnFailure: 'ROLLBACK'
                });

                const response = await cloudFormationClient.send(createStackCommand);

                if (response.StackId) {
                    const createdAt = new Date();

                    deployedStacks.push({
                        stackName,
                        stackId: response.StackId,
                        uniqueId: accessCode,
                        status: 'CREATE_IN_PROGRESS',
                        createdAt
                    });

                    // Create DynamoDB record for the deployed stack
                    try {
                        const stackRecord: StackRecord = {
                            guid: accessCode,
                            stackArn: response.StackId,
                            stackName,
                            stackId: response.StackId,
                            status: 'CREATE_IN_PROGRESS',
                            createdAt: createdAt.toISOString(),
                            updatedAt: new Date().toISOString()
                        };

                        await putStackRecord(stackRecord);
                        console.log(`Created DynamoDB record for stack ${stackName} with Access Code ${accessCode}`);
                    } catch (dynamoError) {
                        console.error(`Failed to create DynamoDB record for stack ${stackName}:`, dynamoError);
                        // Don't fail the deployment if DynamoDB write fails, but log it
                        // The sync process will eventually pick this up
                    }

                    successfulDeployments++;
                    console.log(`Successfully initiated deployment of stack ${stackName} with Access Code ${accessCode}`);
                } else {
                    throw new Error('No stack ID returned from CloudFormation');
                }
            } catch (error) {
                failedDeployments++;
                console.error(`Failed to deploy stack ${stackName}:`, error);

                // Add failed stack to results
                deployedStacks.push({
                    stackName,
                    stackId: '',
                    uniqueId: accessCode,
                    status: 'CREATE_FAILED',
                    createdAt: new Date()
                });

                // Ensure Access Code remains available in DynamoDB for failed deployments
                try {
                    await updateStackRecord(accessCode, {
                        status: 'AVAILABLE',
                        stackArn: undefined,
                        stackName: undefined,
                        stackId: undefined,
                        createdAt: undefined
                    });
                    console.log(`Reset Access Code ${accessCode} to AVAILABLE status after deployment failure`);
                } catch (dynamoError) {
                    console.error(`Failed to reset Access Code ${accessCode} in DynamoDB after deployment failure:`, dynamoError);
                }

                // If too many deployments fail, stop the process
                if (failedDeployments > stackCount / 2) {
                    console.error(`Too many deployment failures: ${failedDeployments}/${i + 1}`);
                    throw new LambdaError(
                        `Deployment batch failed. ${failedDeployments} out of ${i + 1} stacks failed to deploy.`,
                        500,
                        'DEPLOYMENT_BATCH_FAILED',
                        {
                            successful: successfulDeployments,
                            failed: failedDeployments,
                            total: stackCount,
                            lastError: error instanceof Error ? error.message : String(error)
                        }
                    );
                }
            }
        }

        console.log(`Deployment completed: ${successfulDeployments} successful, ${failedDeployments} failed`);

        // If some deployments failed but not too many, still return success with details
        if (failedDeployments > 0) {
            console.warn(`Partial deployment success: ${failedDeployments} out of ${stackCount} stacks failed`);
        }

        // Manage EventBridge rule state after deployment
        if (successfulDeployments > 0) {
            try {
                console.log('Managing EventBridge rule state after stack deployment...');
                await EventBridgeManager.manageRuleBasedOnStackCount();
            } catch (error) {
                console.error('EventBridge rule management failed after deployment:', error);
                // Don't fail the deployment if rule management fails
            }
        }

        return {
            deployedStacks,
            assignedAccessCodes
        };
    } catch (error) {
        console.error('Error deploying stacks:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleCloudFormationError(error, 'stack deployment');
    }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };

    // Initialize configuration and clients on cold start
    try {
        initializeClients();
    } catch (error) {
        console.error('Failed to initialize configuration:', error);
        return createErrorResponse(
            new LambdaError(
                'Configuration error. Please contact your administrator.',
                500,
                'CONFIGURATION_ERROR',
                { error: error instanceof Error ? error.message : String(error) }
            ),
            headers
        );
    }

    // Log request for debugging
    console.log('Stack Deployer request:', {
        httpMethod: event.httpMethod,
        path: event.path,
        headers: event.headers,
        bodyLength: event.body?.length || 0
    });

    try {
        const { httpMethod, body } = event;

        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: ''
            };
        }

        // Validate HTTP method
        if (httpMethod !== 'POST') {
            throw new LambdaError(
                `Method ${httpMethod} not allowed. Only POST requests are supported.`,
                405,
                'METHOD_NOT_ALLOWED'
            );
        }

        // Validate request body
        if (!body) {
            throw new LambdaError(
                'Request body is required.',
                400,
                'MISSING_REQUEST_BODY'
            );
        }

        let requestData: DeploymentRequest;
        try {
            requestData = JSON.parse(body);
        } catch (error) {
            throw new LambdaError(
                'Invalid JSON in request body.',
                400,
                'INVALID_JSON',
                { error: error instanceof Error ? error.message : String(error) }
            );
        }

        // Validate request data structure
        if (!requestData || typeof requestData !== 'object') {
            throw new LambdaError(
                'Request body must be a JSON object.',
                400,
                'INVALID_REQUEST_FORMAT'
            );
        }

        const { stackCount, selectedAccessCodes, templateParameters } = requestData;

        // Validate and deploy stacks
        const response = await deployStacks(stackCount, selectedAccessCodes, templateParameters);

        console.log('Stack Deployer response:', {
            deployedCount: response.deployedStacks.length,
            assignedAccessCodesCount: response.assignedAccessCodes.length,
            successfulStacks: response.deployedStacks.filter(s => s.status === 'CREATE_IN_PROGRESS').length,
            failedStacks: response.deployedStacks.filter(s => s.status === 'CREATE_FAILED').length
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('Lambda execution error:', error);

        if (error instanceof LambdaError) {
            return createErrorResponse(error, headers);
        }

        // Handle unexpected errors
        const unexpectedError = new LambdaError(
            'An unexpected error occurred while processing your deployment request.',
            500,
            'INTERNAL_ERROR',
            { originalError: error instanceof Error ? error.message : String(error) }
        );

        return createErrorResponse(unexpectedError, headers);
    }
};