/**
 * Custom CloudFormation Template Permissions
 *
 * ⚠️ IMPORTANT: CUSTOMIZE THESE PERMISSIONS FOR YOUR CLOUDFORMATION TEMPLATE
 * 
 * The permissions in this file are EXAMPLES configured for the AWS Service Catalog 
 * S3 Launch Role template (https://s3.amazonaws.com/aws-service-catalog-reference-architectures/iam/sc-s3-launchrole.yml).
 * 
 * You MUST modify these permissions based on the AWS resources your CloudFormation template creates.
 * 
 * These permissions should match the policies defined in amplify/iam-policies.json:
 * - StackDeployerPolicy: Permissions needed to CREATE resources
 * - StackDeleterPolicy: Permissions needed to DELETE resources
 * 
 * For detailed guidance, see:
 * - amplify/security-config.md - Complete IAM permission guide with examples
 * - amplify/iam-policies.json - Policy definitions (for reference)
 */

import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

/**
 * Get custom permissions for Stack Deployer Lambda function
 * These permissions allow the Lambda to create resources defined in your CloudFormation template
 * 
 * Current example: IAM roles and policies for S3 Launch Role template
 */
export function getStackDeployerCustomPermissions(): PolicyStatement[] {
    return [
        // IAM Role Management - for creating IAM roles
        new PolicyStatement({
            sid: 'IAMRoleManagement',
            actions: [
                'iam:CreateRole',
                'iam:GetRole',
                'iam:AttachRolePolicy',
                'iam:PutRolePolicy',
                'iam:GetRolePolicy',
                'iam:ListRolePolicies',
                'iam:ListAttachedRolePolicies',
                'iam:PassRole',
                'iam:TagRole',
                'iam:UntagRole',
                'iam:UpdateAssumeRolePolicy'
            ],
            resources: [
                'arn:aws:iam::*:role/SC*'
            ]
        }),

        // IAM Policy Management - for creating IAM policies
        new PolicyStatement({
            sid: 'IAMPolicyManagement',
            actions: [
                'iam:CreatePolicy',
                'iam:GetPolicy',
                'iam:GetPolicyVersion',
                'iam:ListPolicyVersions',
                'iam:DeletePolicy',
                'iam:DeletePolicyVersion',
                'iam:CreatePolicyVersion'
            ],
            resources: [
                'arn:aws:iam::*:policy/SC*'
            ]
        })
    ];
}

/**
 * Get custom permissions for Stack Deleter Lambda function
 * These permissions allow the Lambda to delete resources created by your CloudFormation template
 * 
 * Current example: IAM roles and policies for S3 Launch Role template
 */
export function getStackDeleterCustomPermissions(): PolicyStatement[] {
    return [
        // IAM Role Deletion - for deleting IAM roles
        new PolicyStatement({
            sid: 'IAMRoleDeletion',
            actions: [
                'iam:DeleteRole',
                'iam:GetRole',
                'iam:DetachRolePolicy',
                'iam:DeleteRolePolicy',
                'iam:ListRolePolicies',
                'iam:ListAttachedRolePolicies'
            ],
            resources: [
                'arn:aws:iam::*:role/SC*'
            ]
        }),

        // IAM Policy Deletion - for deleting IAM policies
        new PolicyStatement({
            sid: 'IAMPolicyDeletion',
            actions: [
                'iam:DeletePolicy',
                'iam:GetPolicy',
                'iam:ListPolicyVersions',
                'iam:DeletePolicyVersion'
            ],
            resources: [
                'arn:aws:iam::*:policy/SC*'
            ]
        })
    ];
}

/**
 * EXAMPLES: Common resource types and their required permissions
 * 
 * Uncomment and modify the examples below based on your CloudFormation template needs:
 */

/*
// Example: Lambda Function permissions
export function getStackDeployerCustomPermissions(): PolicyStatement[] {
    return [
        new PolicyStatement({
            sid: 'LambdaFunctionManagement',
            actions: [
                'lambda:CreateFunction',
                'lambda:GetFunction',
                'lambda:GetFunctionConfiguration',
                'lambda:UpdateFunctionCode',
                'lambda:UpdateFunctionConfiguration',
                'lambda:TagResource',
                'lambda:UntagResource',
                'lambda:ListTags'
            ],
            resources: [
                'arn:aws:lambda:*:*:function:your-function-pattern-*'
            ]
        }),
        new PolicyStatement({
            sid: 'IAMRoleForLambda',
            actions: [
                'iam:CreateRole',
                'iam:GetRole',
                'iam:AttachRolePolicy',
                'iam:PutRolePolicy',
                'iam:PassRole',
                'iam:TagRole'
            ],
            resources: [
                'arn:aws:iam::*:role/your-lambda-role-pattern-*'
            ]
        })
    ];
}

export function getStackDeleterCustomPermissions(): PolicyStatement[] {
    return [
        new PolicyStatement({
            sid: 'LambdaFunctionDeletion',
            actions: [
                'lambda:DeleteFunction',
                'lambda:GetFunction'
            ],
            resources: [
                'arn:aws:lambda:*:*:function:your-function-pattern-*'
            ]
        }),
        new PolicyStatement({
            sid: 'IAMRoleForLambdaDeletion',
            actions: [
                'iam:DeleteRole',
                'iam:GetRole',
                'iam:DetachRolePolicy',
                'iam:DeleteRolePolicy',
                'iam:ListRolePolicies',
                'iam:ListAttachedRolePolicies'
            ],
            resources: [
                'arn:aws:iam::*:role/your-lambda-role-pattern-*'
            ]
        })
    ];
}
*/

/*
// Example: EC2 Instance permissions
export function getStackDeployerCustomPermissions(): PolicyStatement[] {
    return [
        new PolicyStatement({
            sid: 'EC2InstanceManagement',
            actions: [
                'ec2:RunInstances',
                'ec2:DescribeInstances',
                'ec2:CreateTags',
                'ec2:CreateSecurityGroup',
                'ec2:AuthorizeSecurityGroupIngress',
                'ec2:DescribeSecurityGroups'
            ],
            resources: ['*']
        }),
        new PolicyStatement({
            sid: 'IAMRoleForEC2',
            actions: [
                'iam:CreateRole',
                'iam:CreateInstanceProfile',
                'iam:AddRoleToInstanceProfile',
                'iam:PassRole',
                'iam:GetRole',
                'iam:GetInstanceProfile'
            ],
            resources: [
                'arn:aws:iam::*:role/your-ec2-role-pattern-*',
                'arn:aws:iam::*:instance-profile/your-ec2-profile-pattern-*'
            ]
        })
    ];
}

export function getStackDeleterCustomPermissions(): PolicyStatement[] {
    return [
        new PolicyStatement({
            sid: 'EC2InstanceDeletion',
            actions: [
                'ec2:TerminateInstances',
                'ec2:DescribeInstances',
                'ec2:DeleteSecurityGroup',
                'ec2:DescribeSecurityGroups'
            ],
            resources: ['*']
        }),
        new PolicyStatement({
            sid: 'IAMRoleForEC2Deletion',
            actions: [
                'iam:DeleteRole',
                'iam:DeleteInstanceProfile',
                'iam:RemoveRoleFromInstanceProfile',
                'iam:GetRole',
                'iam:GetInstanceProfile',
                'iam:ListInstanceProfilesForRole'
            ],
            resources: [
                'arn:aws:iam::*:role/your-ec2-role-pattern-*',
                'arn:aws:iam::*:instance-profile/your-ec2-profile-pattern-*'
            ]
        })
    ];
}
*/

/*
// Example: RDS Database permissions
export function getStackDeployerCustomPermissions(): PolicyStatement[] {
    return [
        new PolicyStatement({
            sid: 'RDSManagement',
            actions: [
                'rds:CreateDBInstance',
                'rds:DescribeDBInstances',
                'rds:ModifyDBInstance',
                'rds:AddTagsToResource'
            ],
            resources: [
                'arn:aws:rds:*:*:db:your-db-pattern-*'
            ]
        })
    ];
}

export function getStackDeleterCustomPermissions(): PolicyStatement[] {
    return [
        new PolicyStatement({
            sid: 'RDSDeletion',
            actions: [
                'rds:DeleteDBInstance',
                'rds:DescribeDBInstances'
            ],
            resources: [
                'arn:aws:rds:*:*:db:your-db-pattern-*'
            ]
        })
    ];
}
*/

/*
// Example: S3 Bucket permissions
export function getStackDeployerCustomPermissions(): PolicyStatement[] {
    return [
        new PolicyStatement({
            sid: 'S3BucketManagement',
            actions: [
                's3:CreateBucket',
                's3:PutBucketPolicy',
                's3:PutBucketTagging',
                's3:PutBucketVersioning',
                's3:PutEncryptionConfiguration'
            ],
            resources: [
                'arn:aws:s3:::your-bucket-pattern-*'
            ]
        })
    ];
}

export function getStackDeleterCustomPermissions(): PolicyStatement[] {
    return [
        new PolicyStatement({
            sid: 'S3BucketDeletion',
            actions: [
                's3:DeleteBucket',
                's3:DeleteObject',
                's3:DeleteObjectVersion',
                's3:ListBucket',
                's3:ListBucketVersions'
            ],
            resources: [
                'arn:aws:s3:::your-bucket-pattern-*',
                'arn:aws:s3:::your-bucket-pattern-*\/*'
            ]
        })
    ];
}
*/
