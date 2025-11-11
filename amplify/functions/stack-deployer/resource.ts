import { defineFunction } from '@aws-amplify/backend';
import { DEPLOYMENT_CONFIG } from '../shared/deployment-config';

export const stackDeployer = defineFunction({
    name: 'stack-deployer',
    entry: './handler.ts',
    environment: {
        ...DEPLOYMENT_CONFIG
    },
    runtime: 18,
    timeoutSeconds: 300, // 5 minutes for stack deployment operations
    memoryMB: 1024,
    resourceGroupName: 'ApiGatewayStack' // Assign to API Gateway stack to avoid circular dependency
});