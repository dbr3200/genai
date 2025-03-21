"""
This file has all the common functions that are used.
"""
import os
import sys
import json
from string import Template
import time
import logging
import decimal
from datetime import datetime, timedelta, timezone
import re
import csv
from uuid import UUID
from io import BytesIO
import gzip
import base64
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

import dynamodbUtil
import errorUtil
import cognitoUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

try:
    LOGGER.info("Loading environment variables - commonUtil")
    AWS_REGION = os.environ["awsRegion"]
    AWS_PARTITION = os.environ["awsPartition"]
    ACCOUNT_ID = os.environ["accountId"]
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    ENVIRONMENT = os.environ['environment']
    USER_POOL_ID = os.environ["userPoolId"]
    ENABLE_IDP = os.environ["enableIDP"]

    # AUDITLOGS_RESOURCE_INDEX_NAME = dynamodbUtil.AUDITLOGS_RESOURCE_INDEX_NAME
    SSM_CLIENT = boto3.client('ssm', AWS_REGION)
    EVENT_CLIENT = boto3.client('events', AWS_REGION)
    DYNAMODB_RES = boto3.resource('dynamodb', AWS_REGION)

    USERS_TABLE = dynamodbUtil.USERS_TABLE
    VERTICAL_NAME = os.environ['verticalName']
except Exception as exc:
    LOGGER.error("Failed to load env-variables in commonUtil with exception %s", exc)
    sys.exit()

# Common Variables
SUPPORTED_DATASET_FILETYPES = ['pdf', 'others', 'txt', 'csv']

# Run related variables
RUN_STATUS_STARTING = "STARTING"
RUN_STATUS_IN_PROGRESS = "IN_PROGRESS"
RUN_STATUS_COMPLETE = "COMPLETE"
RUN_STATUS_FAILED = "FAILED"

# file synchronization variables
FILE_SYNC_STATUS_PENDING = "pending"
FILE_SYNC_STATUS_RUNNING = "running"
FILE_SYNC_STATUS_COMPLETED = "completed"
FILE_SYNC_STATUS_FAILED = "failed"

# agent action status
AGENT_SUCCESS_STATE = "SUCCESS"
AGENT_FAILURE_STATE = "FAILURE"

# chat query status variables
CHAT_QUERY_PROCESSING = "processing"
CHAT_QUERY_COMPLETED = "completed"
CHAT_QUERY_FAILED = "failed"

WORKSPACES_CREATING_STATUS = "CREATING"
WORKSPACES_CREATION_COMPLETED_STATUS = "ACTIVE"
WORKSPACES_DELETING_STATUS = "DELETE_IN_PROGRESS"
WORKSPACES_DELETE_FAILED_STATUS = "DELETE_FAILED"
WORKSPACES_FAILED_STATUS = "CREATE_FAILED"

OPENAI_MODEL_PROVIDER = "Openai"

UPLOAD_FILE_LOAD_STATUS_COMPLETED = "completed"

SYSTEM_RUNNER_ID = 'System'
EMAIL_SENDER_NAME = "Amorphic Data Services"

ADMINS_USER_ROLE = "Admins"
DEVELOPERS_USER_ROLE = "Developers"
USERS_USER_ROLE = "Users"

# MIME types for respective file types
FILE_TYPE_MIME_MAP = {
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "txt": "text/plain",
    "csv": "text/csv",
    "tsv": "text/tab-separated-values",
    "xlsx": "text/csv",
    "png": "image/png",
    "pdf": "application/pdf",
    "wav": "audio/x-wav",
    "mp3": "audio/mpeg",
    "py": "text/x-python",
    "zip": "application/zip",
    "egg": "application/zip",
    "whl": "application/zip",
    "mp4": "video/mp4"
}
VALID_TRIGGER_TYPES = ['time-based', 'file-based', 'on-demand']

ACCESS_TYPES = ["owner", "read-only"]
S3_BATCH_SIZE = 1000

# Datetime ISO format
DATETIME_ISO_FORMAT = "%Y-%m-%d %H:%M:%S"
DATE_ISO_FORMAT = "%Y-%m-%d"

EVENT_INFO = errorUtil.EVENT_INFO

OPENAI_KEY_SSM_KEY = 'AMORPHIC.AI.CONFIG.OPENAIKEY'
WORKSPACE_RETRIEVAL_MAXRESULTS_SSM_KEY = 'AMORPHIC.AI.CONFIG.WORKSPACE_RETRIEVAL_MAXRESULTS'

CHAT_MESSAGE_DELIVERY_DELIVERED = 'DELIVERED'
CHAT_MESSAGE_DELIVERY_PENDING = 'PENDING'
CHAT_MESSAGE_DELIVERY_FAILED = 'FAILED'

CHAT_SESSION_VALIDITY_IN_DAYS = 365
CHATBOT_SESSION_VALIDITY_IN_DAYS = 7
AGENT_IDLE_SESSION_TIMEOUT_IN_SECONDS = 3600


BASE_MODEL_TYPE = "Base"
CUSTOM_MODEL_TYPE = "Custom"

PROVISIONED_THROUGHPUT_SUCCESS_STATUS = "InService"

MODEL_STATUS_GREEN = "AVAILABLE"
MODEL_STATUS_YELLOW = "READY"
MODEL_STATUS_RED = "UNAVAILABLE"

PREBAKED_ACTION_GROUPS = ["DatasetOperations", "EtlOperations"]
AGENT_SUPPORTED_MODELS = ['anthropic.claude-instant-v1', 'anthropic.claude-v2', 'anthropic.claude-3-sonnet-20240229-v1:0', 'anthropic.claude-3-haiku-20240307-v1:0']
AGENT_ACTION_GROUP_RUNTIME = "python3.12"

MODEL_PROVIDER_MAP = {'amazon': 'amazon', 'stability ai': 'stability', 'ai21 labs': 'ai21', 'anthropic': 'anthropic', 'cohere': 'cohere', 'meta': 'meta', 'mistral ai': 'mistral', 'openai': 'openai'}

MODEL_PROVIDER_MAX_TOKENS_MAP = {
    'amazon': 8000,
    'anthropic': 4096,
    'ai21': 2048,
    'cohere': 4096,
    'meta': 2048,
    'mistral': 4096
}

class ExtendedEnum:
    """
    Extend Enum.
    """
    _ALL = set()

    @classmethod
    def is_valid(cls, value):
        """
        Check if it's a valid value
        :param value:
        :return:
        """
        return value.upper() in cls.list()

    @classmethod
    def list(cls):
        """
        List all supported values
        :return:
        """
        if not cls._ALL:
            cls._ALL = [
                getattr(cls, attr)
                for attr in dir(cls)
                if not attr.startswith("_") and not callable(getattr(cls, attr))
            ]
        return cls._ALL

    @classmethod
    def equals(cls, obj1, obj2):
        """
        check if 2 objects are equal
        :param obj1:
        :param obj2:
        :return:
        """
        return obj1.upper() == obj2

class NotificationTypes(ExtendedEnum):
    """
    Class to get the notification types.
    """
    SUCCESS = "success"
    FAILURE = "failure"
    WARNING = "warning"
    INFO = "info"
    DEBUG = "debug"

class DecimalEncoder(json.JSONEncoder):
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

class InvalidInputException(Exception):
    """
    Creating a custom exception for input validation
    """

    def __init___(self, error_arguments):
        Exception.__init__(self, "%s", error_arguments)


class InconsistentMetadataException(Exception):
    """
    Creating a custom exception for inconsistent metadata errors
    """

    def __init___(self, error_arguments):
        Exception.__init__(self, "%s", error_arguments)


class GenericFailureException(Exception):
    """
    Creating a custom exception for server side errors
    """

    def __init___(self, error_arguments):
        Exception.__init__(self, "%s", error_arguments)


class FailedToUpdateMetadataException(Exception):
    """
    Creating a custom exception for server side errors
    """

    def __init___(self, error_arguments):
        Exception.__init__(self, "%s", error_arguments)


class UnauthorizedUserException(Exception):
    """
    Creating a custom exception for unauthorized operations
    """

    def __init___(self, error_arguments):
        Exception.__init__(self, "%s", error_arguments)


class InvalidUserException(Exception):
    """
    Creating a custom exception for invalid user
    """

    def __init__(self, error_arguments):
        Exception.__init__(self, "%s", error_arguments)


class SNSSendMessageException(Exception):
    """
    Creating a custom exception when failing to send SNS message
    """

    def __init___(self, error_arguments):
        Exception.__init__(self, "%s", error_arguments)


class InvalidHttpMethodTypeException(Exception):
    """
    Creating a custom exception when wrong HTTP Method is used
    """

    def __init___(self, error_arguments):
        Exception.__init__(self, "%s", error_arguments)


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

def is_compression_requested(event):
    """
    Check if the requestor supports compressed response
    :param event: Input request data
    :return: True if headers has gzip or deflate else False
    """
    LOGGER.info("In commonUtil.is_compression_requested method, checking if request headers has gzip")
    headers = event.get('headers', {})
    accepted_encoding = headers.get('Accept-Encoding', "")
    LOGGER.info("In commonUtil.is_compression_requested method, found accepted encoding %s", accepted_encoding)
    # Only gzip is supported for compression
    return 'gzip' in accepted_encoding

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

def build_post_delete_response(code=None, body=None):
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
                    "Access-Control-Allow-Methods": "POST,DELETE,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body)
    }
    return response

def build_put_response(code=None, body=None):
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
                    "Access-Control-Allow-Methods": "PUT,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body)
    }
    return response

def build_get_post_response(code=None, body=None):
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
                    "Access-Control-Allow-Methods": "POST,GET,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body, cls=DecimalEncoder)
    }
    return response

def build_get_put_post_response(code=None, body=None):
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
                    "Access-Control-Allow-Methods": "POST,GET,PUT,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body, cls=DecimalEncoder)
    }
    return response

def build_put_post_response(code=None, body=None):
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
                    "Access-Control-Allow-Methods": "POST,PUT,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body, cls=DecimalEncoder)
    }
    return response

def build_get_put_response(code=None, body=None):
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
                    "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,"
                                                    "X-Api-Key,X-Amz-Security-Token"},
        "body": json.dumps(body, cls=DecimalEncoder)
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

def build_redirect_response(code=None, location=None):
    """
    Builds response object
    :param code: Status code to be returned
    :type code: int
    :param location: values to be returned to API via header.
    :type location: str
    :return: constructed response
    :rtype: dict
    """
    response = {
        "statusCode": code,
        "headers": {"Location": location,
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "OPTIONS,GET",
                    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,"
                                                    "X-Api-Key,X-Amz-Security-Token"}
    }
    return response

def is_valid_uuid(uuid_to_test):
    """
    This function is to test if the ID passed is UUID
    """
    LOGGER.info("In commonUtil.is_valid_uuid checking if the given UUID is valid or not")
    try:
        UUID(uuid_to_test)
        return True
    except Exception:
        return False

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

# This method will give the dataset details.
def get_datasetdetails(dataset_id, dataset_table_name, dynamodb_resource):
    """
    This function will give the dataset details for a particular dataset.
    :param dataset_id:
    :param table_name:
    :param dynamodb:
    :return:
    """
    LOGGER.info("In commonUtil.get_datasetdetails, Getting the details for dataset id %s", dataset_id)
    dataset_item = dynamodbUtil.get_item_with_key(dynamodb_resource.Table(dataset_table_name), {"DatasetId": dataset_id})
    LOGGER.info("In commonUtil.get_datasetdetails, dataset_item %s", dataset_item)
    return dataset_item

def get_userdetails(user_id, user_table_name, dynamodb_resource):
    """
    This function gets the user details
    :param user_id: user id to get the details
    :type user_id: str
    :param table_name:
    :param dynamodb:
    :return: user details
    :rtype: dict
    """
    LOGGER.info("In commonUtil.get_userdetails, Getting the user details for user id %s", user_id)
    user_item = dynamodbUtil.get_item_with_key(dynamodb_resource.Table(user_table_name), {'UserId': user_id})
    if not user_item:
        LOGGER.error("In commonUtil.get_userdetails, User '%s' not found", user_id)
        errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1002", None, "UserId", user_id)
    elif user_item.get("Groups", []):
        user_item["Groups"] = list(user_item["Groups"])
    LOGGER.info("In commonUtil.get_userdetails, user_item - %s", user_item)

    return user_item

def check_user_dataset_access(dataset_id, user_dataset_table, user_id, dynamodb_resource):
    """
    This function will check for the permission type
    :param dataset_id:
    :type dataset_id: str
    :param user_dataset_table:
    :type user_dataset_table: str
    :param user_id:
    :type user_id: str
    """
    LOGGER.info("In commonUtil.check_user_dataset_access, Retrieving user %s access on dataset - %s", user_id, dataset_id)
    permission_type = "No Access"
    ud_table = dynamodb_resource.Table(user_dataset_table)
    user_dataset_list = dynamodbUtil.get_item_with_key(
        ud_table,
        {
            'UserId': user_id,
            'DatasetId': dataset_id
        }
    )
    if user_dataset_list:
        if 'AccessType' in user_dataset_list:
            permission_type = user_dataset_list['AccessType']
    LOGGER.info("In commonUtil.check_user_dataset_access, User has '%s' access on dataset - %s", permission_type, dataset_id)
    return permission_type

def delete_s3_path(s3_bucket_name, s3_prefixs, s3_client):
    """
    Removes S3 directory and contents recursively
    :param s3_dir_path:
    :param s3_client:
    :return status - success/error
    """
    LOGGER.info("In commonUtil.delete_s3_path, with s3_bucket_name %s", s3_bucket_name)
    delete_api_limit = 1000
    objects_to_delete = list_all_s3_objects(s3_client, s3_bucket_name, s3_prefixs)
    if not objects_to_delete:
        return 'success'
    response_obj = {'errors': []}
    for i in range(0, len(objects_to_delete), delete_api_limit):
        batch = objects_to_delete[i:i+delete_api_limit]
        response = s3_client.delete_objects(
            Bucket=s3_bucket_name,
            Delete={"Objects": [{"Key": file_key} for file_key in batch]},
        )
        if response.get("Errors", []):
            LOGGER.error(
                "In commonUtil.delete_s3_path, encountered files that were not deleted"
            )
            response_obj["errors"].extend(response["Errors"])
    if response_obj["errors"]:
        LOGGER.error(
                "In commonUtil.delete_s3_path, delete failed due to %s", response_obj["errors"]
            )
        return 'error'
    return 'success'

def list_all_s3_objects(s3_client, s3_bucket_name, prefix_list):
    """
    List all the files in the bucket with a give prefix
    :param s3_client: Boto 3 S3 Client Object
    :param s3_bucket_name: S3 Bucket name which is to be scanned
    :param prefix_list: list of prefixes which is to be scanned
    :return: List of all s3 objects
    """
    LOGGER.info("In commonUtil.list_all_s3_objects with s3_bucket_name %s and prefixes - %s", s3_bucket_name, prefix_list)
    all_s3_objects = []
    for prefix in prefix_list:
        kwargs = {'Bucket': s3_bucket_name, 'Prefix': prefix}
        while True:
            resp = s3_client.list_objects_v2(**kwargs)
            if resp and resp["ResponseMetadata"] and resp["ResponseMetadata"]["HTTPStatusCode"] != 200:
                LOGGER.error("In commonUtil.list_all_s3_objects, unable to fetch contents from S3 bucket %s", str(s3_bucket_name))
                ec_ge_1017 = errorUtil.get_error_object("GE-1017")
                ec_ge_1017['Message'] = ec_ge_1017['Message'].format(s3_bucket_name)
                raise Exception(ec_ge_1017['Message'])

            if "Contents" in resp and resp['Contents']:
                LOGGER.info("In commonUtil.list_all_s3_objects, getting only matched keys based on the prefix & suffix")
                for obj in resp['Contents']:
                    all_s3_objects.append(obj['Key'])
            try:
                kwargs['ContinuationToken'] = resp['NextContinuationToken']
            except KeyError:
                break
    LOGGER.info("In commonUtil.list_all_s3_objects, list of all s3 objects are - %s", all_s3_objects)

    return all_s3_objects

def list_all_s3_prefixes(s3_client, s3_bucket_name, delimiter, prefix_list):
    """
    This method is to list all the the prefixes or folders present under certain prefix/s of S3 bucket
    :param s3_client: Boto 3 S3 Client Object
    :param s3_bucket_name: S3 Bucket name which is to be scanned
    :param prefix_list: list of prefixes which is to be scanned
    :param delimiter: delimiter to be passed to filter the prefixes
    :return: List of all s3 prefixes
    """
    LOGGER.info("In commonUtil.list_all_s3_prefixes with s3_bucket_name %s, delimiter - %s and prefixes - %s", s3_bucket_name, delimiter, prefix_list)
    all_s3_prefixes = []
    for prefix in prefix_list:
        kwargs = {'Bucket': s3_bucket_name, 'Prefix': prefix, 'Delimiter' : delimiter}
        while True:
            resp = s3_client.list_objects_v2(**kwargs)
            if resp and resp["ResponseMetadata"] and resp["ResponseMetadata"]["HTTPStatusCode"] != 200:
                LOGGER.error("In commonUtil.list_all_s3_prefixes, unable to fetch prefixes from S3 bucket %s under prefix - %s", str(s3_bucket_name), str(prefix))
                ec_ge_1017 = errorUtil.get_error_object("GE-1017")
                ec_ge_1017['Message'] = ec_ge_1017['Message'].format(s3_bucket_name)
                raise Exception(ec_ge_1017['Message'])

            if resp.get('CommonPrefixes'):
                LOGGER.info("In commonUtil.list_all_s3_prefixes, getting only matched keys based on the prefix & suffix")
                for each_prefix in resp['CommonPrefixes']:
                    all_s3_prefixes.append(each_prefix["Prefix"])
            try:
                kwargs['ContinuationToken'] = resp['NextContinuationToken']
            except KeyError:
                break
    LOGGER.info("In commonUtil.list_all_s3_prefixes, list of all s3 prefixes are - %s", all_s3_prefixes)

    return all_s3_prefixes

def get_s3_bucket_and_path(s3_full_path):
    """
    Method to split bucket name & bucket key from the s3 path provided
    @param: s3_full_path: Full S3 path to be validated
    @type: s3_full_path: string
    @return: (bucket_name: string, bucket_key: string)
    """
    LOGGER.info("In commonUtil.get_s3_bucket_and_path, s3_full_path is - %s", s3_full_path)
    s3_full_path_regex = r's3:\/\/(.+?)\/(.+)'
    match = re.match(s3_full_path_regex, s3_full_path)
    bucket_name = match.group(1)
    bucket_key = match.group(2)
    LOGGER.info("In commonUtil.get_s3_bucket_and_path, bucket_name - %s, bucket_key - %s", bucket_name, bucket_key)

    return bucket_name, bucket_key

def validate_s3_path(s3_full_path):
    """
    Validating the S3 url to see if it's a valid one
    @param: s3_full_path: Full S3 path to be validated
    @type: s3_full_path: string
    @return: None
    """
    LOGGER.info("In commonUtil.validate_s3_path, with s3_full_path %s", s3_full_path)

    if s3_full_path:
        bucket_name, bucket_key = get_s3_bucket_and_path(s3_full_path)
        LOGGER.info("In commonUtil.validate_s3_path, Bucket Name - %s, Bucket Key - %s", bucket_name, bucket_key)

        # Making suree bucket_name & bucket_key are non-empty
        if bucket_name and bucket_key:
            bucket_name_regex = r'^[a-z0-9.-]+$'

            if len(bucket_name) < 3 or len(bucket_name) > 63 or not bool(re.match(bucket_name_regex, bucket_name)):
                ec_ipv_1028 = errorUtil.get_error_object("IPV-1028")
                ec_ipv_1028['Message'] = ec_ipv_1028['Message'].format(path=s3_full_path)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1028)

            if bucket_name[-1] == "-" or "_" in bucket_name or ".." in bucket_name or "-." in bucket_name or ".-" in bucket_name:
                ec_ipv_1029 = errorUtil.get_error_object("IPV-1029")
                ec_ipv_1029['Message'] = ec_ipv_1029['Message'].format(path=s3_full_path)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1029)
        else:
            ec_ipv_1030 = errorUtil.get_error_object("IPV-1030")
            ec_ipv_1030['Message'] = ec_ipv_1030['Message'].format(path=s3_full_path)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1030)
    else:
        ec_ipv_1031 = errorUtil.get_error_object("IPV-1031")
        ec_ipv_1031['Message'] = ec_ipv_1031['Message'].format(path=s3_full_path)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1031)

    LOGGER.info("In commonUtil.validate_s3_path, S3 path - %s, is valid", s3_full_path)

def get_decrypted_value(parameter):
    """
    This function will decrypt the value that is stored in ssm parameter store
    :param parameter:
    :return:
    """
    client = boto3.client('ssm')
    param_details = client.get_parameter(
        Name=parameter,
        WithDecryption=True
    )
    return param_details['Parameter']['Value']

def get_secret_value(secrets_manager_client, secret_id, version_stage=None, version_id=None):
    """
    Return secret string retrieved from secrets manager without formatting it.
    :param secrets_manager_client: BOTO3 Secrets Manager Client
    :param secret_id: SecretId
    :param version_stage: Secret Version Label
    :param version_id: Secret Version Id
    :return: String
    """
    LOGGER.info("In commonUtil.get_secret_value, getting secret for secretId - %s with versionStage - %s"
                " or versionId - %s", secret_id, version_stage, version_id)
    kwargs = {"SecretId": secret_id}
    if version_stage:
        kwargs["VersionStage"] = version_stage
    if version_id:
        kwargs["VersionId"] = version_id
    try:
        secrets_response = secrets_manager_client.get_secret_value(**kwargs)
        LOGGER.info("In commonUtil.get_secret_value, secrets retrieved successfully")
    except ClientError as cer:
        LOGGER.error("In  commonUtil.get_secret_value, exception occured while retrieving secret due to - %s",
                     cer.response['Error']['Message'])
        ec_ge_1114 = errorUtil.get_error_object("GE-1114")
        ec_ge_1114['Message'] = ec_ge_1114['Message'].format(cer.response['Error']['Message'])
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1114) from cer
    return secrets_response["SecretString"]

def get_presigned_url_get_object(s3_client, bucket_name, object_key, output_file_key, disposition_type='attachment', expiration_in_seconds=3600, **kwargs):
    """
    Generate a presigned URL for download files from s3
    :param s3_client: boto3 s3 client object
    :param bucket_name: Name of the S3 bucket
    :param object_key: S3 Object key
    :param output_file_key: client side file name
    """
    LOGGER.info('In commonUtil.get_presigned_url, Generating S3 signed url')
    params = {
        'Bucket': bucket_name,
        'Key': "{}".format(object_key),
        'ResponseContentDisposition': "{}; filename={}".format(disposition_type, output_file_key)
    }
    if kwargs.get('response_content_type'):
        params['ResponseContentType'] = kwargs['response_content_type']
    url = s3_client.generate_presigned_url(
        ClientMethod='get_object',
        Params=params,
        ExpiresIn=expiration_in_seconds # Setting it to a default value of 1 hour in seconds
    )
    LOGGER.info('In commonUtil.get_presigned_url, Successfully generated S3 signed url')
    return url


def download_file_from_s3(s3_client, bucket_name, s3_path, file_path):
    """
    Download a file from s3 into an output file path
    :param s3_client: boto3 s3 client object
    :param bucket_name: Name of the S3 bucket
    :param bucket_name: path of file at S3
    :param bucket_name: file path where to download
    """
    LOGGER.info("In commonUtil.download_file_from_s3, entering method with bucket name - %s and s3 path - %s", bucket_name, s3_path)
    try:
        s3_client.download_file(bucket_name, s3_path, file_path)
    except Exception as ex:
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = f"Failed to download file from S3 with error - {str(ex)}"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)


def get_presigned_url_put_object(s3_client, bucket_name, object_key, content_type = None):
    """
    Generate a presigned URL for put requests
    :param s3_client: boto3 s3 client object
    :param bucket_name: Name of the S3 bucket
    :param object_key: S3 Object key
    :param content_type: file ContentType (application/json)
    """
    LOGGER.info('In commonUtil.get_presigned_url_put_object, generating S3 signed url.')
    params = {
        'Bucket': bucket_name,
        'Key': '{}'.format(object_key)
    }
    if content_type:
        params['ContentType'] = content_type
    url = s3_client.generate_presigned_url(
        ClientMethod='put_object',
        Params=params,
        HttpMethod='PUT')

    LOGGER.info('In commonUtil.get_presigned_url_put_object, Successfully generated s3 presigned url for file upload.')
    return url

def sort_page_in_code(**kwargs):
    """
    This function is to sort results & paginate them programatically
    :param sort_by
    :param sort_order
    :param offset
    :param limit
    :param dict_key
    :param input_items
    """
    LOGGER.info("In commonUtil.sort_page_in_code sorting & paginating items based on the inputs - %s", str(kwargs))

    new_items_dict = {}
    if kwargs['input_items'][kwargs['dict_key']]:
        sorted_items = sorted(kwargs['input_items'][kwargs['dict_key']], key=lambda k: k[kwargs['sort_by']].lower(), reverse=kwargs['sort_order'] == 'desc')
        if 'items_limit' in kwargs and kwargs.get('items_limit'):
            new_items_dict[kwargs['dict_key']] = sorted_items[kwargs['offset']: kwargs['offset']+kwargs['items_limit']]
        else:
            new_items_dict[kwargs['dict_key']] = sorted_items[kwargs['offset']:]
    else:
        sorted_items = []
        new_items_dict[kwargs['dict_key']] = sorted_items
    if 'items_limit' in kwargs and kwargs.get('items_limit'):
        new_items_dict['next_available'] = 'yes' if len(sorted_items) > kwargs['offset']+kwargs['items_limit'] else 'no'
    else:
        new_items_dict['next_available'] = 'no'
    new_items_dict['count'] = len(new_items_dict[kwargs['dict_key']])
    new_items_dict['total_count'] = len(sorted_items)

    return new_items_dict

def get_ssm_parameter(ssm_client, parameter_name):
    """
    This function returns a parameter's value from ssm given its name
    :param parameter_name: name of parameter to be retrieved
    :type parameter_name: String
    :return type: string
    """
    LOGGER.info("In commonUtil.get_ssm_parameter, retrieving value of param %s from ssm", parameter_name)
    # get parameter
    response = ssm_client.get_parameter(
        Name=parameter_name,
        WithDecryption=True
    )
    LOGGER.info("In commonUtil.get_ssm_parameter, retrieved value of param %s from ssm", parameter_name)
    # check if the param type is stringlist then return an array
    if response["Parameter"]["Type"] == "StringList":
        return response['Parameter']['Value'].split(",")

    return response['Parameter']['Value']

def ssm_parameter_exists(ssm_client, parameter_key):
    """
    :param ssm_client: ssm service boto3 client
    :param parameter_key: parameter key to lookup in ssm parameter store
    :return: True/False
    """
    LOGGER.info("In commonUtil.ssm_parameter_exists, checking if %s exists in ssm parameter store", parameter_key)
    return_val = False
    try:
        response = ssm_client.get_parameter(Name=parameter_key)
        LOGGER.info("In commonUtil.ssm_parameter_exists, response - %s", response)
        return_val = True
    except ssm_client.exceptions.ParameterNotFound:
        LOGGER.info("In commonUtil.ssm_parameter_exists, ParameterNotFound - %s", parameter_key)
        return_val = False

    return return_val

def create_ssm_parameter(ssm_client, input_body):
    """
    :param ssm_client: ssm service boto3 client
    :param input_body: parameter key to lookup in ssm parameter store. expected keys
                    (Name, Description, Value, Type, Overwrite, Tags)
    """
    LOGGER.info("In commonUtil.create_ssm_parameter, creating parameter in ssm parameter store with body - %s", input_body)
    response = ssm_client.put_parameter(**input_body)
    LOGGER.info("In commonUtil.create_ssm_parameter, response - %s", response)

def get_current_time():
    """
    Retrieves current datetime in ISO format
    :return Current datetime in ISO format
    """
    current_time = str(datetime.now(timezone.utc).strftime(DATETIME_ISO_FORMAT))
    return current_time

def get_current_date():
    """
    Retrieves current date in ISO format
    :return Current date in ISO format (eg: 2021-11-24)
    """
    current_date = str(datetime.now(timezone.utc).strftime(DATE_ISO_FORMAT))
    return current_date

def get_active_time(start_time):
    """
    This method returns the active time of a resource based on the start time
    :param start_time: Start time of the resource
    :return: standardized resource information
    """
    LOGGER.info("In commonUtil.get_active_time, start_time - %s", start_time)
    start_time = start_time.split(".")[0]  # Standardizes timestamps to ISO format Ex: reduces 2020-12-02 04:39:30.481000+00:00 to 2020-12-02 04:39:30
    active_time = datetime.now(timezone.utc) - datetime.strptime(start_time, DATETIME_ISO_FORMAT).replace(tzinfo=timezone.utc)
    active_time_hrs = active_time.total_seconds()/timedelta(hours=1).total_seconds()
    return str(round(active_time_hrs, 2))

def invoke_lambda_function(lambda_client, function_name, payload, invocation_type):
    """
    Invokes Lambda function
    :param lambda_client: AWS Lambda boto3 client
    :param function_name: Lambda function name
    :param payload: Lambda function input payload
    :param invocation_type: Invocation type
    :return: Lambda invocation request ID
    """
    try:
        LOGGER.info("In commonUtil.invoke_lambda_function, Invoking lambda function - %s, invocation_type - %s, payload - %s", function_name, invocation_type, payload)
        response = lambda_client.invoke(FunctionName=function_name, Payload=payload, InvocationType=invocation_type)
        LOGGER.info("In commonUtil.invoke_lambda_function, response - %s", json.dumps(response, default=str))
        if response["ResponseMetadata"]["HTTPStatusCode"] not in (200, 202):
            raise Exception(response['Payload'].read().decode())
        request_id = response['ResponseMetadata']['RequestId']
        LOGGER.info('In commonUtil.invoke_lambda_function, Invoked Lambda: %s', function_name)
        LOGGER.info('In commonUtil.invoke_lambda_function, RequestId: %s', request_id)
        # Log request_id in the backend
        return response
    except Exception as ex:
        LOGGER.error("In commonUtil.invoke_lambda_function, Failed to invoke function: '%s' with error - %s", function_name, str(ex))

def get_s3_object_metadata(s3_client, bucket, key):
    """
    Fetches the metadata of object in a bucket
    :param s3_client: Boto3 S3 client
    :param bucket: Bucket name
    :param key: Object file path
    :return:
    """
    try:
        LOGGER.info("In commonUtil.get_s3_object_metadata, fetching metadata of %s object from %s bucket", key, bucket)
        response = s3_client.head_object(Bucket=bucket, Key=key)
        LOGGER.info("In commonUtil.get_s3_object_metadata, returning fetched metadata - %s", json.dumps(response,
                                                                                                        default=str))
        return response
    except ClientError as cer:
        LOGGER.error("In commonUtil.get_s3_object_metadata, exception occured while fetching metadata of object - %s",
                     cer.response['Error']['Message'])
        if cer.response['Error']['Code'] == "404":
            return {"StorageClass": "STANDARD", "ContentLength": 0}
        raise Exception(cer.response['Error']['Message']) from cer

def get_ssm_parameters_by_path(ssm_client, path):
    """
    Get all the SSM parameters stored in the specified path.
    """
    LOGGER.info("In commonUtil.get_ssm_parameters_by_path, Getting all SSM parameters based on path %s", path)
    response = ssm_client.get_parameters_by_path(
        Path=path,
        Recursive=True
    )
    params_list = response["Parameters"]
    # Retrieve all parameters i the given hierarchy recursively
    while "NextToken" in response and response["NextToken"]:
        response = ssm_client.get_parameters_by_path(
            Path=path,
            Recursive=True,
            NextToken=response["NextToken"]
        )
        params_list.extend(response["Parameters"])
    # Store the retrieved parameters in a json format
    output_params = {}
    if params_list:
        for each_param_dict in params_list:
            output_params[each_param_dict["Name"].split("/")[-1]] = each_param_dict["Value"]
    LOGGER.info("In commonUtil.get_ssm_parameters_by_path, Retrieved all SSM parameters - %s", str(output_params))
    return output_params

def remove_s3_file(s3_resource, s3_file_key, bucket_name):
    """
    This function will remove the file from S3 bucket
    :param s3_file_key: s3 file key for both src and target
    """
    try:
        error_message = None
        LOGGER.info("In commonUtil.remove_s3_file, Removing file %s from bucket %s", s3_file_key, bucket_name)
        bucket = s3_resource.Bucket(bucket_name)
        response = bucket.object_versions.filter(Prefix=s3_file_key).delete()
        LOGGER.info("In commonUtil.remove_s3_file, Successfully deleted s3 file key '%s'. Delete response - %s", s3_file_key, response)
    except Exception as ex:
        LOGGER.error("In commonUtil.remove_s3_file, Failed to remove s3 file with error %s", str(ex))
        error_message = str(ex)
    return error_message

def get_matching_s3_buckets(s3_client, bucket_prefix):
    """
    Retrieves a list of S3 bucket names that match a given prefix and contain a specified bucket name.
    :param s3_client: Boto3 S3 client
    :param bucket_prefix: The prefix to filter the S3 bucket names.
    :return: A list of S3 bucket names that match the given prefix
    """
    LOGGER.info("In commonUtil.get_matching_s3_buckets, getting buckets based on given prefix - %s", bucket_prefix)
    s3_response = s3_client.list_buckets()
    buckets = [bucket['Name'] for bucket in s3_response['Buckets'] if bucket['Name'].startswith(bucket_prefix)]
    LOGGER.info("In commonUtil.get_matching_s3_buckets, filtered buckets list - %s", buckets)
    return buckets

def send_custom_verification_mail(ses_client, email_id, user_id):
    """
    Checks whether the account is in Sandbox or not and then send the verification email using appropriate boto3 call
    :param email_id: custom email id passed in body
    """
    # If the email sending quota is 200 then that means account is still in sandbox so don't use custom verification email template
    LOGGER.info("In commonUtil.send_custom_verification_mail, Verify if the account is out of sandbox to subscribe for alerts")
    quota_response = ses_client.get_send_quota()
    ses_response = None
    if quota_response and quota_response['ResponseMetadata']['HTTPStatusCode'] == 200 and int(quota_response['Max24HourSend']) != 200:
        LOGGER.info("In commonUtil.send_custom_verification_mail, AWS Account is out of sandbox, so sending custom email verification")
        ses_response = ses_client.send_custom_verification_email(EmailAddress=email_id, TemplateName="CustomEmailVerificationTemplate")
    if quota_response and quota_response['ResponseMetadata']['HTTPStatusCode'] == 200 and int(quota_response['Max24HourSend']) == 200:
        LOGGER.info("In commonUtil.send_custom_verification_mail, AWS Account is still in sandbox, so sending default AWS email verification")
        ses_response = ses_client.verify_email_identity(EmailAddress=email_id)
    if ses_response and ses_response['ResponseMetadata']['HTTPStatusCode'] != 200:
        LOGGER.error("In commonUtil.send_custom_verification_mail, failed to send verification link to user for email subscription with error %s", str(ses_response))
        ec_ge_1090 = errorUtil.get_error_object("GE-1090")
        ec_ge_1090['Message'] = ec_ge_1090['Message'].format(user_id)
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1090)
    return True

def get_user_auth_resources(user_id, users_table):
    """
    This function will return the authorization token and amorphic role-id that used to create token
    :param user_id:
    :param users_table:
    :return:
    """
    LOGGER.info("In commonUtil.get_user_auth_resources, starting method")
    # get auth token from ssm
    try:
        # If parameter not found then integration is not done, so send the valid error response to the user instead of generic msg
        param_details = SSM_CLIENT.get_parameter(
            Name=f"/ai/{ENVIRONMENT}/access_token/{user_id}",
            WithDecryption=True
        )
        auth_token = param_details['Parameter']['Value']

        claims = get_claims(auth_token)
        if datetime.fromtimestamp(claims['exp'], tz=timezone.utc) < datetime.now(timezone.utc):
            LOGGER.error("In commonUtil.get_user_auth_resources, access token is invalid, error: %s", "Access token is expired")
            # don't change the error message, its being used in datastore file upload # "Invalid access token, Token expired"
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid access token, Token expired for creator/user")

        user_item = dynamodbUtil.get_item_with_key(
            DYNAMODB_RES.Table(users_table),
            {'UserId': user_id})
        if not user_item:
            ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
            ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("UserId", user_id)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

        return auth_token, user_item["RoleId"]

    except Exception as err:
        LOGGER.error("In commonUtil.get_user_auth_resources, request is failed with error, %s", str(err))
        ec_ge_1044 = errorUtil.get_error_object("GE-1044")
        ssm_error_msg = "User integration to Amorphic is required to list the resources"
        ec_ge_1044["Message"] = ec_ge_1044["Message"].format(str(err)) if "ParameterNotFound" not in str(err) else ssm_error_msg
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1044)

def get_session_details(sessions_table, user_id, session_id):
    """
    This function is to get chat session details
    :param user_id
    :param session_id
    :return: session details
    """
    LOGGER.info("In commonUtil.get_session_details, User %s requested to get session details for session id: %s", user_id, session_id)
    session_details = dynamodbUtil.get_item_with_key(
            DYNAMODB_RES.Table(sessions_table),
            {
                "UserId": user_id,
                "SessionId": session_id
            }
        )
    if not session_details:
        LOGGER.error("In commonUtil.get_session_details, session with id: %s not found", session_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("SessionId", session_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    session_details = json.loads(json.dumps(session_details, cls=DecimalEncoder))
    LOGGER.info("In commonUtil.get_session_details, retrieved session details - %s", session_details)
    return session_details

def create_event_rule(event_obj):
    """
    This method will create a new event rule in event bridge.
    :param event_obj:
    :return:
    """
    LOGGER.info("In commonUtil.create_event_rule, starting method with object: %s", event_obj)
    try:
        put_rule_response = EVENT_CLIENT.put_rule(
            Name=event_obj["RuleName"],
            ScheduleExpression=event_obj["ScheduledExpression"],
            State='ENABLED'
        )
        LOGGER.info("In commonUtil.create_event_rule, put rule response: %s", put_rule_response)

        EVENT_CLIENT.put_targets(
            Rule=event_obj["RuleName"],
            Targets=[{
                'Id': '1',
                'Arn': event_obj["TargetLambdaArn"],
                'Input': json.dumps(event_obj["LambdaEvent"])
            }]
        )
        return put_rule_response["RuleArn"]
    except Exception as err:
        LOGGER.error("In commonUtil.create_event_rule, request is failed with error, %s", str(err))
        ec_ge_1044 = errorUtil.get_error_object("GE-1044")
        ec_ge_1044["Message"] = ec_ge_1044["Message"].format(str(err))
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1044)

def get_default_domain(user_id, user_table):
    """
    Get default domain of user
    """
    LOGGER.info("In idpDatastores.get_default_domain, starting method with user_id: %s", user_id)
    default_domain = dynamodbUtil.get_item_with_key(
        DYNAMODB_RES.Table(user_table),
        {'UserId': user_id}
    )
    return default_domain['DefaultDomain']

def create_amorphic_dataset(dataset_item, user_id, lambda_obj):
    """
    Create new textract dataset in amorphic and update
    :param dataset_item:
    :param user_id:
    :param lambda_obj:
    :return:
    """
    # create dataset item in amorphic and update datastore status metadata in idp
    try:
        LOGGER.info("In commonUtil.create_amorphic_dataset, trying to call Amorphic dataset creation api with dataset item: %s", dataset_item)
        create_dataset_body = {
            "DatasetName": dataset_item["DatasetName"],
            "DatasetDescription": dataset_item.get("DatasetDescription", ""),
            "DatasetType": "internal",
            "Domain": dataset_item["Domain"],
            "Keywords": dataset_item.get("Keywords", []) + [f"Vertical:{VERTICAL_NAME}"],
            "DatasourceType": "api",
            "TargetLocation": dataset_item["TargetLocation"],
            "MalwareDetectionOptions": {"ScanForMalware": False, "AllowUnscannableFiles": True},
            "TableUpdate": "append",
            "DataMetricsCollectionOptions": {"IsMetricsCollectionEnabled": False},
            "FileType": "others",
            "IsDataCleanupEnabled": False,
            "IsDataProfilingEnabled": False,
            "LifeCyclePolicyStatus": "Disabled",
            "SkipFileHeader": False,
            "AreAIServicesEnabled": False
        }

        create_dataset_payload = {
            "headers": {
                "Authorization": lambda_obj["AuthorizationToken"],
                "user_id": user_id,
                "role_id": lambda_obj["RoleId"]
            },
            "resource": "/datasets",
            "path": "/datasets",
            "httpMethod": "POST",
            "requestContext": {
                "requestId": "N/A",
                "httpMethod": "POST"
            },
            "body": json.dumps(create_dataset_body)
        }

        LOGGER.info("In commonUtil.create_amorphic_dataset, calling function: %s with payload: %s", lambda_obj["FunctionName"], create_dataset_payload)
        create_dataset_response = invoke_lambda_function(
            lambda_client=lambda_obj["LambdaClient"],
            function_name=lambda_obj["FunctionName"],
            payload=json.dumps(create_dataset_payload),
            invocation_type='RequestResponse'
        )
        LOGGER.info("In commonUtil.create_amorphic_dataset, create dataset lambda invoke response %s", create_dataset_response)
        if create_dataset_response["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In commonUtil.lambda_handler, error: %s", create_dataset_response['Payload'].read().decode())
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Error- {create_dataset_response['Payload'].read().decode()}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        dataset_create_response = json.loads(json.loads(create_dataset_response['Payload'].read().decode('utf-8'))["body"])
        if "DatasetId" not in dataset_create_response:
            LOGGER.error("In commonUtil.create_amorphic_dataset, failed to create dataset with error: %s", dataset_create_response)
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Failed to create source dataset with error - {dataset_create_response}"
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)
        LOGGER.info("In commonUtil.create_amorphic_dataset, create dataset response: %s. Exiting method...", dataset_create_response)
        return dataset_create_response

    except Exception as ex:
        LOGGER.error("In commonUtil.create_amorphic_dataset, create dataset failed with error %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Create dataset failed. Error - {}".format(str(ex))
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)


def validate_amorphic_integration_status(user_id, ret_item=None):
    """
    Check amorphic integration status of a user
    """
    LOGGER.info("In commonUtil.validate_amorphic_integration_status, Starting method with user id: %s", user_id)
    user_item = dynamodbUtil.get_item_with_key(DYNAMODB_RES.Table(USERS_TABLE), {'UserId': user_id})
    if not user_item:
        LOGGER.info("In commonUtil.validate_amorphic_integration_status, User %s does not exist in IDP", user_id)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"User :{user_id} doesnt exist in IDP"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    if ret_item and ret_item.lower() == "integration-status":
        return user_item.get('AmorphicIntegrationStatus', None)
    elif user_item.get('AmorphicIntegrationStatus', None) == "connected":
        LOGGER.info("In commonUtil.validate_amorphic_integration_status, User: %s is integrated with Amorphic", user_id)
        return user_item
    else:
        LOGGER.info("In commonUtil.validate_amorphic_integration_status, User: %s is disconnected from Amorphic", user_id)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"User :{user_id} is not connected to Amorphic"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

def retrieve_amorphic_dataset(user_id, dataset_id, lambda_obj):
    """
    Retrieve an amorphic dataset
    """
    LOGGER.info("In commonUtil.retrieve_amorphic_dataset, Starting method for dataset id: %s", dataset_id)

    get_dataset_invoke_item = {
        "pathParameters": {'id': dataset_id},
        "requestContext": {"requestId": dataset_id, "httpMethod": "GET", "resourcePath": "/datasets/{id}"},
        "headers": {"user_id": user_id, "role_id": lambda_obj["RoleId"], "Authorization": lambda_obj["AuthorizationToken"]},
        "httpMethod": "GET",
        "resource": "/datasets/{id}",
        "queryStringParameters": None
    }

    LOGGER.info("In commonUtil.retrieve_amorphic_dataset, calling function: %s with payload: %s", lambda_obj["FunctionName"], get_dataset_invoke_item)
    get_dataset_response = invoke_lambda_function(
        lambda_client=lambda_obj["LambdaClient"],
        function_name=lambda_obj["FunctionName"],
        payload=json.dumps(get_dataset_invoke_item),
        invocation_type='RequestResponse'
    )

    LOGGER.info("In commonUtil.retrieve_amorphic_dataset, get dataset lambda invoke response %s", get_dataset_response)
    if get_dataset_response["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In commonUtil.retrieve_amorphic_dataset, error: %s", get_dataset_response['Payload'].read().decode())
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Error- {get_dataset_response['Payload'].read().decode()}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    dataset_item = json.loads(json.loads(get_dataset_response['Payload'].read().decode('utf-8'))["body"])
    # response from amorphic if dataset not exists: {'Message': 'IPV-1002 - Invalid DatasetId - <dataset_id>, resource not found.'}
    if "DatasetId" not in dataset_item:
        LOGGER.error("In commonUtil.retrieve_amorphic_dataset, dataset with id: %s doesn't exists in amorphic or user dont have access", dataset_id)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Dataset:{dataset_id} doesn't exist/user don't have access")
    LOGGER.info("In commonUtil.retrieve_amorphic_dataset, dataset item retrieved: %s", dataset_item)
    return dataset_item

def get_user_accessible_resources(user_item, groups_table, resource_table, resource_type):
    """
    This method will return user accessible resources from groups table
    """
    LOGGER.info("In commonUtil.get_user_accessible_resources, starting method..")
    user_id = user_item["UserId"]

    if not user_item["UserRole"] == ADMINS_USER_ROLE:
        owner_group_item = dynamodbUtil.get_item_with_key(DYNAMODB_RES.Table(groups_table), {"GroupId": f"g_{user_id}_owner"})
        read_only_group_item = dynamodbUtil.get_item_with_key(DYNAMODB_RES.Table(groups_table), {"GroupId": f"g_{user_id}_read-only"})

    if resource_type.lower() == "workspaces":
        if user_item["UserRole"] == ADMINS_USER_ROLE:
            LOGGER.info("In commonUtil.get_user_accessible_resources, assuming all the resources as owner for admins and returning all resources")
            workspace_id_list = dynamodbUtil.scan_with_pagination(DYNAMODB_RES.Table(resource_table), None, "WorkspaceId", None)
            owner_workspace_id_list = [each_ws_item["WorkspaceId"] for each_ws_item in workspace_id_list]
            read_only_workspace_id_list = []
        else:
            owner_workspace_id_list = owner_group_item.get("WorkspaceIdList", []) if owner_group_item else []
            read_only_workspace_id_list = read_only_group_item.get("WorkspaceIdList", []) if read_only_group_item else []

        LOGGER.info("In commonUtil.get_user_accessible_resources, user owner workspaces: %s, read-only workspaces: %s", owner_workspace_id_list, read_only_workspace_id_list)
        return owner_workspace_id_list, read_only_workspace_id_list

    elif resource_type.lower() == "chatbots":
        if user_item["UserRole"] == ADMINS_USER_ROLE:
            LOGGER.info("In commonUtil.get_user_accessible_resources, assuming all the resources as owner for admins and returning all resources")
            chatbot_id_list = dynamodbUtil.scan_with_pagination(DYNAMODB_RES.Table(resource_table), None, "ChatbotId", None)
            owner_chatbot_id_list = [each_cb_item["ChatbotId"] for each_cb_item in chatbot_id_list]
            read_only_chatbot_id_list = []
        else:
            owner_chatbot_id_list = owner_group_item.get("ChatbotIdList", []) if owner_group_item else []
            read_only_chatbot_id_list = read_only_group_item.get("ChatbotIdList", []) if read_only_group_item else []
        LOGGER.info("In commonUtil.get_user_accessible_resources, user owner chatbots: %s, read-only chatbots: %s", owner_chatbot_id_list, read_only_chatbot_id_list)
        return owner_chatbot_id_list, read_only_chatbot_id_list


def remove_keys_from_dictionary(dict_obj, keys_list):
    """
    This function will remove unnecessary keys from the dictionary
    """
    LOGGER.info("In commonUtil.remove_keys_from_dictionary, starting method dict_obj: %s and keys_list: %s", dict_obj, keys_list)
    for key in keys_list:
        dict_obj.pop(key, None)
    LOGGER.info("In commonUtil.remove_keys_from_dictionary, returning method dict_obj: %s", dict_obj)
    return dict_obj

def get_user_resource_permission(user_id, resource_id, user_table, groups_table, resource_attribute):
    """
    This method returns the user permission given the resource id
    :param user_id
    :param resource_id
    :param user_table
    :param groups_table
    :param resource_attribute: Attribute to be queried for in groups table, ex: JobIdList in case resource is a job
    :return Accesstype - "owner"/"read-only"/None
    """
    LOGGER.info("In commonUtil.get_user_resource_permission, user_id - %s, resource_id - %s", user_id, resource_id)
    user_item = dynamodbUtil.get_item_by_key_with_projection(
        user_table, # Tablename
        {"UserId": user_id}, # Key
        "Groups" # Projection expression
    )
    LOGGER.info("In commonUtil.get_user_resource_permission, user_item - %s", user_item)
    access_list = []

    if user_item and 'Groups' in user_item:
        for group_id in user_item['Groups']:
            group_item = dynamodbUtil.get_item_details_query(
                groups_table,
                Key('GroupId').eq(group_id),
                Attr(resource_attribute).contains(resource_id),
                'GroupType'
            )
            if group_item:
                access_list.append((group_item[0]['GroupType']).lower())

    access_set = set(access_list)
    LOGGER.info("In commonUtil.get_user_resource_permission method, retrieved access_list contains %s", str(access_set))
    if not access_set:
        return None
    if 'owner' in access_set:
        return 'owner'
    return 'read-only'

def is_valid_user(user_id, skip_user_check=False):
    """
    This method will check if user have permission to do specific operations
    """
    LOGGER.info("In commonUtil.is_valid_user, starting method with UserId: %s", user_id)
    user_item = dynamodbUtil.get_item_with_key(DYNAMODB_RES.Table(USERS_TABLE), {"UserId": user_id})
    if not user_item and not skip_user_check:
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("UserId", user_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

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

    LOGGER.info("In commonUtil.is_valid_user, user item retrieved - %s", user_item)
    return user_item if user_item else {}

def check_user_access_on_resource(resource_key, resource_id, resource_table, groups_table, user_id):
    """
    This method is used to check user access on the resource
    """
    # Get resource item from DynamoDB
    LOGGER.info("In commonUtil.check_user_access_on_resource, starting the method")
    resource_item = dynamodbUtil.get_item_with_key(DYNAMODB_RES.Table(resource_table), {resource_key: resource_id})
    if not resource_item:
        ec_ge_1046 = errorUtil.get_error_object("GE-1046")
        ec_ge_1046['Message'] = ec_ge_1046['Message'].format(resource_key, resource_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1046)
    LOGGER.info("In commonUtil.check_user_access_on_resource, resource item: %s", resource_item)

    # Get user access for the resource_id
    LOGGER.info("In commonUtil.check_user_access_on_resource, validating if the user is authorized to access the resource or not")
    user_permission = get_user_resource_permission(
        user_id,
        resource_id,
        DYNAMODB_RES.Table(USERS_TABLE),
        DYNAMODB_RES.Table(groups_table),
        "{}List".format(resource_key)
        )

    return resource_item, user_permission

def is_user_action_valid(user_item, resource_key, resource_id, resource_table, groups_table, input_request):
    """
    This method is to validate if user have access to make the request
    """
    LOGGER.info("In commonUtil.is_user_action_valid, starting the method")
    user_type = user_item["UserRole"]
    user_id = user_item["UserId"]

    # For create action only user role/access need to be checked
    if input_request == "create" and user_type not in [ADMINS_USER_ROLE, DEVELOPERS_USER_ROLE]:
        LOGGER.error("In commonUtil.is_user_action_valid, user doesn't have relevant access to perform the request")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User role is not allowed to perform the request")
    # for custom models, only admins can create/update/delete models. all users have read access
    elif resource_table in [dynamodbUtil.MODELS_TABLE, dynamodbUtil.AGENTS_TABLE, dynamodbUtil.AGENTS_ACTION_GROUPS_TABLE, dynamodbUtil.AGENTS_LIBRARIES_TABLE] and input_request in ['create', 'update', 'delete'] and user_type != ADMINS_USER_ROLE:
        LOGGER.error("In commonUtil.is_user_action_valid, user doesn't have relevant access to perform the request")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User role is not allowed to perform the request")

    elif resource_table in [dynamodbUtil.MODELS_TABLE, dynamodbUtil.AGENTS_TABLE, dynamodbUtil.AGENTS_ACTION_GROUPS_TABLE, dynamodbUtil.AGENTS_LIBRARIES_TABLE] and input_request == "read":
        LOGGER.info("In commonUtil.is_user_action_valid, user has required permissions to view models/agents")
        return {"ModelId": resource_id}, "read-only"

    # For all other actions (read, update, delete) user access on the resource need to be checked, role check is not required
    elif resource_id:
        resource_item, user_permission = check_user_access_on_resource(resource_key, resource_id, resource_table, groups_table, user_id)
        # Admins are allowed to do any operation in the system
        user_permission = "owner" if user_type == ADMINS_USER_ROLE else user_permission
        if not user_permission:
            LOGGER.error("In commonUtil.is_user_action_valid, user doesn't have access to the resource")
            ec_auth_1017 = errorUtil.get_error_object("AUTH-1017")
            ec_auth_1017['Message'] = ec_auth_1017['Message'].format(user_id)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_auth_1017)
        LOGGER.info("In commonUtil.is_user_action_valid, User permission on the resource is : %s", user_permission)

        # Check if user is allowed to perform the request
        if user_permission == "read-only" and input_request != "read":
            LOGGER.error("In commonUtil.is_user_action_valid, user doesn't have access to the resource")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "User doesn't have access to the resource to perform the request")
        return resource_item, user_permission


def trigger_amorphic_dataset_deletion(dataset_id, auth_token, role_id, lambda_obj):
    """
    This method is used to delete amorphic dataset
    """
    LOGGER.info("In commonUtil.delete_amorphic_dataset, starting the method dataset id: %s", dataset_id)
    delete_dataset_payload = {
        "pathParameters": {'id': dataset_id},
        "requestContext": {
            "requestId": dataset_id,
            "httpMethod": "DELETE",
            "resourcePath": "/datasets/{id}"
        },
        "headers": {
            "role_id": role_id,
            "Authorization": auth_token
        },
        "httpMethod": "DELETE",
        "resource": "/datasets/{id}",
        "queryStringParameters": None
    }

    LOGGER.info("In commonUtil.delete_amorphic_dataset, calling function: %s with payload: %s", lambda_obj["FunctionName"], delete_dataset_payload)
    delete_dataset_response = invoke_lambda_function(
        lambda_client=lambda_obj["LambdaClient"],
        function_name=lambda_obj["FunctionName"],
        payload=json.dumps(delete_dataset_payload),
        invocation_type='RequestResponse'
    )
    LOGGER.info("In commonUtil.delete_amorphic_dataset, delete  dataset response %s", delete_dataset_response)
    if delete_dataset_response["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In commonUtil.retrieve_amorphic_dataset, error: %s", delete_dataset_response['Payload'].read().decode())

def generate_email_body(title, event_type, resource_type, resource_name, resource_id, message, email_type, **kwargs):
    """
    This method generates the email body
    :param title:
    :param title:
    :param event_type:
    :param resource_type:
    :param resource_name:
    :param resource_id:
    :param message:
    :return:
    """
    LOGGER.info("In commonUtil.generate_email_body, generating email body")
    if email_type == "failure":
        color_code = "#eb5757"
    elif email_type == "info":
        color_code = "#0676e1"
    logo = 'https://www.cloudwick.com/hubfs/6602587/Amorphic_2020/Branding/March%202023_branding/ADC-logo-color.png'
    if event_type == "Dataset File Upload from Session":
        success_files_list = kwargs.get("success_files_list", "")
        failed_files_list = kwargs.get("failed_files_list", "")
        body_text = (
                "<!DOCTYPE html><html><head><title>{title}</title><style>"
                "@font-face{{font-family:'Arlon';src:url('arlon.ttf') format('truetype');}}"
                "body{{font-size:10px;font-family:'Arlon',sans-serif; width:700px; display: flex; justify-content: center;}}"
                "table{{border-collapse:collapse;width:100%;border:1px solid #f2f2f2;}}"
                "th,td{{padding:8px;text-align:left;border-bottom:1px solid #f2f2f2;}}"
                "th{{color:#808080;font-weight:400;}}"
                "h1{{text-align:center;background-color:{};color:white;padding:10px;font-size:10px;}}"
                "</style></head><body><img src={} alt=\"Amorphic Logo\" height=50x width=auto style=\"display:block;\">"
                "<h1>{title}</h1><table><tr><th>Project</th><td>{}</td></tr><tr><th>Environment</th><td>{}</td></tr>"
                "<tr><th>EventType</th><td>{}</td></tr><tr><th>ResourceType</th><td>{}</td></tr>"
                "<tr><th>ResourceName</th><td>{}</td></tr><tr><th>ResourceId</th><td>{}</td></tr>"
                "</tr><tr><th>Upload Success Files List</th><td>{}</td></tr></tr><tr><th>Upload Failed Files List</th><td>{}</td></tr>"
                "<tr><th>Message</th><td>{}</td></tr></table></body></html>").format(color_code, logo, VERTICAL_NAME, ENVIRONMENT, event_type, resource_type, resource_name, resource_id, success_files_list, failed_files_list, message, title=title)
    else:
        body_text = (
                "<!DOCTYPE html><html><head><title>{title}</title><style>"
                "@font-face{{font-family:'Arlon';src:url('arlon.ttf') format('truetype');}}"
                "body{{font-size:10px;font-family:'Arlon',sans-serif; width:700px; display: flex; justify-content: center;}}"
                "table{{border-collapse:collapse;width:100%;border:1px solid #f2f2f2;}}"
                "th,td{{padding:8px;text-align:left;border-bottom:1px solid #f2f2f2;}}"
                "th{{color:#808080;font-weight:400;}}"
                "h1{{text-align:center;background-color:{};color:white;padding:10px;font-size:10px;}}"
                "</style></head><body><img src={} alt=\"Amorphic Logo\" height=50x width=auto style=\"display:block;\">"
                "<h1>{title}</h1><table><tr><th>Project</th><td>{}</td></tr><tr><th>Environment</th><td>{}</td></tr>"
                "<tr><th>EventType</th><td>{}</td></tr><tr><th>ResourceType</th><td>{}</td></tr>"
                "<tr><th>ResourceName</th><td>{}</td></tr><tr><th>ResourceId</th><td>{}</td></tr>"
                "<tr><th>Message</th><td>{}</td></tr></table></body></html>").format(color_code, logo, VERTICAL_NAME, ENVIRONMENT, event_type, resource_type, resource_name, resource_id, message, title=title)
    return body_text


def send_email(recipient, body_text, email_subject, sender, ssm_client):
    """
    This function is used to send email to user without attachments
    :param recipient:
    :param body_text:
    :param email_subject:
    :param sender:
    :param ssm_client:
    :return:
    """
    LOGGER.info("In commonUtil.send_email, starting method")
    response = ssm_client.send_email(
                Destination={
                    'ToAddresses': [recipient]
                },
                Message={
                    'Body': {
                        'Html': {
                            'Data': body_text,
                        },
                        'Text': {
                            'Data': " ",
                        },
                    },
                    'Subject': {
                        'Data': email_subject,
                    },
                },
                Source=sender
            )
    return response

def send_email_with_attachment(recipient, msg, sender, ses_client):
    """
    This function is used to send email to user with attachments
    :param recipient:
    :param msg:
    :param sender:
    :param ses_client:
    :return:
    """
    LOGGER.info("In commonUtil.send_email_with_attachment, starting method")
    response = ses_client.send_raw_email(
                    Source=sender,
                    Destinations=[recipient],
                    RawMessage={ 'Data':msg.as_string() }
                )
    return response

def substitute_characters(input_string, existing_character='-', replacing_character='_'):
    """
    This function is used to convert spaces, special characters, and hyphens with underscores
    :param input_string: string to convert
    :param existing_character: charcter to be replaced
    :param replacing_character: character to replace with in the string
    :return: formatted_string
    """
    LOGGER.info("In commonUtil.substitute_characters, starting method")
    return input_string.replace(existing_character, replacing_character)

def is_valid_string(input_string, pattern=r'^[a-zA-Z][a-zA-Z0-9_-]*$'):
    """
    This function is used to validate the name of datastores and pipelines
    :param input_string:
    :param pattern: regular expression for valid string
    :return: bool indicating whether the name is valid or not
    """
    LOGGER.info("In commonUtil.is_valid_name, starting method")
    return bool(re.match(pattern, input_string))


def update_sf_exec_arn_of_execution(job_run_id, key, sf_exec_arn, execution_table):
    """
    This function adds the execution arn of the job to execution table
    :param job_run_id: The job run id
    :param key: The primary key of the execution table
    :param sf_exec_arn: The execution arn of the stepfunction
    :param datastore_execution_table: datastores execution table name
    """
    LOGGER.info("In commonutil.update_sf_exec_arn_of_execution method storing the stepfunction execution arn in execution table")
    key_condition_expression = {key: job_run_id}
    update_expression = "SET SFExecutionArn = :val1, LastModifiedTime = :val2"
    expression_attributes = {
        ":val1": sf_exec_arn,
        ":val2": get_current_time()
    }
    update_status = dynamodbUtil.update_item_by_key(DYNAMODB_RES.Table(execution_table), key_condition_expression, update_expression, expression_attributes)
    if update_status == "error":
        LOGGER.error("In commonUtil.update_sf_exec_arn_of_execution, Failed to update execution table")


def update_document_status(document_id, workspace_id, run_status, message):
    """Update the run status of the document

    Args:
        document_id (string): Document Id
        workspace_id (string): Workspace Id
        run_id (string): Run Id
        message (string): Message linked with the status
    """
    LOGGER.info("In commonUtil.update_document_status, updating the run status of document with id - %s", document_id)
    update_expression = 'SET #processStatus = :rstatus, LastModifiedBy = :lmb, LastModifiedTime = :lmt, Message = :msg'
    expression_attributes = {
        ':rstatus': run_status,
        ':lmb': SYSTEM_RUNNER_ID,
        ':lmt': get_current_time(),
        ':msg': message,
    }
    key = {
        'DocumentId': document_id,
        'WorkspaceId': workspace_id
    }
    expression_attribute_names = {"#processStatus": "Status"}
    response = dynamodbUtil.update_item_by_key(DYNAMODB_RES.Table(dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE), key, update_expression, expression_attributes, expression_attribute_names)
    if response == "error":
        LOGGER.error('Failed to update the document status in documents table')

def update_execution_status(event, status, message):
    """
    Update workspace execution status in the Dynamodb table with the respective status
    :param event: event
    :param status: execution status
    :param message: details of execution step
    """
    LOGGER.info("In commonUtil.update_execution_status, event - %s", event)

    key_condition_expression = {'RunId': event.get('RunId', "")}
    update_expression = "SET RunStatus = :val1, Message = :val2, LastModifiedTime = :val3"
    expression_attributes = {
        ":val1": status,
        ":val2": message,
        ":val3": get_current_time()
    }

    if status in [RUN_STATUS_COMPLETE, RUN_STATUS_FAILED]:
        update_expression += ", EndTime = :val4"
        expression_attributes[":val4"] = event.get("EndTime", get_current_time())
    update_status = dynamodbUtil.update_item_by_key(DYNAMODB_RES.Table(dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE), key_condition_expression, update_expression, expression_attributes)
    if update_status == "error":
        LOGGER.error("In commonUtil.update_execution_status, Failed to update execution table")

def s3_upload_file_with_status(s3_client, file_name, bucket, object_name=None):
    """
    Upload a file to an S3 bucket and know the status
    :param file_name: File to upload
    :param bucket: Bucket to upload to
    :param object_name: S3 object name. If not specified then same as file_name
    :return: True if file was uploaded, else False
    """
    LOGGER.info("In commonUtil.s3_upload_file_with_status, Uploading the file: %s", file_name)
    # If S3 object_name was not specified, use file_name
    if not object_name:
        object_name = file_name

    try:
        s3_client.upload_file(file_name, bucket, object_name)
    except ClientError as cerror:
        LOGGER.error("In commonUtil.s3_upload_file_with_status, Failed to upload the file %s to S3 with error %s", file_name, cerror)
        return False

    return True

def find_delimiter(file_path):
    """Find the delimiter for a csv file to be used in the CSVLoader

    Args:
        file_path (string): tmp directory file path of the CSV file to be used
    """
    LOGGER.info("In commonUtil.find_delimiter, finding delimiter for file with file path - %s", file_path)
    with open(file_path, 'r', newline='', encoding='utf-8') as file:
        try:
            dialect = csv.Sniffer().sniff(file.read(1024))  # Sniff the first 1024 bytes
            LOGGER.info("In commonUtil.find_delimiter, file delimiter is %s", dialect.delimiter)
            return dialect.delimiter
        except csv.Error as ex:
            LOGGER.error("In commonUtil.find_delimiter, unsupported delimiter found")
            raise Exception('Delimiter being used in the file is not supported') from ex

def get_openai_key(ssm_client):
    """Get OpenAIKey value from ssm if exists
    """
    if ssm_parameter_exists(ssm_client, OPENAI_KEY_SSM_KEY):
        return get_decrypted_value(OPENAI_KEY_SSM_KEY)
    else:
        return ""

def is_valid_jsonl(file_path):
    """
    Check if the file is a valid jsonl file
    :param file_path: file path of the jsonl file
    :return: True if valid, else False
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            for line in file:
                json.loads(line)
        return True
    except Exception:
        return False

def get_amorphic_datasets_files(dataset_id, user_id, lambda_client, dataset_files_lambda):
    """
    This method will return a list of datasets that user have owner permission in Amorphic
    :param dataset_id:
    :param user_id:
    :return:
    """
    LOGGER.info("In commonUtil.get_amorphic_datasets_files, starting method with dataset id: %s", dataset_id)
    auth_token, role_id = get_user_auth_resources(user_id, USERS_TABLE)

    list_dataset_files_payload = {
        "headers": {
            "Authorization": auth_token,
            "user_id": user_id,
            "role_id": role_id
        },
        "resource": "/datasets/{id}/files",
        "httpMethod": "GET",
        "requestContext": {
            "requestId": "N/A",
            "httpMethod": "POST"
        },
        "pathParameters": {
            "id": dataset_id
        },
        "queryStringParameters": {
            "status": UPLOAD_FILE_LOAD_STATUS_COMPLETED,
            "limit": 500,    # dataset files return is limited to 500 in amorphic datasetFiles lambda
            "offset": 1,
            "projectionExpression": "FileName,DatasetId"
        }
    }

    next_available = True
    files_metadata = []
    while next_available:
        list_dataset_files_lamda_invoke_response = invoke_lambda_function(lambda_client, dataset_files_lambda, json.dumps(list_dataset_files_payload), "RequestResponse")
        if list_dataset_files_lamda_invoke_response["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In commonUtil.lambda_handler, error: %s", list_dataset_files_lamda_invoke_response['Payload'].read().decode())
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Error- {list_dataset_files_lamda_invoke_response['Payload'].read().decode()}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        list_dataset_files_response = json.loads(json.loads(list_dataset_files_lamda_invoke_response['Payload'].read().decode('utf-8'))["body"])
        files_metadata.extend(list_dataset_files_response['files'])

        next_available = list_dataset_files_response["next_available"] == "yes"
        list_dataset_files_payload["queryStringParameters"]["offset"] += list_dataset_files_payload["queryStringParameters"]["limit"]

    LOGGER.info("In commonUtil.get_amorphic_datasets_files, dataset with id: %s, contains %s no. of completed files in it.", dataset_id, len(files_metadata))
    return files_metadata

def update_message_delivery_status(user_id, session_id, delivery_status, kwargs):
    """
    This method will update message delivery status in sessions table
    :param dynamodb_res:
    :param sessions_table:
    :param user_id:
    :param session_id:
    :param delivery_status:
    :return:
    """
    LOGGER.info("In commonUtil.update_message_delivery_status, updating message delivery status to %s for session id: %s", delivery_status, session_id)
    dynamodb_res = kwargs["DynamoDBResource"]
    sessions_table = kwargs["SessionsTable"]
    update_expression = "SET MessageDeliveryStatus = :mdstatus, LastModifiedTime = :last_modified_time"
    expression_attributes = {":mdstatus": delivery_status, ":last_modified_time": get_current_time()}
    if "LatestMessageId" in kwargs:
        update_expression += ", LatestMessageId = :latest_message_id"
        expression_attributes[":latest_message_id"] = kwargs["LatestMessageId"]
    dynamodbUtil.update_item_by_key(
        dynamodb_res.Table(sessions_table),
        {"UserId": user_id, "SessionId": session_id},
        update_expression,
        expression_attributes
    )

def send_message_to_ws_connection(user_id, session_id, message, kwargs):
    """
    This method will send a message to websocket connection
    :param apimanagement_client:
    :param api_url:
    :param connection_id:
    :param message:
    :return:
    """
    LOGGER.info("In commonUtil.send_message_to_ws_connection, starting method with user id: %s, session id: %s", user_id, session_id)
    api_management_client = kwargs["ApiManagementClient"]
    dynamodb_res = kwargs["DynamoDBResource"]
    sessions_table = kwargs["SessionsTable"]
    # retry mechanism for sending message back to user
    max_retries = 3
    retry = 0
    while retry < max_retries:
        try:
            # get connection id from sessions table item
            session_item =  dynamodbUtil.get_item_with_key(
                dynamodb_res.Table(sessions_table),
                {
                    "UserId": user_id,
                    "SessionId": session_id
                }
            )
            connection_id = session_item["ConnectionId"]
            resp = api_management_client.post_to_connection(
                Data=json.dumps(message),
                ConnectionId=str(connection_id)
            )
            update_message_delivery_status(user_id, session_id, CHAT_MESSAGE_DELIVERY_DELIVERED, kwargs)
            break
        except Exception as ex:
            LOGGER.error("In commonUtil.lambda_handler, failed to send message to connection due to error - %s", str(ex))
            time.sleep(3**retry)
            retry += 1

    if retry == max_retries:
        update_message_delivery_status(user_id, session_id, CHAT_MESSAGE_DELIVERY_FAILED, kwargs)
    LOGGER.info("In commonUtil.send_message_to_ws_connection, response from client - %s", resp)

def check_user_files_access(user_id, dataset_id, files, lambda_client, dataset_files_lambda):
    """
    This method will return the file access for the user
    :param user_id: user id
    :param dataset_id: dataset id
    :param files: list of file names
    :return:
    """
    LOGGER.info("In commonUtil.check_user_file_access, starting method with user id: %s, dataset id: %s and files: %s", user_id, dataset_id, files)
    auth_token, role_id = get_user_auth_resources(user_id, USERS_TABLE)

    check_dataset_file_access_payload = {
        "headers": {
            "Authorization": auth_token,
            "user_id": user_id,
            "role_id": role_id
        },
        "resource": "/datasets/{id}/file-access",
        "httpMethod": "PUT",
        "requestContext": {
            "requestId": "N/A",
            "httpMethod": "PUT"
        },
        "pathParameters": {
            "id": dataset_id
        },
        "body": json.dumps({
            "Files": files
        })
    }
    dataset_files_lambda_invoke_response = invoke_lambda_function(lambda_client, dataset_files_lambda, json.dumps(check_dataset_file_access_payload), "RequestResponse")
    if dataset_files_lambda_invoke_response["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In commonUtil.lambda_handler, error: %s", dataset_files_lambda_invoke_response['Payload'].read().decode())
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Error- {dataset_files_lambda_invoke_response['Payload'].read().decode()}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    check_file_access_response = json.loads(json.loads(dataset_files_lambda_invoke_response['Payload'].read().decode('utf-8'))["body"])
    LOGGER.info("In commonUtil.check_user_file_access, response - %s", check_file_access_response)
    return check_file_access_response['Files']

def disconnect_websocket(connection_id, kwargs):
    """
    This method will update the sessions table with connection end time
    :param connection_id:
    :return:
    """
    LOGGER.info("In commonUtil.disconnect_websocket, starting method with connection id: %s", connection_id)
    dynamodb_res = kwargs["DynamoDBResource"]
    sessions_table = kwargs["SessionsTable"]
    sessions_table_connection_id_index = kwargs["SessionsTableConnectionIdIndex"]
    session_item = dynamodbUtil.get_items_by_query_index(
        dynamodb_res.Table(sessions_table),
        sessions_table_connection_id_index,
        Key("ConnectionId").eq(connection_id)
    )
    if session_item:
        user_id = session_item[0]["UserId"]
        session_id = session_item[0]["SessionId"]

        # update sessions table item with web socket connection id
        update_expression = "SET LastModifiedTime = :last_modified_time, ConnectionEndTime = :last_modified_time"
        expression_attributes = {":last_modified_time": get_current_time()}
        dynamodbUtil.update_item_by_key(
            dynamodb_res.Table(sessions_table),
            {"UserId": user_id, "SessionId": session_id},
            update_expression,
            expression_attributes
        )
        LOGGER.info("In commonUtil.disconnect_websocket, websocket connection disconnected successfully with connection id: %s", connection_id)
    else:
        LOGGER.info("In commonUtil.disconnect_websocket, websocket connection already disconnected")

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

def substitute_var_in_template(template_filename, substitute_values_dict):
    """
    This functions substitutes variables in the IAM template
    :param template_filename: template filename
    :type template_filename: str
    :param substitute_values_dict: dict of variables and values that needs to be substituted
    :return: substituted IAM policy dictionary
    :rtype: dict
    """
    LOGGER.info("In commonUtil.substitute_var_in_template, Substituting variables in the IAM template - %s", template_filename)
    import yaml
    with open(template_filename, encoding="utf8") as file_object:
        template_str = file_object.read()
    replaced_str = Template(template_str).substitute(substitute_values_dict)
    iam_policy_dict = yaml.safe_load(replaced_str)
    return iam_policy_dict

def get_assume_role_policy_doc(service_type, os_env_var_dict):
    """
    This function creates new IAM role/policy as per job name
    :param service_type: type of AWS service. E.g: glue-etl, sagemaker
    :type service_type: str
    :return
    """
    LOGGER.info("In commonUtil.get_assume_role_policy_doc for service type - %s", service_type)

    substitute_values_dict = {
        'SERVICE_TYPE': service_type.split('-')[0],
        'PROJ_SHORT_NAME': os_env_var_dict.get("projectShortName", "*"),
        'AWS_REGION': os_env_var_dict.get("awsRegion", "*"),
        'ACCOUNT_ID': os_env_var_dict.get("accountId", "*"),
        'AWS_PARTITION': os_env_var_dict.get("awsPartition", AWS_PARTITION)
    }
    template_filename = "/var/lang/lib/python3.12/site-packages/iam_assume_role_policy_document_conditionless.yaml"

    assumed_role_policy_dict = substitute_var_in_template(template_filename, substitute_values_dict)
    return json.dumps(assumed_role_policy_dict, indent=4, default=str)
