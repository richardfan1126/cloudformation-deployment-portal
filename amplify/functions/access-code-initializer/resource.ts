import { defineFunction } from '@aws-amplify/backend';
import { DEPLOYMENT_CONFIG } from '../shared/deployment-config';

/**
 * Access Code Initializer Lambda function
 * 
 * This function is invoked as a CloudFormation custom resource during stack deployment
 * to generate random UUID Access Codes and initialize the DynamoDB table.
 * 
 * Responsibilities:
 * - Generate random UUID Access Codes based on configured pool size
 * - Initialize DynamoDB table with generated Access Codes
 * - Handle CloudFormation custom resource lifecycle events (Create, Update, Delete)
 */
export const accessCodeInitializer = defineFunction({
    name: 'access-code-initializer',
    entry: './handler.ts',
    timeoutSeconds: 60, // Allow sufficient time for DynamoDB batch operations
    environment: {
        DYNAMODB_TABLE_NAME: process.env.DYNAMODB_TABLE_NAME || 'workshop-portal-stacks',
        ...DEPLOYMENT_CONFIG
    },
    resourceGroupName: 'DynamoDBStack' // Assign to DynamoDB stack to avoid circular dependency
});
