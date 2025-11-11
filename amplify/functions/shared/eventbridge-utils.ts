import { EventBridgeClient, DisableRuleCommand, EnableRuleCommand, DescribeRuleCommand, ListRulesCommand } from '@aws-sdk/client-eventbridge';
import { getNonAvailableStackRecords } from './access-code-utils';

// EventBridge client setup
const eventBridgeClient = new EventBridgeClient({
    region: process.env.REGION || 'us-east-1' // EventBridge rule is in the backend region
});

const SYNC_RULE_NAME_PATTERN = 'StackSyncScheduleRule';

/**
 * Find the actual EventBridge rule name by searching for rules that match our pattern
 */
async function findActualRuleName(): Promise<string> {
    try {
        const command = new ListRulesCommand({});
        const response = await eventBridgeClient.send(command);

        const matchingRule = response.Rules?.find(rule =>
            rule.Name?.includes(SYNC_RULE_NAME_PATTERN)
        );

        if (matchingRule?.Name) {
            console.log(`Found EventBridge rule: ${matchingRule.Name}`);
            return matchingRule.Name;
        }

        // Fallback to the pattern if not found
        console.log(`EventBridge rule not found, using pattern: ${SYNC_RULE_NAME_PATTERN}`);
        return SYNC_RULE_NAME_PATTERN;
    } catch (error) {
        console.error('Error finding EventBridge rule name:', error);
        // Fallback to the pattern if there's an error
        return SYNC_RULE_NAME_PATTERN;
    }
}

export interface RuleState {
    name: string;
    state: 'ENABLED' | 'DISABLED';
    scheduleExpression?: string;
    description?: string;
}

/**
 * EventBridge rule management utility class
 */
export class EventBridgeManager {
    /**
     * Check the count of active (non-AVAILABLE) stacks in DynamoDB
     */
    static async checkActiveStackCount(): Promise<number> {
        try {
            const nonAvailableRecords = await getNonAvailableStackRecords();
            const activeCount = nonAvailableRecords.length;

            console.log(`Active stack count: ${activeCount}`);
            return activeCount;
        } catch (error) {
            console.error('Error checking active stack count:', error);
            throw error;
        }
    }

    /**
     * Enable the EventBridge sync rule
     */
    static async enableSyncRule(): Promise<void> {
        try {
            const ruleName = await findActualRuleName();
            console.log(`Enabling EventBridge rule: ${ruleName}`);

            const command = new EnableRuleCommand({
                Name: ruleName
            });

            await eventBridgeClient.send(command);
            console.log(`Successfully enabled EventBridge rule: ${ruleName}`);
        } catch (error) {
            console.error(`Error enabling EventBridge rule:`, error);
            throw error;
        }
    }

    /**
     * Disable the EventBridge sync rule
     */
    static async disableSyncRule(): Promise<void> {
        try {
            const ruleName = await findActualRuleName();
            console.log(`Disabling EventBridge rule: ${ruleName}`);

            const command = new DisableRuleCommand({
                Name: ruleName
            });

            await eventBridgeClient.send(command);
            console.log(`Successfully disabled EventBridge rule: ${ruleName}`);
        } catch (error) {
            console.error(`Error disabling EventBridge rule:`, error);
            throw error;
        }
    }

    /**
     * Get the current state of the EventBridge sync rule
     */
    static async getCurrentRuleState(): Promise<RuleState> {
        try {
            const ruleName = await findActualRuleName();
            console.log(`Getting current state of EventBridge rule: ${ruleName}`);

            const command = new DescribeRuleCommand({
                Name: ruleName
            });

            const response = await eventBridgeClient.send(command);

            const ruleState: RuleState = {
                name: response.Name || ruleName,
                state: response.State as 'ENABLED' | 'DISABLED',
                scheduleExpression: response.ScheduleExpression,
                description: response.Description
            };

            console.log(`Current rule state:`, ruleState);
            return ruleState;
        } catch (error) {
            console.error(`Error getting current state of EventBridge rule:`, error);
            throw error;
        }
    }

    /**
     * Log rule state changes for monitoring purposes
     */
    static logRuleStateChange(oldState: string, newState: string, reason: string, ruleName?: string): void {
        const logMessage = {
            timestamp: new Date().toISOString(),
            ruleName: ruleName || SYNC_RULE_NAME_PATTERN,
            oldState,
            newState,
            reason,
            message: `EventBridge rule state changed from ${oldState} to ${newState}. Reason: ${reason}`
        };

        console.log('EventBridge rule state change:', JSON.stringify(logMessage, null, 2));
    }

    /**
     * Manage rule state based on active stack count
     * Enables rule if there are active stacks, disables if no active stacks
     */
    static async manageRuleBasedOnStackCount(): Promise<void> {
        try {
            const activeStackCount = await this.checkActiveStackCount();
            const currentRuleState = await this.getCurrentRuleState();

            const shouldBeEnabled = activeStackCount > 0;
            const isCurrentlyEnabled = currentRuleState.state === 'ENABLED';

            if (shouldBeEnabled && !isCurrentlyEnabled) {
                // Enable rule when there are active stacks
                await this.enableSyncRule();
                this.logRuleStateChange('DISABLED', 'ENABLED', `Active stacks detected: ${activeStackCount}`, currentRuleState.name);
            } else if (!shouldBeEnabled && isCurrentlyEnabled) {
                // Disable rule when there are no active stacks
                await this.disableSyncRule();
                this.logRuleStateChange('ENABLED', 'DISABLED', 'No active stacks remaining', currentRuleState.name);
            } else {
                // No change needed
                console.log(`EventBridge rule state is already correct: ${currentRuleState.state} (active stacks: ${activeStackCount})`);
            }
        } catch (error) {
            console.error('Error managing EventBridge rule based on stack count:', error);
            // Don't throw the error - rule management failures shouldn't block stack operations
            console.log('Continuing with stack operation despite EventBridge rule management failure');
        }
    }

    /**
     * Ensure rule is enabled (used when deploying first stack)
     */
    static async ensureRuleEnabled(): Promise<void> {
        try {
            const currentRuleState = await this.getCurrentRuleState();

            if (currentRuleState.state !== 'ENABLED') {
                await this.enableSyncRule();
                this.logRuleStateChange(currentRuleState.state, 'ENABLED', 'Ensuring rule is enabled for stack synchronization', currentRuleState.name);
            } else {
                console.log('EventBridge rule is already enabled');
            }
        } catch (error) {
            console.error('Error ensuring EventBridge rule is enabled:', error);
            // Don't throw the error - rule management failures shouldn't block stack operations
            console.log('Continuing with stack operation despite EventBridge rule management failure');
        }
    }

    /**
     * Ensure rule is disabled (used when deleting last stack)
     */
    static async ensureRuleDisabled(): Promise<void> {
        try {
            const currentRuleState = await this.getCurrentRuleState();

            if (currentRuleState.state !== 'DISABLED') {
                await this.disableSyncRule();
                this.logRuleStateChange(currentRuleState.state, 'DISABLED', 'Ensuring rule is disabled - no active stacks', currentRuleState.name);
            } else {
                console.log('EventBridge rule is already disabled');
            }
        } catch (error) {
            console.error('Error ensuring EventBridge rule is disabled:', error);
            // Don't throw the error - rule management failures shouldn't block stack operations
            console.log('Continuing with stack operation despite EventBridge rule management failure');
        }
    }
}