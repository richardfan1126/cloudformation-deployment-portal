import { defineFunction } from '@aws-amplify/backend';
import { DEPLOYMENT_CONFIG } from '../shared/deployment-config';

export const stackSync = defineFunction({
    name: 'stack-sync',
    entry: './handler.ts',
    environment: {
        ...DEPLOYMENT_CONFIG
    },
    runtime: 18,
    timeoutSeconds: 300, // 5 minutes for sync operations
    memoryMB: 512,
    resourceGroupName: 'EventBridgeStack' // Assign to EventBridge stack to avoid circular dependency
});