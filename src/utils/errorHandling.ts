// Error handling utilities for the CloudFormation Deployment Portal

export interface ErrorDetails {
    message: string;
    code?: string;
    statusCode?: number;
    retryable?: boolean;
    userFriendly?: boolean;
}

export interface RetryConfig {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
}

export class AppError extends Error {
    public readonly code?: string;
    public readonly statusCode?: number;
    public readonly retryable: boolean;
    public readonly userFriendly: boolean;
    public readonly originalError?: Error;

    constructor(details: ErrorDetails, originalError?: Error) {
        super(details.message);
        this.name = 'AppError';
        this.code = details.code;
        this.statusCode = details.statusCode;
        this.retryable = details.retryable ?? false;
        this.userFriendly = details.userFriendly ?? true;
        this.originalError = originalError;
    }
}

// Network error types
export const NetworkErrorTypes = {
    TIMEOUT: 'NETWORK_TIMEOUT',
    CONNECTION_FAILED: 'CONNECTION_FAILED',
    SERVER_ERROR: 'SERVER_ERROR',
    RATE_LIMITED: 'RATE_LIMITED',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
} as const;

// Validation error types
export const ValidationErrorTypes = {
    REQUIRED_FIELD: 'REQUIRED_FIELD',
    INVALID_FORMAT: 'INVALID_FORMAT',
    OUT_OF_RANGE: 'OUT_OF_RANGE',
    INVALID_GUID: 'INVALID_GUID',
    GUID_NOT_IN_POOL: 'GUID_NOT_IN_POOL'
} as const;

// API error types
export const ApiErrorTypes = {
    CONFIG_MISSING: 'API_CONFIG_MISSING',
    GUID_POOL_EXHAUSTED: 'GUID_POOL_EXHAUSTED',
    CLOUDFORMATION_ERROR: 'CLOUDFORMATION_ERROR',
    STACK_NOT_FOUND: 'STACK_NOT_FOUND',
    DEPLOYMENT_FAILED: 'DEPLOYMENT_FAILED'
} as const;

/**
 * Parse and categorize errors from API responses
 */
export function parseApiError(error: any): AppError {
    // Handle fetch errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return new AppError({
            message: 'Unable to connect to the server. Please check your internet connection and try again.',
            code: NetworkErrorTypes.CONNECTION_FAILED,
            retryable: true,
            userFriendly: true
        }, error);
    }

    // Handle timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return new AppError({
            message: 'The request timed out. Please try again.',
            code: NetworkErrorTypes.TIMEOUT,
            retryable: true,
            userFriendly: true
        }, error);
    }

    // Handle HTTP status codes
    if (error.message.includes('HTTP')) {
        const statusMatch = error.message.match(/HTTP (\d+)/);
        const statusCode = statusMatch ? parseInt(statusMatch[1]) : 500;

        switch (statusCode) {
            case 400:
                return new AppError({
                    message: 'Invalid request. Please check your input and try again.',
                    code: ValidationErrorTypes.INVALID_FORMAT,
                    statusCode,
                    retryable: false,
                    userFriendly: true
                }, error);

            case 401:
                return new AppError({
                    message: 'Authentication required. Please log in and try again.',
                    code: NetworkErrorTypes.UNAUTHORIZED,
                    statusCode,
                    retryable: false,
                    userFriendly: true
                }, error);

            case 403:
                return new AppError({
                    message: 'Access denied. You do not have permission to perform this action.',
                    code: NetworkErrorTypes.FORBIDDEN,
                    statusCode,
                    retryable: false,
                    userFriendly: true
                }, error);

            case 404:
                return new AppError({
                    message: 'The requested resource was not found.',
                    code: NetworkErrorTypes.NOT_FOUND,
                    statusCode,
                    retryable: false,
                    userFriendly: true
                }, error);

            case 409:
                if (error.message.includes('GUID') || error.message.includes('Access Code')) {
                    return new AppError({
                        message: 'No available Access Codes remaining. Please wait for existing stacks to be deleted or contact your administrator.',
                        code: ApiErrorTypes.GUID_POOL_EXHAUSTED,
                        statusCode,
                        retryable: false,
                        userFriendly: true
                    }, error);
                }
                return new AppError({
                    message: 'Resource conflict. Please refresh and try again.',
                    code: NetworkErrorTypes.CONFLICT,
                    statusCode,
                    retryable: true,
                    userFriendly: true
                }, error);

            case 429:
                return new AppError({
                    message: 'Too many requests. Please wait a moment and try again.',
                    code: NetworkErrorTypes.RATE_LIMITED,
                    statusCode,
                    retryable: true,
                    userFriendly: true
                }, error);

            case 500:
            case 502:
            case 503:
            case 504:
                return new AppError({
                    message: 'Server error. Please try again in a few moments.',
                    code: NetworkErrorTypes.SERVER_ERROR,
                    statusCode,
                    retryable: true,
                    userFriendly: true
                }, error);

            default:
                return new AppError({
                    message: `Unexpected server response (${statusCode}). Please try again.`,
                    code: NetworkErrorTypes.SERVER_ERROR,
                    statusCode,
                    retryable: true,
                    userFriendly: true
                }, error);
        }
    }

    // Handle specific API error messages
    if (error.message.includes('not configured')) {
        return new AppError({
            message: 'API configuration is missing. Please ensure the backend is deployed and configured.',
            code: ApiErrorTypes.CONFIG_MISSING,
            retryable: false,
            userFriendly: true
        }, error);
    }

    if (error.message.includes('not found') || error.message.includes('404')) {
        return new AppError({
            message: 'The requested stack was not found.',
            code: ApiErrorTypes.STACK_NOT_FOUND,
            retryable: false,
            userFriendly: true
        }, error);
    }

    if (error.message.includes('CloudFormation')) {
        return new AppError({
            message: 'CloudFormation service error. Please try again or contact your administrator.',
            code: ApiErrorTypes.CLOUDFORMATION_ERROR,
            retryable: true,
            userFriendly: true
        }, error);
    }

    // Default error handling
    return new AppError({
        message: error.message || 'An unexpected error occurred. Please try again.',
        code: 'UNKNOWN_ERROR',
        retryable: true,
        userFriendly: true
    }, error);
}

/**
 * Validation utilities
 */
export const ValidationUtils = {
    validateStackCount: (count: number, maxAvailable: number): AppError | null => {
        if (!Number.isInteger(count)) {
            return new AppError({
                message: 'Stack count must be a whole number.',
                code: ValidationErrorTypes.INVALID_FORMAT,
                retryable: false,
                userFriendly: true
            });
        }

        if (count <= 0) {
            return new AppError({
                message: 'Stack count must be greater than 0.',
                code: ValidationErrorTypes.OUT_OF_RANGE,
                retryable: false,
                userFriendly: true
            });
        }

        if (count > 60) {
            return new AppError({
                message: 'Cannot deploy more than 60 stacks (maximum Access Code pool size).',
                code: ValidationErrorTypes.OUT_OF_RANGE,
                retryable: false,
                userFriendly: true
            });
        }

        if (count > maxAvailable) {
            return new AppError({
                message: `Cannot deploy ${count} stacks. Only ${maxAvailable} Access Codes are available.`,
                code: ApiErrorTypes.GUID_POOL_EXHAUSTED,
                retryable: false,
                userFriendly: true
            });
        }

        return null;
    },

    validateAccessCodeFormat: (accessCode: string): AppError | null => {
        if (!accessCode || accessCode.trim() === '') {
            return new AppError({
                message: 'Access Code is required.',
                code: ValidationErrorTypes.REQUIRED_FIELD,
                retryable: false,
                userFriendly: true
            });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(accessCode)) {
            return new AppError({
                message: 'Please enter a valid Access Code format (e.g., xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).',
                code: ValidationErrorTypes.INVALID_GUID,
                retryable: false,
                userFriendly: true
            });
        }

        return null;
    },

    // Legacy alias for backward compatibility
    validateGuidFormat: (guid: string): AppError | null => {
        return ValidationUtils.validateAccessCodeFormat(guid);
    },

    validateCredentials: (username: string, password: string): AppError | null => {
        if (!username || username.trim() === '') {
            return new AppError({
                message: 'Username is required.',
                code: ValidationErrorTypes.REQUIRED_FIELD,
                retryable: false,
                userFriendly: true
            });
        }

        if (!password || password.trim() === '') {
            return new AppError({
                message: 'Password is required.',
                code: ValidationErrorTypes.REQUIRED_FIELD,
                retryable: false,
                userFriendly: true
            });
        }

        return null;
    }
};

/**
 * Retry mechanism with exponential backoff
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        backoffMultiplier = 2
    } = config;

    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error as Error;

            // Don't retry if it's not a retryable error
            if (error instanceof AppError && !error.retryable) {
                throw error;
            }

            // Don't retry on the last attempt
            if (attempt === maxAttempts) {
                break;
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                baseDelay * Math.pow(backoffMultiplier, attempt - 1),
                maxDelay
            );

            console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError!;
}

/**
 * Create a timeout wrapper for promises
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(new AppError({
                    message: `Operation timed out after ${timeoutMs}ms`,
                    code: NetworkErrorTypes.TIMEOUT,
                    retryable: true,
                    userFriendly: true
                }));
            }, timeoutMs);
        })
    ]);
}

/**
 * Format error messages for display
 */
export function formatErrorForDisplay(error: any): string {
    if (error instanceof AppError) {
        return error.message;
    }

    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'An unexpected error occurred. Please try again.';
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: any): boolean {
    if (error instanceof AppError) {
        return error.retryable;
    }

    // Network errors are generally retryable
    if (error instanceof TypeError && error.message.includes('fetch')) {
        return true;
    }

    // Timeout errors are retryable
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
        return true;
    }

    return false;
}