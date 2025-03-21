"""
Lambda used to perform API operations for embedded chatbots
Embeddable chatbots allow users to embed a chatbot on their websites for their customers to interact with
This is a public facing lambda without user authentication
"""
import os
import sys
import json
import signal
import logging
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import boto3
from boto3.dynamodb.conditions import Key, Attr
from botocore.client import Config


import commonUtil
import dynamodbUtil
import errorUtil
import bedrockUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading Function - %s", "embeddedChatbots.py")

try:
    LOGGER.info("In embeddedChatbots.py, Loading environment variables...")
    AWS_REGION = os.environ['awsRegion']
    AWS_PARTITION = os.environ['awsPartition']
    ACCOUNT_ID = os.environ['accountId']
    ENVIRONMENT = os.environ['environment']
    AWS_REGION = os.environ['awsRegion']
    PROJECT_SHORT_NAME = os.environ["projectShortName"]
    VERTICAL_NAME = os.environ["verticalName"]
    DATASET_FILES_LAMBDA = os.environ["amorphicDatasetFilesLambdaArn"]
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)
    CHATBOTS_TABLE = dynamodbUtil.CHATBOTS_TABLE
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
    WORKSPACES_DOCUMENTS_TABLE = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE
    MODELS_TABLE = dynamodbUtil.MODELS_TABLE
    CHAT_HISTORY_TABLE = dynamodbUtil.CHAT_HISTORY_TABLE
    CHAT_HISTORY_CLIENTID_INDEX = dynamodbUtil.CHAT_HISTORY_CLIENTID_INDEX
    SESSIONS_TABLE = dynamodbUtil.SESSIONS_TABLE
    SESSIONS_TABLE_SESSIONID_INDEX = dynamodbUtil.SESSIONS_TABLE_SESSIONID_INDEX
    SESSIONS_TABLE_CONNECTIONID_INDEX = dynamodbUtil.SESSIONS_TABLE_CONNECTIONID_INDEX
    WEBSOCKET_ENDPOINT = os.environ["webSocketAPIEndpoint"].replace('wss://', '')
    API_ENDPOINT_URL = f"https://{WEBSOCKET_ENDPOINT}/{ENVIRONMENT}"
    API_MANAGEMENT_CLIENT = boto3.client('apigatewaymanagementapi', region_name=AWS_REGION,
                          endpoint_url=API_ENDPOINT_URL)
    CHATBOT_SEND_MESSAGE_REQUIRED_KEYS = ["SessionId", "ChatbotId", "MessageId", "UserInput"]
    WS_KWARGS = {"ApiManagementClient": API_MANAGEMENT_CLIENT, "DynamoDBResource": DYNAMODB_RESOURCE, "SessionsTable": SESSIONS_TABLE, "SessionsTableConnectionIdIndex": SESSIONS_TABLE_CONNECTIONID_INDEX}
    EVENT_INFO = {}
except Exception as ex:
    LOGGER.error("In embeddedChatbots.py, Failed to load environment variables. error: %s", str(ex))
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
            LOGGER.error("In embeddedChatbots.LambdaTimer, Lambda has been timed out for websocket")
            if self.event['requestContext']['routeKey'] == "sendmessage":
                LOGGER.info("In embeddedChatbots.LambdaTimer, failed to process user message within the timeout, updating dynamodb with failure status")
                event_body = json.loads(self.event.get('body')) if self.event.get('body', None) else {}
                chatbot_id = event_body["ChatbotId"]
                session_id = event_body["SessionId"]

                # update chat history table
                ai_message_object = {
                    "Type": "ai",
                    "Data": "Apologies, failed to process query due to timeout. Please try again.",
                    "MessageId": event_body["MessageId"],
                    "Metadata": "N/A",
                    "MessageTime": commonUtil.get_current_time(),
                    "ClientId": chatbot_id,
                    "SessionId": session_id,
                    "ReviewRequired": False
                }

                dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), ai_message_object)

                # update sessions table with failure status
                update_expression = "SET QueryStatus = :query_status, QueryFailureReason = :query_failure_reason, LastModifiedTime = :last_modified_time"
                expression_attributes = {":query_status": commonUtil.CHAT_QUERY_FAILED, ":query_failure_reason": "Timed out", ":last_modified_time": commonUtil.get_current_time()}

                dynamodbUtil.update_item_by_key(
                    DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                    {"UserId": chatbot_id, "SessionId": session_id},
                    update_expression,
                    expression_attributes
                )


def get_chatbot_details_from_db(chatbot_id):
    """
    Method that returns chatbot details, given chatbot id.
    It also checks if the chatbot if chatbot is in active state and raises appropriate errors.
    :param chatbot_id: Id of the chatbot for which config needs to be retrieved
    :response chatbot_details: returns a dict object with chatbot details
    """
    LOGGER.info("In embeddedChatbots.get_chatbot_details_from_db method, with chatbot id %s", chatbot_id)
    chatbot_details = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE), {"ChatbotId": chatbot_id})
    if not chatbot_details:
        LOGGER.error("In embeddedChatbots.get_chatbot_config method, invalid chatbot id - %s", chatbot_id)
        ec_ge_1046 = errorUtil.get_error_object("GE-1046")
        ec_ge_1046['Message'] = ec_ge_1046['Message'].format("Chatbot", chatbot_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1046)
    if not chatbot_details.get("KeepActive", True):
        LOGGER.error("In embeddedChatbots.get_chatbot_config method, chatbot is not active")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = "The chatbot is not active currently"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)
    LOGGER.info("In embeddedChatbots.get_chatbot_details_from_db method, exiting")
    return chatbot_details


def get_chatbot_config(chatbot_id):
    """
    Method that fetches chatbot preferences given chatbot id
    :param chatbot_id: Id of the chatbot for which config needs to be retrieved
    """
    LOGGER.info("In embeddedChatbots.get_chatbot_config method")
    # Check if the chatbot exists
        # if it is supposed to be available
        # and if the config exists
    chatbot_details = get_chatbot_details_from_db(chatbot_id)
    chatbot_config = chatbot_details.get("EmbeddedConfig", {})
    LOGGER.info("In embeddedChatbots.get_chatbot_config method, exiting")
    response = commonUtil.build_get_response(200, {"EmbeddedConfig": chatbot_config})
    return response

def get_model_id(chatbot_id):
    """
    Fetches model_id associated with chatbot
    :param chatbot_id: Chatbot, recieved as input in path parameters
    """
    LOGGER.info("In embeddedChatbots.get_model_id method")
    chatbot_details = get_chatbot_details_from_db(chatbot_id)
    model_id = chatbot_details["Model"]
    LOGGER.info("In embeddedChatbots.get_model_id method, exiting with mode %s", model_id)
    return model_id

### Below methods are taken from chat lambda and few changes are made to support this requirement
### Methods that are taken from chat lambda are
### a) format_ai_message
### b) create_new_session
### c) post_query_to_model
def format_ai_message(message):
    """
    This function is to format ai message
    :param message
    """
    LOGGER.info("In embeddedChatbots.format_ai_message, starting method")
    message = message.lstrip("AI:")
    message = message.lstrip("Answer:")
    message = message.strip()
    return message


def get_session_details(session_id, chatbot_id):
    """
    Method used to fetch session details from chat history table and compose object required for session
    :param session_id: session for which details are to be returned
    :param chatbot_id: chatbot for which session details are asked
    """
    LOGGER.info("In embeddedChatbots.get_session_details method")
    # Fetch chat history from table
    chatbot_history = get_chat_history(session_id, chatbot_id)
    session_history = [
            {
                "MessageId": a_message["MessageId"],
                "MessageTime": a_message["MessageTime"],
                "Data": a_message["Data"],
                "Type": a_message["Type"]
            }
            for a_message in chatbot_history
    ]
    session_details = {
        "SessionId": session_id,
        "UserId": chatbot_id,
        "History": session_history
    }
    LOGGER.info("In embeddedChatbots.get_session_details method, exiting")
    return session_details

def raise_model_access_exception():
    """This method raises the model access exception"""
    LOGGER.error("In embeddedChatbots.post_query_to_model, model is not enabled or is unavailable")
    ec_ge_1034 = errorUtil.get_error_object("GE-1034")
    ec_ge_1034['Message'] = "Model is not enabled yet, or is unavailable. Please try again later."
    raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

# pylint: disable=too-many-locals
def post_query_to_model(event_body, chatbot_id, session_id, connection_id):
    """
    This function is to post query to model
    :param event
    """
    LOGGER.info("In embeddedChatbots.post_query_to_model with event - %s", event_body)
    bedrock_runtime_client = boto3.client("bedrock-runtime", AWS_REGION)
    s3_resource = boto3.resource('s3', AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    ssm_client = boto3.client("ssm", AWS_REGION)

    commonUtil.validate_event_body(event_body, CHATBOT_SEND_MESSAGE_REQUIRED_KEYS)

    session_details = get_session_details(session_id, chatbot_id)
    chatbot_details = get_chatbot_details_from_db(chatbot_id)
    model_id = chatbot_details.get("Model")
    message_id = event_body["MessageId"]
    workspace_id = chatbot_details.get("Workspace")
    message = event_body.get("UserInput", "").strip()
    advanced_config = event_body.get("AdvancedConfig", {})

    if not message:
        LOGGER.error("In embeddedChatbots.post_query_to_model, message is empty")
        ec_ipv_1004 = errorUtil.get_error_object("IPV-1004")
        ec_ipv_1004['Message'] = "The parameter UserMessage cannot be empty"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1004)
    # validate user message length
    if len(message) > bedrockUtil.INPUT_MESSAGE_SIZE_LIMIT:
        LOGGER.error("In embeddedChatbots.post_query_to_model, UserMessage exceeded max limit")
        ec_ipv_1068 = errorUtil.get_error_object("IPV-1068")
        ec_ipv_1068["Message"] = ec_ipv_1068["Message"].format('UserMessage', bedrockUtil.INPUT_MESSAGE_SIZE_LIMIT)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1068)

    # getting models from dynamodb for now, validate model access when new models are added
    model_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(MODELS_TABLE),
        {
            "ModelId": model_id
        }
    )

    if not model_item:
        LOGGER.error("In embeddedChatbots.post_query_to_model, invalid model id - `%s`", model_id)
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

    if model_item["ModelType"] == "Custom":
        model_item.update({
            "ModelName":  model_item["AdditionalConfiguration"]["ProvisionThroughputConfig"]["ProvisionedModelArn"]
        })

    # validate openai key
    if model_item["ModelProvider"] == commonUtil.OPENAI_MODEL_PROVIDER:
        openai_key = commonUtil.get_openai_key(ssm_client)
        if not openai_key:
            LOGGER.error("In embeddedChatbots.post_query_to_model, Open AI key not set")
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = "Open AI key not set. Please set it before using Open AI models"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        os.environ["OPENAI_API_KEY"] = openai_key

    workspace_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), {"WorkspaceId": workspace_id})

    query_start_time = commonUtil.get_current_time()
    if event_body.get("SaveChatHistory"):
        chat_history = session_details.get("History", event_body.get("History", []))
        human_message_object = {
            "Type": "human",
            "MessageId": message_id,
            "Data": message,
            "MessageTime": query_start_time,
            "ClientId": chatbot_id,
            "SessionId": session_id,
            "ReviewRequired": False,
            "ExpirationTime": int((datetime.now(timezone.utc) + timedelta(days=commonUtil.CHATBOT_SESSION_VALIDITY_IN_DAYS)).strftime('%s'))
        }
        human_message_object = json.loads(json.dumps(human_message_object, cls=commonUtil.DecimalEncoder), parse_float=Decimal)
        dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), human_message_object)
    else:
        chat_history = event_body.get("History", [])

    chat_history = json.loads(json.dumps(chat_history, cls=commonUtil.DecimalEncoder), parse_float=Decimal)


    # submit query to model
    try:
        session_details["History"] = chat_history
        advanced_config.update({
            "Boto3Clients": {
                "LambdaClient": LAMBDA_CLIENT,
                "BedrockRuntimeClient": bedrock_runtime_client,
                "S3Client": s3_resource.meta.client,
                "DynamoDBResource": DYNAMODB_RESOURCE,
                "ApiManagementClient": API_MANAGEMENT_CLIENT
            },
            "IsExternalChatbot": True,
            "DatasetFilesLambda": DATASET_FILES_LAMBDA,
            "SessionsTable": SESSIONS_TABLE,
            "ChatHistoryTable": CHAT_HISTORY_TABLE,
            "WorkspacesDocumentsTable": WORKSPACES_DOCUMENTS_TABLE,
            "ChatbotsTable": CHATBOTS_TABLE,
            "QueryStartTime": query_start_time
        })
        result = bedrockUtil.get_chatbot_response(chatbot_id, connection_id, message_id, model_item, workspace_item, session_details, message, {}, **advanced_config)
        query_end_time = commonUtil.get_current_time()
        response_time = str((datetime.strptime(query_end_time, commonUtil.DATETIME_ISO_FORMAT) - datetime.strptime(query_start_time, commonUtil.DATETIME_ISO_FORMAT)).total_seconds() * 1000)
        if event_body.get("SaveChatHistory"):
            ai_message_object = {
                "Type": "ai",
                "Data": format_ai_message(result["content"]),
                "MessageId": message_id,
                "Metadata": result["metadata"],
                "MessageTime": query_end_time,
                "ResponseTime": response_time,
                "ClientId": chatbot_id,
                "SessionId": session_id,
                "ReviewRequired": False,
                "ExpirationTime": int((datetime.now(timezone.utc) + timedelta(days=commonUtil.CHATBOT_SESSION_VALIDITY_IN_DAYS)).strftime('%s'))
            }

            ai_message_object = json.loads(json.dumps(ai_message_object, cls=commonUtil.DecimalEncoder), parse_float=Decimal)
            dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), ai_message_object)

        # send final response to user if model is not streamable
        if model_item["IsStreamingEnabled"] == "no":
            WS_KWARGS.update({"LatestMessageId": message_id})
            commonUtil.send_message_to_ws_connection(chatbot_id, session_id, {"AIMessage": format_ai_message(result["content"]), "Metadata": {"IsComplete": True, "MessageId": message_id, "ResponseTime": response_time}}, WS_KWARGS)

        # return metadata
        result["metadata"].update({
            "MessageId": message_id,
            "IsComplete": True,
            "ResponseTime": response_time
        })
        return result["metadata"]
    except Exception as ex:
        LOGGER.error("In embeddedChatbots.post_query_to_model, query failed with error - %s", str(ex))
        query_end_time = commonUtil.get_current_time()
        response_time = str((datetime.strptime(query_end_time, commonUtil.DATETIME_ISO_FORMAT) - datetime.strptime(query_start_time, commonUtil.DATETIME_ISO_FORMAT)).total_seconds() * 1000)
        ai_message = bedrockUtil.FILE_TOO_BIG_MESSAGE if str(ex) == bedrockUtil.FILE_TOO_BIG_MESSAGE else bedrockUtil.CHAT_QUERY_FAILED_MESSAGE
        if event_body.get("SaveChatHistory"):
            ai_message_object = {
                "Type": "ai",
                "Data": ai_message,
                "MessageId": message_id,
                "Metadata": "N/A",
                "MessageTime": query_end_time,
                "ResponseTime": response_time,
                "ClientId": chatbot_id,
                "SessionId": session_id,
                "ReviewRequired": False,
                "ExpirationTime": int((datetime.now(timezone.utc) + timedelta(days=commonUtil.CHATBOT_SESSION_VALIDITY_IN_DAYS)).strftime('%s'))
            }
            ai_message_object = json.loads(json.dumps(ai_message_object, cls=commonUtil.DecimalEncoder), parse_float=Decimal)
            dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), ai_message_object)

        WS_KWARGS.update({"LatestMessageId": message_id})
        commonUtil.send_message_to_ws_connection(chatbot_id, session_id, {"AIMessage": ai_message, "Metadata": {"IsComplete": True, "MessageId": message_id, "ResponseTime": response_time}}, WS_KWARGS)

        # return metadata
        return {"IsComplete": True, "MessageId": message_id, "ResponseTime": response_time}


def get_chat_history(session_id, chatbot_id):
    """
    Method used to fetch session details give session id
    :param session_id: session id for which details are to be retrieved
    """
    LOGGER.info("In embeddedChatbots.get_chat_history method, with session id %s and chatbot id %s", session_id, chatbot_id)
    chat_history_details = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE),
        CHAT_HISTORY_CLIENTID_INDEX,
        Key("ClientId").eq(chatbot_id), None,
        Attr("SessionId").eq(session_id)
    )
    # sort the retrieved messages
    if chat_history_details:
        chat_history_details = sorted(chat_history_details, key=lambda x: x["MessageTime"], reverse=False)
    LOGGER.info("In embeddedChatbots.get_chat_history method, exiting")
    return chat_history_details

def get_session_history(session_id, chatbot_id):
    """
    Method used to retrieve session details given session id,
    Details include chathistory in the session
    """
    LOGGER.info("In embeddedChatbots.get_session_history method with session id %s", session_id)
    get_chatbot_details_from_db(chatbot_id)
    chatbot_history = get_chat_history(session_id, chatbot_id)
    session_history = {
        "SessionId": session_id,
        "History": [
            {
                "MessageId": a_message["MessageId"],
                "MessageTime": a_message["MessageTime"],
                "Message": a_message["Data"],
                "Type": a_message["Type"]
            }
            for a_message in chatbot_history]
    }
    response = commonUtil.build_get_response(200, session_history)
    LOGGER.info("In embeddedChatbots.get_session_history method")
    return response

def flag_message(chatbot_id, session_id, message_id, event_body):
    """
    Method used to flag the message requested by user
    """
    LOGGER.info("In embeddedChatbots.flag_message method, with chatbot id %s, session id %s, message id %s, event body is %s", chatbot_id, session_id, message_id, event_body)
    get_chatbot_details_from_db(chatbot_id)
    message_time = event_body["MessageTime"]
    message = event_body["Message"]
    flag = event_body["Flag"]
    update_expression = "SET ReviewRequired = :flag, ReviewMessage = :message"
    expression_attribute_values = {":flag": flag, ":message": message, ":message_id": message_id}
    condition_expression = "MessageId = :message_id"
    update_response = dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE),
        {"SessionId": session_id, "MessageTime": message_time},
        update_expression, expression_attribute_values, None, condition_expression
    )
    if update_response == "condition-error":
        LOGGER.error("In embeddedChatbots.flag_message, failed to update chat history table, with response %s", update_response)
        return commonUtil.build_get_response(400, {"Message": f"failed to flag message, message_id {message_id} at {message_time} is not part of session {session_id}"})
    elif update_response != "success":
        LOGGER.error("In embeddedChatbots.flag_message, failed to update chat history table with response %s", update_response)
        ec_db_1001 = errorUtil.get_error_object("DB-1001")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)
    LOGGER.info("In embeddedChatbots.flag_message method, exiting")
    return commonUtil.build_get_response(200, {"Message": "Message flagged"})

def lambda_handler(event, context):
    """
    This Lambda function is to handle embedded chatbot related API calls
    :param event: event information
    :type event: dict
    :param context: runtime information to the handler.
    :type context: LambdaContext
    :return: response to the api
    :rtype: dict
    """
    # if the lambda times out, the sessions table is updated with QueryStatus as failed
    with LambdaTimer(int((context.get_remaining_time_in_millis() / 1000) - 10), event, context):
        try:
            EVENT_INFO["eventIdentifier"] = context.aws_request_id
            errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
            LOGGER.info("In embeddedChatbots.lambda_handler, event - %s", event)
            if event["requestContext"]["domainName"] == WEBSOCKET_ENDPOINT:
                LOGGER.info("In chat.lambda_handler, request is from WebSocket API")
                connection_id = event['requestContext']['connectionId']
                LOGGER.info("In chat.lambda_handler, connection_id - %s", connection_id)

                if event['requestContext']['routeKey'] == "$connect":
                    if not event.get("queryStringParameters") or not event["queryStringParameters"].get("session-id"):
                        LOGGER.error("In chat.lambda_handler method, session id missing in query string parameters")
                        ec_ipv_1052 = errorUtil.get_error_object("IPV-1052")
                        ec_ipv_1052['Message'] = ec_ipv_1052['Message'].format("session-id")

                    session_id = event["queryStringParameters"]["session-id"]
                    chatbot_id = event["queryStringParameters"]["chatbot-id"]
                    LOGGER.info("In chat.lambda_handler, action is connect")
                    session_item = dynamodbUtil.get_item_with_key(
                        DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                        {
                            "UserId": chatbot_id,
                            "SessionId": session_id
                        }
                    )
                    # if session is new, create entry in Sessions Table. session validity is set to 7 days(CHATBOT_SESSION_VALIDITY_IN_DAYS)
                    if not session_item:
                        session_details = {
                            "UserId": chatbot_id,
                            "SessionId": session_id,
                            "ConnectionId": connection_id,
                            "ConnectionStartTime": commonUtil.get_current_time(),
                            "ClientId": f"chatbot-{chatbot_id}",
                            "StartTime": commonUtil.get_current_time(),
                            "Title": "New Session",
                            "LastModifiedTime": commonUtil.get_current_time(),
                            "ExpirationTime": int((datetime.now(timezone.utc) + timedelta(days = commonUtil.CHATBOT_SESSION_VALIDITY_IN_DAYS)).strftime('%s'))
                        }
                        put_status = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(SESSIONS_TABLE), session_details)
                        if put_status == "error":
                            LOGGER.error("In chat.create_new_session, failed to create session item in dynamodb, please check for errors.")
                            ec_db_1001 = errorUtil.get_error_object("DB-1001")
                            raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)
                    else:
                        update_expression = "SET ConnectionId = :connection_id, LastModifiedTime = :last_modified_time, ConnectionStartTime = :last_modified_time REMOVE ConnectionEndTime"
                        expression_attributes = {":connection_id": connection_id, ":last_modified_time": commonUtil.get_current_time()}
                        dynamodbUtil.update_item_by_key(
                            DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                            {"UserId": chatbot_id, "SessionId": session_id},
                            update_expression,
                            expression_attributes
                        )
                    response = {
                        'statusCode': 200,
                        'body': json.dumps({"ConnectionId": connection_id})
                    }
                elif event['requestContext']['routeKey'] == "sendmessage":
                    LOGGER.info("In chat.lambda_handler, action is send message")
                    event_body = json.loads(event.get('body')) if event.get('body', None) else {}
                    chatbot_id = event_body["ChatbotId"]
                    session_id = event_body["SessionId"]
                    # update message delivery status to pending in sessions table
                    commonUtil.update_message_delivery_status(chatbot_id, session_id, commonUtil.CHAT_MESSAGE_DELIVERY_PENDING, WS_KWARGS)
                    # post query to model
                    try:
                        chat_response_metadata = post_query_to_model(event_body, chatbot_id, session_id, connection_id)
                        WS_KWARGS.update({"LatestMessageId": chat_response_metadata["MessageId"]})
                        # send metadata to client
                        commonUtil.send_message_to_ws_connection(chatbot_id, session_id, {"Metadata": chat_response_metadata}, WS_KWARGS)
                    except Exception as ex:
                        LOGGER.error("In embeddedChatbots.lambda_handler, user query failed due to error - %s", str(ex))
                        commonUtil.send_message_to_ws_connection(chatbot_id, session_id, {"AIMessage": str(ex), "Metadata": {"IsComplete": True}}, WS_KWARGS)
                    response = {
                        'statusCode': 200,
                        'body': json.dumps({"Message": "Message sent"})
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
                http_method = event['requestContext']['httpMethod']
                api_resource = event['resource']
                LOGGER.info("In embeddedChatbots.lambda_handler, http_method - %s, api_resource - %s", http_method, api_resource)

                if api_resource == "/embedded/chatbot/{id}" and http_method == "GET":
                    LOGGER.info("In embeddedChatbots.lambda_handler, request to fetch chatbot config for chatbot with id %s", event['pathParameters']['id'])
                    chatbot_id = event['pathParameters']['id']
                    response = get_chatbot_config(chatbot_id)
                elif api_resource == "/embedded/chatbot/{id}/sessions/{session_id}" and http_method == "GET":
                    chatbot_id = event['pathParameters']['id']
                    session_id = event['pathParameters']['session_id']
                    LOGGER.info("In embeddedChatbots.lambda_handler method, request to get session details with session id %s", session_id)
                    response = get_session_history(session_id, chatbot_id)
                elif api_resource == "/embedded/chatbot/{id}/sessions/{session_id}/messages/{message_id}" and http_method == "POST":
                    chatbot_id = event['pathParameters']['id']
                    session_id = event['pathParameters']['session_id']
                    message_id = event['pathParameters']['message_id']
                    LOGGER.info("In embeddedChatbots.lamdba_handler method, user has requested to flag message with id %s", message_id)
                    event_body = json.loads(event.get('body')) if event.get('body', None) else '{}'
                    response = flag_message(chatbot_id, session_id, message_id, event_body)
                else:
                    LOGGER.error("In embeddedChatbots.lambda_handler, invalid api call - %s %s", http_method, api_resource)
                    ec_ge_1010 = errorUtil.get_error_object("GE-1010")
                    ec_ge_1010['Message'] = ec_ge_1010['Message'].format(http_method, api_resource)
                    raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1010)
        except errorUtil.InvalidUserException as iue:
            LOGGER.error("In embeddedChatbots.lambda_handler, InvalidUserException occurred with error %s", iue)
            response = commonUtil.build_post_response(400, {'Message': str(iue)})
        except errorUtil.InvalidInputException as iie:
            LOGGER.error("In embeddedChatbots.lambda_handler, InvalidInputException occurred with error %s", iie)
            response = commonUtil.build_post_response(400, {'Message': str(iie)})
        except errorUtil.GenericFailureException as gfe:
            LOGGER.error("In embeddedChatbots.lambda_handler, GenericFailureException occurred with error %s", gfe)
            response = commonUtil.build_post_response(500, {'Message': str(gfe)})
        except Exception as exc:
            LOGGER.error("In embeddedChatbots.lambda_handler, Exception occurred with error %s", exc)
            response = commonUtil.build_generic_response(500, {"Message": str(exc)})
    return response
