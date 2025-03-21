"""
Lambda used to perform API operations for chatbots
"""
import os
import sys
import json
import uuid
import logging
import boto3
from boto3.dynamodb.conditions import Key

import commonUtil
import dynamodbUtil
import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading Function - %s", "chatbot.py")

try:
    LOGGER.info("In chatbot.py, Loading environment variables...")
    AWS_REGION = os.environ['awsRegion']
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    CHATBOTS_TABLE = dynamodbUtil.CHATBOTS_TABLE
    CHATBOTS_TABLE_CHATBOTNAME_INDEX = dynamodbUtil.CHATBOTS_TABLE_CHATBOTNAME_INDEX
    GROUPS_TABLE = dynamodbUtil.GROUPS_TABLE
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
    MODELS_TABLE = dynamodbUtil.MODELS_TABLE
    EVENT_INFO = {}
except Exception as ex:
    LOGGER.error("In chatbots.py, Failed to load environment variables. error: %s", str(ex))
    sys.exit()

def list_chatbots(user_item, query_params):
    """
    This function is to get chatbots
    :param user_item: User metdata to valdiate user permissions on the bots
    :param query_params: Consists of config values used to refactor response based on request
    :return: list of chatbots
    """
    LOGGER.info("In chatbots.list_chatbots, User %s requested to get chatbots", user_item["UserId"])
    commonUtil.is_user_action_valid(user_item, "ChatbotId", None, CHATBOTS_TABLE, GROUPS_TABLE, "read")

    owner_chatbots_id_list, reviewer_chatbots_id_list = commonUtil.get_user_accessible_resources(user_item, GROUPS_TABLE, CHATBOTS_TABLE, "chatbots")
    db_chatbots_key_list = [{"ChatbotId":a_chatbot_id} for a_chatbot_id in set(owner_chatbots_id_list + reviewer_chatbots_id_list)]
    projection_expression = "ChatbotName, ChatbotId, Endpoint, Description, CreatedBy, CreationTime, LastModifiedBy, LastModifiedTime, Keywords, AccessType, Workspace"

    kwargs = {
        "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
        "items_limit": int(query_params.get('limit')) if query_params and 'limit' in query_params else 100,
        "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
        "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
    }
    if kwargs['items_limit'] > 1000:
        LOGGER.error("In chatbots.list_chatbots method, user requested a limit which is more than 1000")
        ec_ge_1028 = errorUtil.get_error_object("GE-1028")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)

    chatbot_items = dynamodbUtil.batch_get_items(
        DYNAMODB_RESOURCE, CHATBOTS_TABLE,
        db_chatbots_key_list, projection_expression
    )

    # replacing workspace id with name in the GET response
    for chatbot_item in chatbot_items:
        chatbot_item["Workspace"] = dynamodbUtil.get_item_with_key(
            DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE),
            {"WorkspaceId": chatbot_item["Workspace"]}
        )["WorkspaceName"]

    for chatbot_item in chatbot_items:
        if chatbot_item["ChatbotId"] in owner_chatbots_id_list:
            chatbot_item["AccessType"] = "owner"
        else:
            chatbot_item["AccessType"] = "reviewer"
    # Sort and pagination
    kwargs['dict_key'] = "Chatbots"
    kwargs['input_items'] = {'Chatbots': chatbot_items}
    chatbots_dict = commonUtil.sort_page_in_code(**kwargs)
    return commonUtil.build_get_response(200, chatbots_dict)

def validate_chatbot_body(user_item, event_body, operation):
    """
    Method that reads the input body, valdiates the content recieved and returns required input
    :param user_item: User details/metadata
    :param event_body: Input body recieved from API request
    :param operation: Value is either create or update. Based on operation validation of input changes
    :return validated body is returned
    """
    LOGGER.info("In chatbots.validate_chatbot_body method")
    create_keys = ["ChatbotName", "Description", "Keywords", "Workspace", "Model", "EmbeddedConfig", "KeepActive", "Instructions", "EnableRedaction"]
    update_keys = ["Description", "Keywords", "Workspace", "Model", "EmbeddedConfig", "KeepActive", "Instructions", "EnableRedaction"]
    if operation == "create":
        missing_keys = [a_key for a_key in create_keys if a_key not in event_body]
    else:
        missing_keys = [a_key for a_key in update_keys if a_key not in event_body]
    if missing_keys:
        LOGGER.error("In chatbots.validate_chatbot_body, missing keys in input body are %s", ", ".join(missing_keys))
        errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1008", None, ", ".join(missing_keys))

    for a_key in create_keys if operation == "create" else update_keys:
        if a_key == "KeepActive" and not isinstance(event_body["KeepActive"], bool):
            LOGGER.error("In chatbots.validate_chatbot_body, KeepActive input received is %s", event_body["KeepActive"])
            errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1004", None, "KeepActive; value should be boolean")

        if a_key == "Keywords" and not isinstance(event_body["Keywords"], list):
            LOGGER.error("In chatbots.validate_chatbot_body, Keywords input received is %s", event_body["Keywords"])
            errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1004", None, "Keywords; value should be list of strings")

        if a_key == "EmbeddedConfig" and not isinstance(event_body["EmbeddedConfig"], dict):
            LOGGER.error("In chatbots.validate_chatbot_body, EmbeddedConfig input received is %s", event_body["EmbeddedConfig"])
            errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1004", None, "EmbeddedConfig; value should be dict")

        if a_key not in ["Keywords", "EmbeddedConfig", "KeepActive", "EnableRedaction"] and not isinstance(event_body[a_key], str):
            LOGGER.error("In chatbots.validate_chatbot_body, %s input received is %s", a_key, event_body[a_key])
            errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1004", None, f"{a_key}; value should be string")
    # Validate input workspace
    workspace_id = event_body["Workspace"]
    model_id = event_body["Model"]
    # Validate user access to workspace (Atleast read access is required)
    commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")
    commonUtil.is_user_action_valid(user_item, "ModelId", model_id, MODELS_TABLE, GROUPS_TABLE, "read")

    if operation == "create":
        required_body = {a_key: event_body[a_key] for a_key in create_keys}
    else:
        required_body = {a_key: event_body[a_key] for a_key in update_keys}
    LOGGER.info("In chatbots.validate_chatbot_body method, exit")
    return required_body


def create_chatbot(input_body, user_item):
    """
    This function is to create new chatbot
    :param input_body: Event body received by API
    :param user_item: Requested User details/metadata for validation
    :return: API response
    """
    LOGGER.info("In chatbots.create_chatbot method")
    commonUtil.is_user_action_valid(user_item, "ChatbotId", None, CHATBOTS_TABLE, GROUPS_TABLE, "create")
    commonUtil.validate_amorphic_integration_status(user_item["UserId"])
    # so that UI doesn't break
    input_body["Instructions"] = input_body.get("Instructions", "")
    input_body["EnableRedaction"] = input_body.get("EnableRedaction", False)
    required_body = validate_chatbot_body(user_item, input_body, "create")
    # Check if a bot exists with same name
    chatbot_names = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE),
        CHATBOTS_TABLE_CHATBOTNAME_INDEX,
        Key("ChatbotName").eq(input_body["ChatbotName"])
    )
    if chatbot_names:
        LOGGER.error("In chatbots.create_chatbot method, response of chatbot with name %s are %s", input_body["ChatbotName"], chatbot_names)
        ec_ge_1009 = errorUtil.get_error_object("GE-1009")
        ec_ge_1009['Message'] = ec_ge_1009['Message'].format(f"chatbot with name {input_body['ChatbotName']}")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1009)
    chatbot_id = str(uuid.uuid4())
    # Create chatbot resources
    required_body.update({
        "ChatbotId": chatbot_id
    })
    # Add item to dynamodb
    current_time = commonUtil.get_current_time()
    chatbot_details = {
        "ChatbotId": chatbot_id,
        "ChatbotName": required_body["ChatbotName"],
        "Description": required_body["Description"],
        "Keywords": required_body["Keywords"],
        "CreatedBy": user_item["UserId"],
        "LastModifiedBy": user_item["UserId"],
        "CreationTime": current_time,
        "LastModifiedTime":current_time,
        "Workspace": required_body["Workspace"],
        "Model": required_body["Model"],
        "EmbeddedConfig": required_body["EmbeddedConfig"],
        "KeepActive": required_body["KeepActive"],
        "Instructions": required_body.get("Instructions", ""),
        "EnableRedaction": required_body.get("EnableRedaction", False)
    }
    put_response = dynamodbUtil.put_item(
        DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE),
        chatbot_details
    )
    if put_response != "success":
        LOGGER.error("In chatbots.create_chatbot method, failed to update dynamodb with response %s", put_response)
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("Chatbots")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1020)
    # Authorization would be same as workspaces, Hence nothing changes here
    response = commonUtil.build_post_response(200, {"Message": "Chatbot created successfully", "ChatbotId": chatbot_id})
    LOGGER.info("In chatbots.create_chatbot method, exiting")
    return response


def get_chatbot_details(user_item, chatbot_id):
    """
    This method is used to fetch chatbot details given chatbot id
    :param user_item: user details to validate whether user has access to said chatbot
    :param chatbot_id: unique id of the chatbot for which details are to be retrieved
    """
    LOGGER.info("In chatbots.get_chatbot_details method")
    # chatbot_item, permission = commonUtil.is_user_action_valid(user_item, "ChatbotId", chatbot_id, CHATBOTS_TABLE, GROUPS_TABLE, "read")
    #Fetch chatbot details to obtain the workspace id
    chatbot_details = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE), {"ChatbotId": chatbot_id})
    if not chatbot_details:
        LOGGER.error("In chatbots.get_chatbot_details method, chatbot details retrived are %s for chatbot id %s", chatbot_details, chatbot_id)
        ec_ge_1046 = errorUtil.get_error_object("GE-1046")
        ec_ge_1046['Message'] = ec_ge_1046['Message'].format("Chatbot", chatbot_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1046)
    workspace_id = chatbot_details["Workspace"]
    _, permission = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")
    chatbot_details.update({
        "AccessType": permission
    })

    # replacing workspace id with name in the GET response
    chatbot_details["Workspace"] = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE),
        {"WorkspaceId": chatbot_details["Workspace"]}
    )["WorkspaceName"]

    # replacing model id with name in the GET response
    chatbot_details["Model"] = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(MODELS_TABLE),
        {"ModelId": chatbot_details["Model"]}
    )["ModelName"]

    response = commonUtil.build_get_response(200, chatbot_details)
    LOGGER.info("In chatbots.get_chatbot_details method, exiting")
    return response

def update_chatbot(user_item, chatbot_id, input_body):
    """
    This method is used to update chatbot given chatbot details in body
    :param user_item: user details to validate whether user has update(owner) access to said chatbot
    :param chatbot_id: unique id of the chatbot for which update is requested
    :param input_body: Consists of details that are to be udpated to the chatbot
    """
    LOGGER.info("In chatbots.update_chatbot method")
    # chatbot_details, _ = commonUtil.is_user_action_valid(user_item, "ChatbotId", chatbot_id, CHATBOTS_TABLE, GROUPS_TABLE, "update")
    # Check if chatbot with given id exists
    chatbot_details = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE), {"ChatbotId": chatbot_id})
    if not chatbot_details:
        LOGGER.error("In chatbots.update_chatbot method, chatbot details retrieved are %s", chatbot_details)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("chatbot_id", chatbot_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    # so that UI doesn't break
    input_body["Instructions"] = input_body.get("Instructions", chatbot_details.get("Instructions", ""))
    input_body["EnableRedaction"] = input_body.get("EnableRedaction", chatbot_details.get("EnableRedaction", False))
    # Validate the input body
    required_body = validate_chatbot_body(user_item, input_body, "update")
    # Update workspace for chatbot if the chatbot request has change in workspace
    # if input_body["Workspace"] != chatbot_details["Workspace"]:
    #     LOGGER.info("In chatbots.update_chatbot method, user has requested to change workspace from %s to %s", chatbot_details["Workspace"], input_body["Workspace"])
    input_body.update({
        "ChatbotName": chatbot_details["ChatbotName"],
        "ChatbotId": chatbot_id
    })
    # Update dynamodb table with changed details
    key_condition_expression = {"ChatbotId": chatbot_id}
    update_expression = "SET LastModifiedTime = :val1, LastModifiedBy = :val2, Description = :val3, Workspace = :val4, Keywords = :val5, Model = :val6, EmbeddedConfig = :val7, KeepActive = :val8, Instructions = :val9, EnableRedaction = :val10"
    expression_attributes = {
        ":val1": commonUtil.get_current_time(),
        ":val2": user_item["UserId"],
        ":val3": required_body["Description"],
        ":val4": required_body["Workspace"],
        ":val5": required_body["Keywords"],
        ":val6": required_body["Model"],
        ":val7": required_body["EmbeddedConfig"],
        ":val8": required_body["KeepActive"],
        ":val9": required_body.get("Instructions", chatbot_details.get("Instructions", "")),
        ":val10": required_body.get("EnableRedaction", chatbot_details.get("EnableRedaction", False))
    }
    update_status = dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE), key_condition_expression,
        update_expression, expression_attributes
    )
    if update_status != "success":
        LOGGER.error("In chatbots.update_chatbot method, failed to update dynamodb with response %s", update_status)
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("Chatbots")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1020)

    response = commonUtil.build_put_response(200, {"Message": "Successfully updated chatbot",  "ChatbotId": chatbot_id})
    LOGGER.info("In chatbots.update_chatbot method, exiting")
    return response

def delete_chatbot(user_item, chatbot_id):
    """
    This method is used to delete chatbot given chatbot id
    :param user_item: user details to validate whether user has delete (owner) access to said chatbot
    :param chatbot_id: unique id of the chatbot to be deleted on the request of user
    """
    LOGGER.info("In chatbots.delete_chatbot method")
    # chatbot_item, _ = commonUtil.is_user_action_valid(user_item, "ChatbotId", chatbot_id, CHATBOTS_TABLE, GROUPS_TABLE, "delete")
    # Fetch chatbot details
    chatbot_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE), {"ChatbotId": chatbot_id})
    if not chatbot_item:
        LOGGER.error("In chatbots.delete_chatbot method, chatbot item retrieved for chatbot id %s is %s", chatbot_id, chatbot_item)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("chatbot_id", chatbot_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    workspace_id = chatbot_item["Workspace"]
    commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "delete")
    # Delete resources
    delete_response = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE),
        {"ChatbotId": chatbot_id}
    )
    if delete_response != "success":
        LOGGER.error("In chatbots.delete_chatbot method, failed to delete item from chatbots table with response %s", delete_response)
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("Chatbots")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

    response = commonUtil.build_delete_response(200, {"Message": "Successfully deleted chatbot", "ChatbotId": chatbot_id})
    LOGGER.info("In chatbots.delete_chatbot method, exiting")
    return response

def lambda_handler(event, context):
    """
    This Lambda function is to handle chatbot related API calls
    :param event: event information
    :type event: dict
    :param context: runtime information to the handler.
    :type context: LambdaContext
    :return: response to the api
    :rtype: dict
    """
    try:
        event = commonUtil.RedactAuthTokensClass(event)
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
        LOGGER.info("In chatbots.lambda_handler, event - %s", event)
        http_method = event['requestContext']['httpMethod']
        api_resource = event['resource']
        query_params = event["queryStringParameters"] if event.get("queryStringParameters", {}) else {}
        LOGGER.info("In chatbots.lambda_handler, http_method - %s, api_resource - %s", http_method, api_resource)

        auth_token = event['headers']['Authorization']
        claims = commonUtil.get_claims(auth_token)
        user_id = claims['cognito:username']
        user_item = commonUtil.is_valid_user(user_id)
        if api_resource == "/chatbots" and http_method == "GET":
            LOGGER.info("In chatbots.lambda_handler, user %s has requested to list chatbots", user_id)
            response = list_chatbots(user_item, query_params)
        elif api_resource == "/chatbots" and http_method == "POST":
            LOGGER.info("In chatbots.lambda_handler method, user %s has requested to create chatbot", user_id)
            event_body = json.loads(event.get('body')) if event.get('body', None) else '{}'
            response = create_chatbot(event_body, user_item)
        elif api_resource == "/chatbots/{id}" and http_method == "GET":
            chatbot_id = event['pathParameters']['id']
            LOGGER.info("In chatbots.lambda_handler method, user %s has requested to get chatbot details with chatbot id %s", user_id, chatbot_id)
            response = get_chatbot_details(user_item, chatbot_id)
        elif api_resource == "/chatbots/{id}" and http_method == "PUT":
            chatbot_id = event['pathParameters']['id']
            LOGGER.info("In chatbos.lamdba_handler method, user %s has requested to update the chatbot with id %s", user_id, chatbot_id)
            event_body = json.loads(event.get('body')) if event.get('body', None) else '{}'
            response = update_chatbot(user_item, chatbot_id, event_body)
        elif api_resource == "/chatbots/{id}" and http_method == "DELETE":
            chatbot_id = event['pathParameters']['id']
            LOGGER.info("In chatbots.lamdba_handler method, user %s has requested to delete chatbot with id %s", user_id, chatbot_id)
            response = delete_chatbot(user_item, chatbot_id)
        else:
            LOGGER.error("In chatbots.lambda_handler, invalid api call - %s %s", http_method, api_resource)
            ec_ge_1010 = errorUtil.get_error_object("GE-1010")
            ec_ge_1010['Message'] = ec_ge_1010['Message'].format(http_method, api_resource)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1010)
    except errorUtil.InvalidUserException as iue:
        LOGGER.error("In chatbots.lambda_handler, InvalidUserException occurred with error %s", iue)
        response = commonUtil.build_post_response(400, {'Message': str(iue)})
    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In chatbots.lambda_handler, InvalidInputException occurred with error %s", iie)
        response = commonUtil.build_post_response(400, {'Message': str(iie)})
    except errorUtil.GenericFailureException as gfe:
        LOGGER.error("In chatbots.lambda_handler, GenericFailureException occurred with error %s", gfe)
        response = commonUtil.build_post_response(500, {'Message': str(gfe)})
    except Exception as exc:
        LOGGER.error("In chatbots.lambda_handler, Exception occurred with error %s", exc)
        response = commonUtil.build_generic_response(500, {"Message": str(exc)})
    return response
