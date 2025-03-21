"""
Lambda for all operations related to Chat
"""

import os
import sys
import json
import copy
import signal
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import unquote_plus
import time
import uuid
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.client import Config
from botocore.exceptions import ClientError

import bedrockUtil
import commonUtil
import dynamodbUtil
import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading Function - %s", "chat.py")

try:
    LOGGER.info("In chat.py, Loading environment variables...")
    AWS_REGION = os.environ['awsRegion']
    AWS_PARTITION = os.environ['awsPartition']
    ACCOUNT_ID = os.environ['accountId']
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    ENVIRONMENT = os.environ['environment']
    SESSION_FILES_BUCKET_NAME = os.environ['sessionFilesBucketName']
    DLZ_BUCKET = os.environ['DLZBucketName']
    LZ_BUCKET = os.environ['LZBucketName']
    SENDER = os.environ['sesEmailFrom']

    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    S3_RESOURCE = boto3.resource('s3', AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION, config=Config(read_timeout=900))
    BEDROCK_RUNTIME_CLIENT = boto3.client('bedrock-runtime', AWS_REGION, config=Config(read_timeout=900))
    SES_CLIENT = boto3.client('ses', AWS_REGION)
    SSM_CLIENT = boto3.client("ssm", AWS_REGION)

    USERS_TABLE = dynamodbUtil.USERS_TABLE
    GROUPS_TABLE = dynamodbUtil.GROUPS_TABLE
    AGENTS_TABLE = dynamodbUtil.AGENTS_TABLE
    SESSIONS_TABLE = dynamodbUtil.SESSIONS_TABLE
    SESSIONS_TABLE_SESSIONID_INDEX = dynamodbUtil.SESSIONS_TABLE_SESSIONID_INDEX
    SESSIONS_TABLE_CONNECTIONID_INDEX = dynamodbUtil.SESSIONS_TABLE_CONNECTIONID_INDEX
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
    WORKSPACES_DOCUMENTS_TABLE = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE
    CHAT_HISTORY_TABLE = dynamodbUtil.CHAT_HISTORY_TABLE
    CHAT_HISTORY_TABLE_SESSIONID_MESSAGEID_INDEX = dynamodbUtil.CHAT_HISTORY_TABLE_SESSIONID_MESSAGEID_INDEX
    MODELS_TABLE = dynamodbUtil.MODELS_TABLE

    DATASET_OPERATIONS_LAMBDA = os.environ["amorphicDatasetOperationsLambdaArn"]
    DATASET_FILES_LAMBDA = os.environ["amorphicDatasetFilesLambdaArn"]
    VISUALIZATIONS_LAMBDA = f"arn:{AWS_PARTITION}:lambda:{AWS_REGION}:{ACCOUNT_ID}:function:{PROJECT_SHORT_NAME}-{commonUtil.VERTICAL_NAME}-{ENVIRONMENT}-visualizations"
    SUMMARIZATION_LAMBDA = os.environ["summarizationLambdaArn"]
    WEBSOCKET_ENDPOINT = os.environ["webSocketAPIEndpoint"].replace('wss://', '')
    API_ENDPOINT_URL = f"https://{WEBSOCKET_ENDPOINT}/{ENVIRONMENT}"
    API_MANAGEMENT_CLIENT = boto3.client('apigatewaymanagementapi', region_name=AWS_REGION,
                          endpoint_url=API_ENDPOINT_URL)
    CHAT_SEND_MESSAGE_REQUIRED_KEYS = ["ModelId", "UserMessage", "SessionId", "MessageId"]
    WS_KWARGS = {"ApiManagementClient": API_MANAGEMENT_CLIENT, "DynamoDBResource": DYNAMODB_RESOURCE, "SessionsTable": SESSIONS_TABLE, "SessionsTableConnectionIdIndex": SESSIONS_TABLE_CONNECTIONID_INDEX}
    EVENT_INFO = {}
except Exception as ex:
    LOGGER.error("In chat.py, Failed to load environment variables. error: %s", str(ex))
    sys.exit()

class LambdaTimer:
    """
    Calling a function in a specified time.
    If you call it several times, any previously scheduled alarm
    will be canceled (only one alarm can be scheduled at any time).
    """

    # pylint: disable=unused-argument

    def __init__(self, sec, event, context):
        self.sec = sec
        self.event = event
        self.context = context

    def __enter__(self):
        signal.signal(signal.SIGALRM, self.timeout_handler)
        signal.alarm(self.sec)
        return self.event

    def __exit__(self, *args):
        signal.alarm(0)  # disable alarm

    def timeout_handler(self, *args):
        """
        Timed out before completing the lambda
        """
        # pylint: disable=unused-argument
        if self.event["requestContext"]["domainName"] == WEBSOCKET_ENDPOINT:
            LOGGER.error("In chat.LambdaTimer, Lambda has been timed out for websocket")
            if self.event['requestContext']['routeKey'] == "sendmessage":
                LOGGER.info("In chat.LambdaTimer, failed to process user message within the timeout, updating dynamodb with failure status")
                event_body = json.loads(self.event.get('body')) if self.event.get('body', None) else {}
                session_id = event_body["SessionId"]

                session_item = dynamodbUtil.get_items_by_query_index(
                    DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                    SESSIONS_TABLE_SESSIONID_INDEX,
                    Key("SessionId").eq(session_id)
                )
                user_id = session_item[0]["UserId"]

                # update chat history table
                ai_message_object = {
                    "Type": "ai",
                    "Data": "Apologies, failed to process query due to timeout. Please try again.",
                    "MessageId": event_body["MessageId"],
                    "Metadata": "N/A",
                    "MessageTime": commonUtil.get_current_time(),
                    "ClientId": user_id,
                    "SessionId": session_id,
                    "ReviewRequired": False
                }

                dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), ai_message_object)

                # update sessions table with failure status
                update_expression = "SET QueryStatus = :query_status, QueryFailureReason = :query_failure_reason, LastModifiedTime = :last_modified_time"
                expression_attributes = {":query_status": commonUtil.CHAT_QUERY_FAILED, ":query_failure_reason": "Timed out", ":last_modified_time": commonUtil.get_current_time()}

                dynamodbUtil.update_item_by_key(
                    DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                    {"UserId": user_id, "SessionId": session_id},
                    update_expression,
                    expression_attributes
                )

def get_chat_sessions(user_id, client_id, **kwargs):
    """
    This function is to get chat sessions
    :param user_id
    :param client_id
    :return: list of chat sessions
    """
    LOGGER.info("In chat.get_chat_sessions, User %s requested to get chat sessions", user_id)
    try:
        if client_id.startswith('agent-'):
            agent_id = client_id.split('-', 1)[1]
            agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {"AgentId": agent_id})
            if not agent_item:
                LOGGER.error("In chat.get_chat_sessions, invalid agent id - `%s`", agent_id)
                ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
                ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("AgentId", agent_id)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
            chat_sessions = dynamodbUtil.get_item_details_query(DYNAMODB_RESOURCE.Table(SESSIONS_TABLE), \
                Key('UserId').eq(user_id), Attr("ClientId").eq(client_id), 'UserId,SessionId,ClientId,Title,StartTime,LastModifiedTime')
        else:
            chat_sessions = dynamodbUtil.get_item_details_query(DYNAMODB_RESOURCE.Table(SESSIONS_TABLE), \
                Key('UserId').eq(user_id), Attr("ClientId").eq(user_id) | Attr("ClientId").not_exists(), 'UserId,SessionId,ClientId,Title,StartTime,LastModifiedTime')

         # Sort & paginate results if applicable
        LOGGER.info("In chat.get_chat_sessions, Sorting & Paginating the results based on the input given")
        kwargs['dict_key'] = 'Sessions'
        kwargs['input_items'] = {'Sessions': chat_sessions}
        chat_sessions = commonUtil.sort_page_in_code(**kwargs)
        LOGGER.info("In chat.get_chat_sessions, retrieved chat sessions - %s", chat_sessions)
        return commonUtil.build_get_response(200, chat_sessions)
    except Exception as ex:
        LOGGER.error("In chat.get_chat_sessions, Failed to get chat sessions due to error: %s", str(ex))
        ec_ge_1004 = errorUtil.get_error_object("GE-1004")
        ec_ge_1004["Message"] = ec_ge_1004["Message"].format("retrieve", "chat sessions details", str(ex))
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1004)

def create_new_session(user_id, client_id):
    """
    This function is to create new chat session
    :param user_id
    :return: session Id of newly create session
    """
    LOGGER.info("In chat.create_new_session, User %s requested to create new chat session", user_id)
    if client_id.startswith('agent-'):
        agent_id = client_id.split('-', 1)[1]
        agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {"AgentId": agent_id})
        if not agent_item:
            LOGGER.error("In chat.create_new_session, invalid agent id - `%s`", agent_id)
            ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
            ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("AgentId", agent_id)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
        expiration_time = (datetime.now(timezone.utc) + timedelta(seconds=commonUtil.AGENT_IDLE_SESSION_TIMEOUT_IN_SECONDS)).strftime('%s')
    else:
        expiration_time = (datetime.now(timezone.utc) + timedelta(days=commonUtil.CHAT_SESSION_VALIDITY_IN_DAYS)).strftime('%s')
        client_id = user_id

    session_id = str(uuid.uuid4())
    session_details = {
        "UserId": user_id,
        "SessionId": session_id,
        "StartTime": commonUtil.get_current_time(),
        "Title": "New Session",
        "History": [],
        "LastModifiedTime": commonUtil.get_current_time(),
        "ExpirationTime": int(expiration_time),
        "ClientId": client_id
    }
    put_status = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(SESSIONS_TABLE), session_details)
    if put_status == "error":
        LOGGER.error("In chat.create_new_session, failed to create session item in dynamodb, please check for errors.")
        ec_db_1001 = errorUtil.get_error_object("DB-1001")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)
    LOGGER.info("In chat.create_new_session, Successfully created new chat session with session id: %s", session_id)
    return session_id

def delete_session_history(session_id):
    """
    This function is to delete chat session history
    :param session_id
    """
    LOGGER.info("In chat.delete_session_history, User requested to delete session history for session id: %s", session_id)
    chat_history = get_session_history(session_id, "SessionId,MessageTime")
    dynamodbUtil.batch_delete_items(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), chat_history)
    LOGGER.info("In chat.delete_session_history, Successfully deleted session history for session id: %s", session_id)

def delete_session(user_id, session_id):
    """
    This function is to delete chat session
    :param user_id
    :param session_id
    :return: status of deletion
    """
    LOGGER.info("In chat.delete_session, User %s requested to delete session id: %s", user_id, session_id)
    # delete all session related files
    s3_delete_response = commonUtil.delete_s3_path(SESSION_FILES_BUCKET_NAME, [f'chat-sessions/{user_id}/{session_id}'], S3_RESOURCE.meta.client)
    if s3_delete_response != 'success':
        raise Exception('Failed to delete sessions files from S3')

    delete_session_history(session_id)

    response = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
        {'UserId': user_id, 'SessionId': session_id}
    )
    if response != "success":
        ec_ge_1021 = errorUtil.get_error_object("GE-1021")
        ec_ge_1021['Message'] = ec_ge_1021['Message'].format("Sessions")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1021)

    return commonUtil.build_delete_response(200, {"Message": "Session deleted successfully"})

def delete_session_file(user_id, session_id, filename):
    """
    This function is to delete chat session file
    :param user_id
    :param session_id
    :param filename
    """
    LOGGER.info("In chat.delete_session_file, User %s requested to delete session file: %s, for session id: %s", user_id, filename, session_id)
    session_details = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
    if filename not in session_details["Files"]:
        raise Exception(f"Invalid file name - {filename}")
    # Removing chat session file from S3 bucket
    LOGGER.info("In chat.delete_session_file, Removing chat session file from S3 bucket")
    s3_error = commonUtil.remove_s3_file(S3_RESOURCE, f'chat-sessions/{user_id}/{session_id}/{filename}', SESSION_FILES_BUCKET_NAME)
    if not s3_error:
        # Removing chat session file from DynamoDB table
        LOGGER.info("In chat.delete_session_file, Removing chat session file from DynamoDB table")
        session_details["Files"].remove(filename)
        session_details["LastModifiedTime"] = commonUtil.get_current_time()
        dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(SESSIONS_TABLE), json.loads(json.dumps(session_details, cls=commonUtil.DecimalEncoder), parse_float=Decimal))
    else:
        raise Exception(s3_error)

def upload_file_to_dataset(user_id, session_id, files, dataset_id):
    """
    This function is to upload file to dataset
    :param user_id
    :param session_id
    :param files
    :param dataset_id
    """
    LOGGER.info("In chat.upload_file_to_dataset, User %s requested to upload file to dataset id: %s", user_id, dataset_id)
    auth_token, role_id = commonUtil.get_user_auth_resources(user_id, USERS_TABLE)
    dataset_operations_lambda_obj = {
        "AuthorizationToken": auth_token,
        "RoleId": role_id,
        "LambdaClient": LAMBDA_CLIENT,
        "FunctionName": DATASET_OPERATIONS_LAMBDA
    }
    amorphic_dataset_item = commonUtil.retrieve_amorphic_dataset(user_id, dataset_id, dataset_operations_lambda_obj)

    # validate if user has write access
    if amorphic_dataset_item["AccessType"] not in ["owner", "editor"]:
        LOGGER.error("In chat.upload_file_to_dataset method, user does not have owner permissions to the dataset")
        ec_auth_1005 = errorUtil.get_error_object("AUTH-1005")
        ec_auth_1005['Message'] = ec_auth_1005['Message'].format(user_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_auth_1005)

    # validate if dataset target location is s3 or s3athena
    if amorphic_dataset_item["TargetLocation"] not in ["s3", "s3athena"]:
        LOGGER.error("In chat.upload_file_to_dataset, Only S3 and S3athena target type datasets are supported")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Only S3/S3athena target type datasets are supported"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    session_details = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
    epoch_time = str(int(time.time()))
    partition = f"upload_date={epoch_time}"
    success_files_list = []
    failed_files = []
    for file in files:
        if file not in session_details.get("Files", []):
            LOGGER.error("In chat.post_query_to_model, invalid file name - `%s`", file)
            failed_files.append({"FileName": file, "FailurReason": "Invalid file. File doesn't exist in session"})
            continue
        if amorphic_dataset_item.get("SkipLZProcess", False):
            target_bucket = DLZ_BUCKET
            object_key = "{}/{}/{}/{}_{}_{}_{}".format(amorphic_dataset_item['Domain'], amorphic_dataset_item['DatasetName'], partition, user_id, dataset_id, str(epoch_time), file)
        else:
            target_bucket = LZ_BUCKET
            object_key = "{}/{}/{}/{}/{}/{}".format(amorphic_dataset_item['Domain'], amorphic_dataset_item['DatasetName'], partition, user_id, amorphic_dataset_item['FileType'], file)
        copy_source = {
            'Bucket': SESSION_FILES_BUCKET_NAME,
            'Key': f'chat-sessions/{user_id}/{session_id}/{file}'
         }
        try:
            S3_RESOURCE.meta.client.copy(copy_source, target_bucket, object_key)
            success_files_list.append(file)
        except Exception as ex:
            LOGGER.info("In chat.upload_file_to_dataset, Dataset upload failed for file - %s, due to error - %s", file, str(ex))
            failed_files.append({"FileName": file, "FailureReason": str(ex)})

    if not success_files_list:
        return commonUtil.build_put_response(500, {"Message": "Dataset file upload failed. Please try again later.", "FailedFiles": failed_files})

    user_details = commonUtil.get_userdetails(user_id, USERS_TABLE, DYNAMODB_RESOURCE)
    if user_details.get('EmailSubscription', None) == 'yes':
        recipient = user_details['EmailId']
        email_type = "info"
        email_subject = f"{PROJECT_SHORT_NAME} | {ENVIRONMENT} | {email_type} | Dataset File Upload Report"
        title = "Dataset File Upload Report"
        event_type = "Dataset File Upload from Session"
        resource_type = "Dataset"
        resource_name = amorphic_dataset_item["DatasetName"]
        message = "Dataset file upload process triggered. Please check the dataset to the view the upload status. Do not trigger the upload for the same files as this will generate duplicates"
        kwargs = {
            "success_files_list": ', '.join(success_files_list),
            "failed_files_list": ', '.join([file["FileName"] for file in failed_files])
        }
        body_text = commonUtil.generate_email_body(title, event_type, resource_type, resource_name, dataset_id, message, email_type, **kwargs)
        msg = MIMEMultipart()
        # Add subject, from and to lines.
        msg['Subject'] = email_subject
        msg['From'] = f"{commonUtil.EMAIL_SENDER_NAME} <{SENDER}>"
        msg['To'] = recipient
        textpart = MIMEText(body_text, 'html')
        msg.attach(textpart)
        try:
            response = commonUtil.send_email(recipient, body_text, email_subject, SENDER, SES_CLIENT)
        except ClientError as ex:
            LOGGER.error("In chat.upload_file_to_dataset, sending report failed with error: %s", ex.response['Error']['Message'])
        else:
            LOGGER.info("In chat.upload_file_to_dataset, Email sent! Message ID: %s",response['MessageId'])

    return commonUtil.build_put_response(200, {"Message": "Dataset file upload process started"})

def format_ai_message(message):
    """
    This function is to format ai message
    :param message
    """
    LOGGER.info("In chat.format_ai_message, starting method")
    message = message.strip()
    message = message.removeprefix("AI:")
    message = message.removeprefix("Answer:")
    message = message.strip()
    return message

def raise_model_access_exception():
    """This method raises the model access exception"""
    LOGGER.error("In chat.post_query_to_model, model is not enabled or is unavailable")
    ec_ge_1034 = errorUtil.get_error_object("GE-1034")
    ec_ge_1034['Message'] = "Model is not enabled yet, or is unavailable. Please try again later."
    raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

# pylint: disable=too-many-locals
def post_query_to_model(event, session_id, user_id, connection_id, auth_token):
    """
    This function is to post query to model
    :param event
    :param user_id
    """
    LOGGER.info("In chat.post_query_to_model with event - %s", event)
    event_body = json.loads(event['body'])

    commonUtil.validate_event_body(event_body, CHAT_SEND_MESSAGE_REQUIRED_KEYS)

    message_id = event_body["MessageId"]
    session_details = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
    model_id = event_body.get("ModelId", "")
    workspace_id = event_body.get("WorkspaceId", "")
    workspace_item = None
    message = event_body.get("UserMessage", "").strip()
    advanced_config = event_body.get("AdvancedConfig", {})
    user_item = commonUtil.is_valid_user(user_id)

    if not message:
        LOGGER.error("In chat.post_query_to_model, message is empty")
        ec_ipv_1004 = errorUtil.get_error_object("IPV-1004")
        ec_ipv_1004['Message'] = "The parameter UserMessage cannot be empty"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1004)
    # validate user message length
    if len(message) > bedrockUtil.INPUT_MESSAGE_SIZE_LIMIT:
        LOGGER.error("In chat.post_query_to_model, UserMessage exceeded max limit")
        ec_ipv_1068 = errorUtil.get_error_object("IPV-1068")
        ec_ipv_1068["Message"] = ec_ipv_1068["Message"].format('UserMessage', bedrockUtil.INPUT_MESSAGE_SIZE_LIMIT)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1068)

    # getting models from dynamodb for now, validate model access when new models are added
    model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE),{"ModelId": model_id})
    if not model_item:
        LOGGER.error("In chat.post_query_to_model, invalid model id - `%s`", model_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("ModelId", model_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    # check if model is enabled by admins and if model is available or not
    if "ModelStatusCode" in model_item:
        if model_item["ModelStatusCode"] != commonUtil.MODEL_STATUS_GREEN:
            raise_model_access_exception()
    else:
        if model_item['UserAccessible'] == "no" or model_item['AvailabilityStatus'] == 'Unavailable':
            raise_model_access_exception()

    if model_item["ModelType"] == "Base" and "ON_DEMAND" not in model_item.get('InferenceTypesSupported', []):
        LOGGER.error("In chat.post_query_to_model, model does not support on demand inference")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = "This model does not support on-demand inference. Please try again with a different model."
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    elif model_item["ModelType"] == "Custom":
        model_item.update({
            "ModelName":  model_item["AdditionalConfiguration"]["ProvisionThroughputConfig"]["ProvisionedModelArn"]
        })

    # validate openai key
    if model_item["ModelProvider"] == commonUtil.OPENAI_MODEL_PROVIDER:
        openai_key = commonUtil.get_openai_key(SSM_CLIENT)
        if not openai_key:
            LOGGER.error("In chat.post_query_to_model, Open AI key not set")
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = "Open AI key not set. Please set it before using Open AI models"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        os.environ["OPENAI_API_KEY"] = openai_key

    # validate workspace access
    if workspace_id:
        workspace_item, workspace_permission = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")
        LOGGER.info("In chat.post_query_to_model, workspace - %s, permission - %s", workspace_item, workspace_permission)

    # validate file
    use_original_file = advanced_config.get("UseOriginalFile", False) if advanced_config else False
    if use_original_file:
        if not advanced_config.get("FileName"):
            LOGGER.error("In chat.post_query_to_model, FileName not passed")
            ec_ipv_1001 = errorUtil.get_error_object("IPV-1001")
            ec_ipv_1001['Message'] = 'FileName is a required key when UseOriginalFile option is selected'
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1001)

        if advanced_config["FileName"] not in session_details.get("Files", []):
            LOGGER.error("In chat.post_query_to_model, invalid file name - `%s`", advanced_config["FileName"])
            ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
            ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("FileName", advanced_config["FileName"])
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    query_start_time = commonUtil.get_current_time()
    chat_history = get_session_history(session_id)
    human_message_object = {
        "Type": "human",
        "MessageId": message_id,
        "Data": message,
        "MessageTime": query_start_time,
        "ClientId": user_id,
        "SessionId": session_id,
        "ReviewRequired": False
    }
    chat_history = json.loads(json.dumps(chat_history, cls=commonUtil.DecimalEncoder), parse_float=Decimal)

    # set query status to running
    update_expression = "REMOVE QueryFailureReason SET QueryStatus = :query_status, LastModifiedTime = :last_modified_time"
    expression_attributes = {":query_status": commonUtil.CHAT_QUERY_PROCESSING, ":last_modified_time": query_start_time}

    # write title if not present
    if session_details["Title"] == "New Session":
        update_expression += ", Title = :title"
        expression_attributes[":title"] = message[:128]

    human_message_object = json.loads(json.dumps(human_message_object, cls=commonUtil.DecimalEncoder), parse_float=Decimal)
    dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), human_message_object)

    dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
        {"UserId": user_id, "SessionId": session_id},
        update_expression,
        expression_attributes
    )

    # submit query to model
    try:
        visualization_metadata_dict = {"visualizationsLambdaArn": VISUALIZATIONS_LAMBDA, "lambdaClient": LAMBDA_CLIENT, "authToken": auth_token}
        summarization_metadata_dict = {"summarizationLambdaArn": SUMMARIZATION_LAMBDA, "lambdaClient": LAMBDA_CLIENT, "sessionId": session_id, "userId": user_id, "authToken": auth_token}
        session_details["History"] = chat_history
        advanced_config.update({
            "Boto3Clients": {
                "LambdaClient": LAMBDA_CLIENT,
                "BedrockRuntimeClient": BEDROCK_RUNTIME_CLIENT,
                "S3Client": S3_RESOURCE.meta.client,
                "DynamoDBResource": DYNAMODB_RESOURCE,
                "ApiManagementClient": API_MANAGEMENT_CLIENT
            },
            "DatasetFilesLambda": DATASET_FILES_LAMBDA,
            "SessionsTable": SESSIONS_TABLE,
            "ChatHistoryTable": CHAT_HISTORY_TABLE,
            "WorkspacesDocumentsTable": WORKSPACES_DOCUMENTS_TABLE,
            "QueryStartTime": query_start_time
        })
        result = bedrockUtil.get_chatbot_response(user_id, connection_id, message_id, model_item, workspace_item, session_details, message, summarization_metadata_dict, visualization_metadata_dict, **advanced_config)
        query_end_time = commonUtil.get_current_time()
        response_time = str((datetime.strptime(query_end_time, commonUtil.DATETIME_ISO_FORMAT) - datetime.strptime(query_start_time, commonUtil.DATETIME_ISO_FORMAT)).total_seconds() * 1000)
        # remove page content from metadata when storing to ddb
        updated_documents = []
        for document in result["metadata"].get("documents", []):
            document_copy = copy.deepcopy(document)
            document_copy.pop("page_content", None)
            updated_documents.append(document_copy)
        updated_metadata = copy.deepcopy(result["metadata"])
        if updated_documents:
            updated_metadata["documents"] = updated_documents
        ai_message_object = {
            "Type": "ai",
            "Data": format_ai_message(result["content"]),
            "MessageId": message_id,
            "Metadata": updated_metadata,
            "MessageTime": query_end_time,
            "ResponseTime": response_time,
            "ClientId": user_id,
            "SessionId": session_id,
            "ReviewRequired": False
        }
        # store response to dynamodb
        update_expression = "SET QueryStatus = :query_status, LastModifiedTime = :last_modified_time"
        expression_attributes = {":query_status": commonUtil.CHAT_QUERY_COMPLETED, ":last_modified_time": query_end_time}

        ai_message_object = json.loads(json.dumps(ai_message_object, cls=commonUtil.DecimalEncoder), parse_float=Decimal)
        dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), ai_message_object)

        dynamodbUtil.update_item_by_key(
            DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
            {"UserId": user_id, "SessionId": session_id},
            update_expression,
            expression_attributes
        )

        # send final response to user if model is not streamable
        if model_item["IsStreamingEnabled"] == "no":
            WS_KWARGS.update({"LatestMessageId": message_id})
            commonUtil.send_message_to_ws_connection(user_id, session_id, {"AIMessage": format_ai_message(result["content"]), "Metadata": {"IsComplete": True, "MessageId": message_id, "ResponseTime": response_time}}, WS_KWARGS)

        # return metadata
        result["metadata"].update({
            "MessageId": message_id,
            "IsComplete": True,
            "ResponseTime": response_time
        })
        return result["metadata"]
    except Exception as ex:
        LOGGER.error("In chat.post_query_to_model, query failed with error - %s", str(ex))
        query_end_time = commonUtil.get_current_time()
        response_time = str((datetime.strptime(query_end_time, commonUtil.DATETIME_ISO_FORMAT) - datetime.strptime(query_start_time, commonUtil.DATETIME_ISO_FORMAT)).total_seconds() * 1000)
        if str(ex) == bedrockUtil.FILE_TOO_BIG_MESSAGE or "Member must have length less than or equal to 25000000" in str(ex) or "Input is too long for requested model" in str(ex):
            ai_message = bedrockUtil.FILE_TOO_BIG_MESSAGE
        elif "AccessDeniedException" in str(ex):
            ai_message = bedrockUtil.MODEL_ACCESS_ERROR_MESSAGE.format(model_item["ModelName"])
        elif "incorrect api key" in str(ex).lower():
            ai_message = bedrockUtil.INVALID_API_KEY_MESSAGE
        elif "Could not parse LLM output" in str(ex):
            ai_message = bedrockUtil.MODEL_FAILURE_MESSAGE
        elif "unsupported file type" in str(ex):
            ai_message = bedrockUtil.UNSUPPORTED_FILE_TYPE_MESSAGE.format(str(ex))
        else:
            ai_message =bedrockUtil.CHAT_QUERY_FAILED_MESSAGE

        ai_message_object = {
            "Type": "ai",
            "Data": ai_message,
            "MessageId": message_id,
            "Metadata": "N/A",
            "MessageTime": query_end_time,
            "ResponseTime": response_time,
            "ClientId": user_id,
            "SessionId": session_id,
            "ReviewRequired": False
        }

        update_expression = "SET QueryStatus = :query_status, QueryFailureReason = :query_failure_reason, LastModifiedTime = :last_modified_time"
        expression_attributes = {":query_status": commonUtil.CHAT_QUERY_FAILED, ":query_failure_reason": str(ex), ":last_modified_time": query_end_time}

        ai_message_object = json.loads(json.dumps(ai_message_object, cls=commonUtil.DecimalEncoder), parse_float=Decimal)
        dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), ai_message_object)

        dynamodbUtil.update_item_by_key(
            DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
            {"UserId": user_id, "SessionId": session_id},
            update_expression,
            expression_attributes
        )
        WS_KWARGS.update({"LatestMessageId": message_id})
        commonUtil.send_message_to_ws_connection(user_id, session_id, {"AIMessage": ai_message, "Metadata": {"IsComplete": True, "MessageId": message_id, "ResponseTime": response_time}}, WS_KWARGS)

        # return metadata
        return {"IsComplete": True, "MessageId": message_id, "ResponseTime": response_time}

def get_model_query_response(user_id, session_id, message_id):
    """
    This function is to get model query response
    :param user_id
    :param session_id
    :param message_id
    """
    session_details = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
    if session_details.get("QueryStatus", None) == commonUtil.CHAT_QUERY_PROCESSING:
        return commonUtil.build_get_response(200, {"Message": "Query is still running"})
    else:
        if message_id:
            messages = get_messages_from_history(session_id, message_id)
            if not messages:
                LOGGER.error("In chat.get_session_details, message with id: %s not found", message_id)
                ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
                ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("message-id", message_id)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
        else:
            history = get_session_history(session_id)
            messages = history[-2:]
            message_id = messages[-1]["MessageId"]

        message_response = {}
        for message in messages:
            sender = "AI" if message["Type"] == "ai" else "User"
            message_response[sender] = message["Data"]

        return commonUtil.build_get_response(200,
            {"Message": message_response, "SessionId": session_id, "MessageId": message_id})

def update_file_metadata(event):
    """
    This function updates file metadata in sessions table
    :param event
    """
    add_file = 'ObjectCreated' in event['Records'][0]['eventName']
    key = unquote_plus(str(event['Records'][0]['s3']['object']['key']))
    user_id = key.split("/")[-3]
    session_id = key.split("/")[-2]
    filename = key.split("/")[-1]
    try:
        session_details = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
    except Exception as ex:
        # case where a session's ddb entry got deleted due to TTL expiry
        if not add_file and "IPV-1002" in str(ex):
            LOGGER.info("In chat.update_file_metadata, session already deleted, so no need to update metadata")
            return
        else:
            raise Exception(ex) from ex
    files_list = session_details.get("Files", [])
    if add_file:
        LOGGER.info("In chat.update_file_metadata, user %s has added file %s to session %s", user_id, filename, session_id)
        files_list.append(filename)
    else:
        LOGGER.info("In chat.update_file_metadata, user %s has removed file %s from session %s", user_id, filename, session_id)
        files_list.remove(filename)
    session_details["Files"] = list(set(files_list))
    session_details["LastModifiedTime"] = commonUtil.get_current_time()
    dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(SESSIONS_TABLE), json.loads(json.dumps(session_details, cls=commonUtil.DecimalEncoder), parse_float=Decimal))

def get_session_history(session_id, projection_keys=None, expression_attribute_names=None):
    """
    This function gets session history
    :param session_id
    :param projection_keys
    """
    LOGGER.info("In chat.get_session_history, getting session history for session %s", session_id)
    chat_history = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE),
        CHAT_HISTORY_TABLE_SESSIONID_MESSAGEID_INDEX,
        Key("SessionId").eq(session_id),
        projection_expression=projection_keys,
        expression_attributes_names=expression_attribute_names
    )
    chat_history = sorted(chat_history, key=lambda x: x["MessageTime"], reverse=False)
    return chat_history

def get_messages_from_history(session_id, message_id):
    """
    This function gets messages from history
    :param session_id
    :param message_id
    """
    LOGGER.info("In chat.get_messages_from_history, getting messages from history for session %s and message id %s", session_id, message_id)
    messages = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE),
        CHAT_HISTORY_TABLE_SESSIONID_MESSAGEID_INDEX,
        Key("SessionId").eq(session_id) & Key("MessageId").eq(message_id),
        projection_expression="#type,MessageTime,#data,ResponseTime,Metadata",
        expression_attributes_names={"#type": "Type", "#data": "Data"}
    )
    return messages

def lambda_handler(event, context):
    """
    This Lambda function is to handle users related API calls
    :param event: event information
    :type event: dict
    :param context: runtime information to the handler.
    :type context: LambdaContext
    :return: response to the api
    :rtype: dict
    """
    if event.get("requestContext", None):
        # if the lambda times out, the sessions table is updated with QueryStatus as failed
        with LambdaTimer(int((context.get_remaining_time_in_millis() / 1000) - 10), event, context):
            try:
                #to remove authorization token while printing logs
                event = commonUtil.RedactAuthTokensClass(event)
                EVENT_INFO["eventIdentifier"] = context.aws_request_id
                errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
                LOGGER.info("In chat.lambda_handler, event - %s", event)

                # check if request is from WebSocket API
                if event["requestContext"]["domainName"] == WEBSOCKET_ENDPOINT:
                    LOGGER.info("In chat.lambda_handler, request is from WebSocket API")
                    connection_id = event['requestContext']['connectionId']
                    LOGGER.info("In chat.lambda_handler, connection_id - %s", connection_id)

                    # this route is triggered when the websocket connection is established
                    if event['requestContext']['routeKey'] == "$connect":
                        auth_token = event['queryStringParameters']['Authorization']
                        claims = commonUtil.get_claims(auth_token)
                        user_id = claims['cognito:username']
                        LOGGER.info("In chat.lambda_handler, action is connect")
                        if not event.get("queryStringParameters") or not event["queryStringParameters"].get("session-id"):
                            LOGGER.error("In chat.lambda_handler method, session id missing in query string parameters")
                            ec_ipv_1052 = errorUtil.get_error_object("IPV-1052")
                            ec_ipv_1052['Message'] = ec_ipv_1052['Message'].format("session-id")

                        session_id = event["queryStringParameters"]["session-id"]
                        # check if session id is valid
                        session_details = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
                        # update sessions table item with web socket connection id
                        update_expression = "SET ConnectionId = :connection_id, LastModifiedTime = :last_modified_time, ConnectionStartTime = :last_modified_time REMOVE ConnectionEndTime"
                        expression_attributes = {":connection_id": connection_id, ":last_modified_time": commonUtil.get_current_time()}
                        dynamodbUtil.update_item_by_key(
                            DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                            {"UserId": user_id, "SessionId": session_id},
                            update_expression,
                            expression_attributes
                        )
                        response = {
                            'statusCode': 200,
                            'body': json.dumps({"ConnectionId": connection_id, "Message": "Connection opened."})
                        }
                    # this route is triggered when any message is sent to the websocket api
                    elif event['requestContext']['routeKey'] == "sendmessage":
                        LOGGER.info("In chat.lambda_handler, action is send message")
                        session_id = json.loads(event["body"])["SessionId"]
                        session_item = dynamodbUtil.get_items_by_query_index(
                            DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                            SESSIONS_TABLE_SESSIONID_INDEX,
                            Key("SessionId").eq(session_id)
                        )
                        user_id = session_item[0]["UserId"]
                        # update message delivery status to pending in sessions table
                        commonUtil.update_message_delivery_status(user_id, session_id, commonUtil.CHAT_MESSAGE_DELIVERY_PENDING, WS_KWARGS)
                        # post query to model
                        try:
                            chat_response_metadata = post_query_to_model(event, session_id, user_id, connection_id, None)
                            WS_KWARGS.update({"LatestMessageId": chat_response_metadata["MessageId"]})
                            # send metadata to client
                            commonUtil.send_message_to_ws_connection(user_id, session_id, {"Metadata": chat_response_metadata}, WS_KWARGS)
                        except Exception as ex:
                            LOGGER.error("In chat.lambda_handler, user query failed due to error - %s", str(ex))
                            commonUtil.send_message_to_ws_connection(user_id, session_id, {"AIMessage": str(ex), "Metadata": {"IsComplete": True}}, WS_KWARGS)
                        response = {
                            'statusCode': 200,
                            'body': json.dumps({"Message": "Message delivered"})
                        }
                    # this route is triggered when the websocket connection is closed
                    elif event['requestContext']['routeKey'] == "$disconnect":
                        commonUtil.disconnect_websocket(connection_id, WS_KWARGS)
                        response = {
                            'statusCode': 200,
                            'body': json.dumps({"ConnectionId": connection_id, "Message": "Connection closed."})
                        }
                    return response
                else:
                    LOGGER.info("In chat.lambda_handler, request is from Rest API")
                    LOGGER.info("In chat.lambda_handler, event - %s", event)
                    auth_token = event['headers']['Authorization']
                    claims = commonUtil.get_claims(auth_token)
                    user_id = claims['cognito:username']
                    http_method = event['requestContext']['httpMethod']
                    api_resource = event['resource']
                    LOGGER.info("In users.lambda_handler, http_method - %s, api_resource - %s", http_method, api_resource)
                    if api_resource == "/chat/sessions" and http_method == "GET":
                        query_params = event.get("queryStringParameters", {})
                        client_id = query_params.get("client-id") if query_params and "client-id" in query_params else user_id
                        kwargs = {
                            "offset": 0,
                            "items_limit": 20,
                            "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                            "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                         }
                        response = get_chat_sessions(user_id, client_id, **kwargs)
                    elif api_resource == "/chat/sessions" and http_method == "POST":
                        query_params = event.get("queryStringParameters", {})
                        client_id = query_params.get("client-id") if query_params and "client-id" in query_params else user_id
                        session_id = create_new_session(user_id, client_id)
                        response = commonUtil.build_post_response(200, {"Message": "Session created successfully", "SessionId": session_id})
                    elif api_resource == "/chat/sessions/{id}" and http_method == "GET":
                        session_id = event['pathParameters']['id']
                        session_details = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
                        session_details["History"] = get_session_history(session_id, "#type,#data,MessageTime,ResponseTime,MessageId,Sources", {"#type": "Type", "#data": "Data"})
                        response = commonUtil.build_get_response(200, session_details, commonUtil.is_compression_requested(event))
                    elif api_resource == "/chat/sessions/{id}" and http_method == "DELETE":
                        session_id = event['pathParameters']['id']
                        response = delete_session(user_id, session_id)
                    elif api_resource == "/chat/sessions/{id}/files" and http_method == "GET":
                        session_id = event['pathParameters']['id']
                        session_details = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
                        response = commonUtil.build_post_response(200, {"Files": session_details.get("Files", [])})
                    elif api_resource == "/chat/sessions/{id}/files" and http_method == "POST":
                        session_id = event['pathParameters']['id']
                        event_body = json.loads(event['body']) if event['body'] else {}
                        # validate session_id and filename
                        _ = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
                        if "FileName" not in event_body or not event_body["FileName"]:
                            LOGGER.error("In chat.lambda_handler, missing key FileName in request body")
                            ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
                            ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("FileName")
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
                        filename = event_body["FileName"]
                        presigned_url = commonUtil.get_presigned_url_put_object(S3_RESOURCE.meta.client, SESSION_FILES_BUCKET_NAME, f'chat-sessions/{user_id}/{session_id}/{filename}')
                        response = commonUtil.build_post_response(200, {"PresignedURL": presigned_url})
                    elif api_resource == "/chat/sessions/{id}/files" and http_method == "DELETE":
                        session_id = event['pathParameters']['id']
                        event_body = json.loads(event['body']) if event['body'] else {}
                        # validate session_id and FileName
                        _ = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
                        if "FileName" not in event_body or not event_body["FileName"]:
                            LOGGER.error("In chat.lambda_handler, missing key FileName in request body")
                            ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
                            ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("FileName")
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
                        filename = event_body["FileName"]
                        delete_session_file(user_id, session_id, filename)
                        response = commonUtil.build_delete_response(200, {"Message": "File deleted successfully"})
                    elif api_resource == "/chat/sessions/{id}/files/dataset-upload" and http_method == "PUT":
                        session_id = event['pathParameters']['id']
                        event_body = json.loads(event['body']) if event['body'] else {}
                        # validate Files and DatasetId
                        if "Files" not in event_body or not event_body["Files"]:
                            LOGGER.error("In chat.lambda_handler, missing key Files in request body")
                            ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
                            ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("Files")
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
                        if "DatasetId" not in event_body or not event_body["DatasetId"]:
                            LOGGER.error("In chat.lambda_handler, missing key DatasetId in request body")
                            ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
                            ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("DatasetId")
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
                        files = event_body["Files"]
                        dataset_id = event_body["DatasetId"]
                        response = upload_file_to_dataset(user_id, session_id, files, dataset_id)
                    elif api_resource == "/chat/sessions/{id}/messages/{message_id}" and http_method == "GET":
                        session_id = event['pathParameters']['id']
                        message_id = event['pathParameters']['message_id']
                        messages = get_messages_from_history(session_id, message_id)
                        response = commonUtil.build_get_response(200, messages, commonUtil.is_compression_requested(event))
                    else:
                        LOGGER.error("In chat.lambda_handler, invalid api call - %s %s", http_method, api_resource)
                        ec_ge_1010 = errorUtil.get_error_object("GE-1010")
                        ec_ge_1010['Message'] = ec_ge_1010['Message'].format(http_method, api_resource)
                        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1010)
            except errorUtil.InvalidUserException as iue:
                LOGGER.error("In chat.lambda_handler, InvalidUserException occurred with error %s", iue)
                response = commonUtil.build_post_response(400, {'Message': str(iue)})
            except errorUtil.InvalidInputException as iie:
                LOGGER.error("In chat.lambda_handler, InvalidInputException occurred with error %s", iie)
                response = commonUtil.build_post_response(400, {'Message': str(iie)})
            except errorUtil.GenericFailureException as gfe:
                LOGGER.error("In chat.lambda_handler, GenericFailureException occurred with error %s", gfe)
                response = commonUtil.build_post_response(500, {'Message': str(gfe)})
            except Exception as exc:
                LOGGER.error("In chat.lambda_handler, Exception occurred with error %s", exc)
                response = commonUtil.build_generic_response(500, {"Message": str(exc)})
            return response
    else:
        LOGGER.info("In chat.lambda_handler, request is from S3, event - %s", event)
        update_file_metadata(event)
