# Configuration Guide

This guide explains how to configure the CloudFormation Deployment Portal for your specific use case.

## Configuration File

The portal configuration is centralized in `amplify/deployment-config.json`. This is the single file you need to edit to configure all deployment settings.

**Configuration Location:**
Edit `amplify/deployment-config.json` to configure your deployment settings.

**Benefits of JSON Configuration:**
- Single source of truth - edit one file only
- Used at build time to set Lambda environment variables
- Used at runtime by backend.ts for IAM policy configuration
- Simple JSON format, easy to understand and modify
- No need to edit TypeScript files

**How It Works:**
The JSON configuration is read at build time by `amplify/functions/shared/deployment-config.ts`, which converts it to environment variables for Lambda functions. The same JSON file is also read by `amplify/backend.ts` for configuring IAM policies.

### Configuration Schema

```json
{
  "templateUrl": "string (required)",
  "stackNamePrefix": "string (optional, default: deployment-stack)",
  "accessCodePoolSize": "number (optional, default: 60)",
  "region": "string (optional, default: us-east-1)",
  "templateParameters": "object (optional, default: {})"
}
```

### Configuration Options

#### templateUrl (required)

The URL to your CloudFormation template. Must be accessible from AWS Lambda.

**Format**: HTTPS URL to a CloudFormation template (YAML or JSON)

**Examples**:
```json
"templateUrl": "https://my-bucket.s3.us-east-1.amazonaws.com/my-template.yaml"
"templateUrl": "https://my-bucket.s3.amazonaws.com/templates/workshop-v2.json"
```

**Requirements**:
- Must use HTTPS protocol
- Template must be accessible from the AWS region where Lambda functions are deployed
- S3 bucket must have appropriate permissions for Lambda execution role

#### stackNamePrefix (optional)

Prefix for deployed CloudFormation stack names. Stacks will be named `{prefix}-{accessCode}`.

**Default**: `"deployment-stack"`

**Format**: String following CloudFormation naming requirements (alphanumeric and hyphens only)

**Examples**:
```json
"stackNamePrefix": "workshop-stack"
"stackNamePrefix": "demo-env"
"stackNamePrefix": "training-lab"
```

**Requirements**:
- Must contain only alphanumeric characters and hyphens
- Must start with an alphabetic character
- Maximum length: 128 characters (including the Access Code suffix)

#### accessCodePoolSize (optional)

Number of Access Codes to generate during deployment. Determines how many concurrent stacks can be deployed.

**Default**: `60`

**Format**: Positive integer

**Examples**:
```json
"accessCodePoolSize": 30    // Small workshop
"accessCodePoolSize": 100   // Large training event
"accessCodePoolSize": 10    // Demo environment
```

**Requirements**:
- Must be a positive integer (minimum: 1)
- Recommended maximum: 1000 (for DynamoDB performance)
- Consider your expected concurrent users and stack lifecycle

#### region (optional)

AWS region where CloudFormation stacks will be deployed.

**Default**: Current AWS region where Lambda functions are deployed

**Format**: AWS region identifier

**Examples**:
```json
"region": "us-east-1"
"region": "eu-west-1"
"region": "ap-southeast-1"
```

**Requirements**:
- Must be a valid AWS region identifier
- Template URL must be accessible from this region
- Lambda execution role must have permissions in this region

#### templateParameters (optional)

Default parameters to pass to the CloudFormation template. These can be overridden per deployment via the API.

**Default**: `{}` (empty object)

**Format**: Object with string keys and string values

**Examples**:
```json
"templateParameters": {
  "InstanceType": "t3.micro",
  "KeyName": "my-key-pair",
  "VPC": "vpc-12345678",
  "Subnet": "subnet-12345678"
}
```

**Requirements**:
- Keys must match parameter names in your CloudFormation template
- Values must be strings (even for numbers or booleans)
- Required template parameters must be provided either here or via API

## Configuration Examples

### Example 1: Basic Web Application

Simple web application deployment with minimal configuration:

**TypeScript Configuration:**
```typescript
export const DEPLOYMENT_CONFIG = {
  TEMPLATE_URL: 'https://my-templates.s3.us-east-1.amazonaws.com/webapp.yaml',
  STACK_NAME_PREFIX: 'webapp-demo',
  ACCESS_CODE_POOL_SIZE: '30',
  TEMPLATE_PARAMETERS: '{}'
} as const;
```

**Legacy JSON Configuration:**
```json
{
  "templateUrl": "https://my-templates.s3.us-east-1.amazonaws.com/webapp.yaml",
  "stackNamePrefix": "webapp-demo",
  "accessCodePoolSize": 30
}
```

### Example 2: Workshop with EC2 Instances

Workshop environment with EC2 instances and networking parameters:

```json
{
  "templateUrl": "https://workshop-templates.s3.us-west-2.amazonaws.com/ec2-lab.yaml",
  "stackNamePrefix": "workshop-stack",
  "accessCodePoolSize": 100,
  "region": "us-west-2",
  "templateParameters": {
    "InstanceType": "t3.micro",
    "KeyName": "workshop-key",
    "VPC": "vpc-0a1b2c3d4e5f6g7h8",
    "Subnet": "subnet-0a1b2c3d4e5f6g7h8",
    "LatestAmiId": "/aws/service/ami-amazon-linux-latest/amzn2-ami-hvm-x86_64-gp2"
  }
}
```

### Example 3: Development Environment

Full-stack development environment with database:

```json
{
  "templateUrl": "https://dev-templates.s3.eu-west-1.amazonaws.com/full-stack.yaml",
  "stackNamePrefix": "dev-env",
  "accessCodePoolSize": 20,
  "region": "eu-west-1",
  "templateParameters": {
    "Environment": "development",
    "DatabaseInstanceClass": "db.t3.small",
    "DatabaseAllocatedStorage": "20",
    "ApplicationInstanceType": "t3.small"
  }
}
```

### Example 4: Training Lab with Multiple Resources

Complex training lab with multiple AWS services:

```json
{
  "templateUrl": "https://training-bucket.s3.ap-southeast-1.amazonaws.com/advanced-lab.yaml",
  "stackNamePrefix": "training-lab",
  "accessCodePoolSize": 50,
  "region": "ap-southeast-1",
  "templateParameters": {
    "LabDuration": "4",
    "EnableMonitoring": "true",
    "S3BucketPrefix": "training-lab",
    "NotificationEmail": "admin@example.com"
  }
}
```

### Example 5: Minimal Configuration

Minimal configuration using all defaults:

```json
{
  "templateUrl": "https://my-bucket.s3.amazonaws.com/simple-template.yaml"
}
```

This will use:
- Stack prefix: `deployment-stack`
- Pool size: `60`
- Region: Current Lambda region
- No template parameters

## Configuration Validation

The portal validates your configuration when Lambda functions start (cold start). Validation checks:

1. **Template URL**: Must be a valid HTTPS URL
2. **Stack Prefix**: Must follow CloudFormation naming requirements
3. **Pool Size**: Must be a positive integer
4. **Region**: Must be a valid AWS region identifier
5. **Template Parameters**: Must be an object with string values

### Validation Errors

If validation fails, you'll see errors in CloudWatch Logs:

```
Configuration validation failed: templateUrl is required
Configuration validation failed: stackNamePrefix must contain only alphanumeric characters and hyphens
Configuration validation failed: accessCodePoolSize must be a positive integer
```

## Updating Configuration

To update your configuration:

1. Edit `amplify/functions/shared/deployment-config.ts`
2. Redeploy the backend: `npx ampx deploy` (or restart sandbox: `npm run amplify:sandbox`)
3. Lambda functions will automatically use the new configuration on next invocation

**How Configuration is Applied:**
The `deployment-config.json` file is read at build time and converted to environment variables that are injected into Lambda functions during deployment.

**Note**: Changing `ACCESS_CODE_POOL_SIZE` after initial deployment will not add or remove Access Codes. The pool size is only used during initial deployment.

## Access Code Terminology

Access Codes are randomly-generated UUIDs that serve as unique identifiers for deployed CloudFormation stacks. They replace the previous "GUID" or "Participant Code" terminology.

**Format**: UUID v4 (e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

**Purpose**:
- Unique identifier for each deployed stack
- Used by end users to access their stack outputs
- Prevents enumeration attacks (random UUIDs)
- Simplifies stack management for administrators

**Lifecycle**:
1. Generated automatically during Amplify deployment
2. Stored in DynamoDB with status `AVAILABLE`
3. Assigned to a stack when deployed (status changes to `CREATE_IN_PROGRESS`, etc.)
4. Returned to `AVAILABLE` when stack is deleted
5. Can be reused for new deployments

## IAM Permissions

Your CloudFormation template may require specific IAM permissions. Ensure your Lambda execution roles have appropriate permissions for the resources your template creates.

### Common Permissions Needed

- **EC2 Instances**: `ec2:*` permissions
- **RDS Databases**: `rds:*` permissions
- **S3 Buckets**: `s3:*` permissions
- **IAM Roles**: `iam:CreateRole`, `iam:AttachRolePolicy`, etc.
- **VPC Resources**: `ec2:CreateVpc`, `ec2:CreateSubnet`, etc.

### Updating IAM Policies

IAM policies are defined in `amplify/backend.ts`. Update the `stackDeployerFunction` policy to include permissions for your template's resources.

## Template Requirements

Your CloudFormation template should:

1. **Outputs**: Define outputs that you want to display to end users
2. **Parameters**: Use parameters for configurable values
3. **Tags**: Consider adding tags for resource tracking
4. **Deletion Policy**: Set appropriate deletion policies for data resources

### Recommended Outputs

```yaml
Outputs:
  ApplicationURL:
    Description: URL to access the application
    Value: !GetAtt LoadBalancer.DNSName
  
  DatabaseEndpoint:
    Description: Database connection endpoint
    Value: !GetAtt Database.Endpoint.Address
  
  AccessInstructions:
    Description: Instructions for accessing resources
    Value: "Connect using the provided credentials"
```

## Troubleshooting

### Configuration Not Loading

**Symptom**: Lambda functions return errors about missing configuration

**Solutions**:
- Verify `amplify/functions/shared/deployment-config.ts` is properly configured
- Check that all required fields are present
- Ensure configuration values are valid
- Redeploy the backend after making changes

### Template URL Not Accessible

**Symptom**: Deployments fail with "template not found" errors

**Solutions**:
- Verify S3 bucket permissions allow Lambda access
- Check template URL is correct and accessible
- Ensure HTTPS protocol is used
- Verify region matches or bucket allows cross-region access

### Stack Name Conflicts

**Symptom**: Deployments fail with "stack already exists" errors

**Solutions**:
- Change `stackNamePrefix` to a unique value
- Delete existing stacks with conflicting names
- Ensure Access Codes are properly tracked in DynamoDB

### Parameter Validation Errors

**Symptom**: CloudFormation returns parameter validation errors

**Solutions**:
- Verify all required template parameters are provided
- Check parameter values match template constraints
- Ensure parameter values are strings in configuration
- Review CloudFormation template parameter definitions

## Best Practices

1. **Use Descriptive Prefixes**: Choose stack prefixes that clearly identify the purpose
2. **Right-Size Pool**: Set pool size based on expected concurrent users
3. **Parameterize Templates**: Use parameters for values that may change
4. **Test Configuration**: Test with a small pool size first
5. **Monitor Costs**: Track CloudFormation stack costs in AWS Cost Explorer
6. **Document Parameters**: Document required parameters for your team
7. **Version Templates**: Use versioned template URLs for reproducibility
8. **Secure Credentials**: Never hardcode credentials in templates or configuration

## Additional Resources

- [AWS CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)
- [CloudFormation Best Practices](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/best-practices.html)
- [AWS Amplify Gen2 Documentation](https://docs.amplify.aws/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
