import { defineFunction } from '@aws-amplify/backend';
import { DEPLOYMENT_CONFIG } from '../shared/deployment-config';

export const stackDeleter = defineFunction({
    name: 'stack-deleter',
    entry: './handler.ts',
    timeoutSeconds: 60,
    memoryMB: 512,
    environment: {
        ...DEPLOYMENT_CONFIG
    },
    resourceGroupName: 'ApiGatewayStack' // Assign to API Gateway stack to avoid circular dependency
});