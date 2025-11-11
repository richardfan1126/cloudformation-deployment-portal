import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as customResources from 'aws-cdk-lib/custom-resources';
import { CustomResource, RemovalPolicy, Duration } from 'aws-cdk-lib';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { auth } from './auth/resource';
import { accessCodeManager } from './functions/access-code-manager/resource';
import { accessCodeInitializer } from './functions/access-code-initializer/resource';
import { stackDeployer } from './functions/stack-deployer/resource';
import { stackOutputRetriever } from './functions/stack-output-retriever/resource';
import { stackDeleter } from './functions/stack-deleter/resource';
import { stackSync } from './functions/stack-sync/resource';
import { getStackDeployerCustomPermissions, getStackDeleterCustomPermissions } from './custom-template-permissions';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Load stack name prefix from deployment configuration
 * Defaults to 'deployment-stack' if not configured
 */
function getStackNamePrefix(): string {
    try {
        const configPath = join(__dirname, 'deployment-config.json');
        const configContent = readFileSync(configPath, 'utf-8');
        const config = JSON.parse(configContent);
        return config.stackNamePrefix || 'deployment-stack';
    } catch (error) {
        console.warn('Could not load deployment config, using default stack prefix:', error);
        return 'deployment-stack';
    }
}

const stackNamePrefix = getStackNamePrefix();
console.log(`Using stack name prefix for IAM policies: ${stackNamePrefix}`);

export const backend = defineBackend({
    auth,
    accessCodeManager,
    accessCodeInitializer,
    stackDeployer,
    stackOutputRetriever,
    stackDeleter,
    stackSync,
});

// Access the DynamoDB stack (automatically created by accessCodeInitializer function)
const dynamoStack = backend.accessCodeInitializer.resources.cfnResources.cfnFunction.stack;

const stackRecordsTable = new dynamodb.Table(dynamoStack, 'StackRecordsTable', {
    partitionKey: {
        name: 'guid',
        type: dynamodb.AttributeType.STRING
    },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    pointInTimeRecovery: true,
    removalPolicy: RemovalPolicy.DESTROY, // For development - change to RETAIN for production
    encryption: dynamodb.TableEncryption.AWS_MANAGED
});

// Access the EventBridge stack (automatically created by stackSync function)
const eventBridgeStack = backend.stackSync.resources.cfnResources.cfnFunction.stack;

const stackSyncRule = new events.Rule(eventBridgeStack, 'StackSyncScheduleRule', {
    description: 'Triggers stack synchronization every 1 minute',
    schedule: events.Schedule.rate(Duration.minutes(1)),
    enabled: true
});

// Add the stackSync Lambda as a target
stackSyncRule.addTarget(new targets.LambdaFunction(backend.stackSync.resources.lambda, {
    retryAttempts: 2
}));

// Add DynamoDB table name as environment variable to all Lambda functions
backend.accessCodeManager.addEnvironment('DYNAMODB_TABLE_NAME', stackRecordsTable.tableName);
backend.accessCodeInitializer.addEnvironment('DYNAMODB_TABLE_NAME', stackRecordsTable.tableName);
backend.stackDeployer.addEnvironment('DYNAMODB_TABLE_NAME', stackRecordsTable.tableName);
backend.stackOutputRetriever.addEnvironment('DYNAMODB_TABLE_NAME', stackRecordsTable.tableName);
backend.stackDeleter.addEnvironment('DYNAMODB_TABLE_NAME', stackRecordsTable.tableName);
backend.stackSync.addEnvironment('DYNAMODB_TABLE_NAME', stackRecordsTable.tableName);

// Configure IAM permissions for Lambda functions using the resources property
backend.accessCodeManager.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'cloudformation:ListStacks',
            'cloudformation:DescribeStacks',
            'cloudformation:ListStackResources',
            'cloudformation:GetTemplate'
        ],
        resources: ['*']
    })
);

// Add DynamoDB permissions to accessCodeManager
backend.accessCodeManager.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem'
        ],
        resources: [stackRecordsTable.tableArn]
    })
);

// Add DynamoDB permissions to accessCodeInitializer
backend.accessCodeInitializer.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem'
        ],
        resources: [stackRecordsTable.tableArn]
    })
);

// Create custom resource to invoke accessCodeInitializer Lambda on stack creation
// This will generate and initialize the Access Code pool in DynamoDB
const accessCodeInitializerProvider = new customResources.Provider(
    dynamoStack,
    'AccessCodeInitializerProvider',
    {
        onEventHandler: backend.accessCodeInitializer.resources.lambda,
    }
);

const accessCodePoolResource = new CustomResource(
    dynamoStack,
    'AccessCodePoolInitializer',
    {
        serviceToken: accessCodeInitializerProvider.serviceToken,
        properties: {
            // Trigger re-initialization if table name changes
            TableName: stackRecordsTable.tableName,
        },
    }
);

// Ensure the custom resource runs after the DynamoDB table is created
accessCodePoolResource.node.addDependency(stackRecordsTable);

backend.stackDeployer.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'cloudformation:CreateStack',
            'cloudformation:UpdateStack',
            'cloudformation:DeleteStack',
            'cloudformation:DescribeStacks',
            'cloudformation:DescribeStackEvents',
            'cloudformation:DescribeStackResources',
            'cloudformation:ListStackResources'
        ],
        resources: [
            `arn:aws:cloudformation:*:*:stack/${stackNamePrefix}-*/*`,
            // Backward compatibility with existing portal-stack-* pattern
            'arn:aws:cloudformation:*:*:stack/portal-stack-*/*'
        ]
    })
);

// Add DynamoDB permissions to stackDeployer
backend.stackDeployer.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem'
        ],
        resources: [stackRecordsTable.tableArn]
    })
);

// Add EventBridge rule management permissions to stackDeployer
backend.stackDeployer.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'events:PutRule',
            'events:EnableRule',
            'events:DisableRule',
            'events:DescribeRule'
        ],
        resources: [
            `arn:aws:events:*:*:rule/*StackSyncScheduleRule*`
        ]
    })
);

// Add ListRules permission separately (requires wildcard resource)
backend.stackDeployer.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'events:ListRules'
        ],
        resources: ['*']
    })
);

// Allow listing all stacks but restrict operations to portal-stack-* prefix
backend.stackDeployer.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'cloudformation:ListStacks',
            'cloudformation:GetTemplate',
            'cloudformation:ValidateTemplate'
        ],
        resources: ['*']
    })
);

backend.stackDeployer.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            's3:GetObject',
            's3:GetObjectVersion'
        ],
        resources: [
            'arn:aws:s3:::*/*' // Allow access to any S3 bucket for template retrieval
        ]
    })
);

// ============================================================================
// CUSTOM TEMPLATE PERMISSIONS - STACK DEPLOYER
// ============================================================================
// TODO: Customize permissions in amplify/custom-template-permissions.ts
// The permissions are loaded from a separate file for easier maintenance.
// See amplify/custom-template-permissions.ts for examples and guidance.
// ============================================================================

// Add custom permissions for your CloudFormation template resources
const deployerCustomPermissions = getStackDeployerCustomPermissions();
deployerCustomPermissions.forEach(permission => {
    backend.stackDeployer.resources.lambda.addToRolePolicy(permission);
});

// END OF STACK DEPLOYER CUSTOM PERMISSIONS

backend.stackOutputRetriever.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'cloudformation:DescribeStacks',
            'cloudformation:ListStacks',
            'cloudformation:DescribeStackResources',
            'cloudformation:ListStackResources'
        ],
        resources: ['*']
    })
);

// Add DynamoDB permissions to stackOutputRetriever
backend.stackOutputRetriever.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem'
        ],
        resources: [stackRecordsTable.tableArn]
    })
);

// CloudFormation permissions for stack deletion
backend.stackDeleter.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'cloudformation:DeleteStack',
            'cloudformation:DescribeStacks',
            'cloudformation:DescribeStackEvents',
            'cloudformation:DescribeStackResources',
            'cloudformation:ListStackResources'
        ],
        resources: [
            `arn:aws:cloudformation:*:*:stack/${stackNamePrefix}-*/*`,
            // Backward compatibility with existing portal-stack-* pattern
            'arn:aws:cloudformation:*:*:stack/portal-stack-*/*'
        ]
    })
);

// Allow listing all stacks for discovery but restrict operations to portal-stack-* prefix
backend.stackDeleter.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'cloudformation:ListStacks'
        ],
        resources: ['*']
    })
);

// ============================================================================
// CUSTOM TEMPLATE PERMISSIONS - STACK DELETER
// ============================================================================
// TODO: Customize permissions in amplify/custom-template-permissions.ts
// The permissions are loaded from a separate file for easier maintenance.
// These should mirror the resources you can create in the Stack Deployer section.
// See amplify/custom-template-permissions.ts for examples and guidance.
// ============================================================================

// Add custom deletion permissions for your CloudFormation template resources
const deleterCustomPermissions = getStackDeleterCustomPermissions();
deleterCustomPermissions.forEach(permission => {
    backend.stackDeleter.resources.lambda.addToRolePolicy(permission);
});

// END OF STACK DELETER CUSTOM PERMISSIONS

// Add DynamoDB permissions to stackDeleter
backend.stackDeleter.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem'
        ],
        resources: [stackRecordsTable.tableArn]
    })
);

// CloudFormation permissions for stackSync (read-only for synchronization)
backend.stackSync.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'cloudformation:DescribeStacks',
            'cloudformation:ListStacks',
            'cloudformation:DescribeStackResources',
            'cloudformation:ListStackResources'
        ],
        resources: ['*']
    })
);

// Add DynamoDB permissions to stackSync
backend.stackSync.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'dynamodb:GetItem',
            'dynamodb:PutItem',
            'dynamodb:UpdateItem',
            'dynamodb:DeleteItem',
            'dynamodb:Query',
            'dynamodb:Scan',
            'dynamodb:BatchGetItem',
            'dynamodb:BatchWriteItem'
        ],
        resources: [stackRecordsTable.tableArn]
    })
);

// Add EventBridge rule management permissions to stackSync
backend.stackSync.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'events:PutRule',
            'events:EnableRule',
            'events:DisableRule',
            'events:DescribeRule'
        ],
        resources: [
            `arn:aws:events:*:*:rule/*StackSyncScheduleRule*`
        ]
    })
);

// Add ListRules permission separately (requires wildcard resource)
backend.stackSync.resources.lambda.addToRolePolicy(
    new PolicyStatement({
        actions: [
            'events:ListRules'
        ],
        resources: ['*']
    })
);

// Access the API Gateway stack (automatically created by accessCodeManager function)
const apiStack = backend.accessCodeManager.resources.cfnResources.cfnFunction.stack;

// Create API Gateway
const api = new apigateway.RestApi(apiStack, 'CloudFormationPortalApi', {
    description: 'API for CloudFormation Deployment Portal',
    defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
            'Content-Type',
            'X-Amz-Date',
            'Authorization',
            'X-Api-Key',
            'X-Amz-Security-Token',
            'X-Amz-User-Agent'
        ],
    },
});

// Create Cognito authorizer
const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
    apiStack,
    'CognitoAuthorizer',
    {
        cognitoUserPools: [backend.auth.resources.userPool],
        identitySource: 'method.request.header.Authorization',
    }
);

// Create API resources and methods

// Admin endpoints (protected)
const adminResource = api.root.addResource('admin');

// GET /admin/access-code-statuses
const accessCodeStatusesResource = adminResource.addResource('access-code-statuses');
accessCodeStatusesResource.addMethod('GET', new apigateway.LambdaIntegration(backend.accessCodeManager.resources.lambda), {
    authorizer: cognitoAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
});

// POST /admin/deploy
const deployResource = adminResource.addResource('deploy');
deployResource.addMethod('POST', new apigateway.LambdaIntegration(backend.stackDeployer.resources.lambda), {
    authorizer: cognitoAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
});

// DELETE /admin/stack/{accessCode} and GET /admin/stack/{accessCode}/deletion-status
const stackResource = adminResource.addResource('stack');
const stackAccessCodeResource = stackResource.addResource('{accessCode}');
stackAccessCodeResource.addMethod('DELETE', new apigateway.LambdaIntegration(backend.stackDeleter.resources.lambda), {
    authorizer: cognitoAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
});

const deletionStatusResource = stackAccessCodeResource.addResource('deletion-status');
deletionStatusResource.addMethod('GET', new apigateway.LambdaIntegration(backend.stackDeleter.resources.lambda), {
    authorizer: cognitoAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
});

// Bulk deletion endpoints
// DELETE /admin/stacks/all
const stacksResource = adminResource.addResource('stacks');
const allStacksResource = stacksResource.addResource('all');
allStacksResource.addMethod('DELETE', new apigateway.LambdaIntegration(backend.stackDeleter.resources.lambda), {
    authorizer: cognitoAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
});

// GET /admin/stacks/deletion-status
const bulkDeletionStatusResource = stacksResource.addResource('deletion-status');
bulkDeletionStatusResource.addMethod('GET', new apigateway.LambdaIntegration(backend.stackDeleter.resources.lambda), {
    authorizer: cognitoAuthorizer,
    authorizationType: apigateway.AuthorizationType.COGNITO,
});

// Public endpoints (no auth required)
const publicResource = api.root.addResource('public');

// GET /public/stack-outputs/{accessCode}
const stackOutputsResource = publicResource.addResource('stack-outputs');
const accessCodeResource = stackOutputsResource.addResource('{accessCode}');
accessCodeResource.addMethod('GET', new apigateway.LambdaIntegration(backend.stackOutputRetriever.resources.lambda));

// Export API Gateway URL for frontend configuration
backend.addOutput({
    custom: {
        apiGatewayUrl: api.url,
    },
});