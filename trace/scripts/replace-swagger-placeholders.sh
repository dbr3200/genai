#!/bin/bash

# Get APIGW Lambda execution role
API_LAMBDA_INVOKE_ROLE_ARN="$(aws ssm get-parameter --name "AMORPHIC.SECURITY.APIGATEWAYLAMBDAINVOKEROLEARN" --profile ${BITBUCKET_BRANCH} --output text --query 'Parameter.Value')"
API_LAMBDA_INVOKE_ROLE="$(cut -d'/' -f2 <<<"${API_LAMBDA_INVOKE_ROLE_ARN}")"


# API Gateway - Swagger replacements
sed -i "s/productversion_placeholder/${VERSION}/g" "trace/api/api-def/$1"
sed -i "s/lambdaexecrole_placeholder/${API_LAMBDA_INVOKE_ROLE}/g" "trace/api/api-def/$1"
sed -i "s/projectshortname_placeholder/${PROJECT_SHORT_NAME}/g" "trace/api/api-def/$1"
sed -i "s/verticalname_placeholder/${VERTICAL_NAME}/g" "trace/api/api-def/$1"
sed -i "s/environment_placeholder/${DEPLOYMENT_ENV}/g" "trace/api/api-def/$1"
sed -i "s/apigateway_title_placeholder/$2/g" "trace/api/api-def/$1"
