# Documentation

This directory contains comprehensive documentation for the CloudFormation Deployment Portal.

## Available Documentation

### [CONFIGURATION.md](CONFIGURATION.md)
Complete guide to configuring the portal for your specific use case.

**Topics covered:**
- Configuration file schema and options
- Template URL configuration
- Stack naming and Access Code pool sizing
- Region and parameter configuration
- Configuration examples for different use cases
- Validation and troubleshooting
- Best practices

**Start here if:** You're setting up the portal for the first time or need to customize the deployment configuration.

### [API.md](API.md)
Comprehensive API documentation including endpoints, deployment, and testing.

**Topics covered:**
- Complete API endpoint specifications
- Admin endpoints (authenticated) and public endpoints
- Request/response examples for all endpoints
- Authentication and CORS configuration
- Security headers implementation
- Deployment and testing instructions
- Troubleshooting guide
- API architecture and best practices

**Start here if:** You need to understand the API structure, test endpoints, integrate with the API programmatically, or troubleshoot API issues.

### [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md)
Comprehensive security configuration checklist and best practices.

**Topics covered:**
- Completed security configurations
- IAM permissions and roles
- API Gateway security
- Lambda function security
- Data protection (in transit and at rest)
- Production readiness checklist
- Security incident response
- Regular maintenance tasks

**Start here if:** You're preparing for production deployment or conducting a security review.

## Quick Start

1. **Initial Setup**: Read [CONFIGURATION.md](CONFIGURATION.md) to configure your `amplify/functions/shared/deployment-config.ts`
2. **Local Development**: Use `npm run amplify:sandbox` for local testing and development
3. **API Testing**: Follow [API.md](API.md) to test your endpoints
4. **Security Review**: Check [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) before production deployment

## Development Workflow

### Local Development
For local development and testing:
```bash
npm run amplify:sandbox  # Start Amplify sandbox
npm run dev              # Start development server
```

The Amplify sandbox provides a complete local development environment with all backend services.

## Common Tasks

### Updating Configuration
1. Edit `amplify/functions/shared/deployment-config.ts`
2. Redeploy or restart the sandbox to apply changes: `npm run amplify:sandbox`

### Testing API Endpoints
See [API.md](API.md) for detailed testing instructions and example cURL commands.

### Security Hardening
Review [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) for production readiness tasks and security best practices.

## Additional Resources

- [Main README](../README.md) - Project overview and features
- [AWS CloudFormation Documentation](https://docs.aws.amazon.com/cloudformation/)
- [AWS Amplify Gen2 Documentation](https://docs.amplify.aws/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)

## Getting Help

If you encounter issues:
1. Check the troubleshooting sections in the relevant documentation
2. Review CloudWatch Logs for detailed error messages
3. Verify your configuration matches the examples in [CONFIGURATION.md](CONFIGURATION.md)
4. Ensure all prerequisites are met (see main [README](../README.md))
