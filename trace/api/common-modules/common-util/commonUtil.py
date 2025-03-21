"""
This file has all the common functions that are used.
"""
import os
import json
import logging
import decimal
from io import BytesIO
import gzip
import base64
from datetime import datetime, timezone

import errorUtil
import cognitoUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

EVENT_INFO = errorUtil.EVENT_INFO

# Datetime ISO format
DATETIME_ISO_FORMAT = "%Y-%m-%d %H:%M:%S"
USER_POOL_ID = os.environ["userPoolId"]
AWS_REGION = os.environ["awsRegion"]
ENABLE_IDP = os.environ["enableIDP"]
VERTICAL_NAME = os.environ['verticalName']

class RedactAuthTokensClass(dict):
    """
    Helper class to prevent printing of authorization header in event
    """

    def __str__(self) -> str:
        event = super().copy()
        event_temporary_json  =  json.dumps(event)
        event_copy = json.loads(event_temporary_json)

        # for REST API, the Authorization will be in headers. for WebSocket API, it will be in queryStringParameter
        for key in ["headers", "queryStringParameters"]:
            if key in event_copy and event_copy[key]:
                event_copy[key].pop("Authorization", None)
            multi_key = f"multiValue{key.capitalize()}"
            if multi_key in event_copy and event_copy[multi_key]:
                event_copy.get(multi_key, {}).pop("Authorization", None)

        return json.dumps(event_copy)

class CustomJsonEncoder(json.JSONEncoder):
    """
    Helper class to convert a DynamoDB item to JSON.
    """
    def default(self, o): # pylint: disable=E0202
        if isinstance(o, decimal.Decimal):
            if abs(o) % 1 > 0: # pylint: disable=R1705
                return float(o)
            else:
                return int(o)
        if isinstance(o, set):
            return list(o)
        return super().default(o)

def build_get_response(code=None, body=None, compression=None):
    """
    Builds response object
    :param code: Status code to be returned
    :type code: int
    :param body: values to be returned to API.
    :type body: object
    :param compression: compression for API response
    :type compression: boolean
    :return: constructed response
    :rtype: dict
    """
    response = {
        "statusCode": code,
        "headers": {"Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body, cls=CustomJsonEncoder)
    }
    if compression:
        response.update({
            'isBase64Encoded': True,
            'body': compress_and_encode_data(body)
        })
        response['headers'].update({
            'Content-Encoding': 'gzip',
        })
    return response

def build_post_response(code=None, body=None):
    """
    Builds response object
    :param code: Status code to be returned
    :type code: int
    :param body: values to be returned to API.
    :type body: dict
    :return: constructed response
    :rtype: dict
    """
    response = {
        "statusCode": code,
        "headers": {"Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body, cls=CustomJsonEncoder)
    }
    return response


def build_delete_response(code=None, body=None):
    """
    Builds response object
    :param code: Status code to be returned
    :type code: int
    :param body: values to be returned to API.
    :type body: dict
    :return: constructed response
    :rtype: dict
    """
    response = {
        "statusCode": code,
        "headers": {"Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS,DELETE",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body)
    }
    return response

def build_generic_response(code=None, body=None):
    """
    Builds response object
    :param code: Status code to be returned
    :type code: int
    :param body: values to be returned to API.
    :type body: dict
    :return: constructed response
    :rtype: dict
    """
    response = {
        "statusCode": code,
        "headers": {"Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS,DELETE",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body)
    }
    return response

# This method will return the claims of the authtoken
def get_claims(authtoken):
    """
    Returns claims
    :param authtoken: A valid JWT token
    :return: claims
    """
    import jwt
    LOGGER.info("In commonUtil.get_claims, Retrieving user id from auth token")
    claims = jwt.decode(authtoken, options={"verify_signature": False})
    LOGGER.info("In commonUtil.get_claims, Successfully retrieved claims from auth token")
    # claims['custom:samaccountname']
    LOGGER.info("In commonUtil.get_claims, Check if IDP custom username is available in token")
    # After adding the pretoken-generation in Cognito, all tokens will have "custom:username" in claims and will go thru the below if condition.
    if 'custom:username' in claims and claims['custom:username']:
        LOGGER.info("In commonUtil.get_claims, IDP custom username is present so replacing actual username with custom username")
        LOGGER.info("In commonUtil.get_claims, cognito:username - %s, custom:username - %s",
                    claims['cognito:username'], claims['custom:username'])
        # Appending original idp and custom username
        claims['origin_idp:username'] = claims['cognito:username']
        claims['cognito:username'] = claims['custom:username']
    return claims

def compress_and_encode_data(data):
    '''
    Compresses the given data using gzip and then encodes using base64
    :param data: data to be converted
    '''
    LOGGER.info("In commonUtil.compress_and_encode_data method, compressing data")
    compressed = BytesIO()
    with gzip.GzipFile(fileobj=compressed, mode='w') as file:
        json_response = json.dumps(data, cls=CustomJsonEncoder)
        file.write(json_response.encode('utf-8'))
    LOGGER.info("In commonUtil.compress_and_encode_data method, data compressed successfully")
    return base64.b64encode(compressed.getvalue()).decode('ascii')

def validate_event_body(event_body, required_keys):
    """
    This method will validate the event body
    :param event_body:
    :param required_keys:
    :return:
    """
    LOGGER.info("In commonUtil.validate_event_body, starting method with event body: %s and required keys: %s", event_body, required_keys)
    missing_keys = set(required_keys) - set(event_body.keys())
    if missing_keys:
        LOGGER.error("In commonUtil.validate_event_body, missing keys: %s in request body", missing_keys)
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format(missing_keys)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)

def get_current_time():
    """
    Retrieves current datetime in ISO format
    :return Current datetime in ISO format
    """
    current_time = str(datetime.now(timezone.utc).strftime(DATETIME_ISO_FORMAT))
    return current_time

def is_valid_user(user_id):
    """
    This method will check if user have permission to do specific operations
    """
    LOGGER.info("In commonUtil.is_valid_user, starting method with UserId: %s", user_id)

    cognito_util = cognitoUtil.CognitoUtil(USER_POOL_ID, AWS_REGION)
    filter_cond = 'cognito:user_status = "CONFIRMED"' if ENABLE_IDP == "no" else 'cognito:user_status = "EXTERNAL_PROVIDER"'
    cognito_user_response = cognito_util.get_users_list(filter_condition=filter_cond)
    # Check if user have access to the vertical
    user_allowed_apps = []
    invalid_user = True
    for each_user in cognito_user_response:
        allowed_apps = ["amorphic"]
        user_name = each_user['Username'] if each_user['Username'] == user_id else None
        for each_attr in each_user.get('Attributes', []):
            if each_attr["Name"] == "custom:username":
                user_name = each_user['Username'] if user_id == each_attr["Value"] else None
            if str(each_attr["Name"]) == "custom:attr3":
                # Value will be in format of "allowed_apps=amorphic,idp"
                allowed_apps = (each_attr["Value"].split("=")[1].split(","))
        # If a user is found then no need to continue the iteration, break the loop
        if user_name:
            invalid_user = False
            break
    user_allowed_apps = list(set(allowed_apps))

    LOGGER.info("In commonUtil.is_valid_user, checking if user have access to the vertical or invalid user")
    if not invalid_user and VERTICAL_NAME.lower() not in user_allowed_apps:
        LOGGER.error("In commonUtil.is_valid_user, user doesn't have access to the vertical")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User doesn't have access to the vertical")

    if invalid_user:
        LOGGER.error("In commonUtil.is_valid_user, user doesn't have access to the vertical")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User does not exist")
