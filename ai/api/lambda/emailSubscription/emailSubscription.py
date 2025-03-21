
"""
######################################################################################################
# File: emailSubscription.py
#
# This lambda function registers/de-register user from SES service to send the email alerts
# If the account is in Sandbox then don't use custom verification email template, use default sending method
#
#
# Modification History:
# ====================================================================
# Date                 Who                       Description
# ==========      =================     ==============================
# July 13th 2023       Yadu                     Initial Commit
#
######################################################################################################
"""

from __future__ import print_function  # Python 2/3 compatibility

import logging
import os
import sys
import boto3

import commonUtil
import dynamodbUtil
import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info('Loading email subscription lambda Function')

try:
    USERS_TABLE = dynamodbUtil.USERS_TABLE
    AWS_REGION = os.environ['awsRegion']
    AWS_PARTITION = os.environ["awsPartition"]
    SES_AWS_REGION = os.environ["sesAwsRegion"]
    ENVIRONMENT = os.environ['environment']
    ACCOUNT_ID = os.environ['accountId']
    PROJECT_NAME = os.environ['projectName']
    EVENT_INFO = {}

    # Define boto3 client/resources
    SES_CLIENT = boto3.client('ses', SES_AWS_REGION)
    SES_V2_CLIENT = boto3.client('sesv2', SES_AWS_REGION)
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
except Exception as exc:
    LOGGER.error("Failed to set environment variables with: %s", '{0}'.format(exc))
    sys.exit()

def get_user_details(user_id):
    """
    This function returns user details
    : param user_id : Id of the user
    """
    LOGGER.info("In emailSubscription.does_user_exist, checking if user %s is a valid user", user_id)
    user_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(USERS_TABLE), {'UserId': user_id})
    if not user_item:
        LOGGER.error("In emailSubscription.does_user_exist, given user id %s is invalid", user_id)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"The user: {user_id} does not exist"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    return user_item

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

def get_subscription_status(user_id):
    """
    This function is get email subscription status of user
    : param user_id
    : param email_id --> Email_id of user
    """
    LOGGER.info("In emailSubscription.get_subscription_status, User %s requested to check status of email subscription", user_id)

    user_item = get_user_details(user_id)
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
        key = {'UserId': user_id}
        update_expression = "SET EmailSubscription = :val1, LastModifiedBy = :val2, LastModifiedTime = :val3"
        expression_attributes = {
            ":val1": user_item['EmailSubscription'],
            ":val2": user_id,
            ":val3": commonUtil.get_current_time()
            }
        if dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(USERS_TABLE), key, update_expression, expression_attributes) == "error":
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("USER")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        LOGGER.info("In emailSubscription.get_subscription_status, Successfully updated user table for user %s with latest email subscription status", user_id)

    return {'EmailSubscriptionStatus': user_item['EmailSubscription']}

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

def lambda_handler(event, context):
    """
   This is a lambda handler function which is called for every API call event
   :param event: event information
   :type event: dict
   :param context: runtime information to the handler.
   :type context: LambdaContext
   :return: response to the api
   :rtype: dict
   """
    try:
        #to remove authorization token while printing logs
        event = commonUtil.RedactAuthTokensClass(event)
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
        api_request_id = event['requestContext']['requestId']
        lambda_request_id = context.aws_request_id
        LOGGER.info("API Gateway Request ID: " + api_request_id +
                    " Lambda Request ID: " + lambda_request_id)
        authtoken = event['headers']['Authorization']
        http_method = event['httpMethod']
        api_resource = event["resource"]
        claims = commonUtil.get_claims(authtoken)
        email_id = claims['email']
        user_id = claims['cognito:username']
        input_user_id = event['pathParameters']['id']
        # All users can only update their own alert preferences
        if input_user_id == user_id:
            if http_method == "GET" and api_resource == "/users/{id}/alert-preferences":
                status = get_subscription_status(input_user_id)
                response = commonUtil.build_get_response(200, status)

            elif http_method == "POST" and api_resource == "/users/{id}/alert-preferences":
                status = subscribe_for_alerts(input_user_id, email_id)
                response = commonUtil.build_get_post_response(200, status)

            elif http_method == "DELETE" and api_resource == "/users/{id}/alert-preferences":
                status = unsubscribe_from_alerts(input_user_id, email_id)
                response = commonUtil.build_delete_response(200, status)

        else:
            LOGGER.error("In emailSubscription.lambda_handler, User `%s` is not permitted to perform the action", user_id)
            errorUtil.raise_exception(EVENT_INFO, "UU", "AUTH-1002", "default")

    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In emailSubscription.lambda_handler, Failed to process the api request %s with error %s", api_request_id, iie)
        response = commonUtil.build_generic_response(400, {'Message': str(iie)})
    except errorUtil.GenericFailureException as gfe:
        LOGGER.error("In emailSubscription.lambda_handler, Failed to process the api request %s with error %s", api_request_id, gfe)
        response = commonUtil.build_generic_response(500, {'Message': str(gfe)})
    except errorUtil.UnauthorizedUserException as uue:
        LOGGER.error("In accessTokens.lambda_handler, Failed to process the api request %s with error %s", api_request_id, uue)
        response = commonUtil.build_generic_response(400, {'Message': str(uue)})
    except Exception as ex:
        LOGGER.error('In emailSubscription.lambda_handler, Email subscription api request %s raised by %s is failed with error %s.', api_request_id, user_id, ex)
        ec_ge_1008 = errorUtil.get_error_object("GE-1008")
        error_msg_format = errorUtil.get_error_object("EMF-1001")
        err_msg = error_msg_format['Message'].format(ec_ge_1008['Code'], ec_ge_1008['Message'])
        response = commonUtil.build_generic_response(500, {'Message': err_msg})

    return response
