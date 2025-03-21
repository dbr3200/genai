"""
This utility is created to handle all intermediate API calls and setup parameters for action group lambdas
These util functions are sourced directly from commonUtil and dynamodbUtil so any changes made there will need to be replicated here as well
"""
import json
import logging
import sys
import os
import time

from boto3.dynamodb.conditions import Key, Attr
import boto3

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

try:
    DYNAMODB_SSM_PARAM_FILE = "dynamodb_ssm_params.json"
    AWS_REGION = os.environ['awsRegion']
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    ENVIRONMENT = os.environ['environment']
    VERTICAL_NAME = os.environ['verticalName']
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    SSM_CLIENT = boto3.client('ssm', AWS_REGION)

except Exception as excp:
    LOGGER.error("Failed to set environment variables with: %s", '{0}'.format(excp))
    sys.exit()


def get_parameter_from_event(parameters, parameter_name):
    """
    This function is to get a specific parameter from the event body
    """
    LOGGER.info("In actionGroupUtil.lambda_handler, entering method with parameter name - %s", parameter_name)
    parameter_value = ""

    LOGGER.info("In actionGroupUtil.lambda_handler, fetching parameter value..")
    for parameter in parameters:
        if parameter['name'] == parameter_name:
            parameter_value = parameter['value']
            LOGGER.info("In actionGroupUtil.lambda_handler, retrieved value of %s is - %s", parameter_name, parameter_value)
            return parameter_value

    return parameter_value


def get_item_from_resource_name(resource_type, resource_name, ddb_table, ddb_index):
    """
    This helper function is to get resource details from resource name
    Mostly used for retrieving details of Amorphic resources for Agent consumption
    """
    LOGGER.info("In actionGroupUtil.get_item_from_resource_name, entering function with resource type - %s, and resource name - %s", resource_type, resource_name)

    if resource_type == "dataset":
        domain_name = resource_name.split('.')[0]
        dataset_name = resource_name.split('.')[1]
        key_condition_expression = Key('Domain').eq(domain_name)
        filter_expression = Attr('DatasetName').eq(dataset_name)
        dataset_items = get_items_by_query_index(ddb_table, ddb_index, key_condition_expression, None, filter_expression)
        if dataset_items:
            LOGGER.info("In actionGroupUtil.get_item_from_resource_name, dataset item - %s", dataset_items[0])
            return dataset_items[0]
        else:
            return None

    if resource_type == "job":
        key_condition_expression = Key('JobName').eq(resource_name)
        job_items = get_items_by_query_index(ddb_table, ddb_index, key_condition_expression, None, None)
        if job_items:
            LOGGER.info("In actionGroupUtil.get_item_from_resource_name, job item - %s", job_items[0])
            return job_items[0]
        else:
            return None


# pylint: disable=too-many-arguments
def get_items_by_query_index(table, index_name, key_condition_expression, projection_expression=None,
                             filter_expression=None, expression_attributes_values=None,
                             expression_attributes_names=None, scan_index_forward=None,
                             exclusive_start_key=None, select=None, limit=None, is_batch_query_required=False):
    """
    returns list of items with based on the query on index/key_condition/filter
    :param table:
    :param index_name
    :param key_condition_expression:
    :param projection_expression
    :param filter_expression
    :param expression_attributes_values
    :param expression_attributes_names
    :return dynamoDB table Items
    """
    LOGGER.info("In actionGroupUtil.get_items_by_query_index ")
    api_args = {}
    if filter_expression:
        api_args["FilterExpression"] = filter_expression
    if key_condition_expression:
        api_args["KeyConditionExpression"] = key_condition_expression
    if expression_attributes_values:
        api_args["ExpressionAttributeValues"] = expression_attributes_values
    if expression_attributes_names:
        api_args["ExpressionAttributeNames"] = expression_attributes_names
    if index_name:
        api_args["IndexName"] = index_name
    if projection_expression:
        api_args["ProjectionExpression"] = projection_expression
    if scan_index_forward is not None:
        api_args["ScanIndexForward"] = scan_index_forward
    if exclusive_start_key:
        api_args["ExclusiveStartKey"] = exclusive_start_key
    if select:
        api_args["Select"] = select
    if limit:
        api_args["Limit"] = limit
    response = table.query(**api_args)
    response_items = response.get('Items', [])
    if not limit:
        while response.get("LastEvaluatedKey", None):
            api_args["ExclusiveStartKey"] = response['LastEvaluatedKey']
            response = table.query(**api_args)
            response_items.extend(response.get('Items', []))
    if is_batch_query_required:
        return response

    LOGGER.info("In actionGroupUtil.get_items_by_query_index, completed and returned %s number of items", len(response_items))
    return response_items


def get_user_id(session_id, sessions_table, sessions_table_sessionid_index):
    """
    This function is to retrieve user id from session id by querying the sessions table
    """
    key_condition = Key('SessionId').eq(session_id)
    session_item = get_items_by_query_index(DYNAMODB_RESOURCE.Table(sessions_table), sessions_table_sessionid_index, key_condition)
    LOGGER.info("In actionGroupUtil.get_user_id, session item - %s", session_item[0])
    user_id = session_item[0]['UserId']
    LOGGER.info("In actionGroupUtil.get_user_id, user id retreived - %s", user_id)
    return user_id


def get_auth_token_role_id(user_id, users_table):
    """
    This function is to retrieve auth token and role id header values from user id
    """
    LOGGER.info("In actionGroupUtil.get_auth_token_role_id, entering method with user id - %s", user_id)

    user_item = get_item_with_key(DYNAMODB_RESOURCE.Table(users_table), {'UserId' : user_id})
    LOGGER.info("In actionGroupUtil.get_auth_token_role_id, user item - %s", user_item)

    role_id = user_item['RoleId']
    auth_token = get_decrypted_value(f"/ai/{ENVIRONMENT}/access_token/{user_id}")

    LOGGER.info("In actionGroupUtil.get_auth_token_role_id, successfully retrieved role id - %s", role_id)
    return role_id, auth_token


def get_item_with_key(dynamodb_table, key):
    """
    returns single item with the unique key passed
    :param dynamodb_table:
    :param key:
    :return dynamoDB table Item
    """
    LOGGER.info("In actionGroupUtil.get_item_with_key method, with key %s", str(key))
    args = {
        "Key": key
    }
    response = dynamodb_table.get_item(**args)
    LOGGER.info("In actionGroupUtil.get_item_with_key method, response is %s", response)
    if 'Item' in response:
        if 'Groups' in response['Item']:
            response['Item']['Groups'] = list(response['Item']['Groups'])
        return response['Item']
    LOGGER.info("In actionGroupUtil.get_item_with_key method, exiting")
    return None


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


def get_referenced_filepath(file_name):
    """
    This functions checks if a given file is present in any of the sys.path directories.
    This is for handling differences in file location betwen Glue python shell and spark jobs.
    :param file_name: file name to be searched
    """
    sys.path.insert(0, '/tmp')
    for dir_name in sys.path:
        candidate = os.path.join(dir_name, file_name)
        if os.path.isfile(candidate):
            return candidate
    LOGGER.error("In actionGroupUtil.get_referenced_filepath, provided file %s could not be found", file_name)
    raise Exception(f"In actionGroupUtil.get_referenced_filepath, provided file {file_name} could not be found")


def get_dynamodb_tables_keys():
    """
    Read the dynamodb table keys from the lambda layer
    """
    try:
        with open('dynamodb_table_keys.json', 'r', encoding="utf8") as readfile:
            table_names_dict = json.load(readfile)
        return table_names_dict
    except Exception as exc:
        LOGGER.error("In actionGroupUtil.get_dynamodb_tables_keys, dynamodb_table_keys file is invalid or empty: %s", str(exc))
        sys.exit()


def get_dynamodb_ssm_parameters(project_short_name, environment, tables_names_list):
    """
    Get 10 SSM parameter in single command and iterate through all dynamodb table & index names and load it in json file
    """
    LOGGER.info("In actionGroupUtil.get_dynamodb_ssm_parameters, getting all parameters based on project %s & environment %s and writing to file %s", project_short_name, environment, DYNAMODB_SSM_PARAM_FILE)
    # !Join [ "/", [ "" , !Ref pSSMProjectShortName, !Ref pSSMVerticalName, !Ref pSSMEnvironment, "dynamoDB" ,"usersTable" ] ]
    ai_path = f"/{project_short_name}/{VERTICAL_NAME}/{environment}/dynamoDB/"
    amorphic_path = f"/{project_short_name}/{environment}/dynamoDB/"
    LOGGER.info("In actionGroupUtil.get_dynamodb_ssm_parameters, ssm paths specified -> %s, %s", ai_path, amorphic_path)
    tables_names = [tables_names_list[i * 10:(i + 1) * 10] for i in range((len(tables_names_list) + 9) // 10)]
    params_list = []
    for index in range(len(tables_names)):
        names = [amorphic_path + name.split('-', 1)[1] if name.startswith('amorphic-') else ai_path + name for name in tables_names[index]]

        max_retries = 4
        max_sleep_time = 15
        current_retry_sleep_time = 1
        while max_retries >= 0:
            try:
                response = SSM_CLIENT.get_parameters(Names=names)
                LOGGER.info("In actionGroupUtil.get_dynamodb_ssm_parameters, ssm api response -> %s", str(response))
                if response.get('InvalidParameters'):
                    raise Exception("In actionGroupUtil.get_dynamodb_ssm_parameters, These dynamodb ssm parameters are missing or not created yet - {}".format(str(response['InvalidParameters'])))
                params_list.extend(response["Parameters"])
                break
            except Exception as exc:
                LOGGER.error("In actionGroupUtil.get_dynamodb_ssm_parameters, error while fetching ssm parameters - %s", str(exc))
                if max_retries > 0:
                    max_retries = max_retries - 1
                    back_off_duration = min(max_sleep_time, current_retry_sleep_time)
                    current_retry_sleep_time *= 2
                    LOGGER.info("In actionGroupUtil.get_dynamodb_ssm_parameters, will re-try after %s seconds back-off", back_off_duration)
                    time.sleep(back_off_duration)
                else:
                    LOGGER.error("In actionGroupUtil.get_dynamodb_ssm_parameters, reached maximum retries for connection limit error")
                    raise

    # Store the retrieved parameters in a json format
    output_params = {}
    if params_list:
        for each_param_dict in params_list:
            output_params[each_param_dict["Name"].split("/")[-1]] = each_param_dict["Value"]
        LOGGER.info("In actionGroupUtil.get_dynamodb_ssm_parameters, output params dict is %s", str(output_params))
    else:
        LOGGER.error("In actionGroupUtil.get_dynamodb_ssm_parameters, Failed to retrieve SSM parameters ")

    LOGGER.info("In actionGroupUtil.get_dynamodb_ssm_parameters, load the output in temp file %s", DYNAMODB_SSM_PARAM_FILE)
    with open("/tmp/{}".format(DYNAMODB_SSM_PARAM_FILE), "w", encoding="utf8") as outfile:
        json.dump(output_params, outfile)


def read_dynamodb_ssm_param_file():
    """
    Read the dynamodb ssm parameter json file from temp directory
    """
    with open("/tmp/{}".format(DYNAMODB_SSM_PARAM_FILE), "r", encoding="utf8") as readfile:
        return_dict = json.load(readfile)
    return return_dict


# GLOBALISING DYNAMODB TABLE NAMES
try:
    tables_dict = get_dynamodb_tables_keys()

    if not os.path.exists("/tmp/{}".format(DYNAMODB_SSM_PARAM_FILE)):
        LOGGER.info("In actionGroupUtil, %s not exists in tmp dir", DYNAMODB_SSM_PARAM_FILE)
        get_dynamodb_ssm_parameters(PROJECT_SHORT_NAME, ENVIRONMENT, list(tables_dict.values()))

    try:
        dynamodb_table_names_dict = read_dynamodb_ssm_param_file()
    except Exception as ex:
        LOGGER.error("In actionGroupUtil, %s file is invalid or emtpy", DYNAMODB_SSM_PARAM_FILE)
        os.remove("/tmp/{}".format(DYNAMODB_SSM_PARAM_FILE))
        LOGGER.info("In actionGroupUtil, %s file deleted from cache - Fetching ssm parameters now", DYNAMODB_SSM_PARAM_FILE)
        get_dynamodb_ssm_parameters(PROJECT_SHORT_NAME, ENVIRONMENT, list(tables_dict.values()))
        dynamodb_table_names_dict = read_dynamodb_ssm_param_file()

    for each_table_key in tables_dict.keys():
        globals()[each_table_key] = dynamodb_table_names_dict[tables_dict[each_table_key].split('-', 1)[1]] if tables_dict[each_table_key].startswith('amorphic-') else dynamodb_table_names_dict[tables_dict[each_table_key]]

except Exception as ex:
    LOGGER.error("Failed to fetch & set Dynamodb table names %s", ex)
    sys.exit()
