# CloudFormation Deployment Portal

An AWS Amplify web portal that allows administrators to deploy multiple CloudFormation stacks and provides public access to individual stack outputs using unique access codes.

## What It Does

- Admins deploy CloudFormation stacks through a web interface
- Each deployment gets a unique UUID access code
- Users can view their stack outputs by entering their access code
- No authentication required for viewing outputs

## Prerequisites

- Node.js 18+
- AWS CLI configured with appropriate credentials
- An S3-hosted CloudFormation template

## Deployment Steps

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure your CloudFormation template**
   
   Edit `amplify/deployment-config.json`:
   ```json
   {
     "templateUrl": "https://s3.amazonaws.com/your-bucket/your-template.yaml",
     "stackNamePrefix": "my-deployment",
     "accessCodePoolSize": 60,
     "region": "us-east-1",
     "templateParameters": {
       "InstanceType": "t3.micro"
     }
   }
   ```

3. **Customize IAM permissions for your template**
   
   Edit `amplify/custom-template-permissions.ts` to add permissions for the Lambda functions to create/delete CloudFormation stacks. See [amplify/security-config.md](amplify/security-config.md) for guidance.

4. **Deploy to AWS**
   
   For sandbox/local development:
   ```bash
   npm run amplify:sandbox
   npm run dev
   ```
   
   For production deployment, connect the repo to Amplify. See [Amplify documentation](https://docs.amplify.aws/react/start/quickstart/#2-deploy-the-starter-app).

5. **Create an admin user**
   
   After deployment, create a Cognito user in the AWS Console for admin access. See [this tutorial](https://docs.amplify.aws/react/build-a-backend/auth/manage-users/with-amplify-console/).

6. **Access the admin panel**
   
   Navigate to `https://<your-app-url>/admin` to log in and start deploying CloudFormation stacks.

## Documentation

- [Configuration Guide](docs/CONFIGURATION.md) - Detailed configuration options
- [API Documentation](docs/API.md) - API reference and testing
- [Security Checklist](docs/SECURITY_CHECKLIST.md) - Production security best practices