import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand,
    ScanCommand,
    BatchGetCommand,
    BatchWriteCommand
} from '@aws-sdk/lib-dynamodb';

/**
 * Stack record interface representing an Access Code and its associated CloudFormation stack
 * Note: DynamoDB attribute name remains 'guid' for backward compatibility
 */
export interface StackRecord {
    guid: string; // Partition key (stores Access Code, attribute name kept for backward compatibility)
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
    outputs?: Array<{
        outputKey: string;
        outputValue: string;
        description?: string;
    }>; // Cached CloudFormation outputs
    lastSyncAt?: string; // ISO timestamp of last successful sync
    syncError?: string; // Error message if sync failed
}

/**
 * Access Code status interface for API responses
 */
export interface AccessCodeStatus {
    accessCode: string;
    isLinked: boolean;
    stackName?: string;
    stackId?: string;
    createdAt?: Date;
    status?: string;
}

// DynamoDB client setup
const dynamoClient = new DynamoDBClient({
    region: process.env.REGION || 'us-east-1' // DynamoDB table is in the backend region
});

const docClient = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
        removeUndefinedValues: true // Automatically remove undefined values from objects
    }
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'workshop-portal-stacks';

/**
 * Get a single stack record by Access Code
 */
export async function getStackRecord(accessCode: string): Promise<StackRecord | null> {
    try {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { guid: accessCode } // DynamoDB attribute name remains 'guid' for backward compatibility
        });

        const response = await docClient.send(command);
        return response.Item as StackRecord || null;
    } catch (error) {
        console.error(`Error getting stack record for Access Code ${accessCode}:`, error);
        throw error;
    }
}

/**
 * Put a stack record
 */
export async function putStackRecord(record: StackRecord): Promise<void> {
    try {
        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: record
        });

        await docClient.send(command);
    } catch (error) {
        console.error(`Error putting stack record for Access Code ${record.guid}:`, error);
        throw error;
    }
}

/**
 * Update a stack record
 */
export async function updateStackRecord(
    accessCode: string,
    updates: Partial<Omit<StackRecord, 'guid'>>
): Promise<void> {
    try {
        // Filter out undefined values and build update expression dynamically
        const setExpressions: string[] = [];
        const removeExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};

        let attrIndex = 0;

        Object.entries(updates).forEach(([key, value]) => {
            const attrName = `#attr${attrIndex}`;

            if (value === undefined) {
                // Use REMOVE for undefined values to delete the attribute
                removeExpressions.push(attrName);
                expressionAttributeNames[attrName] = key;
            } else {
                // Use SET for defined values
                const attrValue = `:val${attrIndex}`;
                setExpressions.push(`${attrName} = ${attrValue}`);
                expressionAttributeNames[attrName] = key;
                expressionAttributeValues[attrValue] = value;
            }

            attrIndex++;
        });

        // Always update the updatedAt timestamp
        const timestampAttr = `#attr${attrIndex}`;
        const timestampValue = `:val${attrIndex}`;
        setExpressions.push(`${timestampAttr} = ${timestampValue}`);
        expressionAttributeNames[timestampAttr] = 'updatedAt';
        expressionAttributeValues[timestampValue] = new Date().toISOString();

        // Build the complete update expression
        const updateExpressionParts: string[] = [];
        if (setExpressions.length > 0) {
            updateExpressionParts.push(`SET ${setExpressions.join(', ')}`);
        }
        if (removeExpressions.length > 0) {
            updateExpressionParts.push(`REMOVE ${removeExpressions.join(', ')}`);
        }

        const command = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { guid: accessCode }, // DynamoDB attribute name remains 'guid' for backward compatibility
            UpdateExpression: updateExpressionParts.join(' '),
            ExpressionAttributeNames: expressionAttributeNames,
            ...(Object.keys(expressionAttributeValues).length > 0 && {
                ExpressionAttributeValues: expressionAttributeValues
            })
        });

        await docClient.send(command);
    } catch (error) {
        console.error(`Error updating stack record for Access Code ${accessCode}:`, error);
        throw error;
    }
}

/**
 * Delete a stack record
 */
export async function deleteStackRecord(accessCode: string): Promise<void> {
    try {
        const command = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { guid: accessCode } // DynamoDB attribute name remains 'guid' for backward compatibility
        });

        await docClient.send(command);
    } catch (error) {
        console.error(`Error deleting stack record for Access Code ${accessCode}:`, error);
        throw error;
    }
}

/**
 * Get all stack records
 */
export async function getAllStackRecords(): Promise<StackRecord[]> {
    try {
        const command = new ScanCommand({
            TableName: TABLE_NAME
        });

        const response = await docClient.send(command);
        return response.Items as StackRecord[] || [];
    } catch (error) {
        console.error('Error getting all stack records:', error);
        throw error;
    }
}

/**
 * Batch get stack records for specific Access Codes
 */
export async function batchGetStackRecords(accessCodes: string[]): Promise<StackRecord[]> {
    try {
        if (accessCodes.length === 0) {
            return [];
        }

        // DynamoDB BatchGetItem has a limit of 100 items
        const batches: string[][] = [];
        for (let i = 0; i < accessCodes.length; i += 100) {
            batches.push(accessCodes.slice(i, i + 100));
        }

        const allRecords: StackRecord[] = [];

        for (const batch of batches) {
            const command = new BatchGetCommand({
                RequestItems: {
                    [TABLE_NAME]: {
                        Keys: batch.map(accessCode => ({ guid: accessCode })) // DynamoDB attribute name remains 'guid'
                    }
                }
            });

            const response = await docClient.send(command);
            if (response.Responses && response.Responses[TABLE_NAME]) {
                allRecords.push(...(response.Responses[TABLE_NAME] as StackRecord[]));
            }
        }

        return allRecords;
    } catch (error) {
        console.error('Error batch getting stack records:', error);
        throw error;
    }
}

/**
 * Batch put stack records
 */
export async function batchPutStackRecords(records: StackRecord[]): Promise<void> {
    try {
        if (records.length === 0) {
            return;
        }

        // DynamoDB BatchWriteItem has a limit of 25 items
        const batches: StackRecord[][] = [];
        for (let i = 0; i < records.length; i += 25) {
            batches.push(records.slice(i, i + 25));
        }

        for (const batch of batches) {
            const command = new BatchWriteCommand({
                RequestItems: {
                    [TABLE_NAME]: batch.map(record => ({
                        PutRequest: {
                            Item: record
                        }
                    }))
                }
            });

            await docClient.send(command);
        }
    } catch (error) {
        console.error('Error batch putting stack records:', error);
        throw error;
    }
}

/**
 * Get Access Code pool from DynamoDB
 * This replaces the hardcoded FIXED_GUID_POOL constant
 */
export async function getAccessCodePool(): Promise<string[]> {
    try {
        const allRecords = await getAllStackRecords();
        return allRecords.map(record => record.guid); // Returns all Access Codes from DynamoDB
    } catch (error) {
        console.error('Error getting Access Code pool from DynamoDB:', error);
        throw error;
    }
}

/**
 * Initialize DynamoDB table with Access Codes
 * This function is called by the Access Code initializer Lambda
 */
export async function initializeAccessCodePool(accessCodes: string[]): Promise<void> {
    try {
        console.log(`Initializing DynamoDB table with ${accessCodes.length} Access Codes...`);

        // Get existing records
        const existingRecords = await batchGetStackRecords(accessCodes);
        const existingAccessCodes = new Set(existingRecords.map(r => r.guid));

        // Create records for Access Codes that don't exist
        const newRecords: StackRecord[] = accessCodes
            .filter(accessCode => !existingAccessCodes.has(accessCode))
            .map(accessCode => ({
                guid: accessCode, // DynamoDB attribute name remains 'guid' for backward compatibility
                status: 'AVAILABLE' as const,
                updatedAt: new Date().toISOString()
            }));

        if (newRecords.length > 0) {
            console.log(`Creating ${newRecords.length} new Access Code records in DynamoDB`);
            await batchPutStackRecords(newRecords);
        } else {
            console.log('All Access Codes already exist in DynamoDB');
        }

        console.log('DynamoDB table initialization complete');
    } catch (error) {
        console.error('Error initializing DynamoDB table:', error);
        throw error;
    }
}

/**
 * Validate if Access Code exists in DynamoDB
 */
export async function validateAccessCode(accessCode: string): Promise<boolean> {
    if (!accessCode || typeof accessCode !== 'string') {
        return false;
    }

    // Validate Access Code format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(accessCode)) {
        return false;
    }

    try {
        // Check if Access Code exists in DynamoDB
        const record = await getStackRecord(accessCode);
        return record !== null;
    } catch (error) {
        console.error(`Error validating Access Code ${accessCode}:`, error);
        return false;
    }
}

/**
 * Get available Access Codes from DynamoDB
 */
export async function getAvailableAccessCodes(): Promise<string[]> {
    try {
        const allRecords = await getAllStackRecords();
        const availableRecords = allRecords.filter(record => record.status === 'AVAILABLE');
        return availableRecords.map(record => record.guid);
    } catch (error) {
        console.error('Error getting available Access Codes from DynamoDB:', error);
        throw error;
    }
}

/**
 * Get all non-AVAILABLE records from DynamoDB (for sync operations)
 */
export async function getNonAvailableStackRecords(): Promise<StackRecord[]> {
    try {
        const allRecords = await getAllStackRecords();
        return allRecords.filter(record => record.status !== 'AVAILABLE');
    } catch (error) {
        console.error('Error getting non-available stack records:', error);
        throw error;
    }
}
