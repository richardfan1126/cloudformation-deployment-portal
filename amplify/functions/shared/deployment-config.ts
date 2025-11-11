/**
 * Centralized deployment configuration
 * This file reads from deployment-config.json at build time
 * Users should edit deployment-config.json, not this file
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface DeploymentConfigJson {
    templateUrl: string;
    stackNamePrefix: string;
    accessCodePoolSize: number;
    region: string;
    templateParameters: Record<string, string>;
}

function loadConfig(): DeploymentConfigJson {
    try {
        const configPath = join(__dirname, '../../deployment-config.json');
        const configContent = readFileSync(configPath, 'utf-8');
        return JSON.parse(configContent);
    } catch (error) {
        console.error('Failed to load deployment-config.json:', error);
        throw new Error('deployment-config.json is required');
    }
}

const config = loadConfig();

export const DEPLOYMENT_CONFIG = {
    TEMPLATE_URL: config.templateUrl,
    STACK_NAME_PREFIX: config.stackNamePrefix,
    ACCESS_CODE_POOL_SIZE: String(config.accessCodePoolSize),
    REGION: config.region,
    TEMPLATE_PARAMETERS: JSON.stringify(config.templateParameters),
} as const;
