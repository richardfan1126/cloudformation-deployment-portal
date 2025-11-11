// Core data types for the CloudFormation Deployment Portal

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
    isDeletable?: boolean;
}

export interface DeployedStack {
    stackName: string;
    stackId: string;
    uniqueId: string; // Access Code from the pool
    status: 'CREATE_IN_PROGRESS' | 'CREATE_COMPLETE' | 'CREATE_FAILED' |
    'ROLLBACK_IN_PROGRESS' | 'ROLLBACK_COMPLETE' | 'ROLLBACK_FAILED' |
    'UPDATE_IN_PROGRESS' | 'UPDATE_COMPLETE' | 'UPDATE_FAILED' |
    'UPDATE_ROLLBACK_IN_PROGRESS' | 'UPDATE_ROLLBACK_COMPLETE' | 'UPDATE_ROLLBACK_FAILED' |
    'DELETE_IN_PROGRESS' | 'DELETE_COMPLETE' | 'DELETE_FAILED' |
    'REVIEW_IN_PROGRESS';
    createdAt: Date;
}

export interface StackOutput {
    outputKey: string;
    outputValue: string;
    description?: string;
}

export interface StackConfig {
    templateUrl: string;
    tags: {
        UniqueId: string; // Access Code from pool
        ManagedBy: 'CloudFormationStackPortal';
        CreatedAt: string;
    };
    stackName: string; // Generated: `deployment-stack-${accessCode}-${timestamp}`
}

// API Response types
export interface AccessCodeStatusResponse {
    accessCodeStatuses: AccessCodeStatus[];
    totalAvailable: number;
    totalLinked: number;
}

export interface DeploymentResponse {
    deployedStacks: DeployedStack[];
    assignedAccessCodes: string[];
}

export interface StackOutputResponse {
    outputs: StackOutput[];
}

export interface ErrorResponse {
    error: string;
    message?: string;
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

// DynamoDB data models
export interface StackRecord {
    accessCode: string; // Partition key (stored as 'guid' in DynamoDB for backward compatibility)
    stackArn?: string; // CloudFormation stack ARN
    stackName?: string;
    stackId?: string;
    status: 'AVAILABLE' | 'CREATE_IN_PROGRESS' | 'CREATE_COMPLETE' | 'CREATE_FAILED' |
    'DELETE_IN_PROGRESS' | 'DELETE_COMPLETE' | 'DELETE_FAILED' |
    'ROLLBACK_IN_PROGRESS' | 'ROLLBACK_COMPLETE' | 'ROLLBACK_FAILED' |
    'UPDATE_IN_PROGRESS' | 'UPDATE_COMPLETE' | 'UPDATE_FAILED' |
    'UPDATE_ROLLBACK_IN_PROGRESS' | 'UPDATE_ROLLBACK_COMPLETE' | 'UPDATE_ROLLBACK_FAILED' |
    'REVIEW_IN_PROGRESS';
    createdAt?: string; // ISO timestamp
    updatedAt: string; // ISO timestamp, updated on every sync
    outputs?: StackOutput[]; // Cached CloudFormation outputs
    lastSyncAt?: string; // ISO timestamp of last successful sync
    syncError?: string; // Error message if sync failed
}

export interface DynamoDBTableConfig {
    tableName: 'deployment-portal-stacks';
    partitionKey: 'guid'; // Note: DynamoDB attribute name remains 'guid' for backward compatibility
    attributes: {
        guid: 'S'; // String - stores Access Code values
        stackArn: 'S'; // String
        status: 'S'; // String
        updatedAt: 'S'; // String (ISO timestamp)
    };
}