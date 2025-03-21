"""
Lambda for all operations related to Users
"""

import os
import sys
import uuid
import json
import logging
from datetime import datetime, timedelta, timezone
import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr

import commonUtil
import dynamodbUtil
import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading Function - %s", "users.py")

try:
    LOGGER.info("In users, Loading environment variables...")

    ENVIRONMENT = os.environ['environment']
    AWS_REGION = os.environ['awsRegion']
    DEFAULT_TENANT = os.environ['projectShortName']
    VERTICAL_NAME = os.environ['verticalName']
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    VALID_ADMIN_ACTIONS = ['update_user_role']
    VALID_USER_ROLES = ['Admins', 'Developers', 'Users']
    MULTI_TENANCY = os.environ['enableMultiTenancy']
    ACCESS_TOKEN_VALIDITY = 730 # creating access token with 2 year validity
    SES_AWS_REGION = os.environ["sesAwsRegion"]
    AWS_PARTITION = os.environ["awsPartition"]
    PROJECT_NAME = os.environ['projectName']
    ACCOUNT_ID = os.environ['accountId']

    AMORPHIC_DOMAINS_LAMBDA_ARN = os.environ['amorphicDomainsLambdaArn']
    AMORPHIC_DWH_TENANTS_LAMBDA_ARN = os.environ['amorphicDWHTenantsLambdaArn']
    ACCESS_TOKENS_LAMBDA_ARN = os.environ['amorphicAccessTokensLambdaArn']
    AMORPHIC_GET_USER_LAMBDA_ARN = os.environ['amorphicGetUserLambdaArn']
    USER_POOL_ID = os.environ["userPoolId"]

    USERS_TABLE = dynamodbUtil.USERS_TABLE
    GROUPS_TABLE = dynamodbUtil.GROUPS_TABLE

    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)
    COGNITO_IDP_CLIENT = boto3.client('cognito-idp', AWS_REGION)
    SSM_CLIENT = boto3.client('ssm', AWS_REGION)
    SES_CLIENT = boto3.client('ses', SES_AWS_REGION)
    SES_V2_CLIENT = boto3.client('sesv2', SES_AWS_REGION)

    EVENT_INFO = {}
except Exception as ex:
    LOGGER.error("In users, Failed to load environment variables. error: %s", str(ex))
    sys.exit()

def unsubscribe_from_alerts(user_id, email_id):
    """
    This function is to un subscribe user for email alerts
    : param user_id
    : param email_id --> Email_id of user
    """
    LOGGER.info("In emailSubscription.unsubscribe_from_alerts, User %s requested to Un-subscribe from email alerts", user_id)

    try:
        ses_response = SES_CLIENT.delete_verified_email_address(EmailAddress=email_id)
        if ses_response['ResponseMetadata']['HTTPStatusCode'] != 200:
            LOGGER.error("In emailSubscription.unsubscribe_from_alerts, failed to delete email identity from SES with error %s", str(ses_response))
            ec_ge_1091 = errorUtil.get_error_object("GE-1091")
            ec_ge_1091['Message'] = ec_ge_1091['Message'].format(user_id)
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1091)
    except Exception:
        LOGGER.info("In emailSubscription.unsubscribe_from_alerts, in Exception block, email not available in SES or already deleted")

    LOGGER.info("In emailSubscription.unsubscribe_from_alerts, Updating user dynamo table with latest subscription status")
    key = {'UserId': user_id}
    update_expression = "REMOVE EmailSubscription SET LastModifiedBy = :val1, LastModifiedTime = :val2"
    expression_attributes = {
        ":val1": user_id,
        ":val2": commonUtil.get_current_time()
        }
    if dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(USERS_TABLE), key, update_expression, expression_attributes) == "error":
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("USER")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    LOGGER.info("In emailSubscription.unsubscribe_from_alerts, Successfully updated user table for user %s by removing email subscription", user_id)
    return {'Message':'Successfully unsubscribed from email alerts. You will not receive any system alerts to your email anymore.'}

def subscribe_for_alerts(user_id, email_id):
    """
    This function is to subscribe user for email alerts
    : param user_id
    : param email_id --> Email_id of user
    """
    LOGGER.info("In emailSubscription.subscribe_for_alerts, User %s requested to subscribe for email alerts", user_id)

    # Check whether user is already subscribed
    ses_response = SES_CLIENT.get_identity_verification_attributes(Identities=[email_id])
    if (ses_response.get('VerificationAttributes')) and (ses_response['VerificationAttributes'][email_id]['VerificationStatus'].lower() == 'success'):
        subscription_status = "yes"
    else:
        verification_email_status = commonUtil.send_custom_verification_mail(SES_CLIENT, email_id, user_id)
        LOGGER.info("In emailSubscription.subscribe_for_alerts, verification email status is %s", verification_email_status)
        subscription_status = "pending"

        if verification_email_status:
            LOGGER.info("In emailSubscription.subscribe_for_alerts, adding tags to email identity %s", email_id)
            # Add Tags to email identity
            ses_v2_response = SES_V2_CLIENT.tag_resource(ResourceArn=f"arn:{AWS_PARTITION}:ses:{AWS_REGION}:{ACCOUNT_ID}:identity/{email_id}",
                Tags=[
                    {"Key": "Environment", "Value": ENVIRONMENT},
                    {"Key": "Name", "Value": "{}-identity".format(PROJECT_NAME)},
                    {"Key": "Region", "Value": AWS_REGION}
                ])
            if ses_v2_response and ses_v2_response['ResponseMetadata']['HTTPStatusCode'] != 200:
                LOGGER.error("In emailSubscription.subscribe_for_alerts, failed to add tags to identity with error %s", str(ses_v2_response))
                ec_ge_1108 = errorUtil.get_error_object("GE-1108")
                ec_ge_1108['Message'] = ec_ge_1108['Message'].format(email_id)
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1108)

            LOGGER.info("In emailSubscription.subscribe_for_alerts, Successfully sent verification link to user for email subscription")

    # Updating user table with subscription status
    LOGGER.info("In emailSubscription.subscribe_for_alerts, Updating user dynamo table with latest subscription status")
    key = {'UserId': user_id}
    update_expression = "SET EmailSubscription = :val1, LastModifiedBy = :val2, LastModifiedTime = :val3"
    expression_attributes = {
        ":val1": subscription_status,
        ":val2": user_id,
        ":val3": commonUtil.get_current_time()
        }

    if dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(USERS_TABLE), key, update_expression, expression_attributes) == "error":
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("USER")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

    LOGGER.info("In emailSubscription.subscribe_for_alerts, Successfully updated user table for user %s with latest email subscription status %s", user_id, subscription_status)

    if subscription_status == "pending":
        return {'Message': f'Confirmation email sent to {email_id}, please click the link in email to complete the subscription.'}
    else:
        return {'Message': f'User: {user_id} is already subscribed for email alerts.'}

def get_subscription_status(user_item):
    """
    This function is get email subscription status of user
    : param user_item --> User details from Users Table
    """
    LOGGER.info("In emailSubscription.get_subscription_status, User %s requested to check status of email subscription", user_item["UserId"])

    old_subscription_status = user_item.get('EmailSubscription', None)
    user_item['EmailSubscription'] = user_item.get('EmailSubscription', "no")

    if user_item['EmailSubscription'] != 'yes':
        ses_response = SES_CLIENT.get_identity_verification_attributes(Identities=[user_item['EmailId']])
        if ses_response['VerificationAttributes']:
            user_item['EmailSubscription'] = 'pending'
            if ses_response['VerificationAttributes'][user_item['EmailId']]['VerificationStatus'].lower() == 'success':
                user_item['EmailSubscription'] = 'yes'

    # Update item in DynamoDB table with latest subscription status
    if old_subscription_status != user_item['EmailSubscription']:
        LOGGER.info("In emailSubscription.get_subscription_status,Updating user dynamo table with latest subscription status")
        key = {'UserId': user_item["UserId"]}
        update_expression = "SET EmailSubscription = :val1, LastModifiedBy = :val2, LastModifiedTime = :val3"
        expression_attributes = {
            ":val1": user_item['EmailSubscription'],
            ":val2": user_item["UserId"],
            ":val3": commonUtil.get_current_time()
            }
        if dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(USERS_TABLE), key, update_expression, expression_attributes) == "error":
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("USER")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        LOGGER.info("In emailSubscription.get_subscription_status, Successfully updated user table for user %s with latest email subscription status", user_item["UserId"])

    return {'EmailSubscriptionStatus': user_item['EmailSubscription']}

def change_amorphic_connection_status(user_id, action):
    """
    This function updates the AmorphicIntegrationStatus
    :param user_id: ID of the user
    :param action: Action to decide whether to enable or disable
    """
    LOGGER.error("In users.change_amorphic_connection_status, changing connection, action: %s", action)
    if not commonUtil.ssm_parameter_exists(SSM_CLIENT, f"/{VERTICAL_NAME}/{ENVIRONMENT}/access_token/{user_id}"):
        LOGGER.error("In users.change_amorphic_connection_status, access token not found in parameter store")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Access Token not found,please Integrate with amorphic")
    update_response = dynamodbUtil.update_item_by_key(
                DYNAMODB_RESOURCE.Table(USERS_TABLE),
                {'UserId': user_id}, # Key
                'set AmorphicIntegrationStatus=:val1,  LastModifiedTime=:val2, LastModifiedBy=:val3', # Update Expression
                {
                    ':val1': "disabled" if action == "disable" else "connected",
                    ':val2': commonUtil.get_current_time(),
                    ':val3': user_id
                } # Expression Attribute Values
            )
    if update_response == 'error':
        LOGGER.error("In users.change_amorphic_connection_status, Failed to update user table")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Error while updating integration status")
    return commonUtil.build_get_post_response(200, {"Message": "Successfully updated integration status"})

def delete_access_token_from_parameter_store(user_id):
    """
    This function deletes the access token from the parameter store
    :param user_id: The ID of the user
    """
    try:
        ssm_response = SSM_CLIENT.delete_parameter(
                        Name=f"/{VERTICAL_NAME}/{ENVIRONMENT}/access_token/{user_id}"
                        )
        if ssm_response["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In users.delete_access_token_from_parameter_store, deleting access token from parameter store failed with error: %s", ssm_response)
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"deleting access token from parameter store failed with error: {ssm_response}")
        else:
            LOGGER.info("In users.delete_access_token_from_parameter_store, deleted parameter , ssm_response: %s", ssm_response)
    except ClientError as c_e:
        if c_e.response['Error']['Code'] == 'ParameterNotFound':
            LOGGER.error("In users.delete_access_token_from_parameter_store, Parameter not found, skipping deletion, error: %s", c_e.response['Error']['Message'])
        else:
            LOGGER.error("In users.delete_access_token_from_parameter_store, deleting access token from parameter store failed with error: %s", c_e.response['Error']['Message'])
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"deleting access token from parameter store failed with error: {c_e.response['Error']['Message']}")

def delete_amorphic_connection(user_id):
    """
    This function disables users from amorphic and disables the PAT token
    :param user_id: The ID of the user
    """
    LOGGER.info("In users.delete_amorphic_connection, Disconnecting user %s from amorphic", user_id)
    delete_access_token_from_parameter_store(user_id)
    LOGGER.info("In pipelines.create_pipeline_groups, updating PipelineIdList in groups table")
    key = {"UserId": user_id}
    update_expression = "REMOVE AccessTokenId, AccessTokenExpiresAt SET LastModifiedTime = :val1, LastModifiedBy = :val2, AmorphicIntegrationStatus  = :val3"
    expression_attributes = {
        ":val1": commonUtil.get_current_time(),
        ":val2": user_id,
        ":val3": "disconnected"
        }
    status = dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(USERS_TABLE),
        key, update_expression, expression_attributes)
    if status == "error":
        LOGGER.error("In users.delete_amorphic_connection, updating user table failed ")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Unable to disconnect , error while updating integration status")
    return commonUtil.build_get_post_response(200, {"Message": "Successfully disconnected from amorphic"})

def store_access_token_in_parameter_store(user_id, access_token, access_token_id):
    """
    This method stores access token in parameter store
    :param user_id: user id of the user
    :param access_token: access token information
    :param access_token_id: access token ID information
    :return: None
    """
    LOGGER.info("In users.store_access_token_in_parameter_store, starting method with access_token, %s, access_token_id, %s", access_token, access_token_id)
    ssm_response = SSM_CLIENT.put_parameter(
                Name=f"/{VERTICAL_NAME}/{ENVIRONMENT}/access_token/{user_id}",
                Description=f"PAT token created by ai for user {user_id}",
                Value=access_token,
                Type="SecureString",
                Overwrite=True
                )

    if ssm_response["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In users.store_access_token_in_parameter_store, storing access token in parameter store failed with error: %s", ssm_response)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"storing access token in parameter store failed with error: {ssm_response}")
    else:
        LOGGER.info("In users.store_access_token_in_parameter_store, stored access token parameter store, ssm_response: %s", ssm_response)

def is_access_token_valid(access_token, user_id):
    """
    This function checks if the access token is valid or not
    :param access_token: The access token to be checked
    :return: True if the access token is valid, False if the access token is not valid
    """
    LOGGER.info("In users.is_access_token_valid, checking if access token is valid or not")
    try:
        claims = commonUtil.get_claims(access_token)
        if user_id != claims['cognito:username']:
            LOGGER.error("In users.is_access_token_valid, access token is invalid, error: %s", "User ID in access token does not match with the user")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid access token, User ID in access token does not match with the user")
        elif datetime.fromtimestamp(claims['exp'], tz=timezone.utc) < datetime.now(timezone.utc):
            LOGGER.error("In users.is_access_token_valid, access token is invalid, error: %s", "Access token is expired")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid access token, Access token is expired")
    except Exception as ex:
        LOGGER.error("In users.is_access_token_valid, access token is invalid, error: %s", str(ex))
        if "User ID in access token does not match with the user" in str(ex):
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"{ex}")
        elif "Access token is expired" in str(ex):
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Token Expired")
        else:
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid access token")
    else:
        return claims['exp']

def create_amorphic_connection(user_item, event_body, authtoken):
    """
    This function creates a connection to amorphic
    :param user_item: user item from user table
    :param event_body: event body with role_id and token info
    """
    LOGGER.info("In users.create_amorphic_connection, starting method")
    user_id = user_item["UserId"]
    role_id = event_body.get("RoleId", "")
    access_token = event_body.get("Token", "")

    if "Token" not in event_body:
        input_body = {
            "RoleId": role_id,
            "Name": f"{user_id}_ai_access_token",
            "Description": "PAT token created from AI",
            "ExpirationAlertOne": 7,
            "ExpirationAlertTwo": 1,
            "ExpiresOn": float((datetime.now(timezone.utc) + timedelta(days = ACCESS_TOKEN_VALIDITY)).strftime('%s')) * 1000
        }
        invoke_payload = {
            "pathParameters":{"id": user_id},
            "requestContext": {"httpMethod": "POST", "requestId": "ai_amorphic_operations", "resourcePath": "/access-tokens"},
            "headers": {"Authorization": authtoken,"role_id": role_id},
            "resource": "ai_amorphic_operations",
            "httpMethod": "POST",
            "body": json.dumps(input_body)
        }
        response = commonUtil.invoke_lambda_function(
            lambda_client=LAMBDA_CLIENT,
            function_name=ACCESS_TOKENS_LAMBDA_ARN,
            payload=json.dumps(invoke_payload),
            invocation_type='RequestResponse'
        )
        response = json.loads(response['Payload'].read().decode('utf-8'))
        response['body'] = json.loads(response.get('body', ""))

        if 'AccessToken' in response['body']:
            LOGGER.info("In users.create_amorphic_connection, AccessToken creation response: %s", response['body'])
            access_token = response['body'].get('AccessToken', "")
            access_token_id = response['body'].get('AccessTokenId', "")
        else:
            LOGGER.error("In users.create_amorphic_connection, AccessToken creation failed with error: %s", response['body'])
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Error while creating access token, response:{response['body']}")
    else:
        access_token_id = ""

    if access_token:
        expires_on = is_access_token_valid(access_token, user_id)
    store_access_token_in_parameter_store(user_id, access_token, access_token_id)
    update_response = dynamodbUtil.update_item_by_key(
                DYNAMODB_RESOURCE.Table(USERS_TABLE),
                {'UserId': user_id},
                'set AccessTokenId=:val1, AmorphicIntegrationStatus=:val2, RoleId=:val3, LastModifiedTime=:val4, LastModifiedBy=:val5, AccessTokenExpiresAt=:val6', # Update Expression
                {
                    ':val1': access_token_id,
                    ':val2': "connected",
                    ':val3': role_id,
                    ':val4': commonUtil.get_current_time(),
                    ':val5': user_id,
                    ':val6': expires_on
                } # Expression Attribute Values
            )
    if update_response == 'error':
        LOGGER.error("In users.create_amorphic_connection, Failed to update user table")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Error while updating integration status")
    else:
        # check if user have default domain else create default domain while integrating
        if not user_item.get("DefaultDomain"):
            LOGGER.info("In users.create_amorphic_connection, trying to create default domain for user: %s", user_id)
            set_default_domain(user_id, {})
            LOGGER.info("In users.create_amorphic_connection, default domain creation completed")
        response = commonUtil.build_get_post_response(200, {"Message": "Successfully connected to amorphic"})
    return response

def integrate_amorphic(user_item, action, event_body, authtoken):
    """
    This method will integrate amorphic
    :param user_id: User ID of a user which is being retrieved.
    :param action: action to be performed
    :param event_body: event body
    :return: User object
    """
    LOGGER.info("In users.integrate_amorphic, starting method")
    user_id = user_item['UserId']
    if action == "connect":
        if "RoleId" not in event_body:
            LOGGER.error("In users.integrate_amorphic, RoleId is missing")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "'RoleId' is Required")
        response = create_amorphic_connection(user_item, event_body, authtoken)
    elif action == "disconnect" :
        if user_item.get('AmorphicIntegrationStatus') in ["connected", "disabled"]:
            response = delete_amorphic_connection(user_id)
        else:
            LOGGER.error("In users.lambda_handler, User is not connected to amorphic")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User is not connected to amorphic")
    elif action == "enable":
        if user_item.get('AmorphicIntegrationStatus') == "disabled":
            response = change_amorphic_connection_status(user_id, "enable")
        elif user_item.get('AmorphicIntegrationStatus') == "connected":
            LOGGER.error("In users.lambda_handler, User is already connected to amorphic")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User is already connected to amorphic")
        elif user_item.get('AmorphicIntegrationStatus') == "disconnected":
            LOGGER.error("In users.lambda_handler, User is already disconnected from amorphic")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User is disconnected from amorphic, No Access Token available")
    elif action == "disable":
        if user_item.get('AmorphicIntegrationStatus') == "connected":
            response = change_amorphic_connection_status(user_id, "disable")
        else:
            LOGGER.error("In users.lambda_handler, User is not connected to amorphic")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User is not connected to amorphic")
    else:
        LOGGER.error("In users.lambda_handler, Invalid action- %s, should be one of- %s", action, ["connect", "disconnect", "enable", "disable"])
        raise errorUtil.InvalidInputException(EVENT_INFO, errorUtil.get_error_object("GE-1010"))
    return response

def get_user_roles_from_amorphic(user_id, authtoken):
    """
    This method gets the user roles from amorphic
    :param user_id: User ID information
    :type user_id: string
    :return: user_roles: List of user roles
    :rtype: list
    """
    LOGGER.info("In users.get_user_roles_from_amorphic, getting roles for user: %s", user_id)
    invoke_payload = {
        "pathParameters":{"id": user_id},
        "requestContext": {"httpMethod": "GET", "resourcePath": "/users/{id}"},
        "headers": {"Authorization": authtoken},
        "resource": "/users/{id}",
        "httpMethod": "GET"
    }

    response = commonUtil.invoke_lambda_function(
        lambda_client=LAMBDA_CLIENT,
        function_name=AMORPHIC_GET_USER_LAMBDA_ARN,
        payload=json.dumps(invoke_payload),
        invocation_type='RequestResponse'
        )
    if response["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In users.lambda_handler, error: %s", response['Payload'].read().decode())
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "error- {0}".format(response['Payload'].read().decode())
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    response = json.loads(response['Payload'].read().decode('utf-8'))
    response['body'] = json.loads(response['body'])

    if "user" in response['body'] and 'RolesAttached' in response['body']['user'][0]:
        roles_attached = response['body']['user'][0]['RolesAttached']
        LOGGER.info("In users.get_user_roles_from_amorphic, user accessible roles: %s", roles_attached)
        response_roles_attached = [{"RoleId": key, "RoleName": value} for key, value in roles_attached.items()]
        return commonUtil.build_get_post_response(200, {"Message": "Successfully retrieved user accessible roles from amorphic", "Roles": response_roles_attached})
    else:
        LOGGER.error("In users.get_user_roles_from_amorphic, User `%s` has no roles in amorphic", user_id)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "User has nor roles attached in amorphic and failed with error - {0}".format(response['body'])
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

def get_amorphic_tenants(user_id):
    """
    This method gets user accessible amorphic tenants
    :param user_id: User ID information
    :return: tenants details
    """
    LOGGER.info("In users.get_amorphic_tenants, getting domains from amorphic for user %s", user_id)
    auth_token, role_id = commonUtil.get_user_auth_resources(user_id, USERS_TABLE)
    invoke_payload = {
        "requestContext": {"httpMethod": "GET"},
        "headers": {'Authorization': auth_token, 'role_id': role_id},
        "resource": "/dwh-clusters/tenants",
        "queryStringParameters": "",
        "httpMethod": "GET"
    }

    response = commonUtil.invoke_lambda_function(
        lambda_client=LAMBDA_CLIENT,
        function_name=AMORPHIC_DWH_TENANTS_LAMBDA_ARN,
        payload=json.dumps(invoke_payload),
        invocation_type='RequestResponse'
        )
    LOGGER.info("In users.get_amorphic_tenants, get domains response: %s", response)
    if response["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In users.get_amorphic_tenants, error: %s", response['Payload'].read().decode())
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "error- {0}".format(response['Payload'].read().decode())
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    response = json.loads(response['Payload'].read().decode('utf-8'))
    response['body'] = json.loads(response['body'])
    if 'Tenants' in response['body']:
        owner_tenants = []
        for tenant in response['body']['Tenants']:
            if tenant.get("AccessType", "").lower() == "owner":
                owner_tenants.append({"TenantName": tenant["TenantName"], "DisplayName": tenant["DisplayName"], "TenantDescription": tenant["TenantDescription"]})
        LOGGER.info("In users.get_amorphic_tenants, user accessible tenants: %s", response)
        if owner_tenants:
            return commonUtil.build_get_post_response(200, {"Tenants": owner_tenants})
        else:
            return commonUtil.build_get_post_response(200, {"Message": "User has no tenants in amorphic", "Tenants": owner_tenants})
    else:
        LOGGER.error("In users.get_amorphic_tenants, User `%s` has no tenants in amorphic", user_id)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User has no tenants in amorphic")

def get_amorphic_domains(user_id):
    """
    This method gets amorphic domains
    :param user_id: User ID information
        :return: domain information
    """
    LOGGER.info("In users.get_amorphic_domains, getting domains from amorphic for user %s", user_id)
    auth_token, role_id = commonUtil.get_user_auth_resources(user_id, USERS_TABLE)
    invoke_payload = {
        "requestContext": {"httpMethod": "GET"},
        "headers": {'Authorization': auth_token, 'role_id': role_id},
        "resource": "/domains",
        "queryStringParameters": "",
        "httpMethod": "GET"
    }

    response = commonUtil.invoke_lambda_function(
        lambda_client=LAMBDA_CLIENT,
        function_name=AMORPHIC_DOMAINS_LAMBDA_ARN,
        payload=json.dumps(invoke_payload),
        invocation_type='RequestResponse'
        )
    LOGGER.info("In users.get_amorphic_domains, get domains response: %s", response)
    if response["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In users.get_amorphic_domains, error: %s", response['Payload'].read().decode())
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "error- {0}".format(response['Payload'].read().decode())
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    response = json.loads(response['Payload'].read().decode('utf-8'))
    response['body'] = json.loads(response['body'])
    if 'domains' in response['body']:
        owner_domains = []
        for domain in response['body']['domains']:
            if domain.get("AccessType", "").lower() == "owner":
                owner_domains.append({"DomainName": domain["DomainName"], "DisplayName": domain["DisplayName"], "DomainDescription": domain["DomainDescription"]})
        LOGGER.info("In users.get_amorphic_domains, user accessible domains: %s", response)
        if owner_domains:
            return commonUtil.build_get_post_response(200,{"Domains": owner_domains})
        else:
            LOGGER.error("In users.get_amorphic_domains, User '%s' has no domains with owner access in amorphic", user_id)
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User has no domains with owner access in amorphic")
    else:
        LOGGER.error("In users.get_amorphic_domains, User '%s' has no domains in amorphic", user_id)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User has no domains in amorphic, please create a domain")

def set_default_domain(user_id, event_body, api_resource=None):
    """
    :param user_id: user id of the user
    :param event_body: input body of the event
    :return: response message
    """
    LOGGER.info("In users.set_default_domain, setting default domain for user %s", user_id)
    if api_resource == "/users/{id}/preferences":
        # add validation for required keys
        if not any(key in event_body for key in ["DomainName", "TenantName"]):
            LOGGER.info("In users.set_default_domain, any one of the keys ['DomainName', 'TenantName'] is required")
            errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1008", None, "[DomainName, TenantName]")

    tenant_name = event_body.get('TenantName', DEFAULT_TENANT)
    if event_body.get('DomainName'):
        default_domain_name = event_body['DomainName']
    else:
        random_string=str(uuid.uuid4())
        input_body = {
            "DomainName" : f"ai{random_string[:6]}",
            "DomainDescription": "Domain created from AI",
            "DisplayName":f"ai domain {random_string[:6]}",
        }
        # In Non-Multi-Tenancy env, TenantName is not required as it will be taken as default tenant
        if MULTI_TENANCY == "yes":
            input_body.update({
                "TenantName" : tenant_name
            })

        auth_token, role_id = commonUtil.get_user_auth_resources(user_id, USERS_TABLE)
        invoke_payload = {
            "requestContext": {"httpMethod": "POST"},
            "headers": {'Authorization': auth_token, 'role_id': role_id},
            "resource": "/domains",
            "queryStringParameters": {},
            "httpMethod": "POST",
            "body": json.dumps(input_body)
        }
        response = commonUtil.invoke_lambda_function(
            lambda_client=LAMBDA_CLIENT,
            function_name=AMORPHIC_DOMAINS_LAMBDA_ARN,
            payload=json.dumps(invoke_payload),
            invocation_type='RequestResponse'
        )
        LOGGER.info("In users.set_default_domain, create domain response: %s", response)
        if response["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In users.set_default_domain, error: %s", response['Payload'].read().decode())
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = "error- {0}".format(response['Payload'].read().decode())
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

        response = json.loads(response['Payload'].read().decode('utf-8'))
        response['body'] = json.loads(response['body'])
        if response['body']["Message"] == "Domain Creation Successful.":
            if tenant_name != DEFAULT_TENANT:
                default_domain_name = tenant_name + "_" + input_body["DomainName"]
            else:
                default_domain_name = input_body["DomainName"]
        else:
            LOGGER.error("In users.set_default_domain, Default domain creation failed due to error %s", response['body'])
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Default domain creation failed due to error {response['body']}")

    # set default domain
    update_response = dynamodbUtil.update_item_by_key(
                DYNAMODB_RESOURCE.Table(USERS_TABLE),
                { 'UserId': user_id }, # Key
                'SET DefaultDomain=:val1, LastModifiedTime=:val2, LastModifiedBy=:val3, TenantName=:val4', # Update Expression
                {
                    ':val1': default_domain_name,
                    ':val2': commonUtil.get_current_time(),
                    ':val3': user_id,
                    ':val4': tenant_name
                } # Expression Attribute Values
            )
    if update_response == 'error':
        LOGGER.error("In users.set_default_domain, Failed to set default domain for user %s", user_id)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Error while setting default domain")
    return commonUtil.build_get_post_response(200, {"Message": f"Successfully configured default domain - {default_domain_name}"})

def update_user_role(user_obj, input_user_id, auth_user_id):
    """
    This function is for updating the user role b/w: Admins, Developers & Users
    This action can only be performed by Admins
    :param user_id: User Id of the user to be updated
    :param auth_user_id: User Id of the user who is trying to perform this action
    :param updated_user_type: User Role to be granted for user_id
    """
    LOGGER.info("In users.update_user_role, User %s is trying to grant %s access to %s", auth_user_id, user_obj["UserRole"], input_user_id)

    # Admins can't demote themselves
    if input_user_id != auth_user_id:
        if user_obj["UserRole"] in VALID_USER_ROLES:
            updated_user_type = user_obj["UserRole"]
            key = {"UserId": input_user_id}
            update_expression = "SET UserRole = :val1, LastModifiedBy = :val2, LastModifiedTime = :val3"
            expression_attributes = {
                ":val1": updated_user_type,
                ":val2": str(auth_user_id),
                ":val3": commonUtil.get_current_time()
            }

            update_status = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(USERS_TABLE), key, update_expression, expression_attributes)
            if update_status == "error":
                LOGGER.error("In users.update_user_role, failed to update user role in DynamoDB")
                ec_db_1002 = errorUtil.get_error_object("DB-1002")
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1002)

            return {"Message": f"Successfully updated user role for {input_user_id}"}

        # Role not in valid user roles
        LOGGER.error("In users.update_user_role, %s is not a valid user role", user_obj["UserRole"])
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"'{user_obj['UserRole']}' is not a valid user role: {user_obj['UserRole']}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    LOGGER.error("In users.update_user_role, an admin cannot demote themselves")
    ec_ge_1034 = errorUtil.get_error_object("GE-1034")
    ec_ge_1034["Message"] = "An admin user cannot demote themselves"
    raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

def update_user(user_obj, input_user_id, auth_user_item):
    """
    Performs update actions on user
    :param user_obj: User object
    :param input_user_id: User ID information
    :param auth_user_item: Auth User information
    :return: response
    """
    LOGGER.info("In users.update_user, starting the method")

    # Can only be performed by admins
    if auth_user_item.get("UserRole") != commonUtil.ADMINS_USER_ROLE:
        LOGGER.error("In users.update_user, User `%s` with user type `%s` is not permitted to perform this action", auth_user_item["UserId"], auth_user_item.get("UserRole"))
        ec_auth_1002 = errorUtil.get_error_object("AUTH-1002")
        raise errorUtil.UnauthorizedUserException(EVENT_INFO, ec_auth_1002)

    action = user_obj["Action"]
    if action not in VALID_ADMIN_ACTIONS:
        LOGGER.error("In users.update_user, not a valid user action %s", action)
        usr_ge_1034 = errorUtil.get_error_object("GE-1034")
        usr_ge_1034["Message"] = "Not a valid user action"
        raise errorUtil.GenericFailureException(EVENT_INFO, usr_ge_1034)

    if action == "update_user_role":
        response = update_user_role(user_obj, input_user_id, auth_user_item["UserId"])

    return response

def get_user_details(input_user_id, auth_user_id, auth_user_item):
    """
    Get user detail from Dynamo DB
    :param user_id: User ID of a user which is being retrieved.
        :return: User object
    """

    # Self login call, return the details of user
    if input_user_id == auth_user_id:
        return_user_item =  auth_user_item

    # Request is to get info about other user
    elif auth_user_item.get("UserRole") == commonUtil.ADMINS_USER_ROLE:
        return_user_item = commonUtil.is_valid_user(input_user_id, True)

    else:
        LOGGER.error("In users.get_user_details, User `%s` not authorized to perform this action", input_user_id)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"User {input_user_id} not authorized to perform this action")

    return_user_item.pop("Groups", None)
    return return_user_item

def list_users(auth_user_item):
    """
    List all users in ai
    :param auth_user_id: User ID of the user who is making the request
        :return: List of users
    """
    LOGGER.info ("In users.list_users starting the method")
    if auth_user_item.get("UserRole") == commonUtil.ADMINS_USER_ROLE:
        projection_expression = "UserId,EmailId,FullName,UserRole,EmailSubscription,DefaultDomain,TenantName,AmorphicIntegrationStatus,RoleId,UserCreationDate"
    else:
        projection_expression = "UserId,EmailId,FullName,UserRole"

    response = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(USERS_TABLE), None, projection_expression
    )
    return { "Users": response }

def is_admin_user_exist():
    """
    First user who signs in will be set as an admin,
    check if this default admin is already created
    :return: True if admin user is already created
    :rtype: bool
    """
    LOGGER.info("In users.is_admin_user_exist, check if admin user already exists")
    admin_exist = False
    filter_expression = Attr('UserRole').eq(commonUtil.ADMINS_USER_ROLE)
    response = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(USERS_TABLE),
        filter_expression,
        None, None
    )
    LOGGER.info("In users.is_admin_user_exist, userTable scan response: %s", response)
    if response:
        admin_exist = True
    return admin_exist

def create_new_user(claims, user_id):
    """
    This method creates a new user in users table when logging in is successful for the first time
    """
    LOGGER.info("In users.create_new_user, starting method, UserId: %s", user_id)
    default_groups = set(["g_{}_owner".format(user_id), "g_{}_read-only".format(user_id)])
    # get the name of the user from claims, if not use user_id
    name = claims.get("name", user_id)
    # email claim available?
    if 'email' not in claims:
        ec_ipv_1009 = errorUtil.get_error_object("IPV-1009")
        ec_ipv_1009['Message'] = ec_ipv_1009['Message'].format("email")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1009)
    email_id = claims['email']
    # Check if the user exists or not
    user_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(USERS_TABLE), {"UserId": user_id})
    if user_item and "EmailId" in user_item:
        LOGGER.error("In users.create_new_user, user %s already exists in the system. user_item - %s", user_id, user_item)
        ec_ge_1009 = errorUtil.get_error_object("GE-1009")
        ec_ge_1009['Message'] = ec_ge_1009['Message'].format("User")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1009)

    LOGGER.info("In users.create_new_user, creating the user with id %s", user_id)
    user_metadata = {
        'UserId': user_id,
        'FullName': name.strip(),
        'EmailId': email_id,
        'UserCreationDate': commonUtil.get_current_time(),
        'LastModifiedTime': commonUtil.get_current_time(),
        'LastModifiedBy': user_id,
        'Groups': default_groups,
        'AmorphicIntegrationStatus': 'disconnected'
    }

    # making the first ever user in the application Admin
    if not is_admin_user_exist():
        user_metadata['UserRole'] = commonUtil.ADMINS_USER_ROLE
    else:
        user_metadata['UserRole'] = commonUtil.USERS_USER_ROLE

    # update the user table with new user information
    dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(USERS_TABLE), user_metadata)
    LOGGER.info("In users.create_new_user, user %s created successfully.", user_id)
    # create default groups
    default_groups_items = [
        {
            "GroupId": "g_{}_owner".format(user_id),
            "LastModifiedTime": commonUtil.get_current_time(),
            "LastModifiedBy": user_id,
            "CreatedBy": user_id,
            "CreationTime":commonUtil.get_current_time(),
            "GroupName": f"This is owner group of {user_id}",
            "GroupType": "owner",
            "Default": "yes"
        },
        {
            "GroupId": "g_{}_read-only".format(user_id),
            "LastModifiedTime": commonUtil.get_current_time(),
            "LastModifiedBy": user_id,
            "CreatedBy": user_id,
            "CreationTime":commonUtil.get_current_time(),
            "GroupName": f"This is read-only group of {user_id}",
            "GroupType": "read-only",
            "Default": "yes"
        }
    ]
    dynamodbUtil.batch_write_items(DYNAMODB_RESOURCE.Table(GROUPS_TABLE), default_groups_items)
    return commonUtil.build_post_response(200, {'Message': 'User has been created'})

def lambda_handler(event, context):
    """
    This Lambda function is to handle users related API calls
    """
    try:
        #to remove authorization token while printing logs
        event = commonUtil.RedactAuthTokensClass(event)
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
        LOGGER.info("In users.lambda_handler, event - %s", event)
        http_method = event['requestContext']['httpMethod']
        api_resource = event['resource']
        if "queryStringParameters" in event and event["queryStringParameters"]:
            query_params = event.get("queryStringParameters", {})
            action = query_params.get('action',"N/A").lower()

        LOGGER.info("In users.lambda_handler, http_method - %s, api_resource - %s", http_method, api_resource)

        auth_token = event['headers']['Authorization']
        claims = commonUtil.get_claims(auth_token)
        user_id = claims['cognito:username']

        # Check if the user is valid user or not, we don't need to check if users exist in the system or not for below calls
        user_item = commonUtil.is_valid_user(user_id, True) if api_resource == "/users" or (http_method == 'GET' and api_resource == "/users/{id}") else commonUtil.is_valid_user(user_id, False)

        if http_method == 'POST' and api_resource == "/users":
            response = create_new_user(claims, user_id)
        elif http_method == 'GET' and api_resource == "/users":
            users = list_users(user_item)
            response = commonUtil.build_get_put_response(200, users)

        elif http_method == 'GET' and api_resource == "/users/{id}":
            input_user_id = event['pathParameters']['id']
            user_details = get_user_details(input_user_id, user_id, user_item)
            response = commonUtil.build_get_put_response(200, user_details)

        elif http_method == 'PUT' and api_resource == "/users/{id}":
            input_user_id = event['pathParameters']['id']
            input_body = json.loads(event.get('body', {}))
            message = update_user(input_body, input_user_id, user_item)
            response = commonUtil.build_get_put_response(200, message)

        elif http_method == 'POST' and api_resource =="/users/{id}/preferences":
            event_body = json.loads(event.get("body")) if event.get("body") else {}
            response = set_default_domain(user_id, event_body, api_resource)

        elif api_resource == '/amorphic/domains' and http_method == "GET":
            commonUtil.validate_amorphic_integration_status(user_id)
            response = get_amorphic_domains(user_id)
        elif api_resource == '/amorphic/tenants' and  http_method == "GET":
            if MULTI_TENANCY == 'yes':
                response = get_amorphic_tenants(user_id)
            else:
                response = commonUtil.build_get_post_response(
                    200, {
                        "Tenants": [{"TenantName": DEFAULT_TENANT,"DisplayName": "Default tenant",
                                     "TenantDescription": "This is a system generated tenant with access to every user in the application. This tenant can not be deleted only users in the tenant can be updated"}]
                })
        elif api_resource == '/amorphic/roles' and http_method == "GET":
            response = get_user_roles_from_amorphic(user_id, auth_token)

        elif api_resource == '/users/integrate-amorphic' and http_method == "POST":
            if not event.get("body", None) and action == 'connect':
                LOGGER.info("In users.lambda_handler, Invalid body: body should not be empty")
                errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid request, body is required")
            event_body = json.loads(event.get("body", "{}"))
            response = integrate_amorphic(user_item, action, event_body, auth_token)

        elif api_resource == "/users/{id}/alert-preferences":
            input_user_id = event['pathParameters']['id']
            email_id = claims['email']

            if http_method == 'GET':
                user_details = get_user_details(input_user_id, user_id, user_item)
                status = get_subscription_status(user_details)
                response = commonUtil.build_get_response(200, status)
            else:
                # A user can only update their own alert preferences
                if input_user_id != user_id:
                    LOGGER.error("In emailSubscription.lambda_handler, User `%s` is not permitted to perform the action", user_id)
                    errorUtil.raise_exception(EVENT_INFO, "UU", "AUTH-1002", "default")

                elif http_method == 'POST':
                    status = subscribe_for_alerts(input_user_id, email_id)
                    response = commonUtil.build_get_post_response(200, status)

                elif http_method == 'DELETE':
                    status = unsubscribe_from_alerts(input_user_id, email_id)
                    response = commonUtil.build_delete_response(200, status)
        else:
            LOGGER.error("In users.lambda_handler, invalid api call - %s %s", http_method, api_resource)
            ec_ge_1010 = errorUtil.get_error_object("GE-1010")
            ec_ge_1010['Message'] = ec_ge_1010['Message'].format(http_method, api_resource)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1010)
    except errorUtil.InvalidUserException as iue:
        LOGGER.error("In users.lambda_handler, InvalidUserException occurred with error %s", iue)
        response = commonUtil.build_post_response(400, {'Message': str(iue)})
    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In users.lambda_handler, InvalidInputException occurred with error %s", iie)
        response = commonUtil.build_post_response(400, {'Message': str(iie)})
    except errorUtil.GenericFailureException as gfe:
        LOGGER.error("In users.lambda_handler, GenericFailureException occurred with error %s", gfe)
        response = commonUtil.build_post_response(500, {'Message': str(gfe)})
    except Exception as exc:
        LOGGER.error("In users.lambda_handler, Exception occurred with error %s", exc)
        response = commonUtil.build_generic_response(500, {"Message": str(exc)})
    return response
