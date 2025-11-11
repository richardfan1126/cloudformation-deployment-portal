import { fetchAuthSession } from 'aws-amplify/auth';

import { API_ENDPOINTS, ApiEndpoints, getAccessCodeStatusesEndpoint, getDeployStacksEndpoint, getStackOutputsEndpoint, getDeleteStackEndpoint, getDeletionStatusEndpoint, getDeleteAllStacksEndpoint, getAllDeletionStatusEndpoint } from '../config/api';
import { parseApiError, withRetry, AppError } from './errorHandling';

// Types
export interface AccessCodeStatus {
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

export interface AccessCodeStatusResponse {
    accessCodeStatuses: AccessCodeStatus[];
    totalAvailable: number;
    totalLinked: number;
}

export interface DeployedStack {
    stackName: string;
    stackId: string;
    uniqueId: string;
    status: 'CREATE_IN_PROGRESS' | 'CREATE_COMPLETE' | 'CREATE_FAILED' |
    'ROLLBACK_IN_PROGRESS' | 'ROLLBACK_COMPLETE' | 'ROLLBACK_FAILED' |
    'UPDATE_IN_PROGRESS' | 'UPDATE_COMPLETE' | 'UPDATE_FAILED' |
    'UPDATE_ROLLBACK_IN_PROGRESS' | 'UPDATE_ROLLBACK_COMPLETE' | 'UPDATE_ROLLBACK_FAILED' |
    'DELETE_IN_PROGRESS' | 'DELETE_COMPLETE' | 'DELETE_FAILED' |
    'REVIEW_IN_PROGRESS';
    createdAt: Date;
}

export interface DeploymentResponse {
    deployedStacks: DeployedStack[];
    assignedAccessCodes: string[];
}

export interface StackOutput {
    outputKey: string;
    outputValue: string;
    description?: string;
}

export interface StackOutputResponse {
    outputs: StackOutput[];
}

export interface StackDeletionResponse {
    success: boolean;
    deletionStatus: string;
    message: string;
}

export interface DeletionStatusResponse {
    status: string;
    progress: string;
    isComplete: boolean;
}

export interface BulkDeletionResponse {
    success: boolean;
    deletionStatuses: { [accessCode: string]: string };
    message: string;
}

export interface BulkDeletionStatusResponse {
    deletionStatuses: {
        [accessCode: string]: {
            status: string;
            progress: string;
            isComplete: boolean
        }
    };
}

// Helper function to get authenticated headers
const getAuthHeaders = async (): Promise<Record<string, string>> => {
    try {
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        return {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
        };
    } catch (error) {
        console.error('Error getting auth session:', error);
        return {
            'Content-Type': 'application/json',
        };
    }
};

// Helper function for making API requests with comprehensive error handling
const makeRequest = async <T>(
    url: string,
    options: RequestInit = {},
    requireAuth: boolean = false,
    timeoutMs: number = 30000
): Promise<T> => {
    try {
        const headers = requireAuth ? await getAuthHeaders() : {
            'Content-Type': 'application/json',
        };

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const requestOptions: RequestInit = {
            ...options,
            headers: {
                ...headers,
                ...options.headers,
            },
            signal: controller.signal,
        };

        const response = await fetch(url, requestOptions);
        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.error || errorJson.message || errorMessage;
            } catch {
                // If not JSON, use the text as is
                errorMessage = errorText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return response.json();
        }

        return response.text() as T;
    } catch (error) {
        // Parse and enhance the error
        throw parseApiError(error);
    }
};

// API Client class
export class ApiClient {
    private config: ApiEndpoints;

    constructor() {
        this.config = API_ENDPOINTS;
    }

    // Update configuration (useful after Amplify deployment)
    updateConfig(config: Partial<ApiEndpoints>) {
        this.config = { ...this.config, ...config };
    }

    // Admin APIs (require authentication)
    async getAccessCodeStatuses(): Promise<AccessCodeStatusResponse> {
        if (!this.config.apiGatewayUrl) {
            throw new AppError({
                message: 'API Gateway is not configured. Please ensure the backend is deployed.',
                code: 'API_CONFIG_MISSING',
                retryable: false,
                userFriendly: true
            });
        }

        return withRetry(
            () => makeRequest<AccessCodeStatusResponse>(
                getAccessCodeStatusesEndpoint(),
                { method: 'GET' },
                true,
                15000 // 15 second timeout for admin operations
            ),
            { maxAttempts: 2, baseDelay: 1000 }
        );
    }

    async deployStacks(stackCount: number, selectedAccessCodes?: string[]): Promise<DeploymentResponse> {
        if (!this.config.apiGatewayUrl) {
            throw new AppError({
                message: 'API Gateway is not configured. Please ensure the backend is deployed.',
                code: 'API_CONFIG_MISSING',
                retryable: false,
                userFriendly: true
            });
        }

        const requestBody: { stackCount: number; selectedAccessCodes?: string[] } = { stackCount };
        if (selectedAccessCodes && selectedAccessCodes.length > 0) {
            requestBody.selectedAccessCodes = selectedAccessCodes;
        }

        return withRetry(
            () => makeRequest<DeploymentResponse>(
                getDeployStacksEndpoint(),
                {
                    method: 'POST',
                    body: JSON.stringify(requestBody),
                },
                true,
                60000 // 60 second timeout for deployment operations
            ),
            { maxAttempts: 2, baseDelay: 2000 }
        );
    }

    async deleteStack(accessCode: string): Promise<StackDeletionResponse> {
        if (!this.config.apiGatewayUrl) {
            throw new AppError({
                message: 'API Gateway is not configured. Please ensure the backend is deployed.',
                code: 'API_CONFIG_MISSING',
                retryable: false,
                userFriendly: true
            });
        }

        return withRetry(
            () => makeRequest<StackDeletionResponse>(
                getDeleteStackEndpoint(accessCode),
                { method: 'DELETE' },
                true,
                30000 // 30 second timeout for deletion operations
            ),
            { maxAttempts: 2, baseDelay: 1000 }
        );
    }

    async getDeletionStatus(accessCode: string): Promise<DeletionStatusResponse> {
        if (!this.config.apiGatewayUrl) {
            throw new AppError({
                message: 'API Gateway is not configured. Please ensure the backend is deployed.',
                code: 'API_CONFIG_MISSING',
                retryable: false,
                userFriendly: true
            });
        }

        return withRetry(
            () => makeRequest<DeletionStatusResponse>(
                getDeletionStatusEndpoint(accessCode),
                { method: 'GET' },
                true,
                15000 // 15 second timeout for status checks
            ),
            { maxAttempts: 2, baseDelay: 1000 }
        );
    }

    async deleteAllStacks(): Promise<BulkDeletionResponse> {
        if (!this.config.apiGatewayUrl) {
            throw new AppError({
                message: 'API Gateway is not configured. Please ensure the backend is deployed.',
                code: 'API_CONFIG_MISSING',
                retryable: false,
                userFriendly: true
            });
        }

        return withRetry(
            () => makeRequest<BulkDeletionResponse>(
                getDeleteAllStacksEndpoint(),
                { method: 'DELETE' },
                true,
                60000 // 60 second timeout for bulk deletion operations
            ),
            { maxAttempts: 2, baseDelay: 2000 }
        );
    }

    async getAllDeletionStatus(): Promise<BulkDeletionStatusResponse> {
        if (!this.config.apiGatewayUrl) {
            throw new AppError({
                message: 'API Gateway is not configured. Please ensure the backend is deployed.',
                code: 'API_CONFIG_MISSING',
                retryable: false,
                userFriendly: true
            });
        }

        return withRetry(
            () => makeRequest<BulkDeletionStatusResponse>(
                getAllDeletionStatusEndpoint(),
                { method: 'GET' },
                true,
                15000 // 15 second timeout for status checks
            ),
            { maxAttempts: 2, baseDelay: 1000 }
        );
    }

    // Public APIs (no authentication required)
    async getStackOutputs(accessCode: string): Promise<StackOutputResponse> {
        if (!this.config.apiGatewayUrl) {
            throw new AppError({
                message: 'API Gateway is not configured. Please ensure the backend is deployed.',
                code: 'API_CONFIG_MISSING',
                retryable: false,
                userFriendly: true
            });
        }

        return withRetry(
            () => makeRequest<StackOutputResponse>(
                getStackOutputsEndpoint(accessCode),
                { method: 'GET' },
                false,
                10000
            ),
            { maxAttempts: 3, baseDelay: 1000 }
        );
    }
}

// Export singleton instance
export const apiClient = new ApiClient();

// Export individual functions for convenience
export const getAccessCodeStatuses = () => apiClient.getAccessCodeStatuses();
export const deployStacks = (stackCount: number, selectedAccessCodes?: string[]) => apiClient.deployStacks(stackCount, selectedAccessCodes);
export const getStackOutputs = (accessCode: string) => apiClient.getStackOutputs(accessCode);
export const deleteStack = (accessCode: string) => apiClient.deleteStack(accessCode);
export const getDeletionStatus = (accessCode: string) => apiClient.getDeletionStatus(accessCode);
export const deleteAllStacks = () => apiClient.deleteAllStacks();
export const getAllDeletionStatus = () => apiClient.getAllDeletionStatus();