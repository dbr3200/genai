# How TRACE deployment works

## Prerequisites


- All TRACE specific config must be specified in *trace/config/{branch_name}.conf*.
- Ensure external ID for the AWS account we are attempting to deploy to is set as a repository variable.
- Manually update Core Bucket's policy to ensure Sandbox account(*ID:852039390034*) has access to the Core bucket.
- Manually update S3 KMS key's policy to ensure Sandbox account(*ID:852039390034*) can decrypt the key.

> The last 2 steps are needed, because for internal deployments TRACE codebuild project utilizes the deployment environment's core
> bucket for downloading the necessary artifacts. For deployments from CMP we will be using CMP Artifacts bucket and so these permissions
> are not required.

## Deployment Steps

TRACE deployment utilizes both Bitbucket pipelines and AWS CodeBuild.

### Bitbucket Side

1. Upload all API and UI related artifacts to core bucket of the account we are deploying to.
2. Trigger Verticals CodeBuild Project which exists in *amorphic-sandbox* account.

### CodeBuild Side

1. Retrieve the Web app code as well as the API and infra Cloudformation templates from Core bucket, using verticals Codebuild service role.
2. Assume Amorphic Cross Account role of the account we are deploying to.
3. Update TRACE specific SSM parameters.
4. Deploy Infra stack, followed by the API stack.
5. Create UI config.
6. Build the UI project.
7. Upload UI build artifacts to Web bucket.
8. Invalidate Cloudfront distribution associated with TRACE.
9. Update Amorphic Verticals table with the TRACE deployment's details, if necessary.
10. Update the *AMORPHIC.CONFIG.ENABLEDVERTICALSLIST* SSM parameter, if necessary.

## Debugging

To view CodeBuild logs, you will need access to the *amorphic-sandbox* account.
The logs can be observed under Build History->Build Logs for the CodeBuild project **cdap-master-verticals-deploy**.

>A fresh TRACE deployment will take around 18 minutes.