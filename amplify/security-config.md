# Security Configuration

## IAM Permissions

### Lambda Execution Roles

#### Access Code Manager Function
- **CloudFormation Permissions:**
  - `cloudformation:ListStacks` - List all CloudFormation stacks
  - `cloudformation:DescribeStacks` - Get stack details and tags
  - `cloudformation:ListStackResources` - List resources in stacks
  - `cloudformation:GetTemplate` - Read stack templates
  - Resource: `*` (Required for listing and describing stacks across all regions)
- **DynamoDB Permissions:**
  - `dynamodb:GetItem` - Get specific Access Code details
  - `dynamodb:PutItem` - Create new stack records
  - `dynamodb:UpdateItem` - Update stack record status
  - `dynamodb:DeleteItem` - Remove stack records
  - `dynamodb:Query` - Query Access Code status
  - `dynamodb:Scan` - Read all Access Code records
  - `dynamodb:BatchGetItem` - Batch retrieve multiple Access Code records
  - `dynamodb:BatchWriteItem` - Batch write Access Code records
  - Resource: DynamoDB table ARN (workshop-portal-stacks)

#### Stack Deployer Function

**⚠️ EXAMPLE CONFIGURATION:** The permissions below are configured for the AWS Lambda sample template. You MUST customize these based on your specific CloudFormation template requirements.

- **CloudFormation Permissions:**
  - `cloudformation:CreateStack` - Create new CloudFormation stacks
  - `cloudformation:UpdateStack` - Update existing stacks
  - `cloudformation:DeleteStack` - Delete stacks (for cleanup)
  - `cloudformation:DescribeStacks` - Get stack details and status
  - `cloudformation:DescribeStackEvents` - Monitor stack events
  - `cloudformation:DescribeStackResources` - Get stack resource details
  - `cloudformation:ListStackResources` - List all resources in stacks
  - Resource: `arn:aws:cloudformation:*:*:stack/{configurable-prefix}-*/*` (prefix from deployment-config.json)
  - Backward compatibility: `arn:aws:cloudformation:*:*:stack/portal-stack-*/*`
  - `cloudformation:ListStacks` - List stacks for Access Code availability (Resource: `*`)
  - `cloudformation:GetTemplate` - Read templates (Resource: `*`)
  - `cloudformation:ValidateTemplate` - Validate templates before deployment (Resource: `*`)

- **S3 Permissions:**
  - `s3:GetObject` - Read CloudFormation templates from S3
  - `s3:GetObjectVersion` - Read specific template versions
  - Resource: `arn:aws:s3:::*/*` (Allow access to any S3 bucket for template retrieval. Restrict to specific buckets in production.)

- **IAM Role Permissions (Example for S3 Launch Role template):**
  - `iam:CreateRole` - Create IAM roles for S3 access
  - `iam:GetRole` - Retrieve role information
  - `iam:AttachRolePolicy` - Attach managed policies to roles
  - `iam:PutRolePolicy` - Create inline policies for roles
  - `iam:GetRolePolicy` - Get inline policy details
  - `iam:ListRolePolicies` - List inline policies
  - `iam:ListAttachedRolePolicies` - List attached managed policies
  - `iam:PassRole` - Pass roles to AWS services
  - `iam:TagRole` - Tag IAM roles
  - `iam:UntagRole` - Remove tags from roles
  - `iam:UpdateAssumeRolePolicy` - Update trust relationships
  - Resource: `arn:aws:iam::*:role/SC-*`

- **IAM Policy Permissions (Example for S3 Launch Role template):**
  - `iam:CreatePolicy` - Create IAM policies for S3 access
  - `iam:GetPolicy` - Get policy details
  - `iam:GetPolicyVersion` - Get policy version details
  - `iam:ListPolicyVersions` - List policy versions
  - `iam:DeletePolicy` - Delete policies
  - `iam:DeletePolicyVersion` - Delete policy versions
  - `iam:CreatePolicyVersion` - Create new policy versions
  - Resource: `arn:aws:iam::*:policy/SC-*`

- **DynamoDB Permissions:**
  - `dynamodb:GetItem` - Get specific Access Code details
  - `dynamodb:PutItem` - Create new stack records
  - `dynamodb:UpdateItem` - Update stack record status
  - `dynamodb:DeleteItem` - Remove stack records
  - `dynamodb:Query` - Query Access Code status
  - `dynamodb:Scan` - Read Access Code pool
  - `dynamodb:BatchGetItem` - Batch retrieve multiple Access Code records
  - `dynamodb:BatchWriteItem` - Batch write Access Code records
  - Resource: DynamoDB table ARN (workshop-portal-stacks)

- **EventBridge Permissions:**
  - `events:PutRule` - Create or update EventBridge rules
  - `events:EnableRule` - Enable sync rule when stacks are deployed
  - `events:DisableRule` - Disable sync rule when no stacks exist
  - `events:DescribeRule` - Get current rule state
  - `events:ListRules` - Find sync rule by pattern
  - Resource: `arn:aws:events:*:*:rule/*StackSyncScheduleRule*`
  - ListRules requires wildcard resource: `*`

#### Stack Deleter Function

**⚠️ EXAMPLE CONFIGURATION:** The permissions below are configured for the AWS Lambda sample template. You MUST customize these based on your specific CloudFormation template requirements.

- **CloudFormation Permissions:**
  - `cloudformation:DeleteStack` - Delete CloudFormation stacks
  - `cloudformation:DescribeStacks` - Get stack details and status
  - `cloudformation:DescribeStackEvents` - Monitor deletion events
  - `cloudformation:DescribeStackResources` - Get resource information
  - `cloudformation:ListStackResources` - List resources in stacks
  - Resource: `arn:aws:cloudformation:*:*:stack/{configurable-prefix}-*/*` (prefix from deployment-config.json)
  - Backward compatibility: `arn:aws:cloudformation:*:*:stack/portal-stack-*/*`
  - `cloudformation:ListStacks` - Find stacks by Access Code tags (Resource: `*`)

- **IAM Role Deletion (Example for S3 Launch Role template):**
  - `iam:DeleteRole` - Delete IAM roles created by stacks
  - `iam:GetRole` - Get role information for validation
  - `iam:DetachRolePolicy` - Detach managed policies from roles
  - `iam:DeleteRolePolicy` - Delete inline policies from roles
  - `iam:ListRolePolicies` - List inline policies
  - `iam:ListAttachedRolePolicies` - List attached managed policies
  - Resource: `arn:aws:iam::*:role/SC-*`

- **IAM Policy Deletion (Example for S3 Launch Role template):**
  - `iam:DeletePolicy` - Delete IAM policies created by stacks
  - `iam:GetPolicy` - Get policy information for validation
  - `iam:ListPolicyVersions` - List policy versions before deletion
  - `iam:DeletePolicyVersion` - Delete policy versions
  - Resource: `arn:aws:iam::*:policy/SC-*`

- **DynamoDB Permissions:**
  - `dynamodb:GetItem` - Get specific Access Code details
  - `dynamodb:PutItem` - Create new stack records
  - `dynamodb:UpdateItem` - Update Access Code status after deletion
  - `dynamodb:DeleteItem` - Remove stack records
  - `dynamodb:Query` - Query Access Code status
  - `dynamodb:Scan` - Read all Access Code records
  - `dynamodb:BatchGetItem` - Batch retrieve multiple Access Code records
  - `dynamodb:BatchWriteItem` - Batch write Access Code records
  - Resource: DynamoDB table ARN (workshop-portal-stacks)

#### Stack Output Retriever Function
- **CloudFormation Permissions:**
  - `cloudformation:DescribeStacks` - Get stack outputs and details
  - `cloudformation:ListStacks` - Find stacks by Access Code tags
  - `cloudformation:DescribeStackResources` - Get resource information
  - `cloudformation:ListStackResources` - List stack resources
  - Resource: `*` (Required for listing and describing stacks across all regions)
- **DynamoDB Permissions:**
  - `dynamodb:GetItem` - Get cached stack outputs
  - `dynamodb:PutItem` - Cache stack outputs
  - `dynamodb:UpdateItem` - Update cached outputs
  - `dynamodb:DeleteItem` - Remove cached outputs
  - `dynamodb:Query` - Query stack by Access Code
  - `dynamodb:Scan` - Read all stack records
  - `dynamodb:BatchGetItem` - Batch retrieve multiple stack records
  - `dynamodb:BatchWriteItem` - Batch write stack records
  - Resource: DynamoDB table ARN (workshop-portal-stacks)

#### Stack Sync Function
- **CloudFormation Permissions:**
  - `cloudformation:DescribeStacks` - Get current stack status and outputs
  - `cloudformation:ListStacks` - List stacks for synchronization
  - `cloudformation:DescribeStackResources` - Get resource information
  - `cloudformation:ListStackResources` - List stack resources
  - Resource: `*` (Required for listing and describing stacks across all regions)
- **DynamoDB Permissions:**
  - `dynamodb:GetItem` - Get stack records for synchronization
  - `dynamodb:PutItem` - Create new stack records
  - `dynamodb:UpdateItem` - Update stack status and outputs
  - `dynamodb:DeleteItem` - Remove deleted stack records
  - `dynamodb:Query` - Query stack records
  - `dynamodb:Scan` - Read all non-AVAILABLE stack records
  - `dynamodb:BatchGetItem` - Batch retrieve multiple stack records
  - `dynamodb:BatchWriteItem` - Batch write stack records
  - Resource: DynamoDB table ARN (workshop-portal-stacks)
- **EventBridge Permissions:**
  - `events:PutRule` - Create or update EventBridge rules
  - `events:EnableRule` - Enable sync rule when stacks exist
  - `events:DisableRule` - Disable sync rule when all stacks are deleted
  - `events:DescribeRule` - Get current rule state
  - `events:ListRules` - Find sync rule by pattern
  - Resource: `arn:aws:events:*:*:rule/*StackSyncScheduleRule*`
  - ListRules requires wildcard resource: `*`

#### Access Code Initializer Function
- **DynamoDB Permissions:**
  - `dynamodb:GetItem` - Check for existing Access Codes
  - `dynamodb:PutItem` - Initialize Access Code pool
  - `dynamodb:UpdateItem` - Update Access Code records
  - `dynamodb:DeleteItem` - Remove Access Code records
  - `dynamodb:Query` - Query Access Code pool
  - `dynamodb:Scan` - Read all Access Code records
  - `dynamodb:BatchGetItem` - Batch retrieve Access Code records
  - `dynamodb:BatchWriteItem` - Batch write Access Codes
  - Resource: DynamoDB table ARN (workshop-portal-stacks)
- **CloudFormation Custom Resource:**
  - Responds to CloudFormation custom resource lifecycle events (Create, Update, Delete)
  - Sends responses to CloudFormation via pre-signed S3 URL

## API Gateway Security

### Authentication
- **Admin Endpoints:** Protected with AWS Cognito User Pool authentication
  - `/admin/access-code-statuses` - Requires valid JWT token
  - `/admin/deploy` - Requires valid JWT token
  - `/admin/stack/{accessCode}` - Requires valid JWT token (DELETE)
  - `/admin/stack/{accessCode}/deletion-status` - Requires valid JWT token (GET)
  - `/admin/stacks/all` - Requires valid JWT token (DELETE)
  - `/admin/stacks/deletion-status` - Requires valid JWT token (GET)
- **Public Endpoints:** No authentication required
  - `/public/stack-outputs/{accessCode}` - Public access

### CORS Configuration
- **Allowed Origins:** `*` (configure to specific domain in production)
- **Allowed Headers:**
  - `Content-Type`
  - `X-Amz-Date`
  - `Authorization`
  - `X-Api-Key`
  - `X-Amz-Security-Token`
  - `X-Amz-User-Agent`
- **Allowed Methods:** `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`
- **Allow Credentials:** `true`
- **Max Age:** 86400 seconds (24 hours)

### Security Headers
All Lambda functions return the following security headers:

- **Content Security:**
  - `X-Content-Type-Options: nosniff` - Prevent MIME type sniffing
  - `X-Frame-Options: DENY` - Prevent clickjacking
  - `X-XSS-Protection: 1; mode=block` - Enable XSS protection

- **Transport Security:**
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` - Force HTTPS
  - `Referrer-Policy: strict-origin-when-cross-origin` - Control referrer information

- **Caching:**
  - `Cache-Control: no-cache, no-store, must-revalidate` - Prevent caching of sensitive data
  - `Pragma: no-cache` - HTTP/1.0 cache control
  - `Expires: 0` - Immediate expiration

## AWS Cognito Configuration

### User Pool Settings
- **Authentication Methods:** Username and Email
- **Required Attributes:** Email
- **User Groups:** `admin` group for administrative access
- **Password Policy:** AWS default strong password requirements

### User Pool Client
- **Auth Flows:** Username/password authentication
- **Token Expiration:** Default AWS settings
- **Refresh Token:** Enabled for session management

## AWS Service Configuration

### DynamoDB Table
- **Table Name:** workshop-portal-stacks (configurable via environment variable)
- **Partition Key:** `guid` (String) - Stores Access Code UUID
- **Billing Mode:** PAY_PER_REQUEST (on-demand)
- **Point-in-Time Recovery:** Enabled
- **Encryption:** AWS Managed (SSE)
- **Removal Policy:** DESTROY (for development - change to RETAIN for production)
- **Purpose:** Stores Access Code pool and stack record mappings

### EventBridge Rule
- **Rule Name:** StackSyncScheduleRule (with CDK-generated suffix)
- **Schedule:** Rate(1 minute) - Triggers every minute
- **Target:** Stack Sync Lambda function
- **Retry Attempts:** 2
- **State Management:** Dynamically enabled/disabled based on active stack count
- **Purpose:** Periodic synchronization of stack status from CloudFormation to DynamoDB

## Resource Constraints

### CloudFormation Limits
- **Maximum Stacks:** Limited by Access Code pool (configurable, default 60)
- **Stack Naming:** `{configurable-prefix}-{accessCode}` (prefix from deployment-config.json)
- **Required Tags:**
  - `AccessCode`: UUID from generated pool
  - `ManagedBy`: CloudFormationDeploymentPortal
  - `CreatedAt`: ISO timestamp
  - `BatchId`: Deployment batch identifier

### Lambda Limits
- **Timeout:** 
  - 30 seconds: Access Code Manager (default)
  - 60 seconds: Stack Deleter, Access Code Initializer
  - 300 seconds: Stack Deployer, Stack Sync
- **Memory:** 
  - 512MB: Access Code Manager, Stack Output Retriever, Access Code Initializer, Stack Deleter, Stack Sync
  - 1024MB: Stack Deployer
- **Runtime:** Node.js 18.x

## Error Handling Security

### Information Disclosure Prevention
- Generic error messages for external users
- Detailed error logging for administrators
- No sensitive information in error responses
- Proper HTTP status codes for different error types

### Rate Limiting
- CloudFormation API throttling handled gracefully
- Retry mechanisms with exponential backoff
- Circuit breaker patterns for service failures

## Monitoring and Logging

### CloudWatch Logs
- All Lambda functions log to CloudWatch
- Request/response logging for debugging
- Error tracking and alerting
- Performance metrics monitoring

### Security Monitoring
- Failed authentication attempts
- Unusual API usage patterns
- CloudFormation operation failures
- Resource limit violations

## Security Implementation Details

### Resource-Level Permissions
The system implements resource-level IAM permissions where possible to follow the principle of least privilege:

- **CloudFormation Stacks:** Restricted to stacks with configurable prefix pattern (e.g., `deployment-stack-*` or `portal-stack-*`)
- **IAM Roles:** Restricted to roles and instance profiles created by managed stacks
- **DynamoDB:** Restricted to specific table ARN (workshop-portal-stacks)
- **EventBridge:** Restricted to sync rule pattern (*StackSyncScheduleRule*)

### Wildcard Resource Justification
Some permissions require wildcard (`*`) resources due to AWS service limitations:

- **CloudFormation List/Describe:** Required to discover stacks across regions and accounts
- **EC2 Describe Operations:** EC2 service doesn't support resource-level permissions for describe actions
- **EventBridge ListRules:** Required to discover rule by name pattern

### Configurable Stack Name Prefix
The system uses a configurable stack name prefix (defined in `deployment-config.json`) for security:

- **Default:** `deployment-stack`
- **Backward Compatibility:** Supports legacy `portal-stack` prefix
- **Security Benefit:** Prevents accidental operations on unrelated CloudFormation stacks
- **IAM Policy Pattern:** `arn:aws:cloudformation:*:*:stack/{prefix}-*/*`

### DynamoDB Security
- **Encryption at Rest:** AWS managed encryption (SSE)
- **Access Control:** IAM-based access control per Lambda function
- **Data Isolation:** Each Access Code is a unique partition key
- **Audit Trail:** All operations logged to CloudWatch Logs

### EventBridge Security
- **Rule State Management:** Automatically enabled/disabled based on active stack count
- **Resource Efficiency:** Prevents unnecessary Lambda invocations when no stacks exist
- **Access Control:** Only Stack Deployer and Stack Sync functions can manage rule state

## Template-Specific IAM Permissions

### Important: Customize Permissions for Your CloudFormation Template

The IAM permissions for **Stack Deployer** and **Stack Deleter** Lambda functions **MUST be customized** based on the resources created by your specific CloudFormation template.

**Current Configuration:** The permissions in `amplify/iam-policies.json` and `amplify/backend.ts` are currently configured as an **EXAMPLE** for deploying the AWS Service Catalog S3 Launch Role template (`https://s3.amazonaws.com/aws-service-catalog-reference-architectures/iam/sc-s3-launchrole.yml`).

### Current Example: S3 Launch Role Template

The current configuration includes permissions for deploying IAM roles and policies for S3 access:

**Required Permissions for Stack Deployer:**
```json
{
    "Sid": "IAMRoleManagement",
    "Effect": "Allow",
    "Action": [
        "iam:CreateRole",
        "iam:GetRole",
        "iam:AttachRolePolicy",
        "iam:PutRolePolicy",
        "iam:GetRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies",
        "iam:PassRole",
        "iam:TagRole",
        "iam:UntagRole",
        "iam:UpdateAssumeRolePolicy"
    ],
    "Resource": [
        "arn:aws:iam::*:role/SC-*"
    ]
},
{
    "Sid": "IAMPolicyManagement",
    "Effect": "Allow",
    "Action": [
        "iam:CreatePolicy",
        "iam:GetPolicy",
        "iam:GetPolicyVersion",
        "iam:ListPolicyVersions",
        "iam:DeletePolicy",
        "iam:DeletePolicyVersion",
        "iam:CreatePolicyVersion"
    ],
    "Resource": [
        "arn:aws:iam::*:policy/SC-*"
    ]
}
```

**Required Permissions for Stack Deleter:**
```json
{
    "Sid": "IAMRoleDeletion",
    "Effect": "Allow",
    "Action": [
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:DetachRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:ListRolePolicies",
        "iam:ListAttachedRolePolicies"
    ],
    "Resource": [
        "arn:aws:iam::*:role/SC-*"
    ]
},
{
    "Sid": "IAMPolicyDeletion",
    "Effect": "Allow",
    "Action": [
        "iam:DeletePolicy",
        "iam:GetPolicy",
        "iam:ListPolicyVersions",
        "iam:DeletePolicyVersion"
    ],
    "Resource": [
        "arn:aws:iam::*:policy/SC-*"
    ]
}
```

### How to Determine Required Permissions

1. **Analyze Your CloudFormation Template:**
   - Identify all AWS resources created (e.g., Lambda, RDS, S3, VPC)
   - Note resource naming patterns and ARN structures
   - Check for IAM roles and policies created by the template

2. **Add Permissions to `amplify/backend.ts`:**
   - Locate the `backend.stackDeployer.resources.lambda.addToRolePolicy()` section
   - Add new `PolicyStatement` blocks for each resource type
   - Use resource-level restrictions where possible (e.g., specific function names, role patterns)

3. **Add Deletion Permissions:**
   - Locate the `backend.stackDeleter.resources.lambda.addToRolePolicy()` section
   - Add corresponding deletion permissions for all resources
   - Include describe/get permissions needed to verify resource state

4. **Test Your Permissions:**
   - Deploy a test stack using your template
   - Monitor CloudWatch Logs for permission errors
   - Add any missing permissions identified during testing
   - Test stack deletion to ensure cleanup works properly

### Common Resource Types and Required Permissions

| Resource Type | Deploy Permissions | Delete Permissions |
|--------------|-------------------|-------------------|
| IAM Roles | `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:PassRole`, `iam:UpdateAssumeRolePolicy` | `iam:DeleteRole`, `iam:DetachRolePolicy`, `iam:DeleteRolePolicy` |
| IAM Policies | `iam:CreatePolicy`, `iam:GetPolicy`, `iam:CreatePolicyVersion` | `iam:DeletePolicy`, `iam:DeletePolicyVersion`, `iam:ListPolicyVersions` |
| Lambda Function | `lambda:CreateFunction`, `lambda:GetFunction`, `lambda:UpdateFunctionCode` | `lambda:DeleteFunction`, `lambda:GetFunction` |
| RDS Database | `rds:CreateDBInstance`, `rds:DescribeDBInstances`, `rds:ModifyDBInstance` | `rds:DeleteDBInstance`, `rds:DescribeDBInstances` |
| S3 Bucket | `s3:CreateBucket`, `s3:PutBucketPolicy`, `s3:PutBucketTagging` | `s3:DeleteBucket`, `s3:DeleteObject`, `s3:ListBucket` |
| VPC Resources | `ec2:CreateVpc`, `ec2:CreateSubnet`, `ec2:CreateRouteTable` | `ec2:DeleteVpc`, `ec2:DeleteSubnet`, `ec2:DeleteRouteTable` |

### Security Best Practices

1. **Use Resource-Level Restrictions:** Always scope permissions to specific resource patterns (e.g., `SC-*`, `deployment-stack-*`)
2. **Avoid Wildcard Resources:** Only use `*` when AWS service requires it (e.g., EC2 describe operations)
3. **Follow Least Privilege:** Only grant permissions actually needed by your template
4. **Test Thoroughly:** Deploy and delete test stacks to verify permissions work correctly
5. **Document Changes:** Update `amplify/iam-policies.json` with your custom permissions for reference

## Production Security Recommendations

### CORS Configuration
- Replace `*` origin with specific domain(s)
- Implement proper domain validation
- Use environment-specific configurations

### API Gateway
- Enable API Gateway logging
- Implement request/response validation
- Add rate limiting and throttling
- Enable AWS WAF for additional protection

### Lambda Security
- Use environment variables for configuration
- Implement proper secret management
- Regular security updates and patches
- Principle of least privilege for IAM roles

### Monitoring
- Set up CloudWatch alarms for security events
- Implement AWS CloudTrail for audit logging
- Monitor for unusual access patterns
- Regular security assessments and reviews