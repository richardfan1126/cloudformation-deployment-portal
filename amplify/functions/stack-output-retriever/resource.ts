import { defineFunction } from '@aws-amplify/backend';
import { DEPLOYMENT_CONFIG } from '../shared/deployment-config';

export const stackOutputRetriever = defineFunction({
    name: 'stack-output-retriever',
    entry: './handler.ts',
    environment: {
        ...DEPLOYMENT_CONFIG
    },
    runtime: 18,
    timeoutSeconds: 30,
    memoryMB: 512,
    resourceGroupName: 'ApiGatewayStack' // Assign to API Gateway stack to avoid circular dependency
});