// API Configuration
// API Gateway URL is automatically provided by Amplify through amplify_outputs.json

import outputs from '../../amplify_outputs.json';

export interface ApiEndpoints {
    apiGatewayUrl: string;
}

// Get API Gateway URL from Amplify outputs
const getApiGatewayUrl = (): string => {
    const url = outputs.custom?.apiGatewayUrl || '';
    return url;
};

export const API_ENDPOINTS: ApiEndpoints = {
    apiGatewayUrl: getApiGatewayUrl()
};

// Helper functions to build API endpoint URLs
export const getApiEndpoint = (path: string): string => {
    const baseUrl = API_ENDPOINTS.apiGatewayUrl;
    if (!baseUrl) {
        throw new Error('API Gateway URL is not configured');
    }
    return `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
};

// Specific endpoint builders
export const getAccessCodeStatusesEndpoint = () => getApiEndpoint('admin/access-code-statuses');
export const getDeployStacksEndpoint = () => getApiEndpoint('admin/deploy');
export const getStackOutputsEndpoint = (accessCode: string) => getApiEndpoint(`public/stack-outputs/${accessCode}`);
export const getDeleteStackEndpoint = (accessCode: string) => getApiEndpoint(`admin/stack/${accessCode}`);
export const getDeletionStatusEndpoint = (accessCode: string) => getApiEndpoint(`admin/stack/${accessCode}/deletion-status`);
export const getDeleteAllStacksEndpoint = () => getApiEndpoint('admin/stacks/all');
export const getAllDeletionStatusEndpoint = () => getApiEndpoint('admin/stacks/deletion-status');