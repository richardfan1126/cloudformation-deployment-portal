# API Documentation

This guide provides comprehensive documentation for the CloudFormation Deployment Portal API, including endpoint specifications, deployment instructions, and troubleshooting.

## Overview

The CloudFormation Deployment Portal uses AWS API Gateway to provide a unified REST API interface for all backend operations. The API supports generic CloudFormation template deployment configured through `amplify/functions/shared/deployment-config.ts`.

**Lambda Functions:**
- **Access Code Manager**: Retrieves status of all Access Codes
- **Stack Deployer**: Deploys CloudFormation stacks with assigned Access Codes
- **Stack Output Retriever**: Retrieves stack outputs by Access Code (public endpoint)
- **Stack Deleter**: Deletes deployed CloudFormation stacks
- **Stack Sync**: Periodically synchronizes stack status from CloudFormation

## API Endpoints

### Admin Endpoints (Require Authentication)

All admin endpoints require Cognito User Pool authentication with a valid JWT token in the Authorization header.

#### GET `/admin/access-code-statuses`

Retrieves the status of all Access Codes in the deployment pool, including which codes are linked to active stacks.

**Response Example:**
```json
{
  "accessCodeStatuses": [
    {
      "accessCode": "550e8400-e29b-41d4-a716-446655440000",
      "isLinked": true,
      "stackName": "deployment-stack-550e8400",
      "stackId": "arn:aws:cloudformation:us-east-1:123456789012:stack/deployment-stack-550e8400/abc123",
      "status": "CREATE_COMPLETE",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    {
      "accessCode": "660e8400-e29b-41d4-a716-446655440001",
      "isLinked": false
    }
  ],
  "totalAvailable": 45,
  "totalLinked": 15
}
```

#### POST `/admin/deploy`

Deploys CloudFormation stacks using the template specified in the centralized configuration. Assigns Access Codes to each deployed stack.

**Request Body:**
```json
{
  "stackCount": 2,
  "selectedAccessCodes": ["550e8400-e29b-41d4-a716-446655440000"],
  "templateParameters": {
    "ParameterKey": "ParameterValue"
  }
}
```

**Parameters:**
- `stackCount` (number, required): Number of stacks to deploy
- `selectedAccessCodes` (array, optional): Specific Access Codes to use; if omitted, codes are auto-assigned
- `templateParameters` (object, optional): CloudFormation template parameters to override defaults

**Response Example:**
```json
{
  "deployedStacks": [
    {
      "accessCode": "550e8400-e29b-41d4-a716-446655440000",
      "stackName": "deployment-stack-550e8400",
      "stackId": "arn:aws:cloudformation:us-east-1:123456789012:stack/deployment-stack-550e8400/abc123",
      "status": "CREATE_IN_PROGRESS"
    }
  ],
  "assignedAccessCodes": ["550e8400-e29b-41d4-a716-446655440000"]
}
```

#### DELETE `/admin/stack/{accessCode}`

Deletes a specific CloudFormation stack associated with the given Access Code.

**Path Parameters:**
- `accessCode` (string, required): UUID Access Code linked to the stack

**Response Example:**
```json
{
  "message": "Stack deletion initiated",
  "accessCode": "550e8400-e29b-41d4-a716-446655440000",
  "stackName": "deployment-stack-550e8400"
}
```

#### GET `/admin/stack/{accessCode}/deletion-status`

Checks the deletion status of a specific stack.

**Path Parameters:**
- `accessCode` (string, required): UUID Access Code linked to the stack

**Response Example:**
```json
{
  "accessCode": "550e8400-e29b-41d4-a716-446655440000",
  "status": "DELETE_IN_PROGRESS",
  "stackName": "deployment-stack-550e8400"
}
```

#### DELETE `/admin/stacks/all`

Initiates deletion of all deployed CloudFormation stacks.

**Response Example:**
```json
{
  "message": "Bulk deletion initiated",
  "deletedCount": 15
}
```

#### GET `/admin/stacks/deletion-status`

Retrieves the status of the bulk deletion operation.

**Response Example:**
```json
{
  "inProgress": 5,
  "completed": 10,
  "failed": 0,
  "total": 15
}
```

### Public Endpoints (No Authentication)

Public endpoints are accessible without authentication and allow users to view their stack outputs using Access Codes.

#### GET `/public/stack-outputs/{accessCode}`

Retrieves CloudFormation stack outputs for the stack associated with the given Access Code.

**Path Parameters:**
- `accessCode` (string, required): UUID Access Code linked to the stack

**Response Example (Success):**
```json
{
  "outputs": [
    {
      "outputKey": "WebsiteURL",
      "outputValue": "https://example.com",
      "description": "URL of the deployed website"
    },
    {
      "outputKey": "BucketName",
      "outputValue": "my-deployment-bucket-abc123",
      "description": "Name of the S3 bucket"
    }
  ],
  "lastUpdated": "2024-01-15T10:35:00Z"
}
```

**Response Example (Not Found):**
```json
{
  "error": "Stack outputs not found for the provided Access Code"
}
```

## Deployment

### Local Development

For local development and testing, use the Amplify sandbox environment:

```bash
npm run amplify:sandbox
```

Then start the development server:

```bash
npm run dev
```

The API Gateway URL is automatically configured through Amplify's `amplify_outputs.json` file. No manual configuration is needed!

After the sandbox is running:
1. Check that `amplify_outputs.json` exists in your project root
2. Verify it contains the API Gateway URL
3. The frontend will automatically use this URL for all API calls

## API Gateway Features

### Authentication
- Admin endpoints use Cognito User Pool authentication
- Public endpoints are accessible without authentication
- Proper JWT token validation for protected routes

### CORS Configuration
- Configured to allow all origins for development
- Includes proper headers for authentication
- Supports preflight OPTIONS requests

### Error Handling
- Standardized error responses across all endpoints
- Proper HTTP status codes
- Detailed error messages for debugging

### Security Headers
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking attacks
- `X-XSS-Protection: 1; mode=block` - Enables XSS protection
- `Strict-Transport-Security` - Enforces HTTPS connections
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- Cache control headers to prevent sensitive data caching

## Testing the API

### Testing via Web Interface

1. Start the development server: `npm run dev`
2. Navigate to the admin panel: `http://localhost:5173/admin`
3. Log in with your admin credentials
4. Check if the Access Code status table loads (tests GET `/admin/access-code-statuses`)
5. Try deploying a stack (tests POST `/admin/deploy`)
6. Navigate to the public portal: `http://localhost:5173/`
7. Enter a valid Access Code to test GET `/public/stack-outputs/{accessCode}`

### Testing via cURL

You can test the API endpoints directly using cURL or any HTTP client.

#### Test Public Endpoint

**Get Stack Outputs:**
```bash
curl https://your-api-gateway-url/public/stack-outputs/550e8400-e29b-41d4-a716-446655440000
```

#### Test Admin Endpoints (requires authentication token)

**Get Access Code Statuses:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-api-gateway-url/admin/access-code-statuses
```

**Deploy Stacks:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"stackCount": 2}' \
     https://your-api-gateway-url/admin/deploy
```

**Deploy with Specific Access Codes:**
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "stackCount": 1,
       "selectedAccessCodes": ["550e8400-e29b-41d4-a716-446655440000"],
       "templateParameters": {
         "EnvironmentName": "production"
       }
     }' \
     https://your-api-gateway-url/admin/deploy
```

**Delete a Specific Stack:**
```bash
curl -X DELETE \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-api-gateway-url/admin/stack/550e8400-e29b-41d4-a716-446655440000
```

**Check Deletion Status:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-api-gateway-url/admin/stack/550e8400-e29b-41d4-a716-446655440000/deletion-status
```

**Delete All Stacks:**
```bash
curl -X DELETE \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-api-gateway-url/admin/stacks/all
```

**Check Bulk Deletion Status:**
```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://your-api-gateway-url/admin/stacks/deletion-status
```

## Troubleshooting

### API Gateway URL Not Found

If the configuration can't find the API Gateway URL:
- Ensure the backend deployment completed successfully (check sandbox status for local development)
- Check that `amplify_outputs.json` exists and contains the API Gateway URL
- For local development, restart the sandbox: `npm run amplify:sandbox`

### CORS Issues

If you encounter CORS errors:
- Verify the API Gateway CORS configuration in `amplify/backend.ts`
- Check that preflight OPTIONS requests are handled correctly
- Ensure authentication headers are included in CORS configuration

### Authentication Errors

For admin endpoints:
- Ensure you're logged in to the admin panel
- Check that the Amplify Auth is properly configured
- Verify that the JWT token is being sent in the Authorization header
- Ensure the Cognito User Pool is properly configured

### Configuration Errors

If you see configuration-related errors:
- Verify `amplify/functions/shared/deployment-config.ts` is properly configured
- Check that required fields (`TEMPLATE_URL`) are present
- Ensure template URL is accessible and points to a valid CloudFormation template
- Redeploy the backend after configuration changes
- Validate `stackNamePrefix` follows CloudFormation naming requirements (alphanumeric and hyphens only)
- Confirm template parameters in the config match those defined in your CloudFormation template

### Lambda Function Errors

If Lambda functions are not working:
- Verify the deployment completed successfully
- Check CloudWatch Logs for detailed error messages
- Ensure IAM permissions are correctly configured
- Verify the correct AWS profile is being used

## API Architecture

### Request Flow

1. **Client Request** → API Gateway endpoint
2. **Authentication** (admin endpoints only) → Cognito validates JWT token
3. **Lambda Integration** → API Gateway invokes appropriate Lambda function
4. **Lambda Processing** → Function executes business logic (CloudFormation operations, DynamoDB queries, etc.)
5. **Response** → Lambda returns result to API Gateway
6. **Client Response** → API Gateway returns formatted response to client

### Integration with Other Services

- **DynamoDB**: Stores Access Code and stack relationship data
- **CloudFormation**: Manages stack lifecycle (create, delete, describe)
- **EventBridge**: Triggers periodic stack synchronization
- **Cognito**: Manages admin authentication and authorization
- **S3**: Hosts CloudFormation templates

## Best Practices

1. **Use Environment-Specific Configurations**: Separate configurations for development, staging, and production
2. **Monitor API Usage**: Set up CloudWatch alarms for error rates and latency
3. **Implement Rate Limiting**: Configure API Gateway throttling for production
4. **Secure Credentials**: Never hardcode JWT tokens or credentials
5. **Test Thoroughly**: Test all endpoints before deploying to production
6. **Log Appropriately**: Use structured logging for easier debugging
7. **Handle Errors Gracefully**: Implement proper error handling in client applications

## Additional Resources

- [AWS API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [AWS Amplify Gen2 Documentation](https://docs.amplify.aws/)
- [CloudFormation API Reference](https://docs.aws.amazon.com/AWSCloudFormation/latest/APIReference/)
