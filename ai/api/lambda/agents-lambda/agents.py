"""
This lambda is for agents.
Agents can help the user complete actions based on their data and user input.
They can invoke APIs based on the user input to perform the required action.
"""
import os
import sys
import json
import uuid
import time
import signal
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import logging
import boto3
from boto3.dynamodb.conditions import Key

import commonUtil
import errorUtil
import dynamodbUtil
import agentsLibraries
import agentsActionGroups

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

try:
    LOGGER.info("In agents.py, Loading environment variables")
    AWS_REGION = os.environ['awsRegion']
    ENVIRONMENT = os.environ['environment']
    AGENTS_IAM_ROLE_ARN = os.environ['agentsRoleArn']
    ENVIRONMENT = os.environ['environment']
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    BEDROCK_KMS_KEY_ARN = os.environ['BedrockKMSKeyArn']

    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    AGENTS_TABLE = dynamodbUtil.AGENTS_TABLE
    AGENTS_ACTION_GROUPS_TABLE = dynamodbUtil.AGENTS_ACTION_GROUPS_TABLE
    AGENTS_LIBRARIES_TABLE = dynamodbUtil.AGENTS_LIBRARIES_TABLE
    CHAT_HISTORY_TABLE = dynamodbUtil.CHAT_HISTORY_TABLE
    GROUPS_TABLE = dynamodbUtil.GROUPS_TABLE
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
    CHAT_HISTORY_TABLE_SESSIONID_MESSAGEID_INDEX = dynamodbUtil.CHAT_HISTORY_TABLE_SESSIONID_MESSAGEID_INDEX
    SESSIONS_TABLE = dynamodbUtil.SESSIONS_TABLE
    USERS_TABLE = dynamodbUtil.USERS_TABLE
    SESSIONS_TABLE_SESSIONID_INDEX = dynamodbUtil.SESSIONS_TABLE_SESSIONID_INDEX
    SESSIONS_TABLE_CONNECTIONID_INDEX = dynamodbUtil.SESSIONS_TABLE_CONNECTIONID_INDEX
    WEBSOCKET_ENDPOINT = os.environ["webSocketAPIEndpoint"].replace('wss://', '')
    API_ENDPOINT_URL = f"https://{WEBSOCKET_ENDPOINT}/{ENVIRONMENT}"
    API_MANAGEMENT_CLIENT = boto3.client('apigatewaymanagementapi', region_name=AWS_REGION,
                          endpoint_url=API_ENDPOINT_URL)

    BEDROCK_AGENTS_CLIENT = boto3.client('bedrock-agent', AWS_REGION)
    BEDROCK_AGENTS_RUNTIME_CLIENT = boto3.client('bedrock-agent-runtime', AWS_REGION)
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)
    AGENT_SEND_MESSAGE_REQUIRED_KEYS = ["AgentId", "SessionId", "MessageId", "UserMessage"]
    WS_KWARGS = {"ApiManagementClient": API_MANAGEMENT_CLIENT, "DynamoDBResource": DYNAMODB_RESOURCE, "SessionsTable": SESSIONS_TABLE, "SessionsTableConnectionIdIndex": SESSIONS_TABLE_CONNECTIONID_INDEX}
    EVENT_INFO = {}

except Exception as ex:
    LOGGER.error("In agents.py, Failed to load environment variables. error: %s", str(ex))
    sys.exit()

AGENT_REQUIRED_KEYS = ['AgentName', 'BaseModel', 'Instruction']
AGENTS_ACTION_GROUPS_LIMIT = 5
# this is also used to store dynamodb ttl for agent sessions
AGENT_IDLE_SESSION_TIMEOUT_IN_MINUTES = 60
AGENT_CREATING_STATUS = 'CREATING'
AGENT_CREATED_STATUS = 'CREATED'
AGENT_NOT_PREPARED_STATUS = 'NOT_PREPARED'
AGENT_PREPARING_STATUS = 'PREPARING'
AGENT_PREPARED_STATUS = 'PREPARED'
AGENT_FAILED_STATUS = 'FAILED'
AGENT_UPDATING_STATUS = 'UPDATING'
AGENT_UPDATED_STATUS = 'UPDATED'

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
            LOGGER.error("In agents.LambdaTimer, Lambda has been timed out for websocket")
            if self.event['requestContext']['routeKey'] == "sendmessage":
                LOGGER.info("In agents.LambdaTimer, failed to process user message within the timeout, updating dynamodb with failure status")
                event_body = json.loads(self.event.get('body')) if self.event.get('body', None) else {}
                session_id = event_body["SessionId"]

                session_item = dynamodbUtil.get_items_by_query_index(
                    DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                    SESSIONS_TABLE_SESSIONID_INDEX,
                    Key("SessionId").eq(session_id)
                )
                user_id = session_item[0]["UserId"]

                # update sessions table with failure status
                update_expression = "SET QueryStatus = :query_status, QueryFailureReason = :query_failure_reason, LastModifiedTime = :last_modified_time"
                expression_attributes = {":query_status": commonUtil.CHAT_QUERY_FAILED, ":query_failure_reason": "Timed out", ":last_modified_time": commonUtil.get_current_time()}

                dynamodbUtil.update_item_by_key(
                    DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                    {"UserId": user_id, "SessionId": session_id},
                    update_expression,
                    expression_attributes
                )


def list_agents(**kwargs):
    """
    This function is to list all agents
    """
    LOGGER.info("In agents.list_agents, starting method")

    projection_expression = "AgentId, AgentName, ReferenceId, Description, BaseModel, AgentStatus, CreatedBy, CreationTime, LastModifiedBy, LastModifiedTime"
    agents_list = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(AGENTS_TABLE),
        projection_expression=projection_expression
    )
    LOGGER.info("In agents.list_agents, response from dynamodb - %s", agents_list)

    # Sort & paginate results if applicable
    LOGGER.info("In agents.list_agents, Sorting & Paginating the results based on the input given")
    kwargs['dict_key'] = 'Agents'
    kwargs['input_items'] = {'Agents': agents_list}
    agents_list = commonUtil.sort_page_in_code(**kwargs)

    LOGGER.info("In agents.list_agents, api response - %s", agents_list)
    return agents_list


def create_agent(event, user_item):
    """
    This function is to create an agent
    """
    LOGGER.info("In agents.create_agent, starting method with event - %s, user_item - %s", event, user_item)
    event_body = json.loads(event['body'])
    agent_name = event_body.get("AgentName", "")
    description = event_body.get("Description", "")
    base_model = event_body.get("BaseModel", "")
    instruction = event_body.get("Instruction", "")
    query_follow_up = event_body.get("QueryFollowUp", "disabled")

    # validate agent input
    if any(key not in event_body for key in AGENT_REQUIRED_KEYS):
        LOGGER.error("In agents.create_agent, Required keys are missing in the request body")
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format(set(AGENT_REQUIRED_KEYS) - set(event_body.keys()))
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)

    if base_model not in commonUtil.AGENT_SUPPORTED_MODELS:
        LOGGER.error("In agents.create_custom_model, agent creation is not supported for base model -%s", base_model)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = f"Agent creations is not supported for base model - {base_model}"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    create_agent_input = {
        "agentName": agent_name,
        "description": description,
        "agentResourceRoleArn": AGENTS_IAM_ROLE_ARN,
        "foundationModel": base_model,
        "instruction": instruction,
        "idleSessionTTLInSeconds":commonUtil.AGENT_IDLE_SESSION_TIMEOUT_IN_SECONDS,
        "customerEncryptionKeyArn": BEDROCK_KMS_KEY_ARN,
        "tags": {
            "Name": agent_name,
            "Environment": ENVIRONMENT,
            "Region": AWS_REGION,
            "ProjectShortName": PROJECT_SHORT_NAME
        }
    }

    try:
        LOGGER.info("In agents.create_agent, bedrock create agent input - %s", create_agent_input)
        create_agent_response = BEDROCK_AGENTS_CLIENT.create_agent(**create_agent_input)
        LOGGER.info("In agents.create_agent, bedrock create agent response - %s", create_agent_response)
    except Exception as ex:
        LOGGER.error("In agents.create_agent, failed to create agent due to error - %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to create agent due to error - {str(ex)}")

    agent_ref_id = create_agent_response["agent"]["agentId"]
    LOGGER.info("In agents.create_agent, created agent with reference id - %s", agent_ref_id)

    agent_status = create_agent_response["agent"]["agentStatus"]
    max_retries = 3
    # Use exponential backoff retry mechanism to wait for agentStatus to become NOT_PREPARED
    agent_status, _ = check_status_using_exponential_backoff(max_retries, agent_status, AGENT_NOT_PREPARED_STATUS, agent_ref_id)

    prepare_agent(None, "create-agent", user_item["UserId"], {"ReferenceId": create_agent_response["agent"]["agentId"]})

    LOGGER.info("In agents.create_agent, creating agent alias")
    try:
        create_alias_response = BEDROCK_AGENTS_CLIENT.create_agent_alias(
                                    agentId=create_agent_response["agent"]["agentId"],
                                    agentAliasName=agent_name
                                )
        LOGGER.info("In agents.create_agent, create alias response - %s", create_alias_response)
    except Exception as ex:
        LOGGER.error("In agents.create_agent, failed to create agent alias due to error - %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to create agent alias due to error - {str(ex)}")

    agent_id = str(uuid.uuid4())
    agent_alias_id = create_alias_response["agentAlias"]["agentAliasId"]
    agent_item = {
        "AgentId": agent_id,
        "AgentName": agent_name,
        "AgentAliasId": agent_alias_id,
        "AgentVersion": "1",
        "ReferenceId": agent_ref_id,
        "AgentArn": create_agent_response["agent"]["agentArn"],
        "QueryFollowUp": query_follow_up,
        "Description": description,
        "BaseModel": base_model,
        "Instruction": instruction,
        "AgentStatus": AGENT_PREPARED_STATUS,
        "Message": "Agent prepared and ready to use",
        "CreatedBy": user_item["UserId"],
        "CreationTime": commonUtil.get_current_time(),
        "LastModifiedBy": user_item["UserId"],
        "LastModifiedTime": commonUtil.get_current_time(),
        "AttachedActionGroups": []
    }

    #create agent item in dynamodb
    dynamo_response = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), agent_item)
    if dynamo_response == "error":
        LOGGER.error("In agents.create_agent, failed to create model item in dynamodb")
        ec_db_1001 = errorUtil.get_error_object("DB-1001")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)

    response = { "Message": "Agent prepared and ready to use", "AgentId": agent_id }
    return commonUtil.build_get_response(200, response)

def get_agent_details(agent_id):
    """
    This function is to get details of an agent
    """
    LOGGER.info("In agents.get_agent_details, starting method with agent_id - %s", agent_id)
    agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {'AgentId': agent_id})

    if not agent_item:
        LOGGER.error("In agents.get_agent_details, invalid agent id - `%s`", agent_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("AgentId", agent_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    agent_item["AttachedActionGroups"] = get_agent_action_groups(agent_id, "ActionGroupId,ActionGroupName,ReferenceId", agent_item)

    non_required_keys = ["AgentVersion", "AgentAliasId"]
    agent_item = commonUtil.remove_keys_from_dictionary(agent_item, non_required_keys)

    return commonUtil.build_get_response(200, agent_item)

def check_status_using_exponential_backoff(max_retries, current_status, required_status, agent_id):
    """
    This function is to check the status of an agent using exponential backoff retry mechanism
    """
    retries = 0
    error_message = None
    LOGGER.info("In agents.check_status_using_exponential_backoff, required status is %s", required_status)
    while retries < max_retries and current_status != required_status:
        LOGGER.info("In agents.check_status_using_exponential_backoff, waiting for agent to be updated, try - %s, current status - %s", retries, current_status)
        retries+=1
        time.sleep(3**retries)
        get_agent_response = BEDROCK_AGENTS_CLIENT.get_agent(agentId=agent_id)["agent"]
        current_status = get_agent_response["agentStatus"]
        if current_status == AGENT_FAILED_STATUS:
            error_message = get_agent_response["failureReasons"][0]
            break

    return current_status, error_message


def update_agent_workspace(event, agent_item, user_id):
    """
    This function is to attach/detach workspaces to an agent
    """
    LOGGER.info("In agents.update_agent_workspace, starting method with event - %s, and agent item - %s", event, agent_item)

    # validating input body
    event_body = json.loads(event['body'])
    if "Workspaces" not in event_body:
        LOGGER.error("In agents.update_agent_workspace, 'Workspaces' missing in input body")
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008["Message"] = ec_ipv_1008["Message"].format('WorkspaceId')
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ipv_1008)
    workspaces_list = event_body['Workspaces']
    # max no.of workspaces allowed is 2 so validating that
    if len(workspaces_list) > 2:
        LOGGER.error("In agents.update_agent_workspace, only maximum of 2 workspaces are allowed.")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Only a maximum of 2 workspaces are allowed to attach to an agent."
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    existing_workspaces = agent_item.get('AttachedWorkspaces', [])
    existing_workspaces_list = [workspace['WorkspaceId'] for workspace in existing_workspaces]
    workspaces_to_attach = list(set(workspaces_list) - set(existing_workspaces_list))
    workspaces_to_detach = list(set(existing_workspaces_list) - set(workspaces_list))
    LOGGER.info("In agents.update_agent_workspace, workspaces to attach - %s", workspaces_to_attach)
    LOGGER.info("In agents.update_agent_workspace, workspaces to detach - %s", workspaces_to_detach)

    try:
        for workspace_id in workspaces_to_detach:
            # validating workspace
            workspace_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), {'WorkspaceId': workspace_id})
            if not workspace_item:
                LOGGER.error("In agents.update_agent_workspace, invalid workspace id - `%s`", workspace_id)
                ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
                ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("WorkspaceId", workspace_id)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
            # checking if workspace is in ACTIVE state, if not then action should not be allowed
            if workspace_item.get("WorkspaceStatus", "") != "ACTIVE":
                LOGGER.error("In agents.update_agent_workspace, workspace not in ACTIVE state.")
                ec_ge_1034 = errorUtil.get_error_object("GE-1034")
                ec_ge_1034["Message"] = "Selected workspace is not in ACTIVE state yet. Please try again later."
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
            LOGGER.info("In agents.update_agent_workspace, detaching workspace - %s from agent - %s", workspace_item["WorkspaceName"], agent_item["AgentName"])
            disassociate_agent_kb_response = BEDROCK_AGENTS_CLIENT.disassociate_agent_knowledge_base(
                agentId=agent_item['ReferenceId'],
                agentVersion='DRAFT',
                knowledgeBaseId=workspace_item["KnowledgeBaseId"]
            )
            LOGGER.info("In agents.update_agent_workspace, disassociate_agent_kb_response - %s", disassociate_agent_kb_response)
            existing_workspaces = [workspace for workspace in existing_workspaces if workspace['WorkspaceId'] != workspace_id]
            # updating metadata
            update_expression = "SET Message = :message, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time, AttachedWorkspaces = :attached_workspaces"
            expression_attributes = {
                ":last_modified_by": user_id,
                ":last_modified_time": commonUtil.get_current_time(),
                ":message": f"Successfully detached workspace {workspace_item['WorkspaceName']} from the agent.",
                ":attached_workspaces": existing_workspaces
            }
            key = {'AgentId': agent_item['AgentId']}
            update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), key, update_expression, expression_attributes)
            if update_response == "error":
                LOGGER.error("In agents.update_agent_workspace, failed to update agent item in dynamodb")
                ec_ge_1020 = errorUtil.get_error_object("GE-1020")
                ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS")
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

        for workspace_id in workspaces_to_attach:
            # validating workspace
            workspace_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), {'WorkspaceId': workspace_id})
            if not workspace_item:
                LOGGER.error("In agents.update_agent_workspace, invalid workspace id - `%s`", workspace_id)
                ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
                ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("WorkspaceId", workspace_id)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
            # checking if workspace is in ACTIVE state, if not then action should not be allowed
            if workspace_item.get("WorkspaceStatus", "") != "ACTIVE":
                LOGGER.error("In agents.update_agent_workspace, workspace not in ACTIVE state.")
                ec_ge_1034 = errorUtil.get_error_object("GE-1034")
                ec_ge_1034["Message"] = "Selected workspace is not in ACTIVE state yet. Please try again later."
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
            LOGGER.info("In agents.update_agent_workspace, attaching workspace - %s to agent - %s", workspace_item["WorkspaceName"], agent_item["AgentName"])
            associate_agent_kb_response = BEDROCK_AGENTS_CLIENT.associate_agent_knowledge_base(
                agentId=agent_item['ReferenceId'],
                agentVersion='DRAFT',
                knowledgeBaseId=workspace_item["KnowledgeBaseId"],
                knowledgeBaseState='ENABLED',
                description=f"Associating knowledge base {workspace_item['WorkspaceName']} with agent"
            )
            LOGGER.info("In agents.update_agent_workspace, associate_agent_kb_response - %s", associate_agent_kb_response)
            existing_workspaces.append({
                'WorkspaceId': workspace_id,
                'WorkspaceName': workspace_item['WorkspaceName'],
            })
            # updating metadata
            update_expression = "SET Message = :message, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time, AttachedWorkspaces = :attached_workspaces"
            expression_attributes = {
                ":last_modified_by": user_id,
                ":last_modified_time": commonUtil.get_current_time(),
                ":message": f"Successfully attached workspace {workspace_item['WorkspaceName']} to the agent.",
                ":attached_workspaces": existing_workspaces
            }
            key = {'AgentId': agent_item['AgentId']}
            update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), key, update_expression, expression_attributes)
            if update_response == "error":
                LOGGER.error("In agents.update_agent_workspace, failed to update agent item in dynamodb")
                ec_ge_1020 = errorUtil.get_error_object("GE-1020")
                ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS")
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

        if workspaces_to_attach or workspaces_to_detach:
            prepare_agent(agent_item['AgentId'], "update-agent-workspace", user_id, agent_item)

        LOGGER.info("In agents.update_agent_workspace, successfully updated workspace - %s", workspace_id)
        return commonUtil.build_put_response(200, {"Message": "Successfully updated agent workspace."})

    except Exception as ex:
        LOGGER.error("In agents.update_agent_workspace, failed to update workspace %s with error - %s", workspace_item['WorkspaceName'], str(ex))
        key = {'AgentId': agent_item['AgentId']}
        expression_attributes.update({
            ":message": "Failed to update workspace(s) for the agent."
        })
        update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), key, update_expression, expression_attributes)
        if update_response == "error":
            LOGGER.error("In agents.update_agent_workspace, failed to update the latest status of agent item in dynamodb")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Failed to update workspace {workspace_item['WorkspaceName']} to agent with error - {str(ex)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)


def prepare_agent(agent_id, action, user_id, agent_item=None):
    """
    This function is to prepare an agent and maintain agent versions
    """
    LOGGER.info("In agents.prepare_agent, starting method with agent id - %s", agent_id)
    if not agent_item and action != "create-agent":
        agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {'AgentId': agent_id})
    LOGGER.info("In agents.prepare_agent, agent item - %s", agent_item)

    LOGGER.info("In agents.prepare_agent, preparing agent")
    try:
        prepare_agent_response = BEDROCK_AGENTS_CLIENT.prepare_agent(agentId=agent_item["ReferenceId"])
        LOGGER.info("In agents.prepare_agent, prepare agent response - %s", prepare_agent_response)
    except Exception as ex:
        LOGGER.error("In agents.prepare_agent, failed to prepare agent due to error - %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to prepare agent due to error - {str(ex)}")

    agent_status = prepare_agent_response["agentStatus"]
    max_retries = 3
    # Use exponential backoff retry mechanism to wait for agentStatus to become PREPARED
    agent_status, _ = check_status_using_exponential_backoff(max_retries, agent_status, AGENT_PREPARED_STATUS, agent_item["ReferenceId"])

    if action == "create-agent":
        LOGGER.info("In agents.prepare_agent, action is create agent so no further steps.")

    elif action in ["update-agent-workspace", "prepare-agent-api", "update-agent-details"]:

        LOGGER.info("In agents.prepare_agent, updating agent alias")
        update_alias_response = BEDROCK_AGENTS_CLIENT.update_agent_alias(
            agentId=agent_item["ReferenceId"],
            agentAliasId=agent_item["AgentAliasId"],
            agentAliasName=agent_item["AgentName"]
        )

        retries = 0
        max_retries = 3
        agent_version = agent_item["AgentVersion"]
        agent_alias_status = update_alias_response["agentAlias"]["agentAliasStatus"]
        # Use exponential backoff retry mechanism to wait for agentAliasStatus to become PREPARED
        while retries < max_retries and agent_alias_status==AGENT_UPDATING_STATUS:
            LOGGER.info("In agents.prepare_agent, waiting for agent alias to be updated, try - %s", retries)
            retries+=1
            time.sleep(3**retries)
            agent_alias = BEDROCK_AGENTS_CLIENT.get_agent_alias(
                agentId=agent_item["ReferenceId"],
                agentAliasId=agent_item["AgentAliasId"]
            )
            LOGGER.info("In agents.prepare_agent, agent alias - %s", agent_alias)
            agent_alias_status = agent_alias["agentAlias"]["agentAliasStatus"]
            agent_version = agent_alias["agentAlias"]["routingConfiguration"][0]["agentVersion"]

        LOGGER.info("In agents.prepare_agent, new agent version - %s", agent_version)
        LOGGER.info("In agents.prepare_agent, deleting previous agent version")
        BEDROCK_AGENTS_CLIENT.delete_agent_version(
            agentId=agent_item["ReferenceId"],
            agentVersion=agent_item["AgentVersion"]
        )
        update_expression = "SET LastModifiedTime = :last_modified_time, LastModifiedBy = :last_modified_by, AgentStatus = :status, AgentVersion = :version"
        expression_attributes = {
            ":status": AGENT_PREPARED_STATUS,
            ":version": agent_version,
            ":last_modified_time": commonUtil.get_current_time(),
            ":last_modified_by": user_id,
        }

        # updating metadata in dynamodb
        key = {'AgentId': agent_item['AgentId']}
        update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), key, update_expression, expression_attributes)
        if update_response == "error":
            LOGGER.error("In agents.prepare_agent, failed to update the latest status of agent item in dynamodb")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

        if action == "prepare-agent-api":
            return commonUtil.build_put_response(200, {"Message": "Successfully prepared agent."})


def update_agent_details(user_id, agent_id, event, query_params):
    """
    This function is to update an agent
    """
    LOGGER.info("In agents.update_agent_details, starting method with agent_id - %s", agent_id)
    event_body = json.loads(event['body'])
    agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {'AgentId': agent_id})

    if not agent_item:
        LOGGER.error("In agents.update_agent_details, invalid agent id - `%s`", agent_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("AgentId", agent_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    if query_params and "action" in query_params:
        # action can be update-workspace/prepare-agent
        LOGGER.info("In agents.update_agent_details, action is passed in query parameters so performing the action.")
        if query_params['action'] not in ['update-workspace', 'prepare-agent']:
            LOGGER.error("In agents.update_agent_details, invalid action passed in query params")
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = "Invalid action passed in query parameters (expected update-workspace/prepare-agent)."
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        if query_params['action'] == 'update-workspace':
            return update_agent_workspace(event, agent_item, user_id)
        if query_params['action'] == 'prepare-agent':
            return prepare_agent(agent_id, "prepare-agent-api", user_id, None)

    # validating input body
    if all(event_body.get(key, "") == agent_item[key] for key in ["Description", "BaseModel", "Instruction"]):
        LOGGER.info("In agents.update_agent_details, no change in agent details")
        return commonUtil.build_put_response(200, {"Message": "Update not performed as there are no changes"})

    description = event_body.get("Description", agent_item["Description"])
    base_model = event_body.get("BaseModel", agent_item["BaseModel"])
    instruction = event_body.get("Instruction", agent_item["Instruction"])

    update_agent_input = {
       "agentId": agent_item["ReferenceId"],
       "agentName": agent_item["AgentName"],
       "agentResourceRoleArn": AGENTS_IAM_ROLE_ARN,
       "description": description,
       "foundationModel": base_model,
       "instruction": instruction
   }
    try:
        update_agent_response = BEDROCK_AGENTS_CLIENT.update_agent(**update_agent_input)
        LOGGER.info("In agents.update_agent_details, bedrock update agent response - %s", update_agent_response)
    except Exception as ex:
        LOGGER.error("In agents.update_agent_details, failed to update agent due to error - %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to update agent due to error - {str(ex)}")

    agent_ref_id = update_agent_response["agent"]["agentId"]
    LOGGER.info("In agents.update_agent_details, updated agent with reference id - %s", agent_ref_id)

    agent_status = update_agent_response["agent"]["agentStatus"]
    max_retries = 3
    # Use exponential backoff retry mechanism to wait for agentStatus to become PREPARED
    agent_status, _ = check_status_using_exponential_backoff(max_retries, agent_status, AGENT_PREPARED_STATUS, agent_item["ReferenceId"])

    # preparing agent only if either instruction or base model is changes
    if instruction != agent_item['Instruction'] or base_model != agent_item['BaseModel']:
        prepare_agent(agent_id, "update-agent-details", user_id, agent_item)


    update_expression = "SET Description = :description, BaseModel = :base_model, Instruction = :instruction, Message = :message, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time"
    expression_attributes = {
        ":description": description,
        ":base_model": base_model,
        ":instruction": instruction,
        ":message": "Agent details updated successfully. Agent Preparation process triggered",
        ":last_modified_by": user_id,
        ":last_modified_time": commonUtil.get_current_time()
    }
    key = {'AgentId': agent_id}
    update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE),
                    key, update_expression, expression_attributes)

    if update_response == "error":
        LOGGER.error("In agents.update_agent_details, failed to update the agent metadata")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

    return commonUtil.build_put_response(200, {"Message": "Agent updated successfully. Agent Preparation process has been triggered"})

def delete_agent(agent_id):
    """
    This function is to delete an agent
    """
    LOGGER.info("In agents.delete_agent, starting method with agent_id - %s", agent_id)
    agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {'AgentId': agent_id})
    if not agent_item:
        LOGGER.error("In agents.post_query_to_model, invalid agent id - `%s`", agent_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("AgentId", agent_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    try:
        delete_agent_alias_response = BEDROCK_AGENTS_CLIENT.delete_agent_alias(
                                    agentId=agent_item["ReferenceId"],
                                    agentAliasId=agent_item["AgentAliasId"]
                                )
        LOGGER.info("In agents.delete_agent, delete agent alias response - %s", delete_agent_alias_response)
        delete_agent_response = BEDROCK_AGENTS_CLIENT.delete_agent(agentId=agent_item["ReferenceId"])
        LOGGER.info("In agents.delete_agent, delete agent response - %s", delete_agent_response)
    except Exception as ex:
        LOGGER.error("In agents.delete_agent, Failed to delete agent due to error: %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to delete agent due to error - {str(ex)}")

    response = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(AGENTS_TABLE),
        {'AgentId': agent_id}
    )

    if response != "success":
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("Agents")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    LOGGER.info("In agents.delete_agent, deleted metadata from dynamodb")

    response =  { "Message": "Deletion completed successfully" }
    return commonUtil.build_delete_response(200, response)

def get_agent_action_groups(agent_id, projection_expression = None, agent_item = None):
    """
    This function is to get the action groups attached to the agent
    """
    LOGGER.info("In agents.get_agent_action_groups, starting method with agent_id - %s", agent_id)
    if not agent_item:
        agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {'AgentId': agent_id})

    agent_action_group_ids = [{"ActionGroupId": action_group["ActionGroupId"]} for action_group in agent_item["AttachedActionGroups"]]
    agent_action_group_items_ddb = []
    if agent_action_group_ids:
        agent_action_group_items_ddb = dynamodbUtil.batch_get_items(
                                        DYNAMODB_RESOURCE,
                                        AGENTS_ACTION_GROUPS_TABLE,
                                        agent_action_group_ids,
                                        projection_expression=projection_expression
                                    )
    agent_action_groups_dict = {}
    for action_group in agent_item["AttachedActionGroups"]:
        agent_action_groups_dict[action_group["ActionGroupId"]] = action_group
    for action_group in agent_action_group_items_ddb:
        agent_action_groups_dict[action_group["ActionGroupId"]].update(action_group)

    agent_action_group_items = list(agent_action_groups_dict.values())
    return agent_action_group_items

def add_agent_action_groups(agent_item, action_groups_to_add):
    """
    This function is to add the action groups to the agent
    """
    LOGGER.info("In agents.add_agent_action_groups, starting method")
    added_action_groups = []
    for action_group in action_groups_to_add:
        bucket_name, object_key = commonUtil.get_s3_bucket_and_path(action_group["ApiDefS3Uri"])
        kwargs = {
            'agentId': agent_item["ReferenceId"],
            'agentVersion': "DRAFT",
            'actionGroupName': action_group["ActionGroupName"],
            'description': action_group.get("Description", "N/A"),
            'actionGroupExecutor': {
                'lambda': action_group["LambdaArn"]
            },
            'apiSchema' : {
                's3': {
                    's3BucketName': bucket_name,
                    's3ObjectKey': object_key
                },
            },
            'actionGroupState': "ENABLED"
        }
        if agent_item.get('QueryFollowUp', '') == "yes":
            kwargs.update({
                'parentActionGroupSignature': 'AMAZON.UserInput'
            })
        response = BEDROCK_AGENTS_CLIENT.create_agent_action_group(**kwargs)
        action_group_ref_id = response['agentActionGroup']['actionGroupId']
        action_group_item = {
            "ActionGroupId": action_group["ActionGroupId"],
            "ReferenceId": action_group_ref_id
        }
        added_action_groups.append(action_group_item)
    return added_action_groups

def remove_agent_action_groups(agent_item, action_groups_to_remove):
    """
    This function is to remove the action groups from the agent
    """
    LOGGER.info("In agents.remove_agent_action_groups, starting method")
    for action_group in action_groups_to_remove:
        bucket_name, object_key = commonUtil.get_s3_bucket_and_path(action_group["ApiDefS3Uri"])
        BEDROCK_AGENTS_CLIENT.update_agent_action_group(
            agentId=agent_item["ReferenceId"],
            agentVersion="DRAFT",
            description=action_group.get("Description", "N/A"),
            actionGroupName=action_group["ActionGroupName"],
            actionGroupId=action_group["ReferenceId"],
            actionGroupState="DISABLED",
            actionGroupExecutor={
                'lambda': action_group["LambdaArn"]
            },
            apiSchema={
                's3': {
                    's3BucketName': bucket_name,
                    's3ObjectKey': object_key
                },
            }
        )
        BEDROCK_AGENTS_CLIENT.delete_agent_action_group(
            agentId=agent_item["ReferenceId"],
            agentVersion="DRAFT",
            actionGroupId=action_group["ReferenceId"]
        )

def update_agent_action_groups(event_body):
    """
    This function is to update the action groups attached to the agent
    """
    updated_agent_action_groups = None
    try:
        LOGGER.info("In agents.update_agent_action_groups, starting method")
        agent_id = event_body["AgentId"]
        agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {'AgentId': agent_id})
        updated_agent_action_groups_ids = event_body["ActionGroups"]
        if len(updated_agent_action_groups_ids) > AGENTS_ACTION_GROUPS_LIMIT:
            raise Exception("Exceeded maximum number of action groups allowed for an agent")

        updated_agent_action_groups = get_agent_action_groups(agent_id, None, {"AttachedActionGroups": [{"ActionGroupId": action_group_id} for action_group_id in updated_agent_action_groups_ids]})
        if any(action_group["ActionGroupStatus"] != "READY" for action_group in updated_agent_action_groups):
            # update to None so that item is not updated in dynamodb
            updated_agent_action_groups = None
            raise Exception("Action groups must be in READY state in order for them to be attached to an agent")

        existing_agent_action_groups = agent_item["AttachedActionGroups"]
        existing_agent_action_groups_ids = [action_group["ActionGroupId"] for action_group in existing_agent_action_groups]


        action_groups_to_remove_ids = list(set(existing_agent_action_groups_ids) - set(updated_agent_action_groups_ids))
        LOGGER.info("In agents.update_agent_action_groups, action groups to be removed - %s", action_groups_to_remove_ids)
        action_groups_to_remove = [action_group for action_group in existing_agent_action_groups if action_group["ActionGroupId"] in action_groups_to_remove_ids]
        action_groups_to_remove = get_agent_action_groups(agent_id, None, {"AttachedActionGroups": action_groups_to_remove})
        remove_agent_action_groups(agent_item, action_groups_to_remove)

        action_groups_to_add_ids = list(set(updated_agent_action_groups_ids) - set(existing_agent_action_groups_ids))
        LOGGER.info("In agents.update_agent_action_groups, action groups to be added - %s", action_groups_to_add_ids)
        action_groups_to_add = get_agent_action_groups(agent_id, None, {"AttachedActionGroups": [{"ActionGroupId": action_group_id} for action_group_id in action_groups_to_add_ids]})
        added_action_groups = add_agent_action_groups(agent_item, action_groups_to_add)

        LOGGER.info("In agents.update_agent_action_groups, preparing agent")
        try:
            prepare_agent_response = BEDROCK_AGENTS_CLIENT.prepare_agent(agentId=agent_item["ReferenceId"])
            LOGGER.info("In agents.update_agent_action_groups, prepare agent response - %s", prepare_agent_response)
        except Exception as ex:
            LOGGER.error("In agents.update_agent_action_groups, failed to prepare agent due to error - %s", str(ex))
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to prepare agent due to error - {str(ex)}")

        agent_status = prepare_agent_response["agentStatus"]
        max_retries = 6
        # Use exponential backoff retry mechanism to wait for agentStatus to become PREPARED
        agent_status, error_message = check_status_using_exponential_backoff(max_retries, agent_status, AGENT_PREPARED_STATUS, agent_item["ReferenceId"])

        if agent_status == AGENT_FAILED_STATUS:
            # revert changes made on bedrock
            LOGGER.error("In agents.update_agent_action_groups, update failed due to error - %s", error_message)
            LOGGER.info("In agents.update_agent_action_groups, reverting changes made on bedrock as update failed")
            action_groups_to_remove = get_agent_action_groups(agent_id, None, {"AttachedActionGroups": added_action_groups})
            remove_agent_action_groups(agent_item, action_groups_to_remove)
            removed_action_groups = get_agent_action_groups(agent_id, None, {"AttachedActionGroups": [{"ActionGroupId": action_group_id} for action_group_id in action_groups_to_remove_ids]})
            readded_action_groups = add_agent_action_groups(agent_item, removed_action_groups)
            agent_item["AttachedActionGroups"].extend(readded_action_groups)
            updated_agent_action_groups = [action_group for action_group in agent_item["AttachedActionGroups"] if action_group["ActionGroupId"] in existing_agent_action_groups]
            prepare_agent_response = BEDROCK_AGENTS_CLIENT.prepare_agent(agentId=agent_item["ReferenceId"])
            LOGGER.info("In agents.update_agent_action_groups, prepare agent response after revert - %s", prepare_agent_response)
            raise Exception(f'{error_message}')


        LOGGER.info("In agents.update_agent_action_groups, updating agent alias")
        update_alias_response = BEDROCK_AGENTS_CLIENT.update_agent_alias(
            agentId=agent_item["ReferenceId"],
            agentAliasId=agent_item["AgentAliasId"],
            agentAliasName=agent_item["AgentName"]
        )

        retries = 0
        max_retries = 6
        agent_version = agent_item["AgentVersion"]
        agent_alias_status = update_alias_response["agentAlias"]["agentAliasStatus"]
        # Use exponential backoff retry mechanism to wait for agentAliasStatus to become PREPARED
        while retries < max_retries and agent_alias_status==AGENT_UPDATING_STATUS:
            LOGGER.info("In agents.update_agent_action_groups, waiting for agent alias to be updated, try - %s", retries)
            retries+=1
            time.sleep(3**retries)
            agent_alias = BEDROCK_AGENTS_CLIENT.get_agent_alias(
                agentId=agent_item["ReferenceId"],
                agentAliasId=agent_item["AgentAliasId"]
            )
            LOGGER.info("In agents.update_agent_action_groups, agent alias - %s", agent_alias)
            agent_alias_status = agent_alias["agentAlias"]["agentAliasStatus"]
            agent_version = agent_alias["agentAlias"]["routingConfiguration"][0]["agentVersion"]

        LOGGER.info("In agents.update_agent_action_groups, new agent version - %s", agent_version)

        LOGGER.info("In agents.update_agent_action_groups, deleting previous agent version")
        BEDROCK_AGENTS_CLIENT.delete_agent_version(
            agentId=agent_item["ReferenceId"],
            agentVersion=agent_item["AgentVersion"]
        )

        agent_item["AttachedActionGroups"].extend(added_action_groups)
        updated_agent_action_groups = [action_group for action_group in agent_item["AttachedActionGroups"] if action_group["ActionGroupId"] in updated_agent_action_groups_ids]

        update_expression = "SET AttachedActionGroups = :att_act_groups, AgentStatus = :status, AgentVersion = :version, Message = :message, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time"
        expression_attributes = {
            ":status": AGENT_PREPARED_STATUS,
            ":att_act_groups": updated_agent_action_groups,
            ":message": "Agent action groups updated successfully",
            ":version": agent_version,
            ":last_modified_by": commonUtil.SYSTEM_RUNNER_ID,
            ":last_modified_time": commonUtil.get_current_time()
        }
        key = {'AgentId': agent_id}
        update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE),
                        key, update_expression, expression_attributes)

        if update_response == "error":
            LOGGER.error("In agents.update_agent_action_groups, failed to update the agent metadata")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

        return commonUtil.build_post_response(200, {"Message": "Updated agent action groups. Agent Preparation process has been triggered"})
    except Exception as ex:
        LOGGER.error("In agents.update_agent_action_groups, failed to update agent action groups due to error - %s", str(ex))
        update_expression = "SET AgentStatus = :status, Message = :message, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time"
        expression_attributes = {
            ":status": AGENT_FAILED_STATUS,
            ":message": f"Failed to update agent action groups due to error - {str(ex)}",
            ":last_modified_by": commonUtil.SYSTEM_RUNNER_ID,
            ":last_modified_time": commonUtil.get_current_time()
        }
        if updated_agent_action_groups:
            update_expression += ", AttachedActionGroups = :att_act_groups"
            expression_attributes.update({":att_act_groups": updated_agent_action_groups})
        key = {'AgentId': agent_id}
        update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE),
                        key, update_expression, expression_attributes)
        if update_response == "error":
            LOGGER.error("In agents.get_agent_details, failed to update the latest status of agent item in dynamodb")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to update agent action groups due to error - {str(ex)}")

def trigger_agent_action_groups_update(user_id, agent_id, event, context):
    """
    This function is to trigger agent action groups update
    :param agent_id: ID of the agent
    :param event: event
    :param context: context
    """
    LOGGER.info("In agents.trigger_agent_action_groups_update, agent_id - %s", agent_id)
    event_body = json.loads(event["body"])
    invoke_payload={
        'ActionGroups': event_body["ActionGroups"],
        'AgentId': agent_id,
        'Operation': "update_agent_action_groups"
    }
    LOGGER.info("In agents.trigger_agent_action_groups_update, input payload is - %s", invoke_payload)
    response = commonUtil.invoke_lambda_function(
        lambda_client=LAMBDA_CLIENT,
        function_name=context.function_name,
        payload=json.dumps(invoke_payload),
        invocation_type='Event'
    )

    LOGGER.info("In agents.trigger_agent_action_groups_update, agent action groups update process trigger response - %s", response)
    update_expression = "SET AgentStatus = :status, Message = :message, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time"
    expression_attributes = {
        ":status": AGENT_UPDATING_STATUS,
        ":message": "Agent action groups update process triggered",
        ":last_modified_by": user_id,
        ":last_modified_time": commonUtil.get_current_time()
    }
    key = {'AgentId': agent_id}
    update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE),
                        key, update_expression, expression_attributes)
    if update_response == "error":
        LOGGER.error("In agents.get_agent_details, failed to update the latest status of agent item in dynamodb")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    return commonUtil.build_put_response(200, {"Message": "Agent action groups update process triggered"})

def invoke_agent(agent_id, user_id, event):
    """
    This function is to invoke agent
    """
    LOGGER.info("In agents.invoke_agent, invoking agent with id - %s", agent_id)
    event_body = json.loads(event["body"])
    commonUtil.validate_event_body(event_body, AGENT_SEND_MESSAGE_REQUIRED_KEYS)
    agent_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_TABLE), {'AgentId': agent_id})
    if not agent_item:
        LOGGER.error("In agents.invoke_agent, invalid agent id - `%s`", agent_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("AgentId", agent_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    event_body = json.loads(event["body"])
    # session id is generated from UI with client-id passed as 'agent-${agent_id}'
    session_id = event_body.get("SessionId", "")
    user_message = event_body.get("UserMessage", "")

    # check if agent is in preparing state, if yes it can't be invoked
    if agent_item["AgentStatus"] != AGENT_PREPARED_STATUS:
        LOGGER.error("In agents.invoke_agent, cannot invoke agent that is not in PREPARED state")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Failed to invoke agent as it is not in PREPARED state")

    # check if agent has any prebaked action groups attached. if yes, then validate user's Amorphic integration status
    for action_group in agent_item["AttachedActionGroups"]:
        action_group_details = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE), {'ActionGroupId': action_group['ActionGroupId']})
        if action_group_details['ActionGroupName'] in commonUtil.PREBAKED_ACTION_GROUPS:
            user_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(USERS_TABLE), {'UserId': user_id})
            if user_item['AmorphicIntegrationStatus'] != "connected":
                LOGGER.error("In agents.invoke_agent, failed to invoke agent as user is not integrated with Amorphic.")
                errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Failed to invoke agent as user is not integrated with Amorphic.")

    message_id = event_body["MessageId"]
    query_start_time = commonUtil.get_current_time()
    human_message_object = {
        "Type": "human",
        "MessageId": message_id,
        "Data": user_message,
        "MessageTime": query_start_time,
        "ClientId": f"agent-{agent_id}",
        "SessionId": session_id,
        "ReviewRequired": False
    }
    human_message_object = json.loads(json.dumps(human_message_object, cls=commonUtil.DecimalEncoder), parse_float=Decimal)
    dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), human_message_object)

    session_details = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(SESSIONS_TABLE), {'UserId': user_id, 'SessionId': session_id})
    update_expression = "SET LastModifiedTime = :last_modified_time, LastModifiedBy = :last_modified_by, ExpirationTime = :expiration_time"
    expression_attributes = {
        ":last_modified_time": commonUtil.get_current_time(),
        ":last_modified_by": user_id,
        # resetting the session expiration to 60 minutes from now
        ":expiration_time": int((datetime.now(timezone.utc) + timedelta(seconds=commonUtil.AGENT_IDLE_SESSION_TIMEOUT_IN_SECONDS)).strftime('%s'))
    }
    # write title if not present
    if session_details.get("Title", "New Session") == "New Session":
        update_expression += ", Title = :title"
        expression_attributes.update({
            ":title": user_message[:128],
        })
    dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
        {"UserId": user_id, "SessionId": session_id},
        update_expression,
        expression_attributes
    )

    invoke_agent_response = BEDROCK_AGENTS_RUNTIME_CLIENT.invoke_agent(
        agentId=agent_item["ReferenceId"],
        agentAliasId=agent_item["AgentAliasId"],
        sessionId=session_id,
        endSession=False,
        enableTrace=True,
        # this change helps the agent retrieve user_id from the input message
        inputText= f"{user_id} : {user_message}"
    )

    LOGGER.info("In agents.invoke_agent, agent response - %s", invoke_agent_response)

    agent_response_stream = invoke_agent_response["completion"]
    agent_message = ""
    agent_metadata = {"Documents": []}
    for stream_event in agent_response_stream:
        if "chunk" in stream_event:
            stream_message = stream_event["chunk"]["bytes"].decode("utf-8")
            commonUtil.send_message_to_ws_connection(user_id, session_id, {"AIMessage": stream_message, "Metadata": {"MessageId": message_id, "IsComplete": True}}, WS_KWARGS)
            agent_message += stream_message
            for citation in stream_event["chunk"].get("attribution",{}).get("citations",[]):
                agent_metadata["Documents"].append(citation["retrievedReferences"])

    query_end_time = commonUtil.get_current_time()
    response_time = str((datetime.strptime(query_end_time, commonUtil.DATETIME_ISO_FORMAT) - datetime.strptime(query_start_time, commonUtil.DATETIME_ISO_FORMAT)).total_seconds() * 1000)
    ai_message_object = {
        "Type": "ai",
        "Data": agent_message,
        "MessageId": message_id,
        "MessageTime": query_end_time,
        "ResponseTime": response_time,
        "ClientId": f"agent-{agent_id}",
        "SessionId": session_id,
        "ReviewRequired": False
    }
    ai_message_object = json.loads(json.dumps(ai_message_object, cls=commonUtil.DecimalEncoder), parse_float=Decimal)
    dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), ai_message_object)

    agent_metadata.update({"IsComplete": True, "MessageId": message_id})
    return agent_metadata

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
    # pylint: disable-msg=too-many-branches
    if event.get("requestContext"):
        LOGGER.info("In agents.lambda_handler, request is from API gateway")
        # if the lambda times out, the sessions table is updated with QueryStatus as failed
        with LambdaTimer(int((context.get_remaining_time_in_millis() / 1000) - 10), event, context):
            try:
                #to remove authorization token while printing logs
                event = commonUtil.RedactAuthTokensClass(event)
                EVENT_INFO["eventIdentifier"] = context.aws_request_id
                errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
                LOGGER.info("In agents.lambda_handler, event - %s", event)

                # check if request is from WebSocket API
                if event["requestContext"]["domainName"] == WEBSOCKET_ENDPOINT:
                    LOGGER.info("In agents.lambda_handler, request is from WebSocket API")
                    connection_id = event['requestContext']['connectionId']
                    LOGGER.info("In agents.lambda_handler, connection_id - %s", connection_id)

                    # this route is triggered when the websocket connection is established
                    if event['requestContext']['routeKey'] == "$connect":
                        auth_token = event['queryStringParameters']['Authorization']
                        claims = commonUtil.get_claims(auth_token)
                        user_id = claims['cognito:username']
                        if not event.get("queryStringParameters") or not event["queryStringParameters"].get("session-id"):
                            LOGGER.error("In agents.lambda_handler method, session id missing in query string parameters")
                            ec_ipv_1052 = errorUtil.get_error_object("IPV-1052")
                            ec_ipv_1052['Message'] = ec_ipv_1052['Message'].format("session-id")

                        session_id = event["queryStringParameters"]["session-id"]
                        LOGGER.info("In agents.lambda_handler, action is connect")
                        # check if session id is valid
                        _ = commonUtil.get_session_details(SESSIONS_TABLE, user_id, session_id)
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
                            'body': json.dumps({"ConnectionId": connection_id})
                        }
                    # this route is triggered when any message is sent to the websocket api
                    elif event['requestContext']['routeKey'] == "sendmessage":
                        LOGGER.info("In agents.lambda_handler, action is send message")
                        event_body = json.loads(event.get('body')) if event.get('body', None) else {}
                        agent_id = event_body["AgentId"]
                        session_id = event_body["SessionId"]
                        session_item = dynamodbUtil.get_items_by_query_index(
                            DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                            SESSIONS_TABLE_SESSIONID_INDEX,
                            Key("SessionId").eq(session_id)
                        )
                        user_id = session_item[0]["UserId"]
                        # update message delivery status to pending in sessions table
                        commonUtil.update_message_delivery_status(user_id, session_id, commonUtil.CHAT_MESSAGE_DELIVERY_PENDING, WS_KWARGS)
                        # invoke agent
                        try:
                            chat_response_metadata = invoke_agent(agent_id, user_id, event)
                            WS_KWARGS.update({"LatestMessageId": chat_response_metadata["MessageId"]})
                            # send message back to client
                            commonUtil.send_message_to_ws_connection(user_id, session_id, {"Metadata": chat_response_metadata}, WS_KWARGS)
                        except Exception as ex:
                            LOGGER.error("In agents.lambda_handler, agent invocation failed due to error - %s", str(ex))
                            ai_message = str(ex)
                            if "dependencyFailedException" in str(ex):
                                ai_message = "Sorry I was unable to process your request. It seems like your Lambda has unhandled errors. Check the Lambda function logs for error details, then try your request again after fixing the error."
                            commonUtil.send_message_to_ws_connection(user_id, session_id, {"AIMessage": ai_message, "Metadata": {"IsComplete": True }}, WS_KWARGS)
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
                    LOGGER.info("In agents.lambda_handler, request is from Rest API")
                    http_method = event['requestContext']['httpMethod']
                    api_resource = event['resource']
                    LOGGER.info("In agents.lambda_handler, http_method - %s, api_resource - %s", http_method, api_resource)

                    auth_token = event['headers']['Authorization']
                    claims = commonUtil.get_claims(auth_token)
                    user_id = claims['cognito:username']
                    user_item = commonUtil.is_valid_user(user_id)
                    query_params = event["queryStringParameters"] if event.get("queryStringParameters", {}) else {}

                    if api_resource == "/agents" and http_method == "GET":
                        commonUtil.is_user_action_valid(user_item, "AgentId", None, AGENTS_TABLE, GROUPS_TABLE, "read")
                        kwargs = {
                            "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
                            "items_limit": int(query_params.get('limit')) if query_params and 'limit' in query_params else 100,
                            "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                            "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                        }
                        if kwargs['items_limit'] > 1000:
                            ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                        response = list_agents(**kwargs)
                        response = commonUtil.build_get_response(200, response, compression=commonUtil.is_compression_requested(event))

                    elif api_resource == "/agents" and http_method == "POST":
                        response = create_agent(event, user_item)

                    elif api_resource == "/agents/{id}" and http_method == "GET":
                        agent_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "AgentId", agent_id, AGENTS_TABLE, GROUPS_TABLE, "read")
                        response = get_agent_details(agent_id)

                    elif api_resource == "/agents/{id}" and http_method == "PUT":
                        agent_id = event['pathParameters']['id']
                        query_params = event["queryStringParameters"] if event.get("queryStringParameters", {}) else {}
                        commonUtil.is_user_action_valid(user_item, "AgentId", agent_id, AGENTS_TABLE, GROUPS_TABLE, "update")
                        response = update_agent_details(user_id, agent_id, event, query_params)

                    elif api_resource == "/agents/{id}" and http_method == "DELETE":
                        agent_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "AgentId", agent_id, AGENTS_TABLE, GROUPS_TABLE, "delete")
                        response = delete_agent(agent_id)

                    elif api_resource == "/agents/{id}/action-groups" and http_method == "GET":
                        agent_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "AgentId", agent_id, AGENTS_TABLE, GROUPS_TABLE, "delete")
                        response = commonUtil.build_get_response(200, {"ActionGroups": get_agent_action_groups(agent_id)})

                    elif api_resource == "/agents/{id}/action-groups" and http_method == "PUT":
                        agent_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "AgentId", agent_id, AGENTS_TABLE, GROUPS_TABLE, "delete")
                        response = trigger_agent_action_groups_update(user_id, agent_id, event, context)

                    elif api_resource == "/agents/action-groups" and http_method == "GET":
                        commonUtil.is_user_action_valid(user_item, "ActionGroupId", None, AGENTS_ACTION_GROUPS_TABLE, GROUPS_TABLE, "read")
                        kwargs = {
                            "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
                            "items_limit": int(query_params.get('limit')) if query_params and 'limit' in query_params else 100,
                            "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                            "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                        }
                        if kwargs['items_limit'] > 1000:
                            ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                        response = agentsActionGroups.list_action_groups(query_params, **kwargs)
                        response = commonUtil.build_get_response(200, response, compression=commonUtil.is_compression_requested(event))

                    elif api_resource == "/agents/action-groups" and http_method == "POST":
                        response = agentsActionGroups.trigger_action_group_create(event, user_id, context)

                    elif api_resource == "/agents/action-groups/{id}" and http_method == "GET":
                        action_group_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "ActionGroupId", action_group_id, AGENTS_ACTION_GROUPS_TABLE, GROUPS_TABLE, "read")
                        response = agentsActionGroups.get_action_group_details(query_params, action_group_id)

                    elif api_resource == "/agents/action-groups/{id}/logs" and http_method == "GET":
                        action_group_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "ActionGroupId", action_group_id, AGENTS_ACTION_GROUPS_TABLE, GROUPS_TABLE, "read")
                        response = agentsActionGroups.download_action_group_lambda_logs(action_group_id, query_params)

                    elif api_resource == "/agents/action-groups/{id}" and http_method == "DELETE":
                        action_group_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "ActionGroupId", action_group_id, AGENTS_ACTION_GROUPS_TABLE, GROUPS_TABLE, "delete")
                        response = agentsActionGroups.delete_action_group(action_group_id)

                    elif api_resource == "/agents/action-groups/{id}" and http_method == "PUT":
                        action_group_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "ActionGroupId", action_group_id, AGENTS_ACTION_GROUPS_TABLE, GROUPS_TABLE, "update")
                        response = agentsActionGroups.trigger_action_group_update(event, user_id, action_group_id, context)

                    elif api_resource == "/agents/libraries" and http_method == "GET":
                        commonUtil.is_user_action_valid(user_item, "LibraryId", None, AGENTS_LIBRARIES_TABLE, GROUPS_TABLE, "read")
                        kwargs = {
                            "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
                            "items_limit": int(query_params.get('limit')) if query_params and 'limit' in query_params else 100,
                            "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                            "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                        }
                        if kwargs['items_limit'] > 1000:
                            ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                        response = agentsLibraries.list_agent_libraries(**kwargs)
                        response = commonUtil.build_get_response(200, response, compression=commonUtil.is_compression_requested(event))

                    elif api_resource == "/agents/libraries" and http_method == "POST":
                        response = agentsLibraries.create_agent_library(event, user_id)

                    elif api_resource == "/agents/libraries/{id}" and http_method == "GET":
                        library_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "LibraryId", library_id, AGENTS_LIBRARIES_TABLE, GROUPS_TABLE, "read")
                        response = agentsLibraries.get_agent_library_details(query_params, library_id)

                    elif api_resource == "/agents/libraries/{id}" and http_method == "PUT":
                        library_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "LibraryId", library_id, AGENTS_LIBRARIES_TABLE, GROUPS_TABLE, "update")
                        response = agentsLibraries.update_agent_library(query_params, event, user_id, library_id, context)

                    elif api_resource == "/agents/libraries/{id}" and http_method == "DELETE":
                        library_id = event['pathParameters']['id']
                        commonUtil.is_user_action_valid(user_item, "LibraryId", library_id, AGENTS_LIBRARIES_TABLE, GROUPS_TABLE, "delete")
                        response = agentsLibraries.delete_agent_library(library_id)

                    else:
                        LOGGER.error("In agents.lambda_handler, invalid api call - %s %s", http_method, api_resource)
                        ec_ge_1010 = errorUtil.get_error_object("GE-1010")
                        ec_ge_1010['Message'] = ec_ge_1010['Message'].format(http_method, api_resource)
                        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1010)
            except Exception as ex:
                LOGGER.error("In agents.lambda_handler, Exception occurred with error %s", ex)
                response = commonUtil.build_generic_response(500, {"Message": str(ex)})

            return response
    else:
        LOGGER.info("In agents.lambda_handler, the invocation is asychronous")
        try:
            if event["Operation"] == "update_agent_action_groups":
                update_agent_action_groups(event)
            elif event["Operation"] == "create_action_group":
                agentsActionGroups.create_action_group(event)
            elif event["Operation"] == "update_action_group":
                agentsActionGroups.update_action_group(event)
            elif event["Operation"] == "async_update_action_groups_layers":
                agentsLibraries.update_associated_action_groups(event)
        except Exception as ex:
            LOGGER.error("In agents.lambda_handler, Exception occurred with error %s", ex)
