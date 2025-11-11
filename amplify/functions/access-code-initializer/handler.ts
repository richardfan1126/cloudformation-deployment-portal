import { v4 as uuidv4 } from 'uuid';
import { loadDeploymentConfig } from '../shared/config-loader';
import { initializeAccessCodePool } from '../shared/access-code-utils';

/**
 * CloudFormation Custom Resource Event interface
 */
interface CloudFormationCustomResourceEvent {
    RequestType: 'Create' | 'Update' | 'Delete';
    ResponseURL: string;
    StackId: string;
    RequestId: string;
    ResourceType: string;
    LogicalResourceId: string;
    PhysicalResourceId?: string;
    ResourceProperties: {
        ServiceToken: string;
        [key: string]: any;
    };
    OldResourceProperties?: {
        [key: string]: any;
    };
}

/**
 * CloudFormation Custom Resource Response interface
 */
interface CloudFormationCustomResourceResponse {
    Status: 'SUCCESS' | 'FAILED';
    Reason?: string;
    PhysicalResourceId: string;
    StackId: string;
    RequestId: string;
    LogicalResourceId: string;
    Data?: {
        [key: string]: any;
    };
}

/**
 * Lambda handler for Access Code initializer custom resource
 * Generates random UUID Access Codes and initializes DynamoDB table
 */
export const handler = async (event: CloudFormationCustomResourceEvent): Promise<void> => {
    console.log('Access Code Initializer invoked:', JSON.stringify(event, null, 2));

    try {
        // Load deployment configuration
        const config = loadDeploymentConfig();
        const poolSize = config.accessCodePoolSize || 60;

        console.log(`Pool size configured: ${poolSize}`);

        if (event.RequestType === 'Create') {
            console.log('Handling Create event - generating Access Codes');

            // Generate random UUID Access Codes
            const accessCodes = Array.from({ length: poolSize }, () => uuidv4());
            console.log(`Generated ${accessCodes.length} Access Codes`);

            // Initialize DynamoDB table with generated Access Codes
            await initializeAccessCodePool(accessCodes);

            // Send success response
            await sendResponse(event, 'SUCCESS', {
                PhysicalResourceId: 'AccessCodePool',
                Data: {
                    PoolSize: poolSize,
                    AccessCodesGenerated: accessCodes.length
                }
            });

            console.log('Access Code pool initialization complete');
        } else if (event.RequestType === 'Update') {
            console.log('Handling Update event');

            // For updates, we could handle pool size changes
            // For now, we'll just acknowledge the update without changes
            // Future enhancement: Add/remove Access Codes based on pool size change

            await sendResponse(event, 'SUCCESS', {
                PhysicalResourceId: event.PhysicalResourceId || 'AccessCodePool',
                Data: {
                    PoolSize: poolSize,
                    Message: 'Update acknowledged - pool size changes not yet implemented'
                }
            });

            console.log('Update event handled');
        } else if (event.RequestType === 'Delete') {
            console.log('Handling Delete event');

            // No cleanup needed - DynamoDB table will be deleted by CDK
            await sendResponse(event, 'SUCCESS', {
                PhysicalResourceId: event.PhysicalResourceId || 'AccessCodePool',
                Data: {
                    Message: 'Delete acknowledged - no cleanup required'
                }
            });

            console.log('Delete event handled');
        }
    } catch (error) {
        console.error('Error in Access Code initializer:', error);

        // Send failure response to CloudFormation
        await sendResponse(event, 'FAILED', {
            PhysicalResourceId: event.PhysicalResourceId || 'AccessCodePool',
            Reason: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
};

/**
 * Send response to CloudFormation custom resource
 */
async function sendResponse(
    event: CloudFormationCustomResourceEvent,
    status: 'SUCCESS' | 'FAILED',
    options: {
        PhysicalResourceId: string;
        Data?: { [key: string]: any };
        Reason?: string;
    }
): Promise<void> {
    const responseBody: CloudFormationCustomResourceResponse = {
        Status: status,
        Reason: options.Reason || (status === 'SUCCESS' ? 'See CloudWatch logs for details' : 'Operation failed'),
        PhysicalResourceId: options.PhysicalResourceId,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: options.Data
    };

    console.log('Sending response to CloudFormation:', JSON.stringify(responseBody, null, 2));

    try {
        const response = await fetch(event.ResponseURL, {
            method: 'PUT',
            headers: {
                'Content-Type': ''
            },
            body: JSON.stringify(responseBody)
        });

        if (!response.ok) {
            console.error('Failed to send response to CloudFormation:', response.statusText);
        } else {
            console.log('Successfully sent response to CloudFormation');
        }
    } catch (error) {
        console.error('Error sending response to CloudFormation:', error);
        // Don't throw - we've already logged the error
    }
}
