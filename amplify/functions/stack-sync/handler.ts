import { EventBridgeEvent } from 'aws-lambda';
import { CloudFormationClient, DescribeStacksCommand, Stack } from '@aws-sdk/client-cloudformation';
import {
    StackRecord,
    getNonAvailableStackRecords,
    updateStackRecord
} from '../shared/access-code-utils';
import { EventBridgeManager } from '../shared/eventbridge-utils';

// CloudFormation client setup - query stacks in configured region where Access Code stacks are deployed
const cloudFormationClient = new CloudFormationClient({
    region: process.env.REGION || 'ap-east-1'
});

interface SyncResult {
    totalProcessed: number;
    successfulSyncs: number;
    failedSyncs: number;
    errors: Array<{
        accessCode: string;
        error: string;
    }>;
}

interface StackOutput {
    outputKey: string;
    outputValue: string;
    description?: string;
}

/**
 * Convert CloudFormation outputs to our format
 */
function convertCloudFormationOutputs(cfOutputs?: Array<{ OutputKey?: string; OutputValue?: string; Description?: string }>): StackOutput[] {
    if (!cfOutputs) {
        return [];
    }

    return cfOutputs
        .filter(output => output.OutputKey && output.OutputValue)
        .map(output => ({
            outputKey: output.OutputKey!,
            outputValue: output.OutputValue!,
            description: output.Description
        }));
}

/**
 * Sync a single stack record with CloudFormation
 */
async function syncStackRecord(record: StackRecord): Promise<{ success: boolean; error?: string }> {
    try {
        if (!record.stackArn) {
            console.warn(`Stack record ${record.guid} has no stackArn, skipping sync`);
            return { success: true }; // Skip records without stack ARN
        }

        console.log(`Syncing stack record for Access Code ${record.guid}, stackArn: ${record.stackArn}`);

        // Query CloudFormation for current stack status
        const describeCommand = new DescribeStacksCommand({
            StackName: record.stackArn
        });

        let stack: Stack | undefined;
        let stackExists = true;

        try {
            const response = await cloudFormationClient.send(describeCommand);
            stack = response.Stacks?.[0];
        } catch (error: any) {
            if (error.name === 'ValidationError' && error.message?.includes('does not exist')) {
                // Stack has been deleted externally
                stackExists = false;
                console.log(`Stack ${record.stackArn} no longer exists, marking Access Code as AVAILABLE`);
            } else {
                throw error; // Re-throw other errors
            }
        }

        const now = new Date().toISOString();
        let hasChanges = false;
        const updates: Partial<StackRecord> = {
            lastSyncAt: now,
            syncError: undefined // Clear any previous sync errors
        };

        if (!stackExists) {
            // Stack was deleted externally, mark as AVAILABLE
            if (record.status !== 'AVAILABLE') {
                updates.status = 'AVAILABLE';
                updates.stackArn = undefined;
                updates.stackName = undefined;
                updates.stackId = undefined;
                updates.outputs = undefined;
                updates.createdAt = undefined;
                hasChanges = true;
                console.log(`Marking Access Code ${record.guid} as AVAILABLE (stack deleted externally)`);
            }
        } else if (stack) {
            const currentStatus = stack.StackStatus as StackRecord['status'];

            // Handle DELETE_COMPLETE status - mark as AVAILABLE
            if (currentStatus === 'DELETE_COMPLETE') {
                updates.status = 'AVAILABLE';
                updates.stackArn = undefined;
                updates.stackName = undefined;
                updates.stackId = undefined;
                updates.outputs = undefined;
                updates.createdAt = undefined;
                hasChanges = true;
                console.log(`Stack ${record.stackArn} is DELETE_COMPLETE, marking Access Code ${record.guid} as AVAILABLE`);
            } else {
                // Update status if changed (for non-DELETE_COMPLETE statuses)
                if (record.status !== currentStatus) {
                    updates.status = currentStatus;
                    hasChanges = true;
                    console.log(`Status changed for Access Code ${record.guid}: ${record.status} -> ${currentStatus}`);
                }

                // Update stack name if changed
                if (record.stackName !== stack.StackName) {
                    updates.stackName = stack.StackName;
                    hasChanges = true;
                }

                // Update stack ID if changed
                if (record.stackId !== stack.StackId) {
                    updates.stackId = stack.StackId;
                    hasChanges = true;
                }

                // Update creation time if not set
                if (!record.createdAt && stack.CreationTime) {
                    updates.createdAt = stack.CreationTime.toISOString();
                    hasChanges = true;
                }

                // Update outputs if stack is in a complete state
                if (currentStatus === 'CREATE_COMPLETE' || currentStatus === 'UPDATE_COMPLETE') {
                    const newOutputs = convertCloudFormationOutputs(stack.Outputs);
                    const currentOutputsJson = JSON.stringify(record.outputs || []);
                    const newOutputsJson = JSON.stringify(newOutputs);

                    if (currentOutputsJson !== newOutputsJson) {
                        updates.outputs = newOutputs;
                        hasChanges = true;
                        console.log(`Outputs updated for Access Code ${record.guid}, ${newOutputs.length} outputs`);
                    }
                }
            }
        }

        // Only update DynamoDB if there are changes
        if (hasChanges) {
            await updateStackRecord(record.guid, updates);
            console.log(`Successfully synced Access Code ${record.guid} with changes`);
        } else {
            // Still update lastSyncAt even if no other changes
            await updateStackRecord(record.guid, { lastSyncAt: now });
            console.log(`Successfully synced Access Code ${record.guid} (no changes)`);
        }

        return { success: true };

    } catch (error: any) {
        const errorMessage = error.message || String(error);
        console.error(`Error syncing stack record for Access Code ${record.guid}:`, error);

        // Update the record with sync error
        try {
            await updateStackRecord(record.guid, {
                syncError: errorMessage,
                lastSyncAt: new Date().toISOString()
            });
        } catch (updateError) {
            console.error(`Failed to update sync error for Access Code ${record.guid}:`, updateError);
        }

        return { success: false, error: errorMessage };
    }
}

/**
 * Validate if all stacks have been successfully deleted
 * This function checks if all DynamoDB records are in AVAILABLE status
 */
async function validateAllStacksDeletionComplete(): Promise<boolean> {
    try {
        console.log('Validating if all stacks have been successfully deleted...');

        // Check if there are any non-AVAILABLE records remaining
        const nonAvailableRecords = await getNonAvailableStackRecords();
        const hasActiveStacks = nonAvailableRecords.length > 0;

        if (hasActiveStacks) {
            console.log(`Found ${nonAvailableRecords.length} active stacks remaining`);
            return false;
        } else {
            console.log('All stacks have been successfully deleted - no active stacks remain');
            return true;
        }
    } catch (error: any) {
        console.error('Error validating stack deletion completion:', error);
        return false; // Assume stacks still exist if we can't validate
    }
}

/**
 * Sync all non-AVAILABLE stack records with CloudFormation
 */
async function syncAllStacks(): Promise<SyncResult> {
    const result: SyncResult = {
        totalProcessed: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        errors: []
    };

    try {
        console.log('Starting periodic CloudFormation synchronization...');

        // Get all non-AVAILABLE records from DynamoDB
        const nonAvailableRecords = await getNonAvailableStackRecords();
        result.totalProcessed = nonAvailableRecords.length;

        console.log(`Found ${nonAvailableRecords.length} non-AVAILABLE records to sync`);

        if (nonAvailableRecords.length === 0) {
            console.log('No records to sync');

            // After sync completion, validate if all stacks have been deleted
            // and disable EventBridge rule if no active stacks remain
            const allStacksDeleted = await validateAllStacksDeletionComplete();
            if (allStacksDeleted) {
                console.log('All stacks confirmed deleted, managing EventBridge rule state...');
                try {
                    await EventBridgeManager.ensureRuleDisabled();
                    console.log('Successfully disabled EventBridge rule after confirming all stacks deleted');
                } catch (ruleError: any) {
                    console.error('Failed to disable EventBridge rule after stack deletion confirmation:', ruleError);
                    // Log the error but don't fail the sync operation
                    // The rule management failure is logged for monitoring but doesn't affect sync success
                }
            }

            return result;
        }

        // Process each record individually to avoid stopping on individual failures
        for (const record of nonAvailableRecords) {
            const syncResult = await syncStackRecord(record);

            if (syncResult.success) {
                result.successfulSyncs++;
            } else {
                result.failedSyncs++;
                result.errors.push({
                    accessCode: record.guid,
                    error: syncResult.error || 'Unknown error'
                });
            }
        }

        console.log(`Sync completed: ${result.successfulSyncs} successful, ${result.failedSyncs} failed`);

        if (result.errors.length > 0) {
            console.warn('Sync errors:', result.errors);
        }

        // After all sync operations complete, validate if all stacks have been successfully deleted
        // and disable EventBridge rule only when sync function confirms no active stacks remain
        const allStacksDeleted = await validateAllStacksDeletionComplete();
        if (allStacksDeleted) {
            console.log('All stacks confirmed deleted after sync, managing EventBridge rule state...');
            try {
                await EventBridgeManager.ensureRuleDisabled();
                console.log('Successfully disabled EventBridge rule after confirming all stacks deleted');
            } catch (ruleError: any) {
                console.error('Failed to disable EventBridge rule after stack deletion confirmation:', ruleError);
                // Log the error but don't fail the sync operation
                // The rule management failure is logged for monitoring but doesn't affect sync success
            }
        } else {
            console.log('Active stacks still remain after sync, keeping EventBridge rule enabled');
        }

        return result;

    } catch (error: any) {
        console.error('Error during sync process:', error);
        throw error;
    }
}

/**
 * Lambda handler for EventBridge scheduled events
 */
export const handler = async (event: EventBridgeEvent<string, any>): Promise<SyncResult> => {
    console.log('StackSyncFunction triggered by EventBridge:', {
        source: event.source,
        detailType: event['detail-type'],
        time: event.time
    });

    try {
        const result = await syncAllStacks();

        // Log metrics for CloudWatch
        console.log('Sync metrics:', {
            totalProcessed: result.totalProcessed,
            successfulSyncs: result.successfulSyncs,
            failedSyncs: result.failedSyncs,
            errorCount: result.errors.length
        });

        return result;

    } catch (error: any) {
        console.error('StackSyncFunction execution failed:', error);

        // Return error result
        return {
            totalProcessed: 0,
            successfulSyncs: 0,
            failedSyncs: 1,
            errors: [{
                accessCode: 'SYNC_PROCESS',
                error: error.message || String(error)
            }]
        };
    }
};