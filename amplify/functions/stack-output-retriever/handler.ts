import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    CloudFormationClient,
    DescribeStacksCommand
} from '@aws-sdk/client-cloudformation';
import {
    getStackRecord,
    validateAccessCode
} from '../shared/access-code-utils';

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

    if (error.name === 'StackNotFoundException' || error.name === 'ValidationException') {
        return new LambdaError(
            'Stack not found.',
            404,
            'STACK_NOT_FOUND',
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
            'Insufficient permissions to access CloudFormation. Please contact your administrator.',
            403,
            'CLOUDFORMATION_ACCESS_DENIED',
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
function validateAccessCodeFormat(accessCode: string): void {
    if (!accessCode || typeof accessCode !== 'string') {
        throw new LambdaError(
            'Access Code parameter is required.',
            400,
            'MISSING_ACCESS_CODE'
        );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(accessCode)) {
        throw new LambdaError(
            'Invalid Access Code format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
            400,
            'INVALID_ACCESS_CODE_FORMAT',
            { provided: accessCode }
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

interface StackOutput {
    outputKey: string;
    outputValue: string;
    description?: string;
}

interface StackOutputResponse {
    outputs: StackOutput[];
    lastUpdated?: string;
}

const cloudFormationClient = new CloudFormationClient({
    region: process.env.REGION || 'ap-east-1'  // CloudFormation stacks are deployed in ap-east-1 region
});

// Validation functions are now imported from shared utils

/**
 * Find stack by Access Code from DynamoDB with cached outputs
 * Always performs the same lookup regardless of Access Code validity
 * to prevent information leakage about valid Access Codes
 */
async function findStackByAccessCode(accessCode: string): Promise<{
    stackName: string;
    stackId: string;
    uniqueId: string;
    status: string;
    outputs?: Array<{
        outputKey: string;
        outputValue: string;
        description?: string;
    }>;
    lastUpdated?: string;
} | null> {
    try {
        // Always perform DynamoDB lookup regardless of pool membership
        // This prevents timing attacks and information leakage

        // Get stack record from DynamoDB
        const stackRecord = await getStackRecord(accessCode);

        // Validate Access Code and check if it has an active stack
        const isValid = await validateAccessCode(accessCode);
        if (stackRecord && isValid && stackRecord.status !== 'AVAILABLE' && stackRecord.stackArn) {
            console.log(`Found valid stack ${stackRecord.stackName} for Access Code ${accessCode} in DynamoDB`);
            return {
                stackName: stackRecord.stackName!,
                stackId: stackRecord.stackId!,
                uniqueId: stackRecord.guid,
                status: stackRecord.status,
                outputs: stackRecord.outputs,
                lastUpdated: stackRecord.lastSyncAt || stackRecord.updatedAt
            };
        }

        console.log(`No valid stack found for Access Code ${accessCode} in DynamoDB`);
        return null;
    } catch (error) {
        console.error('Error finding stack by Access Code in DynamoDB:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleDynamoDBError(error, 'stack search');
    }
}

/**
 * Get CloudFormation stack outputs by Access Code
 */
async function getStackOutputs(accessCode: string): Promise<StackOutputResponse> {
    try {
        // Only validate format - don't reveal pool membership
        validateAccessCodeFormat(accessCode);

        // Get stack from DynamoDB with cached outputs
        const stack = await findStackByAccessCode(accessCode);
        if (!stack) {
            // Always return the same error message regardless of whether the Access Code
            // is invalid format, not in pool, or simply not found
            throw new LambdaError(
                'No stack found with the specified Access Code.',
                404,
                'STACK_NOT_FOUND'
            );
        }

        console.log(`Getting outputs for stack ${stack.stackName} (${stack.status})`);

        // Check if stack is in a valid state to have outputs
        const validOutputStates = ['CREATE_COMPLETE', 'UPDATE_COMPLETE'];
        const errorStates = ['CREATE_FAILED', 'ROLLBACK_COMPLETE', 'ROLLBACK_FAILED', 'UPDATE_FAILED', 'UPDATE_ROLLBACK_COMPLETE', 'UPDATE_ROLLBACK_FAILED', 'DELETE_FAILED'];

        if (!validOutputStates.includes(stack.status)) {
            if (errorStates.includes(stack.status)) {
                throw new LambdaError(
                    `Stack is in error state: ${stack.status}. Stack outputs are not available for stacks in error states.`,
                    400,
                    'STACK_ERROR_STATE',
                    { stackStatus: stack.status, stackName: stack.stackName }
                );
            } else {
                console.log(`Stack ${stack.stackName} is in status ${stack.status}, returning empty outputs`);
                // Stack exists but is not in a complete state, return empty outputs
                return {
                    outputs: [],
                    lastUpdated: stack.lastUpdated
                };
            }
        }

        // Use cached outputs from DynamoDB if available and recent
        if (stack.outputs && stack.outputs.length > 0) {
            console.log(`Retrieved ${stack.outputs.length} cached outputs for stack ${stack.stackName} from DynamoDB`);
            return {
                outputs: stack.outputs,
                lastUpdated: stack.lastUpdated
            };
        }

        // Fallback to CloudFormation if no cached outputs (for backward compatibility)
        console.log(`No cached outputs found, falling back to CloudFormation for stack ${stack.stackName}`);

        try {
            const describeCommand = new DescribeStacksCommand({
                StackName: stack.stackName
            });

            const stackDetails = await cloudFormationClient.send(describeCommand);

            if (!stackDetails.Stacks || !stackDetails.Stacks[0]) {
                throw new LambdaError(
                    'Stack details not found.',
                    404,
                    'STACK_DETAILS_NOT_FOUND',
                    { stackName: stack.stackName }
                );
            }

            const stackData = stackDetails.Stacks[0];

            // Extract outputs from CloudFormation
            const outputs: StackOutput[] = [];
            if (stackData.Outputs) {
                for (const output of stackData.Outputs) {
                    if (output.OutputKey && output.OutputValue) {
                        outputs.push({
                            outputKey: output.OutputKey,
                            outputValue: output.OutputValue,
                            description: output.Description
                        });
                    }
                }
            }

            console.log(`Retrieved ${outputs.length} outputs for stack ${stack.stackName} from CloudFormation fallback`);

            return {
                outputs,
                lastUpdated: new Date().toISOString()
            };
        } catch (cfError) {
            console.error(`CloudFormation fallback failed for stack ${stack.stackName}:`, cfError);
            // Return empty outputs if CloudFormation fallback fails
            return {
                outputs: [],
                lastUpdated: stack.lastUpdated
            };
        }
    } catch (error) {
        console.error('Error getting stack outputs:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleCloudFormationError(error, 'stack output retrieval');
    }
}

// validateGuidFormat function moved to validation utilities section above

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
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

    // Log request for debugging
    console.log('Stack Output Retriever request:', {
        httpMethod: event.httpMethod,
        path: event.path,
        headers: event.headers,
        queryStringParameters: event.queryStringParameters
    });

    try {
        const { httpMethod, pathParameters } = event;

        // Handle CORS preflight
        if (httpMethod === 'OPTIONS') {
            return {
                statusCode: 200,
                headers,
                body: ''
            };
        }

        // Validate HTTP method
        if (httpMethod !== 'GET') {
            throw new LambdaError(
                `Method ${httpMethod} not allowed. Only GET requests are supported.`,
                405,
                'METHOD_NOT_ALLOWED'
            );
        }

        // Extract Access Code from path parameters
        const accessCode = pathParameters?.accessCode;

        if (!accessCode) {
            throw new LambdaError(
                'Access Code parameter is required in URL path.',
                400,
                'MISSING_ACCESS_CODE_PARAMETER'
            );
        }

        // Get stack outputs
        const result = await getStackOutputs(accessCode);

        console.log('Stack Output Retriever response:', {
            accessCode,
            outputCount: result.outputs.length
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('Lambda execution error:', error);

        if (error instanceof LambdaError) {
            return createErrorResponse(error, headers);
        }

        // Handle unexpected errors
        const unexpectedError = new LambdaError(
            'An unexpected error occurred while retrieving stack outputs.',
            500,
            'INTERNAL_ERROR',
            { originalError: error instanceof Error ? error.message : String(error) }
        );

        return createErrorResponse(unexpectedError, headers);
    }
};