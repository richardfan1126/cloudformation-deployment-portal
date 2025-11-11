import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    CloudFormationClient,
    DeleteStackCommand
} from '@aws-sdk/client-cloudformation';
import {
    getStackRecord,
    updateStackRecord,
    getAllStackRecords,
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

    if (error.name === 'ValidationException') {
        return new LambdaError(
            'Stack not found or invalid stack name.',
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
            'Insufficient permissions to delete CloudFormation stacks. Please contact your administrator.',
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

interface StackDeletionResponse {
    success: boolean;
    deletionStatus: string;
    message: string;
}

interface DeletionStatusResponse {
    status: string;
    progress: string;
    isComplete: boolean;
}

interface BulkDeletionResponse {
    success: boolean;
    deletionStatuses: { [accessCode: string]: string };
    message: string;
}

interface BulkDeletionStatusResponse {
    deletionStatuses: {
        [accessCode: string]: {
            status: string;
            progress: string;
            isComplete: boolean
        }
    };
}

const cloudFormationClient = new CloudFormationClient({
    region: process.env.REGION || 'ap-east-1'
});

// Validation functions are now imported from shared utils

/**
 * Find stack by Access Code from DynamoDB
 */
async function findStackByAccessCode(accessCode: string): Promise<{
    stackName: string;
    stackId: string;
    uniqueId: string;
    status: string;
    createdAt: Date;
} | null> {
    try {
        const isValid = await validateAccessCode(accessCode);
        if (!isValid) {
            throw new LambdaError(
                'Invalid Access Code format or Access Code not in pool.',
                400,
                'INVALID_ACCESS_CODE',
                { accessCode }
            );
        }

        // Get stack record from DynamoDB
        const stackRecord = await getStackRecord(accessCode);

        if (!stackRecord || stackRecord.status === 'AVAILABLE' || !stackRecord.stackArn) {
            console.log(`No active stack found for Access Code ${accessCode} in DynamoDB`);
            return null;
        }

        console.log(`Found stack for Access Code ${accessCode} in DynamoDB: ${stackRecord.stackName}`);
        return {
            stackName: stackRecord.stackName!,
            stackId: stackRecord.stackId!,
            uniqueId: stackRecord.guid,
            status: stackRecord.status,
            createdAt: stackRecord.createdAt ? new Date(stackRecord.createdAt) : new Date()
        };
    } catch (error) {
        console.error('Error finding stack by Access Code in DynamoDB:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleDynamoDBError(error, 'stack search');
    }
}

/**
 * Delete CloudFormation stack by Access Code
 */
async function deleteStackByAccessCode(accessCode: string): Promise<StackDeletionResponse> {
    try {
        console.log(`Starting deletion process for Access Code: ${accessCode}`);

        // Find the stack
        const stack = await findStackByAccessCode(accessCode);

        if (!stack) {
            throw new LambdaError(
                `No stack found with Access Code ${accessCode}. The stack may have already been deleted or the Access Code is invalid.`,
                404,
                'STACK_NOT_FOUND',
                { accessCode }
            );
        }

        // Check if stack is in a deletable state
        if (stack.status === 'DELETE_IN_PROGRESS') {
            return {
                success: false,
                deletionStatus: 'DELETE_IN_PROGRESS',
                message: `Stack ${stack.stackName} is already being deleted. Please wait for the current deletion to complete.`
            };
        }

        // Prevent deletion of stacks that are currently in progress
        const inProgressStates = [
            'CREATE_IN_PROGRESS',
            'ROLLBACK_IN_PROGRESS',
            'UPDATE_IN_PROGRESS',
            'UPDATE_ROLLBACK_IN_PROGRESS',
            'REVIEW_IN_PROGRESS'
        ];

        if (inProgressStates.includes(stack.status)) {
            throw new LambdaError(
                `Cannot delete stack ${stack.stackName} while it is in ${stack.status} state. Please wait for the current operation to complete.`,
                409,
                'STACK_OPERATION_IN_PROGRESS',
                { stackName: stack.stackName, status: stack.status }
            );
        }

        // Initiate stack deletion
        const deleteCommand = new DeleteStackCommand({
            StackName: stack.stackName
        });

        await cloudFormationClient.send(deleteCommand);

        // Update DynamoDB record to reflect deletion in progress
        try {
            await updateStackRecord(accessCode, {
                status: 'DELETE_IN_PROGRESS'
            });
            console.log(`Updated DynamoDB record for Access Code ${accessCode} to DELETE_IN_PROGRESS status`);
        } catch (dynamoError) {
            console.error(`Failed to update DynamoDB record for Access Code ${accessCode}:`, dynamoError);
            // Don't fail the deletion if DynamoDB update fails, but log it
            // The sync process will eventually pick this up
        }

        console.log(`Successfully initiated deletion of stack ${stack.stackName} for Access Code ${accessCode}`);

        return {
            success: true,
            deletionStatus: 'DELETE_IN_PROGRESS',
            message: `Stack deletion initiated successfully. Stack ${stack.stackName} is now being deleted.`
        };

    } catch (error) {
        console.error('Error deleting stack:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleCloudFormationError(error, 'stack deletion');
    }
}

/**
 * Get all active stacks from DynamoDB
 */
async function getAllActiveStacks(): Promise<Array<{
    stackName: string;
    stackId: string;
    uniqueId: string;
    status: string;
    createdAt: Date;
}>> {
    try {
        // Get all stack records from DynamoDB
        const allRecords = await getAllStackRecords();

        // Filter for non-AVAILABLE records (active stacks)
        const activeStacks = allRecords
            .filter(record => record.status !== 'AVAILABLE' && record.stackArn)
            .map(record => ({
                stackName: record.stackName!,
                stackId: record.stackId!,
                uniqueId: record.guid,
                status: record.status,
                createdAt: record.createdAt ? new Date(record.createdAt) : new Date()
            }));

        console.log(`Found ${activeStacks.length} active stacks in DynamoDB`);

        return activeStacks;
    } catch (error) {
        console.error('Error getting all active stacks from DynamoDB:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleDynamoDBError(error, 'active stacks retrieval');
    }
}

/**
 * Delete all active CloudFormation stacks
 */
async function deleteAllStacks(): Promise<BulkDeletionResponse> {
    try {
        console.log('Starting bulk deletion process for all active stacks');

        // Get all active stacks
        const activeStacks = await getAllActiveStacks();

        if (activeStacks.length === 0) {
            return {
                success: true,
                deletionStatuses: {},
                message: 'No active stacks found to delete.'
            };
        }

        console.log(`Found ${activeStacks.length} active stacks to delete`);

        const deletionStatuses: { [accessCode: string]: string } = {};
        const deletionPromises: Promise<void>[] = [];

        // Initiate deletion for all stacks simultaneously
        for (const stack of activeStacks) {
            const deletionPromise = (async () => {
                try {
                    // Check if stack is in a deletable state
                    if (stack.status === 'DELETE_IN_PROGRESS') {
                        deletionStatuses[stack.uniqueId] = 'ALREADY_DELETING';
                        console.log(`Stack ${stack.stackName} is already being deleted`);
                        return;
                    }

                    // Prevent deletion of stacks that are currently in progress
                    const inProgressStates = [
                        'CREATE_IN_PROGRESS',
                        'ROLLBACK_IN_PROGRESS',
                        'UPDATE_IN_PROGRESS',
                        'UPDATE_ROLLBACK_IN_PROGRESS',
                        'REVIEW_IN_PROGRESS'
                    ];

                    if (inProgressStates.includes(stack.status)) {
                        deletionStatuses[stack.uniqueId] = 'OPERATION_IN_PROGRESS';
                        console.log(`Cannot delete stack ${stack.stackName} - operation in progress: ${stack.status}`);
                        return;
                    }

                    // Initiate stack deletion
                    const deleteCommand = new DeleteStackCommand({
                        StackName: stack.stackName
                    });

                    await cloudFormationClient.send(deleteCommand);
                    deletionStatuses[stack.uniqueId] = 'DELETE_INITIATED';
                    console.log(`Successfully initiated deletion of stack ${stack.stackName}`);

                    // Update DynamoDB record to reflect deletion in progress
                    try {
                        await updateStackRecord(stack.uniqueId, {
                            status: 'DELETE_IN_PROGRESS'
                        });
                        console.log(`Updated DynamoDB record for Access Code ${stack.uniqueId} to DELETE_IN_PROGRESS status`);
                    } catch (dynamoError) {
                        console.error(`Failed to update DynamoDB record for Access Code ${stack.uniqueId}:`, dynamoError);
                        // Don't fail the deletion if DynamoDB update fails, but log it
                    }

                } catch (error) {
                    console.error(`Failed to delete stack ${stack.stackName}:`, error);
                    deletionStatuses[stack.uniqueId] = 'DELETE_FAILED';
                }
            })();

            deletionPromises.push(deletionPromise);
        }

        // Wait for all deletion attempts to complete
        await Promise.all(deletionPromises);

        const successfulDeletions = Object.values(deletionStatuses).filter(
            status => status === 'DELETE_INITIATED'
        ).length;

        const alreadyDeleting = Object.values(deletionStatuses).filter(
            status => status === 'ALREADY_DELETING'
        ).length;

        const inProgress = Object.values(deletionStatuses).filter(
            status => status === 'OPERATION_IN_PROGRESS'
        ).length;

        const failed = Object.values(deletionStatuses).filter(
            status => status === 'DELETE_FAILED'
        ).length;

        let message = `Bulk deletion completed. `;
        if (successfulDeletions > 0) {
            message += `${successfulDeletions} stack(s) deletion initiated. `;
        }
        if (alreadyDeleting > 0) {
            message += `${alreadyDeleting} stack(s) already being deleted. `;
        }
        if (inProgress > 0) {
            message += `${inProgress} stack(s) skipped due to operations in progress. `;
        }
        if (failed > 0) {
            message += `${failed} stack(s) failed to delete.`;
        }

        console.log('Bulk deletion summary:', {
            total: activeStacks.length,
            successful: successfulDeletions,
            alreadyDeleting,
            inProgress,
            failed
        });

        return {
            success: true,
            deletionStatuses,
            message: message.trim()
        };

    } catch (error) {
        console.error('Error in bulk deletion:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleCloudFormationError(error, 'bulk stack deletion');
    }
}

/**
 * Get deletion status for all stacks
 */
async function getAllDeletionStatus(): Promise<BulkDeletionStatusResponse> {
    try {
        console.log('Getting deletion status for all stacks');

        const activeStacks = await getAllActiveStacks();
        const deletionStatuses: {
            [accessCode: string]: {
                status: string;
                progress: string;
                isComplete: boolean
            }
        } = {};

        // Get status for each active stack
        for (const stack of activeStacks) {
            const status = stack.status;
            let progress = '';
            let isComplete = false;

            switch (status) {
                case 'DELETE_IN_PROGRESS':
                    progress = 'Stack deletion is in progress. Resources are being removed.';
                    isComplete = false;
                    break;
                case 'DELETE_COMPLETE':
                    progress = 'Stack has been successfully deleted and Access Code is now available for reuse.';
                    isComplete = true;
                    break;
                case 'DELETE_FAILED':
                    progress = 'Stack deletion failed. Manual intervention may be required.';
                    isComplete = true;
                    break;
                case 'CREATE_IN_PROGRESS':
                    progress = 'Stack is still being created.';
                    isComplete = false;
                    break;
                case 'CREATE_COMPLETE':
                case 'UPDATE_COMPLETE':
                    progress = 'Stack is active.';
                    isComplete = false;
                    break;
                case 'CREATE_FAILED':
                case 'ROLLBACK_COMPLETE':
                case 'ROLLBACK_FAILED':
                case 'UPDATE_FAILED':
                case 'UPDATE_ROLLBACK_COMPLETE':
                case 'UPDATE_ROLLBACK_FAILED':
                    progress = `Stack is in error state (${status}).`;
                    isComplete = false;
                    break;
                case 'ROLLBACK_IN_PROGRESS':
                case 'UPDATE_IN_PROGRESS':
                case 'UPDATE_ROLLBACK_IN_PROGRESS':
                    progress = `Stack operation is in progress (${status}).`;
                    isComplete = false;
                    break;
                case 'REVIEW_IN_PROGRESS':
                    progress = 'Stack is under review.';
                    isComplete = false;
                    break;
                default:
                    progress = `Stack is in ${status} state.`;
                    isComplete = false;
            }

            deletionStatuses[stack.uniqueId] = {
                status,
                progress,
                isComplete
            };
        }

        return {
            deletionStatuses
        };

    } catch (error) {
        console.error('Error getting all deletion status:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleCloudFormationError(error, 'bulk deletion status check');
    }
}

/**
 * Get deletion status for a stack by Access Code
 */
async function getDeletionStatus(accessCode: string): Promise<DeletionStatusResponse> {
    try {
        console.log(`Checking deletion status for Access Code: ${accessCode}`);

        const stack = await findStackByAccessCode(accessCode);

        if (!stack) {
            // Stack not found could mean it was successfully deleted
            return {
                status: 'DELETE_COMPLETE',
                progress: 'Stack has been successfully deleted and Access Code is now available for reuse.',
                isComplete: true
            };
        }

        const status = stack.status;
        let progress = '';
        let isComplete = false;

        switch (status) {
            case 'DELETE_IN_PROGRESS':
                progress = 'Stack deletion is in progress. Resources are being removed.';
                isComplete = false;
                break;
            case 'DELETE_COMPLETE':
                progress = 'Stack has been successfully deleted and Access Code is now available for reuse.';
                isComplete = true;
                break;
            case 'DELETE_FAILED':
                progress = 'Stack deletion failed. Manual intervention may be required. The stack still exists and the Access Code remains linked.';
                isComplete = true;
                break;
            case 'CREATE_IN_PROGRESS':
                progress = 'Stack is still being created. Deletion cannot proceed until creation completes.';
                isComplete = false;
                break;
            case 'CREATE_COMPLETE':
            case 'UPDATE_COMPLETE':
                progress = 'Stack is active and ready for deletion if needed.';
                isComplete = false;
                break;
            case 'CREATE_FAILED':
            case 'ROLLBACK_COMPLETE':
            case 'ROLLBACK_FAILED':
            case 'UPDATE_FAILED':
            case 'UPDATE_ROLLBACK_COMPLETE':
            case 'UPDATE_ROLLBACK_FAILED':
                progress = `Stack is in error state (${status}). The stack still exists and may require manual cleanup.`;
                isComplete = false;
                break;
            case 'ROLLBACK_IN_PROGRESS':
            case 'UPDATE_IN_PROGRESS':
            case 'UPDATE_ROLLBACK_IN_PROGRESS':
                progress = `Stack operation is in progress (${status}). Please wait for the operation to complete before attempting deletion.`;
                isComplete = false;
                break;
            case 'REVIEW_IN_PROGRESS':
                progress = 'Stack is under review. Please complete the review process before attempting deletion.';
                isComplete = false;
                break;
            default:
                progress = `Stack is in ${status} state. Current status may require manual review.`;
                isComplete = false;
        }

        return {
            status,
            progress,
            isComplete
        };

    } catch (error) {
        console.error('Error getting deletion status:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleCloudFormationError(error, 'deletion status check');
    }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent',
        'Access-Control-Allow-Methods': 'DELETE,GET,OPTIONS',
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
    console.log('Stack Deleter request:', {
        httpMethod: event.httpMethod,
        path: event.path,
        pathParameters: event.pathParameters,
        headers: event.headers
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

        // Check if this is a bulk operation (path ends with /all or /deletion-status)
        const isBulkDeleteAll = event.path?.endsWith('/stacks/all');
        const isBulkStatus = event.path?.endsWith('/stacks/deletion-status');

        if (isBulkDeleteAll) {
            // Handle bulk deletion
            if (httpMethod === 'DELETE') {
                const response = await deleteAllStacks();

                console.log('Bulk Stack Deletion response:', {
                    success: response.success,
                    stackCount: Object.keys(response.deletionStatuses).length
                });

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(response)
                };
            } else {
                throw new LambdaError(
                    `Method ${httpMethod} not allowed for bulk deletion. Only DELETE requests are supported.`,
                    405,
                    'METHOD_NOT_ALLOWED'
                );
            }
        }

        if (isBulkStatus) {
            // Handle bulk status check
            if (httpMethod === 'GET') {
                const response = await getAllDeletionStatus();

                console.log('Bulk Deletion Status response:', {
                    stackCount: Object.keys(response.deletionStatuses).length
                });

                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(response)
                };
            } else {
                throw new LambdaError(
                    `Method ${httpMethod} not allowed for bulk status. Only GET requests are supported.`,
                    405,
                    'METHOD_NOT_ALLOWED'
                );
            }
        }

        // Handle individual stack operations
        // Extract Access Code from path parameters
        const accessCode = pathParameters?.accessCode;
        if (!accessCode) {
            throw new LambdaError(
                'Access Code parameter is required in the URL path.',
                400,
                'MISSING_ACCESS_CODE_PARAMETER'
            );
        }

        // Handle different HTTP methods for individual stacks
        if (httpMethod === 'DELETE') {
            // Delete stack
            const response = await deleteStackByAccessCode(accessCode);

            console.log('Stack Deleter response:', {
                accessCode,
                success: response.success,
                status: response.deletionStatus
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(response)
            };

        } else if (httpMethod === 'GET') {
            // Get deletion status
            const response = await getDeletionStatus(accessCode);

            console.log('Deletion Status response:', {
                accessCode,
                status: response.status,
                isComplete: response.isComplete
            });

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(response)
            };

        } else {
            throw new LambdaError(
                `Method ${httpMethod} not allowed. Only DELETE and GET requests are supported.`,
                405,
                'METHOD_NOT_ALLOWED'
            );
        }

    } catch (error) {
        console.error('Lambda execution error:', error);

        if (error instanceof LambdaError) {
            return createErrorResponse(error, headers);
        }

        // Handle unexpected errors
        const unexpectedError = new LambdaError(
            'An unexpected error occurred while processing your request.',
            500,
            'INTERNAL_ERROR',
            { originalError: error instanceof Error ? error.message : String(error) }
        );

        return createErrorResponse(unexpectedError, headers);
    }
};