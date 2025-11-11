import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Deployment configuration interface
 */
export interface DeploymentConfig {
    templateUrl: string;
    stackNamePrefix?: string;
    accessCodePoolSize?: number;
    region?: string;
    templateParameters?: Record<string, string>;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<DeploymentConfig> = {
    stackNamePrefix: 'deployment-stack',
    accessCodePoolSize: 60,
    region: 'us-east-1',
    templateParameters: {},
};

/**
 * Cached configuration to avoid repeated file reads
 */
let cachedConfig: DeploymentConfig | null = null;

/**
 * Load deployment configuration from environment variables (set at build time from JSON)
 * @returns Deployment configuration with defaults applied
 * @throws Error if configuration is invalid or missing required fields
 */
export function loadDeploymentConfig(): DeploymentConfig {
    // Return cached configuration if available
    if (cachedConfig) {
        return cachedConfig;
    }

    try {
        // Load from environment variables (set at build time from deployment-config.json)
        console.log('Loading configuration from environment variables');
        const config: Partial<DeploymentConfig> = {
            templateUrl: process.env.TEMPLATE_URL,
            stackNamePrefix: process.env.STACK_NAME_PREFIX,
            accessCodePoolSize: process.env.ACCESS_CODE_POOL_SIZE
                ? parseInt(process.env.ACCESS_CODE_POOL_SIZE, 10)
                : undefined,
            region: process.env.REGION,
            templateParameters: process.env.TEMPLATE_PARAMETERS
                ? JSON.parse(process.env.TEMPLATE_PARAMETERS)
                : undefined,
        };

        // Apply defaults for optional fields
        const mergedConfig = {
            ...DEFAULT_CONFIG,
            ...config,
            templateParameters: {
                ...DEFAULT_CONFIG.templateParameters,
                ...(config.templateParameters || {}),
            },
        } as DeploymentConfig;

        // Validate configuration
        validateConfig(mergedConfig);

        // Cache the configuration
        cachedConfig = mergedConfig;

        console.log('Configuration loaded successfully:', {
            templateUrl: mergedConfig.templateUrl,
            stackNamePrefix: mergedConfig.stackNamePrefix,
            accessCodePoolSize: mergedConfig.accessCodePoolSize,
            region: mergedConfig.region,
            parameterCount: Object.keys(mergedConfig.templateParameters || {}).length,
        });

        return mergedConfig;
    } catch (error) {
        if (error instanceof Error) {
            console.error('Failed to load deployment configuration:', error.message);
            throw new Error(`Configuration error: ${error.message}`);
        }
        throw error;
    }
}

/**
 * Validate deployment configuration
 * @param config Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: DeploymentConfig): void {
    // Validate required fields
    if (!config.templateUrl) {
        throw new Error('templateUrl is required in deployment configuration');
    }

    // Validate template URL format
    if (!isValidUrl(config.templateUrl)) {
        throw new Error(`Invalid templateUrl format: ${config.templateUrl}. Must be a valid HTTPS URL.`);
    }

    // Validate stack name prefix
    if (config.stackNamePrefix) {
        if (!isValidStackPrefix(config.stackNamePrefix)) {
            throw new Error(
                `Invalid stackNamePrefix: ${config.stackNamePrefix}. ` +
                'Must contain only alphanumeric characters and hyphens, ' +
                'start with a letter, and be 1-128 characters long.'
            );
        }
    }

    // Validate pool size
    if (config.accessCodePoolSize !== undefined) {
        if (!Number.isInteger(config.accessCodePoolSize) ||
            config.accessCodePoolSize < 1 ||
            config.accessCodePoolSize > 1000) {
            throw new Error(
                `Invalid accessCodePoolSize: ${config.accessCodePoolSize}. ` +
                'Must be a positive integer between 1 and 1000.'
            );
        }
    }

    // Validate region format
    if (config.region && !isValidRegion(config.region)) {
        throw new Error(
            `Invalid region: ${config.region}. ` +
            'Must be a valid AWS region (e.g., us-east-1, eu-west-1).'
        );
    }

    // Validate template parameters
    if (config.templateParameters) {
        if (typeof config.templateParameters !== 'object' || Array.isArray(config.templateParameters)) {
            throw new Error('templateParameters must be a key-value object');
        }

        // Validate each parameter
        for (const [key, value] of Object.entries(config.templateParameters)) {
            if (typeof key !== 'string' || key.trim() === '') {
                throw new Error('Template parameter keys must be non-empty strings');
            }
            if (typeof value !== 'string') {
                throw new Error(`Template parameter value for "${key}" must be a string`);
            }
        }
    }
}

/**
 * Validate URL format (must be HTTPS)
 * @param url URL to validate
 * @returns true if valid, false otherwise
 */
function isValidUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Validate CloudFormation stack name prefix
 * @param prefix Prefix to validate
 * @returns true if valid, false otherwise
 */
function isValidStackPrefix(prefix: string): boolean {
    // CloudFormation stack names must:
    // - Start with a letter
    // - Contain only alphanumeric characters and hyphens
    // - Be 1-128 characters long
    const stackPrefixRegex = /^[a-zA-Z][a-zA-Z0-9-]{0,127}$/;
    return stackPrefixRegex.test(prefix);
}

/**
 * Validate AWS region format
 * @param region Region to validate
 * @returns true if valid, false otherwise
 */
function isValidRegion(region: string): boolean {
    // Basic AWS region format validation
    const regionRegex = /^[a-z]{2}-[a-z]+-\d{1}$/;
    return regionRegex.test(region);
}

/**
 * Clear cached configuration (useful for testing)
 */
export function clearConfigCache(): void {
    cachedConfig = null;
}
