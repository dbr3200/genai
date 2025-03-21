"""
######################################################################################################
# File: appManagement.py
#
# This lambda function is used for managing App level configurations.
#
# Modification History:
# ====================================================================
# Date                 Who                       Description
# ==========      =================     ==============================
# November 6th 2023    Yadu                     Initial Commit
#
######################################################################################################
"""

import logging
import os
import sys
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr

import commonUtil
import dynamodbUtil
import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading App Management Lambda Function")

try:
    AWS_REGION = os.environ["awsRegion"]
    AURORA_CLUSTER_HOST_NAME = os.environ['RAGHost'].split('.')[0]
    RAG_ENGINES = os.environ['ragEngines']

    WORKSPACES_EXECUTIONS_TABLE = dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE
    WORKSPACES_EXECUTIONS_TABLE_WORKSPACEID_INDEX = dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE_WORKSPACEID_INDEX
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE

    EVENT_INFO = {}

    SSM_CLIENT = boto3.client("ssm", AWS_REGION)
    RDS_CLIENT = boto3.client("rds", AWS_REGION)
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)

except Exception as exc:
    LOGGER.error("Failed to set environment variables with: %s", "{0}".format(exc))
    sys.exit()


def get_rag_engines(return_item):
    '''
    This method is to retrieve the RAG engines
    '''
    LOGGER.info("In appManagement.get_rag_engines, retrieving RAG engines")
    try:
        LOGGER.info("In appManagement.get_rag_engines, rag engines are - %s", [RAG_ENGINES])

        LOGGER.info("In appManagement.get_rag_engines, fetching latest status of the rag engines")
        rag_engines_response = fetch_rag_engines_status([RAG_ENGINES], AURORA_CLUSTER_HOST_NAME, RDS_CLIENT)

        LOGGER.info("In appManagement.get_rag_engines, rag engines retrieved : %s", rag_engines_response)
        return_item.update({
            'RagEngines': rag_engines_response
        })

    except Exception as ex:
        LOGGER.error("In appManagement.get_rag_engines, Failed to retrieve the rag engines with exception - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = f"Failed to retrieve rag engines and latest statuses with error - {str(ex)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)


def get_openai_key(return_item):
    """
    This method is used to get the OpenAI key
    """
    openai_key = commonUtil.get_openai_key(SSM_CLIENT)
    masked_key = f"{openai_key[:4]}{'*' * (len(openai_key) - 8)}{openai_key[-4:]}" if len(openai_key) > 8 else openai_key
    LOGGER.info("In appManagement.get_openai_key, masked OpenAI key is %s", masked_key)
    return_item.update({
        'OpenAIKey': masked_key
    })


def list_system_configs(config_name, return_item):
    """
    This function is for listing all AI system configurations, or optionally getting a specific one
    This action can only be performed by SuperUsers
    :rtype: dict
    """
    if config_name == "all":
        get_rag_engines(return_item)
        get_openai_key(return_item)
    elif config_name == "rag-engines":
        get_rag_engines(return_item)
    elif config_name == "openai-key":
        get_openai_key(return_item)
    else:
        LOGGER.info("In appManagement.list_system_configs, unsupported config received - %s", str(config_name))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Failed to process the api request, unsupported configuration is passed."
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)


def fetch_rag_engines_status(rag_engines, db_identifier, rds_client):
    '''
    This method fetches and updates latest status of the rag engines
    '''
    LOGGER.info("In appManagement.fetch_rag_engines_status, retrieving RAG engine statuses")
    rag_engines_response = {}
    for engine in rag_engines:
        if engine == "aurora":
            LOGGER.info("In appManagement.fetch_rag_engines_status, fetching aurora RAG engine status")

            aurora_engine_status = rds_client.describe_db_clusters(
                DBClusterIdentifier=db_identifier
            )['DBClusters'][0]['Status']

            LOGGER.info("In appManagement.fetch_rag_engines_status, aurora engine status - %s", aurora_engine_status)

            rag_engines_response.update({
                "aurora": aurora_engine_status
            })
        ### FOR FUTURE REFERNCE ###
        # elif engine == "kendra":
        #     kendra_engine_status = KENDRA_CLIENT.get_status()
        #     rag_engines_response.update({
        #         "kendra": kendra_engine_status
        #     })
        ###########################

    LOGGER.info("In appManagement.fetch_rag_engines_status, rag engine status  response- %s", rag_engines_response)
    return rag_engines_response


def update_rag_engines(input_body):
    '''
    This function is to update rag engines
    :param input_body: input request body from api
    :type input_body: dict
    '''
    LOGGER.info("In appManagement.update_rag_engines, validating and updating rag engines with body %s", input_body)
    status = ""

    try:
        # validating if RagEngines are present in input body
        if 'RagEngines' not in input_body:
            LOGGER.error("In appManagement.update_rag_engines, missing RagEngines in event body")
            ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
            ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("RagEngines")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)


        if not all(key in [RAG_ENGINES] for key in input_body["RagEngines"].keys()):
            LOGGER.error("In appManagement.update_rag_engines, invalid input rag engine key")
            ec_ipv_1041 = errorUtil.get_error_object("IPV-1041")
            ec_ipv_1041['Message'] = ec_ipv_1041['Message'].format('RagEngines', RAG_ENGINES)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1041)

        if not all(value in ['enable', 'disable'] for value in input_body["RagEngines"].values()):
            LOGGER.error("In appManagement.update_rag_engines, invalid input rag engine value")
            ec_ipv_1041 = errorUtil.get_error_object("IPV-1041")
            ec_ipv_1041['Message'] = ec_ipv_1041['Message'].format('RagEngines', "enable/disable")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1041)


        # validating if input rag engines values are 'enable' or 'disable'
        for key, value in input_body['RagEngines'].items():
            LOGGER.info("In appManagement.update_rag_engines, fetching latest rag engines statuses")
            rag_engines_status = fetch_rag_engines_status([RAG_ENGINES], AURORA_CLUSTER_HOST_NAME, RDS_CLIENT)

            if key =="aurora":
                if rag_engines_status['aurora'] == 'available':
                    if value == "disable":
                        LOGGER.info("In appManagement.update_rag_engines, disabling aurora rag engine")

                        LOGGER.info("In appManagement.update_rag_engines, checking if there are any active workspace runs")
                        workspaces_items = dynamodbUtil.scan_with_pagination(
                            DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE),
                            Attr("RAGEngine").eq("aurora"),
                            "WorkspaceId"
                        )
                        active_executions = []
                        for workspace in workspaces_items:
                            execution_items = dynamodbUtil.get_items_by_query_index(
                                DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE),
                                dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE_WORKSPACEID_INDEX,
                                Key('WorkspaceId').eq(workspace["WorkspaceId"]),
                                "RunStatus",
                                Attr("RunStatus").eq('running')
                            )
                            active_executions.extend(execution_items)

                        LOGGER.info("In appManagement.update_rag_engines, active executions - %s", active_executions)

                        if active_executions:
                            LOGGER.error("In appManagement.update_rag_engines, there are %s active workspace runs", len(active_executions))
                            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
                            ec_ge_1034["Message"] = f"Cannot turn off RAG engine, there are {len(execution_items)} active workspace runs"
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)
                        else:
                            LOGGER.info("In appManagement.update_rag_engines, there are no active workspace runs so stopping the aurora cluster")
                            disable_cluster_response = RDS_CLIENT.stop_db_cluster(
                                DBClusterIdentifier=AURORA_CLUSTER_HOST_NAME
                            )
                            LOGGER.info("In appManagement.update_rag_engines, disable cluster response - %s", disable_cluster_response)
                            status = "Successfully turned off aurora RAG engine"
                    else:
                        LOGGER.info("In appManagement.update_rag_engines, cluster is already turned off so returning status")
                        status = "Successfully turned off aurora RAG engine"

                elif rag_engines_status["aurora"] == 'stopped':
                    if value == "enable":
                        LOGGER.info("In appManagement.update_rag_engines, enabling aurora rag engine")
                        enable_cluster_response = RDS_CLIENT.start_db_cluster(
                            DBClusterIdentifier=AURORA_CLUSTER_HOST_NAME
                        )
                        LOGGER.info("In appManagement.update_rag_engines, enable cluster response - %s", enable_cluster_response)
                        status = "Successfully turned on aurora RAG engine"
                    else:
                        LOGGER.info("In appManagement.update_rag_engines, cluster is already turned on so returning status")
                        status = "Successfully turned on aurora RAG engine"
                else:
                    status = f"Unable to turn on/off RAG engine in {rag_engines_status['aurora']} status"


        LOGGER.info("In appManagement.update_rag_engines, successfully updated rag engine status")

    except Exception as ex:
        LOGGER.error("In appManagement.update_rag_engines, Failed to update the rag engines with exception - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Failed to update RAG engines with error - {str(ex)}"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    return {
        "Message" : status
    }


def update_openai_key(input_body):
    """This function updates the OpenAI key
    """
    LOGGER.info("In appManagement.update_openai_key, validating and updating OpenAI key")

    try:
        # validating if OpenAIKey is present in input body
        if 'OpenAIKey' not in input_body:
            LOGGER.error("In appManagement.update_openai_key, missing 'OpenAIKey' in event body")
            ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
            ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("OpenAIKey")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)

        ssm_input = {
            "Name": commonUtil.OPENAI_KEY_SSM_KEY,
            "Description": "This is an SSM parameter for storing OPENAI key",
            "Value": input_body["OpenAIKey"],
            "Type": "SecureString",
            "Overwrite": True
        }
        commonUtil.create_ssm_parameter(SSM_CLIENT, ssm_input)

        LOGGER.info("In appManagement.update_openai_key, successfully updated the OpenAI key")

        return {"Message": "Successfully updated OpenAI key"}

    except Exception as ex:
        LOGGER.error("In appManagement.update_openai_key, Failed to update the OpenAI key with exception - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Failed to update OpenAI key with error - {str(ex)}"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)


def update_system_config(config_name, config_obj):
    '''
    This is a helper function to call the respective config update function based on the config_name passed as query param
    :param config_name: configuration name
    :param config_obj: input from the api
    :rtype: dict
    '''
    LOGGER.info("In appManagement.update_system_config, update requested for config is - %s", config_name)

    if config_name == "rag-engines":
        response = update_rag_engines(config_obj)
    elif config_name == "openai-key":
        response = update_openai_key(config_obj)
    else:
        LOGGER.info("In appManagement.update_system_config, unsupported config received - %s", str(config_name))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Failed to process the api request, unsupported configuration is passed."
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    return response


def lambda_handler(event, context):
    """
    This Lambda function is for handling all requests related to app management
    """
    try:
        #to remove authorization token while printing logs
        event = commonUtil.RedactAuthTokensClass(event)
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
        LOGGER.info("In appManagement.lambda_handler, event - %s \n context - %s", event, context)
        http_method = event["requestContext"]["httpMethod"]
        api_resource = event["resource"]
        LOGGER.info("In appManagement.lambda_handler, http_method - %s, api_resource - %s", http_method, api_resource)

        authtoken = event["headers"]["Authorization"]
        claims = commonUtil.get_claims(authtoken)
        user_id = claims["cognito:username"]
        # All App Management actions can be performed only by admins
        user_item = commonUtil.is_valid_user(user_id)
        if user_item.get("UserRole") == commonUtil.ADMINS_USER_ROLE:
            query_params = event.get("queryStringParameters", {})
            config_name = query_params.get("config", "all") if query_params else "all"
            if http_method == "GET" and api_resource =="/app-management":
                return_item = {}
                list_system_configs(config_name, return_item)
                response = commonUtil.build_get_response(200, return_item)

            elif http_method == "PUT" and api_resource == "/app-management":
                status = update_system_config(config_name, json.loads(event['body']))
                response = commonUtil.build_get_put_response(200, status)
        else:
            LOGGER.error("In appManagement.lambda_handler, User `%s` is not permitted to perform the action", user_id)
            errorUtil.raise_exception(EVENT_INFO, "UU", "AUTH-1002", "default")

    except errorUtil.InvalidUserException as iue:
        LOGGER.error("In appManagement.lambda_handler, InvalidUserException occurred with error %s", iue)
        response = commonUtil.build_post_response(400, {'Message': str(iue)})
    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In appManagement.lambda_handler, InvalidInputException occurred with error %s", iie)
        response = commonUtil.build_post_response(400, {'Message': str(iie)})
    except errorUtil.GenericFailureException as gfe:
        LOGGER.error("In appManagement.lambda_handler, GenericFailureException occurred with error %s", gfe)
        response = commonUtil.build_post_response(500, {'Message': str(gfe)})
    except Exception as exc:
        LOGGER.error("In appManagement.lambda_handler, Exception occurred with error %s", exc)
        response = commonUtil.build_generic_response(500, {"Message": str(exc)})
    return response
