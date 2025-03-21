#!/bin/bash

#Run bootstrap script to configure the AWS profile
mkdir -p ~/.aws
touch ~/.aws/config
echo "[default]" >> ~/.aws/config
echo "output = json" >> ~/.aws/config
echo "region = "${REGION} >> ~/.aws/config
echo "role_arn = ${BB_OIDC_ROLE_ARN}" >> ~/.aws/config
echo $BITBUCKET_STEP_OIDC_TOKEN > $(pwd)/web-identity-token
echo "web_identity_token_file = $(pwd)/web-identity-token" >> ~/.aws/config

echo "[profile "${BITBUCKET_BRANCH}"]" >> ~/.aws/config
echo "role_arn = "${DEPLOYMENT_ROLE} >> ~/.aws/config
echo "source_profile = default" >> ~/.aws/config
echo "external_id = "${EXTERNAL_ID} >> ~/.aws/config
echo "region = "${REGION} >> ~/.aws/config

#InternalRole Profile for develop
source $BITBUCKET_CLONE_DIR/amorphic-config/config/default.conf
echo "[profile dev_internal]" >> ~/.aws/config
echo "role_arn = "${INTERNAL_ROLE} >> ~/.aws/config
echo "source_profile = default" >> ~/.aws/config
echo "external_id = ${INTERNAL_ROLE_EXTERNAL_ID}" >> ~/.aws/config
echo "region = "${REGION} >> ~/.aws/config