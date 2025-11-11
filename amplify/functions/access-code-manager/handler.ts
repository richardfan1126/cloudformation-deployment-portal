import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
    StackRecord,
    batchGetStackRecords,
    getAccessCodePool
} from '../shared/access-code-utils';
import { loadDeploymentConfig } from '../shared/config-loader';

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
function handleDynamoDBError(error: any): LambdaError {
    console.error('DynamoDB error:', error);

    if (error.name === 'ThrottlingException' || error.name === 'ProvisionedThroughputExceededException') {
        return new LambdaError(
            'Database is temporarily busy. Please try again in a few moments.',
            429,
            'DYNAMODB_THROTTLED',
            { originalError: error.name }
        );
    }

    if (error.name === 'AccessDeniedException' || error.name === 'UnauthorizedOperation') {
        return new LambdaError(
            'Insufficient permissions to access database. Please contact your administrator.',
            403,
            'DYNAMODB_ACCESS_DENIED',
            { originalError: error.name }
        );
    }

    if (error.name === 'ValidationException') {
        return new LambdaError(
            'Invalid database request parameters.',
            400,
            'DYNAMODB_VALIDATION_ERROR',
            { originalError: error.name }
        );
    }

    if (error.name === 'ResourceNotFoundException') {
        return new LambdaError(
            'Database table not found. Please contact your administrator.',
            404,
            'DYNAMODB_TABLE_NOT_FOUND',
            { originalError: error.name }
        );
    }

    if (error.name === 'ServiceUnavailableException') {
        return new LambdaError(
            'Database service is temporarily unavailable. Please try again later.',
            503,
            'DYNAMODB_UNAVAILABLE',
            { originalError: error.name }
        );
    }

    // Network/timeout errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return new LambdaError(
            'Unable to connect to database service. Please try again.',
            503,
            'DYNAMODB_CONNECTION_ERROR',
            { originalError: error.code }
        );
    }

    // Default DynamoDB error
    return new LambdaError(
        'Database service error. Please try again or contact your administrator.',
        500,
        'DYNAMODB_ERROR',
        { originalError: error.name || error.code }
    );
}

/**
 * Access Code status interface for API responses
 */
interface AccessCodeStatus {
    accessCode: string;
    isLinked: boolean;
    stackName?: string;
    stackId?: string;
    createdAt?: Date;
    status?: 'CREATE_IN_PROGRESS' | 'CREATE_COMPLETE' | 'CREATE_FAILED' |
    'ROLLBACK_IN_PROGRESS' | 'ROLLBACK_COMPLETE' | 'ROLLBACK_FAILED' |
    'UPDATE_IN_PROGRESS' | 'UPDATE_COMPLETE' | 'UPDATE_FAILED' |
    'UPDATE_ROLLBACK_IN_PROGRESS' | 'UPDATE_ROLLBACK_COMPLETE' | 'UPDATE_ROLLBACK_FAILED' |
    'DELETE_IN_PROGRESS' | 'DELETE_COMPLETE' | 'DELETE_FAILED' |
    'REVIEW_IN_PROGRESS';
}

/**
 * Access Code status response interface
 */
interface AccessCodeStatusResponse {
    accessCodeStatuses: AccessCodeStatus[];
    totalAvailable: number;
    totalLinked: number;
}

/**
 * Convert StackRecord to AccessCodeStatus for API response
 */
function stackRecordToAccessCodeStatus(record: StackRecord): AccessCodeStatus {
    return {
        accessCode: record.guid,
        isLinked: record.status !== 'AVAILABLE' && !!record.stackArn,
        stackName: record.stackName,
        stackId: record.stackId,
        createdAt: record.createdAt ? new Date(record.createdAt) : undefined,
        status: record.status === 'AVAILABLE' ? undefined : record.status as any
    };
}

/**
 * Get status of all Access Codes from DynamoDB
 */
async function getAllAccessCodeStatuses(): Promise<AccessCodeStatusResponse> {
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

        // Get all stack records from DynamoDB
        const stackRecords = await batchGetStackRecords(accessCodePool);

        // Create a map for quick lookup
        const recordMap = new Map(stackRecords.map(record => [record.guid, record]));

        // Build Access Code statuses for all Access Codes
        const accessCodeStatuses: AccessCodeStatus[] = accessCodePool.map(accessCode => {
            const record = recordMap.get(accessCode);
            if (!record) {
                // If record doesn't exist, treat as AVAILABLE
                return {
                    accessCode: accessCode,
                    isLinked: false
                };
            }
            return stackRecordToAccessCodeStatus(record);
        });

        const totalLinked = accessCodeStatuses.filter(status => status.isLinked).length;
        const totalAvailable = accessCodePool.length - totalLinked;

        console.log(`Access Code status summary from DynamoDB: ${totalAvailable} available, ${totalLinked} linked`);

        return {
            accessCodeStatuses,
            totalAvailable,
            totalLinked
        };
    } catch (error) {
        console.error('Error getting Access Code statuses from DynamoDB:', error);
        if (error instanceof LambdaError) {
            throw error;
        }
        throw handleDynamoDBError(error);
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

    // Log request for debugging
    console.log('Access Code Manager request:', {
        httpMethod: event.httpMethod,
        path: event.path,
        headers: event.headers,
        queryStringParameters: event.queryStringParameters
    });

    try {
        // Load configuration on cold start
        const config = loadDeploymentConfig();
        console.log('Configuration loaded:', {
            stackNamePrefix: config.stackNamePrefix,
            accessCodePoolSize: config.accessCodePoolSize,
            region: config.region
        });

        const { httpMethod } = event;

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

        // This function handles GET requests for Access Code statuses
        const response = await getAllAccessCodeStatuses();

        console.log('Access Code Manager response:', {
            totalAvailable: response.totalAvailable,
            totalLinked: response.totalLinked
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
            'An unexpected error occurred while processing your request.',
            500,
            'INTERNAL_ERROR',
            { originalError: error instanceof Error ? error.message : String(error) }
        );

        return createErrorResponse(unexpectedError, headers);
    }
};
