"""
This utility is created to handle all boto3 dynamodb API calls
Developers are required to use this utility, if necessary update
the utility for dynamodb API calls.
"""
import json
import logging
import decimal
import sys
import os
import re
import time

from botocore.exceptions import ClientError
import boto3
import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

EVENT_INFO = errorUtil.EVENT_INFO
DELETION_PROTECTION_KEY = "AMORPHIC.CONFIG.DELETIONPROTECTIONENABLE"

try:
    DISABLE_DB_GET_CALL_LOGS = True
    DYNAMODB_SSM_PARAM_FILE = "dynamodb_ssm_params.json"
    AWS_REGION = os.environ['awsRegion']
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    ENVIRONMENT = os.environ['environment']
    VERTICAL_NAME = os.environ['verticalName']
    SSM_CLIENT = boto3.client('ssm', AWS_REGION)
except Exception as excp:
    LOGGER.error("Failed to set environment variables with: %s", '{0}'.format(excp))
    sys.exit()

def read_dynamodb_ssm_param_file():
    """
    Read the dynamodb ssm parameter json file from temp directory
    """
    with open("/tmp/{}".format(DYNAMODB_SSM_PARAM_FILE), "r", encoding="utf8") as readfile:
        return_dict = json.load(readfile)
    return return_dict

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
    LOGGER.error("In errorUtil.get_referenced_filepath,provided file %s could not be found", file_name)
    raise Exception(f"In errorUtil.get_referenced_filepath,provided file {file_name} could not be found")

def get_dynamodb_tables_keys():
    """
    Read the dynamodb table keys from the lambda layer
    """
    try:
        try:
            LOGGER.info("In dynamodbUtil, Attempting to read dynamodb_table_keys.json from layer")
            with open('/var/lang/lib/python3.12/site-packages/dynamodb_table_keys.json', 'r', encoding="utf8") as readfile:
                table_names_dict = json.load(readfile)
        except Exception:
            LOGGER.info("In dynamodbUtil, invocation is from a Glue script, attempting to read dynamodb_table_keys.json")
            with open(get_referenced_filepath('dynamodb_table_keys.json'), 'r', encoding="utf8") as readfile:
                table_names_dict = json.load(readfile)
        LOGGER.info("In dynamodbUtil, dynamodb_table_keys.json loaded successfully")
        return table_names_dict
    except Exception as exc:
        LOGGER.error("In dynamodbUtil.get_dynamodb_ssm_keys, dynamodb_table_keys file is invalid or empty: %s", str(exc))
        sys.exit()

def get_dynamodb_ssm_parameters(project_short_name, environment, tables_names_list):
    """
    Get 10 SSM parameter in single command and iterate through all dynamodb table & index names and load it in json file
    """
    LOGGER.info("In dynamodbUtil.get_dynamodb_ssm_parameters, getting all parameters based on project %s & environment %s and writing to file %s", project_short_name, environment, DYNAMODB_SSM_PARAM_FILE)
    # !Join [ "/", [ "" , !Ref pSSMProjectShortName, !Ref pSSMVerticalName, !Ref pSSMEnvironment, "dynamoDB" ,"usersTable" ] ]
    path = f"/{project_short_name}/{VERTICAL_NAME}/{environment}/dynamoDB/"
    LOGGER.info("In dynamodbUtil.get_dynamodb_ssm_parameters, ssm path specified -> %s", path)
    tables_names = [tables_names_list[i * 10:(i + 1) * 10] for i in range((len(tables_names_list) + 9) // 10)]
    params_list = []
    for index in range(len(tables_names)):
        names = [path + name for name in tables_names[index]]

        max_retries = 4
        max_sleep_time = 15
        current_retry_sleep_time = 1
        while max_retries >= 0:
            try:
                response = SSM_CLIENT.get_parameters(Names=names)
                LOGGER.info("In dynamodbUtil.get_dynamodb_ssm_parameters, ssm api response -> %s", str(response))
                if response.get('InvalidParameters'):
                    raise Exception("In dynamodbUtil.get_dynamodb_ssm_parameters, These dynamodb ssm parameters are missing or not created yet - {}".format(str(response['InvalidParameters'])))
                params_list.extend(response["Parameters"])
                break
            except Exception as exc:
                LOGGER.error("Error %s", str(exc))
                if max_retries > 0:
                    max_retries = max_retries - 1
                    back_off_duration = min(max_sleep_time, current_retry_sleep_time)
                    current_retry_sleep_time *= 2
                    LOGGER.info("In dynamodbUtil.get_dynamodb_ssm_parameters, will re-try after %s seconds back-off", back_off_duration)
                    time.sleep(back_off_duration)
                else:
                    LOGGER.error("In dynamodbUtil.get_dynamodb_ssm_parameters, reached maximum retries for connection limit error")
                    raise

    # Store the retrieved parameters in a json format
    output_params = {}
    if params_list:
        for each_param_dict in params_list:
            output_params[each_param_dict["Name"].split("/")[-1]] = each_param_dict["Value"]
        LOGGER.info("In dynamodbUtil.get_dynamodb_ssm_parameters, output params dict is %s", str(output_params))
    else:
        LOGGER.error("In dynamodbUtil.get_dynamodb_ssm_parameters, Failed to retrieve SSM parameters ")

    LOGGER.info("In dynamodbUtil.get_dynamodb_ssm_parameters, load the output in temp file %s", DYNAMODB_SSM_PARAM_FILE)
    with open("/tmp/{}".format(DYNAMODB_SSM_PARAM_FILE), "w", encoding="utf8") as outfile:
        json.dump(output_params, outfile)

try:
    tables_dict = get_dynamodb_tables_keys()

    if not os.path.exists("/tmp/{}".format(DYNAMODB_SSM_PARAM_FILE)):
        LOGGER.info("In dynamodbUtil, %s not exists in tmp dir", DYNAMODB_SSM_PARAM_FILE)
        get_dynamodb_ssm_parameters(PROJECT_SHORT_NAME, ENVIRONMENT, list(tables_dict.values()))

    try:
        dynamodb_table_names_dict = read_dynamodb_ssm_param_file()
    except Exception as ex:
        LOGGER.error("In dynamodbUtil, %s file is invalid or emtpy", DYNAMODB_SSM_PARAM_FILE)
        os.remove("/tmp/{}".format(DYNAMODB_SSM_PARAM_FILE))
        LOGGER.info("In dynamodbUtil, %s file deleted from cache - Fetching ssm parameters now", DYNAMODB_SSM_PARAM_FILE)
        get_dynamodb_ssm_parameters(PROJECT_SHORT_NAME, ENVIRONMENT, list(tables_dict.values()))
        dynamodb_table_names_dict = read_dynamodb_ssm_param_file()

    for each_table_key in tables_dict.keys():
        globals()[each_table_key] = dynamodb_table_names_dict[tables_dict[each_table_key]]

except Exception as ex:
    LOGGER.error("Failed to fetch & set Dynamodb table names %s", ex)
    sys.exit()


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
        return super().default(o)

def set_default(obj):
    """
    Helper class to convert a set to JSON.
    """
    if isinstance(obj, set):
        return list(obj)
    raise TypeError

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
    LOGGER.info("In dynamodbUtil.get_items_by_query_index ")
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

    LOGGER.info("In dynamodbUtil.get_items_by_query_index, completed and returned %s number of items", len(response_items))
    return response_items

def get_item_details_query(table, key_condition_expression, filter_expression=None, projection_expression=None):
    """
    Returns dynamodb table item
    :param dynamodb_table:
    :param key_condition_expression:
    :return: dynamoDB table Item
    """
    LOGGER.info("In dynamodbUtil.get_item_details_query method")
    query_args = {
        "KeyConditionExpression": key_condition_expression
    }
    if filter_expression:
        query_args.update({
            "FilterExpression": filter_expression
        })
    if projection_expression:
        query_args.update({
            "ProjectionExpression": projection_expression
        })
    res = table.query(**query_args)
    details = res['Items']
    while 'LastEvaluatedKey' in res:
        query_args.update({
            "ExclusiveStartKey": res['LastEvaluatedKey']
        })
        res = table.query(**query_args)
        details.extend(res['Items'])
    LOGGER.info("In dynamodbUtil.get_item_details_query method, exiting")
    return details

def batch_write_items(dynamodb_table, items):
    """
    Batch writer to dynamodb table
    :param dynamodb_table:
    :param items:
    :return:
    """
    LOGGER.info("In dynamodbUtil.batch_write_items")
    with dynamodb_table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)
    LOGGER.info("In dynamodbUtil.batch_write_items, exiting")

def batch_put_update_delete_items(dynamodb_table, items):
    """
    This method is user for batch create/update/delete dynamoDB items
    :param items: list of items for the action to be perfomed on
    """
    LOGGER.info("In dynamodbUtil.batch_put_update_delete_items, starting the method")
    batch_size = 25
    for i in range(0, len(items), batch_size):
        batch_items = items[i:i + batch_size]

        # Perform the batch write operation
        ##########************************########
        ######## Update is not working  #########
        with dynamodb_table.batch_writer() as batch:
            for item in batch_items:
                if "Put" in item:
                    batch.put_item(**item['Put'])
                elif 'Update' in item:
                    batch.update_item(**item['Update'])
                elif 'Delete' in item:
                    batch.delete_item(**item['Delete'])
                else:
                    LOGGER.info("In dynamodbUtil.batch_put_update_delete_items, invalid request received - %s", str(item))

    LOGGER.info("In dynamodbUtil.batch_put_update_delete_items, exiting")

def batch_delete_items(dynamodb_table, key_list):
    """
    Removing the items from dynamoDB table in batch mode
    :param dynamodb_table:
    :param key_list:
    """
    LOGGER.info("In dynamodbUtil.batch_delete_items")
    with dynamodb_table.batch_writer() as batch:
        for key in key_list:
            # add it to the dynamoDB table batch
            batch.delete_item(Key=key)
    LOGGER.info("In dynamodbUtil.batch_delete_items, exiting")

def batch_get_items(dynamodb_resource, table_name, key_list, projection_expression=None, expression_attribute_names=None):
    """
    This method takes a list of keys to retrieve respective values
    API can be used for multiple tables, but method is designed to handle one table
    and Unprocessed keys is not being used to retireve values that were not processed in
    previous calls(Not enough info and couldn't produce a scenario). So using breaking list
    into batch at program level
    :param dynamodb_resource: boto3.resource("dynamodb")
    :param table_name: table name in dynamodb
    :param key_list: {"KeyName": "KeyValue"}
    :param projection_expression:
    :param expression_attribute_names:
    """
    LOGGER.info("In dynamodbUtil.batch_get_items method, length of key_list is %s", len(key_list))
    return_items = []
    unprocessed_keys = []
    batch_size = 50
    for i in range(0, len(key_list), batch_size):
        request_item = {
            table_name: {
                "Keys": key_list[i:i + batch_size],
                "ConsistentRead": True
            }
        }

        if projection_expression:
            request_item[table_name]["ProjectionExpression"] = projection_expression
        if expression_attribute_names:
            request_item[table_name]["ExpressionAttributeNames"] = expression_attribute_names

        response_get_items = dynamodb_resource.meta.client.batch_get_item(
            RequestItems=request_item,
            ReturnConsumedCapacity="TOTAL"
        )
        unprocessed_keys.append(response_get_items["UnprocessedKeys"] if "UnprocessedKeys" in response_get_items and response_get_items["UnprocessedKeys"] else {})
        return_items.extend(response_get_items["Responses"][table_name] if response_get_items\
            and "Responses" in response_get_items\
                and table_name in response_get_items["Responses"] else [])
    LOGGER.info("In dynamodbUtil.batch_get_items method, number of items returned are %s", str(len(return_items)))
    LOGGER.info("In dynamodbUtil.batch_get_items method, exiting method")
    return return_items

def get_item_with_key(dynamodb_table, key):
    """
    returns single item with the unique key passed
    :param dynamodb_table:
    :param key:
    :return dynamoDB table Item
    """
    LOGGER.info("In dynamodbUtil.get_item_with_key method, with key %s", str(key))
    args = {
        "Key": key
    }
    response = dynamodb_table.get_item(**args)
    LOGGER.info("In dynamodbUtil.get_item_with_key method, response is %s", response)
    if 'Item' in response:
        if 'Groups' in response['Item']:
            response['Item']['Groups'] = list(response['Item']['Groups'])
        return response['Item']
    LOGGER.info("In dynamodbUtil.get_item_with_key method, exiting")
    return None

def get_item_by_key_with_projection(dynamodb_table, key, projection_expression):
    """
    returns single item with the unique key passed
    :param dynamodb_table:
    :param key:
    :return dynamoDB table Item
    """
    LOGGER.info("In dynamodbUtil.get_item_by_key_with_projection with key %s", str(key))
    args = {
        "Key": key,
        "ProjectionExpression": projection_expression
    }
    response = dynamodb_table.get_item(**args)
    if 'Item' in response:
        return response['Item']
    LOGGER.info("In dynamodbUtil.get_item_by_key_with_projection method, exiting")
    return None

def get_item_by_key_with_exp_proj(dynamodb_table, key, projection_expression, exp_attr_values):
    """
    returns single item with the unique key passed
    :param dynamodb_table:
    :param key:
    :return dynamoDB table Item
    """
    LOGGER.info("In dynamodbUtil.get_item_by_key_with_exp_proj method, with key %s", str(key))
    args = {
        "Key": key,
        "ProjectionExpression": projection_expression,
        "ExpressionAttributeNames": exp_attr_values
    }
    response = dynamodb_table.get_item(**args)
    if 'Item' in response:
        return response['Item']
    LOGGER.info("In dynamodbUtil.get_item_by_key_with_exp_proj method, exiting")
    return None

def get_items_with_index(dynamodb_table, key_condition_expression, projection_expression, gsi_index_name):
    """
    returns list of items with based on the query on index
    :param dynamodb_table:
    :param key_condition_expression:
    :param projection_expression
    :param gsi_index_name
    :return dynamoDB table Items
    """
    LOGGER.info("In dynamodbUtil.get_items_with_index method")
    response_dynamo_items = get_items_by_query_index(dynamodb_table, gsi_index_name, key_condition_expression, projection_expression, None, None)
    LOGGER.info("In dynamodbUtil.get_items_with_index method, exiting")
    return response_dynamo_items

def get_items_by_query(dynamodb_table, key_condition_expression, projection_expression):
    """
    Returns list ot items based on key_expression
    :param dynamodb_table:
    :param key_condition_expression:
    :param projection_expression:
    :return: dynamoDB table Items
    """
    LOGGER.info("In dynamodbUtil.get_items_by_query method")
    response_dynamo_items = get_items_by_query_index(dynamodb_table, None, key_condition_expression, projection_expression, None, None)
    LOGGER.info("In dynamodbUtil.get_items_by_query method, exiting")
    return response_dynamo_items

def get_items_by_query_with_filter(dynamodb_table, key_condition_expression, projection_expression, filter_expression, index_name, exp_attr_values):
    """
    Returns list ot items based on key_expression
    :param dynamodb_table:
    :param key_condition_expression:
    :param projection_expression:
    :return: dynamoDB table Items
    """
    LOGGER.info("In dynamodbUtil.get_items_by_query_with_filter method")
    response_items = get_items_by_query_index(dynamodb_table, index_name, key_condition_expression, projection_expression, filter_expression, exp_attr_values)
    LOGGER.info("In dynamodbUtil.get_items_by_query_with_filter method, exiting")
    return response_items

def get_item_count_with_filter(dynamodb_table, filter_expression=None, expression_attribute_names=None, expression_attribute_values=None):
    """
    Returns the matched and total rows scanned
    """
    LOGGER.info("In dynamodbUtil.get_item_count_with_filter method")
    return_val = {
        "MatchedCount": 0,
        "TotalCount": 0
    }
    input_args = {
        "Select": "COUNT"
    }
    if filter_expression:
        input_args["FilterExpression"] = filter_expression
    if expression_attribute_names:
        input_args["ExpressionAttributeNames"] = expression_attribute_names
    if expression_attribute_values:
        input_args["ExpressionAttributeValues"] = expression_attribute_values

    response = dynamodb_table.scan(**input_args)
    return_val["MatchedCount"] = return_val["MatchedCount"] + response["Count"]
    return_val["TotalCount"] = return_val["TotalCount"] + response["ScannedCount"]
    while 'LastEvaluatedKey' in response:
        input_args["ExclusiveStartKey"] = response['LastEvaluatedKey']
        response = dynamodb_table.scan(**input_args)
        return_val["MatchedCount"] = return_val["MatchedCount"] + response["Count"]
        return_val["TotalCount"] = return_val["TotalCount"] + response["ScannedCount"]
    LOGGER.info("In dynamodbUtil.get_item_count_with_filter method, exiting")
    return return_val

def put_item(dynamodb_table, item, condition_expression=None):
    """
    puts single item with the unique item passed
    :param dynamodb_table:
    :param item:
    :return status - success/error
    """
    LOGGER.info("In dynamodbUtil.put_item, with item - %s", str(item))
    put_item_args = {
        "Item": item
    }
    if condition_expression:
        put_item_args.update({
            "ConditionExpression": condition_expression
        })
    response_message = "error"
    response = dynamodb_table.put_item(**put_item_args)
    if response['ResponseMetadata']['HTTPStatusCode'] == 200:
        LOGGER.info('In dynamodbUtil.put_item, Item inserted successfully in dynamodb table.')
        response_message = "success"
    LOGGER.info("In dynamodbUtil.put_item, exiting")
    return response_message

def update_item_by_key(dynamodb_table, key, update_expression, expression_attribute_values=None, expression_attribute_names=None, condition_expression=None):
    """
    This function will update the status of dataset registration in dynamodb
    :param dynamodb_table:
    :type dynamodb_table: DynamoDb Table Object
    :param key:
    :param update_expression:
    :param expression_attributes:
    :returns: string - success, condition-error, error
    """
    LOGGER.info("In dynamodbUtil.update_item_by_key, updating table in dynamoDB")
    LOGGER.info("In dynamodbUtil.update_item_by_key, key - %s, update_expression - %s, expression_attribute_values - %s, expression_attribute_names - %s, condition_expression - %s", key, update_expression, expression_attribute_values, expression_attribute_names, condition_expression)
    response_message = "error"
    update_item_args = {
        "Key": key,
        "UpdateExpression": update_expression
    }
    if expression_attribute_values:
        update_item_args.update({
            "ExpressionAttributeValues": expression_attribute_values
        })
    if expression_attribute_names:
        update_item_args.update({
            "ExpressionAttributeNames": expression_attribute_names
        })
    if condition_expression:
        update_item_args.update({
            "ConditionExpression": condition_expression
        })

    LOGGER.info("In dynamodbUtil.update_item_by_key, update_item_args - %s", update_item_args)
    try:
        response = dynamodb_table.update_item(**update_item_args)
        LOGGER.info("In dynamodbUtil.update_item_by_key, update_item response - %s", response)
        if response['ResponseMetadata']['HTTPStatusCode'] != 200:
            response_message = "error"
        else:
            response_message = "success"
    except ClientError as c_e:
        if c_e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            LOGGER.error("In dynamodbUtil.update_item_by_key, update failed because condition is not satisfied")
            response_message = "condition-error"
        else:
            LOGGER.error("In dynamodbUtil.update_item_by_key, update failed with code %s and message %s",\
                c_e.response["Error"]["Code"], c_e.response["Error"]["Message"])
            response_message = "error"
    LOGGER.info("In dynamodbUtil.update_item_by_key, exiting..")
    return response_message

def delete_item_by_key(dynamodb_table, key):
    """
    deletes single item with the unique key passed
    :param dynamodb_table:
    :param key:
    :return status - success/error
    """
    LOGGER.info("In dynamodbUtil.delete_item_by_key")
    response_message = "error"
    delete_args = {
        "Key": key
    }
    response = dynamodb_table.delete_item(**delete_args)
    if response['ResponseMetadata']['HTTPStatusCode'] == 200:
        response_message = "success"
    return response_message

def scan_with_pagination(dynamodb_table, filter_expression=None, projection_expression=None, expression_attributes_name=None, index_name=None, limit=None):
    """
    Returns dynaodb table items
    :param dynamodb_table:
    :param filter_expression:
    :param projection_expression:
    :param expression_attributes_name:
    :return: dynamoDB table Items
    """
    LOGGER.info("In dynamodbUtil.scan_with_pagination, filter_expression - %s, projection_expression - %s",
                filter_expression, projection_expression)
    api_args = {}
    if filter_expression:
        api_args["FilterExpression"] = filter_expression
    if projection_expression:
        api_args["ProjectionExpression"] = projection_expression
    if expression_attributes_name:
        api_args["ExpressionAttributeNames"] = expression_attributes_name
    if index_name:
        api_args["IndexName"] = index_name
    if limit:
        api_args["Limit"] = limit
    response = dynamodb_table.scan(**api_args)
    response_items = [item for item in response['Items'] if item] if response['Items'] else []
    while 'LastEvaluatedKey' in response:
        if limit:
            # Validate limits and perform scan accordingly
            fetch_more_results = bool(len(response_items) <= limit)
        else:
            # Scan DB to fetch more results if the limit is not passed
            fetch_more_results = True
        if fetch_more_results:
            api_args["ExclusiveStartKey"] = response['LastEvaluatedKey']
            response = dynamodb_table.scan(**api_args)
            if response['Items']:
                response_items.extend([item for item in response['Items'] if item])
            else:
                LOGGER.error("In dynamodbUtil.scan_with_pagination, No item value found while paginating")
        else:
            break
    # Slicing the results based on the limit passed
    response_items = response_items[:limit] if limit else response_items
    LOGGER.info("In dynamodbUtil.scan_with_pagination, completed and returned %s number of items", len(response_items))
    return response_items

def is_dynamodb_table_empty(dynamodb_table):
    """
    Returns dynaodb table Empty or Not
    :param dynamodb_table:
    :return: True or False
    """
    LOGGER.info("In dynamodbUtil.is_dynamodb_table_empty method")
    is_table_empty = False
    response = dynamodb_table.scan()
    if 'Count' in response and response['Count'] == 0:
        is_table_empty = True
    LOGGER.info("In dynamodbUtil.is_dynamodb_table_empty method the table is empty - %s", str(is_table_empty))
    return is_table_empty

def sort_page_in_dynamo(**kwargs):
    """
    This function is to sort results & paginate them programatically
    :param dynamodb_table
    :param index_name
    :param sort_order
    :param offset
    :param items_limit
    :param dict_key
    """
    LOGGER.info("In dynamodbUtil.sort_page_in_dynamo sorting & paginating items based on the inputs - %s", str(kwargs))
    dynamodb_table = kwargs['dynamodb_table']
    # Get the total_count and LastEvaluatedKeys in {"StartIndex": "", "EndIndex": "", "LastEvaluatedKey": ""} format
    dynamo_count_item_list = []
    total_item_count = 0
    sorted_dynamo_items = {}
    response_dynamo_items = []
    new_offset = kwargs["offset"]
    dynamo_query_args = {
        "KeyConditionExpression": kwargs['key_expression'],
        "ExpressionAttributeValues": kwargs['expression_attributes'],
        "ScanIndexForward": kwargs['sort_order'] == 'asc',
        "Select": "COUNT"
    }
    if kwargs.get("index_name"):
        dynamo_query_args["IndexName"] = kwargs["index_name"]
    if kwargs.get("filter_expression"):
        dynamo_query_args["FilterExpression"] = kwargs["filter_expression"]
    if kwargs.get("expression_attributes_names"):
        dynamo_query_args["ExpressionAttributeNames"] = kwargs["expression_attributes_names"]

    dynamo_count_response = dynamodb_table.query(**dynamo_query_args)
    dynamo_count_item = {"StartIndex": 0, "EndIndex": dynamo_count_response["Count"] - 1}
    if "LastEvaluatedKey" in dynamo_count_response:
        dynamo_count_item["LastEvaluatedKey"] = dynamo_count_response["LastEvaluatedKey"]

    dynamo_count_item_list.append(dynamo_count_item)

    while 'LastEvaluatedKey' in dynamo_count_response:
        dynamo_query_args["ExclusiveStartKey"] = dynamo_count_response['LastEvaluatedKey']
        dynamo_count_response = dynamodb_table.query(**dynamo_query_args)
        dynamo_count_item = {"StartIndex": dynamo_count_item["EndIndex"] + 1, "EndIndex": dynamo_count_item["EndIndex"] + dynamo_count_response["Count"]}
        if "LastEvaluatedKey" in dynamo_count_response:
            dynamo_count_item["LastEvaluatedKey"] = dynamo_count_response["LastEvaluatedKey"]

        dynamo_count_item_list.append(dynamo_count_item)

    total_item_count = dynamo_count_item["EndIndex"] + 1

    LOGGER.info("In dynamodbUtil.sort_page_in_dynamo, total_count_items - %s, list of count objects - %s", str(total_item_count), str(dynamo_count_item_list))
    # check if there are rows to return
    if total_item_count > 0:
        # Once we have the list of indices and LastEvaluatedKeys, need to extract the data based on the offset and item_count requested by API.
        offset_index = -1
        offset_limit_index = len(dynamo_count_item_list) - 1
        # Get the index for offset
        for i in range(len(dynamo_count_item_list)):
            if kwargs["offset"] >= dynamo_count_item_list[i]["StartIndex"] and kwargs["offset"] <= dynamo_count_item_list[i]["EndIndex"]:
                offset_index = i
            if kwargs["offset"] + kwargs["items_limit"] >= dynamo_count_item_list[i]["StartIndex"] and kwargs["offset"] + kwargs["items_limit"] <= dynamo_count_item_list[i]["EndIndex"]:
                offset_limit_index = i

        LOGGER.info("In dynamodbUtil.sort_page_in_dynamo, offset_index - %s, offset_limit_index - %s", offset_index, offset_limit_index)
        # raise error as the offset is invalid, it must be between 0 and total_number_of_rows
        if offset_index == -1:
            ec_ipv_1026 = errorUtil.get_error_object("IPV-1026")
            ec_ipv_1026['Message'] = ec_ipv_1026['Message'].format("OffsetIndex", total_item_count)
            raise Exception(ec_ipv_1026['Message'])
        dynamo_query_args.pop("Select", None)
        for i in range(offset_index, offset_limit_index+1):
            if i == 0:
                dynamo_query_args.pop("ExclusiveStartKey", None)
                # Call dynamodb_items_response without any LastEvaluatedKey
                dynamo_items = dynamodb_table.query(**dynamo_query_args)
                if i == offset_index:
                    new_offset = kwargs['offset']
            else:
                dynamo_query_args["ExclusiveStartKey"] = dynamo_count_item_list[i - 1]['LastEvaluatedKey']
                dynamo_items = dynamodb_table.query(**dynamo_query_args)
                if i == offset_index:
                    new_offset = kwargs['offset'] - dynamo_count_item_list[i]['StartIndex']
            response_dynamo_items.extend(dynamo_items['Items'])

    # Formatting the final output
    sorted_dynamo_items[kwargs['dict_key']] = response_dynamo_items[new_offset: new_offset+kwargs['items_limit']]
    sorted_dynamo_items['next_available'] = 'yes' if total_item_count > kwargs['offset']+kwargs['items_limit'] else 'no'
    sorted_dynamo_items['count'] = len(sorted_dynamo_items[kwargs['dict_key']])
    sorted_dynamo_items['total_count'] = total_item_count
    LOGGER.info("In dynamodbUtil.sort_page_in_dynamo, sorting & paginating results - %s", str(sorted_dynamo_items))
    return sorted_dynamo_items


def check_dynamodb_table_exists(dynamodb_client, table_name):
    """
    check if the input table name exists in AWS Dynamodb
    :param dynamodb_client:
    :param table_name:
    :return:
    """
    LOGGER.info("In dynamodbUtil.check_dynamodb_table_exists, table_name - %s", table_name)
    try:
        response = dynamodb_client.describe_table(TableName=table_name)
        LOGGER.info("In dynamodbUtil.check_dynamodb_table_exists, response - %s", json.dumps(response, default=str))
        return True
    except dynamodb_client.exceptions.ResourceNotFoundException:
        LOGGER.info("In dynamodbUtil.check_dynamodb_table_exists, table %s doesn't exists", table_name)
        return False


def create_dynamodb_table(dynamodb_client, create_table_args):
    """
    Create DynamoDB table for dataset
    :param dynamodb_client:
    :param create_table_args:
        :return:
    """
    LOGGER.info("In dynamodbUtil.create_dynamodb_table, creation of dynamodb table started")
    LOGGER.info("In dynamodbUtil.create_dynamodb_table, create_table_args - %s",
                json.dumps(create_table_args, default=str))
    try:
        create_table_args['BillingMode'] = 'PAY_PER_REQUEST'
        ssm_client = boto3.client('ssm')
        response = ssm_client.get_parameter(
            Name=DELETION_PROTECTION_KEY,
            WithDecryption=True
        )
        if response['Parameter']['Value'] == 'yes':
            create_table_args['DeletionProtectionEnabled'] = True
        create_table_args['SSESpecification'] = {
            "Enabled": True,
            "SSEType": "KMS"
        }
        # Check if 'BackupEnabled' tag is already present with value 'yes'
        backup_tag_exists = any(tag for tag in create_table_args['Tags'] if tag['Key'] == 'BackupEnabled' and tag['Value'] == 'yes')
        # Append the tag BackupEnabled and it's value as yes for compliance only if it doesn't exist
        if not backup_tag_exists:
            create_table_args['Tags'].append({'Key': 'BackupEnabled', 'Value': 'yes'})
        LOGGER.info("In dynamodbUtil.create_dynamodb_table, creating dynamodb table - %s", create_table_args['TableName'])
        create_table_response = dynamodb_client.create_table(**create_table_args)
        LOGGER.info("In dynamodbUtil.create_dynamodb_table, response - %s", json.dumps(create_table_response, default=str))
        # get status of the dynamodb table with multiple retries
        # table creation takes 10-15 seconds to finish so below loop will ensure it is done before updating continuous backups
        max_retry = 10
        for retry_num in range(max_retry):
            time.sleep(2)
            LOGGER.info("In dynamodbUtil.create_dynamodb_table, retry_num - %s, max_retry - %s", retry_num, max_retry)
            describe_table_response = dynamodb_client.describe_table(TableName=create_table_args['TableName'])
            LOGGER.info("In dynamodbUtil.create_dynamodb_table, table status is - %s", describe_table_response['Table']['TableStatus'])
            if describe_table_response['Table']['TableStatus'] == 'ACTIVE':
                LOGGER.info("In dynamodbUtil.create_dynamodb_table, wait 5 seconds")
                break
        # enable backup on the above created table
        for retry_num in range(max_retry):
            try:
                LOGGER.info("In dynamodbUtil.create_dynamodb_table, Update continuous backup, retry_num - %s, max_retry - %s", retry_num, max_retry)
                update_backup_response = dynamodb_client.update_continuous_backups(
                    TableName=create_table_args['TableName'],
                    PointInTimeRecoverySpecification={
                        'PointInTimeRecoveryEnabled': True
                    }
                )
                LOGGER.info("In dynamodbUtil.create_dynamodb_table, update_backup_response - %s", json.dumps(update_backup_response, default=str))
            except dynamodb_client.exceptions.ContinuousBackupsUnavailableException:
                LOGGER.info("In dynamodbUtil.create_dynamodb_table, backups are still being enabled for the table %s", create_table_args['TableName'])
                time.sleep(2)
            except Exception as exc:
                LOGGER.error("In dynamodbUtil.create_dynamodb_table, Unable to update continuous backups to dynamodb table %s. Error message - %s",
                             create_table_args['TableName'], str(exc))
                ec_db_1007 = errorUtil.get_error_object("DB-1007")
                ec_db_1007["Message"] = ec_db_1007["Message"].format(str(exc))
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1007)
            else:
                break

        get_backup_response = dynamodb_client.describe_continuous_backups(
            TableName=create_table_args['TableName']
        )
        LOGGER.info("In dynamodbUtil.create_dynamodb_table, get_backup_response - %s", json.dumps(get_backup_response, default=str))
    except Exception as exc:
        LOGGER.error("In dynamodbUtil.create_dynamodb_table, dynamodb table creation failed with error - %s", exc)
        ec_db_1008 = errorUtil.get_error_object("DB-1008")
        ec_db_1008["Message"] = ec_db_1008["Message"].format("create", str(exc))
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1008)

    LOGGER.info("In dynamodbUtil.create_dynamodb_table, creation of dynamodb table completed successfully")


def update_dynamodb_table(dynamodb_client, update_table_args):
    """
    update DynamoDB table for dataset
    :param dynamodb_client:
    :param update_table_args:
        :return:
    """
    LOGGER.info("In dynamodbUtil.update_dynamodb_table, dynamodb table update started")
    LOGGER.info("In dynamodbUtil.update_dynamodb_table, update_table_args - %s",
                json.dumps(update_table_args, default=str))
    try:
        # check if dynamodb table is in active state
        describe_table_response = dynamodb_client.describe_table(TableName=update_table_args['TableName'])
        if describe_table_response['Table']['TableStatus'] != 'ACTIVE':
            LOGGER.error("In dynamodbUtil.update_dynamodb_table, dynamodb table %s is in %s state. It must be in ACTIVE state to update it",
                         update_table_args['TableName'], describe_table_response['Table']['TableStatus'])
            ec_ge_1043 = errorUtil.get_error_object("GE-1043")
            ec_ge_1043["Message"] = ec_ge_1043["Message"].format("dynamodb dataset table", "Active")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1043)
        LOGGER.info("In dynamodbUtil.update_dynamodb_table, updating dynamodb table - %s", update_table_args['TableName'])
        update_table_response = dynamodb_client.update_table(**update_table_args)
        LOGGER.info("In dynamodbUtil.update_dynamodb_table, response - %s", json.dumps(update_table_response, default=str))
        # get status of the dynamodb table with multiple retries
        # table creation takes 10-15 seconds to finish to below for loop will ensure it is done
        max_retry = 7
        for retry_num in range(max_retry):
            time.sleep(3)
            LOGGER.info("In dynamodbUtil.update_dynamodb_table, retry_num - %s, max_retry - %s", retry_num, max_retry)
            describe_table_response = dynamodb_client.describe_table(TableName=update_table_args['TableName'])
            LOGGER.info("In dynamodbUtil.update_dynamodb_table, table status is - %s",
                        describe_table_response['Table']['TableStatus'])
            if describe_table_response['Table']['TableStatus'] == 'ACTIVE':
                break
    except Exception as exc:
        LOGGER.error("In dynamodbUtil.update_dynamodb_table, update dynamodb table failed with error - %s", exc)
        ec_db_1008 = errorUtil.get_error_object("DB-1008")
        ec_db_1008["Message"] = ec_db_1008["Message"].format("update", str(exc))
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1008)

    LOGGER.info("In dynamodbUtil.update_dynamodb_table, dynamodb table update completed successfully")


def delete_dynamodb_table(dynamodb_client, table_name):
    """
    Delete DynamoDB table for dataset
    :param dynamodb_client:
    :param table_name:
        :return:
    """
    LOGGER.info("In dynamodbUtil.delete_dynamodb_table, dynamodb table deletion started")
    LOGGER.info("In dynamodbUtil.delete_dynamodb_table, table_name - %s", table_name)

    try:
        # check if dynamodb table is in active state
        describe_table_response = dynamodb_client.describe_table(TableName=table_name)
        if describe_table_response['Table']['TableStatus'] != 'ACTIVE':
            LOGGER.error("In dynamodbUtil.delete_dynamodb_table, dynamodb table %s is in %s state. It must be in ACTIVE state to delete it",
                         table_name, describe_table_response['Table']['TableStatus'])
            ec_ge_1043 = errorUtil.get_error_object("GE-1043")
            ec_ge_1043["Message"] = ec_ge_1043["Message"].format("dynamodb dataset table", "Active")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1043)

        delete_response = dynamodb_client.delete_table(
            TableName=table_name
        )
        LOGGER.info("In dynamodbUtil.delete_dynamodb_table, response - %s", json.dumps(delete_response, default=str))
        ssm_client = boto3.client('ssm')
        response = ssm_client.get_parameter(
            Name=DELETION_PROTECTION_KEY,
            WithDecryption=True
        )
        if response['Parameter']['Value'] == 'yes':
            # Setting deletion protection enabled property to false
            LOGGER.info("In dynamodbUtil.delete_dynamodb_table, setting DeletionProtectionEnabled to False for table %s.", table_name)
            dynamodb_client.update_table(
                TableName=table_name,
                DeletionProtectionEnabled=False
            )
            LOGGER.info("In dynamodbUtil.delete_dynamodb_table, DeletionProtectionEnabled successfully set to False for table %s.", table_name)
        # get status of the dynamodb table with multiple retries
        max_retry = 7
        for retry_num in range(max_retry):
            time.sleep(3)
            LOGGER.info("In dynamodbUtil.delete_dynamodb_table, retry_num - %s, max_retry - %s", retry_num, max_retry)
            describe_table_response = dynamodb_client.describe_table(TableName=table_name)
            LOGGER.info("In dynamodbUtil.delete_dynamodb_table, table status is - %s",
                        describe_table_response['Table']['TableStatus'])
            if describe_table_response['Table']['TableStatus'] == 'DELETING':
                break
    except ClientError as c_e:
        LOGGER.error("In dynamodbUtil.delete_dynamodb_table, client error encountered is %s", str(c_e))
        if c_e.response['Error']['Code'] == "ResourceNotFoundException":
            LOGGER.info("In dynamodbUtil.delete_dynamodb_table, Error encountered with code - %s and message - %s",
                        c_e.response["Error"]["Code"], c_e.response["Error"]["Message"])
            LOGGER.info("In dynamodbUtil.delete_dynamodb_table, Dynamodb table %s was successfully deleted", table_name)
        else:
            LOGGER.error("In dynamodbUtil.delete_dynamodb_table, dynamodb table deletion raised an error - %s", str(c_e))
            ec_db_1008 = errorUtil.get_error_object("DB-1008")
            ec_db_1008["Message"] = ec_db_1008["Message"].format("delete", str(c_e))
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1008)
    except Exception as exc:
        LOGGER.error("In dynamodbUtil.delete_dynamodb_table, dynamodb table deletion raised an error - %s", exc)
        ec_db_1008 = errorUtil.get_error_object("DB-1008")
        ec_db_1008["Message"] = ec_db_1008["Message"].format("delete", str(exc))
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1008)
    LOGGER.info("In dynamodbUtil.delete_dynamodb_table, dynamodb table deletion completed successfully")


def validate_attribute_schema(key_schema_elements_list, validate_type):
    """
    Validate schema of attributes in DynamoDB table
    :param key_schema_elements_list:
    :param validate_type:
    :return:
    """
    LOGGER.info("In dynamodbUtil.validate_attribute_schema, key_schema_elements_list - %s, validate_type - %s",
                json.dumps(key_schema_elements_list, default=str), validate_type)
    error_columns = []
    col_name_pattern = re.compile("^[a-zA-Z][a-zA-Z0-9_]{1,255}$")
    col_type_pattern = re.compile("^(string|number|binary)$")
    for col_def in key_schema_elements_list:
        LOGGER.info("In dynamodbUtil.validate_attribute_schema, col_def - %s", json.dumps(col_def, default=str))
        if validate_type == "name":
            if not col_name_pattern.match(col_def['name']):
                error_columns.append(col_def['name'])
        elif validate_type == "type":
            if not col_type_pattern.match(col_def['type']):
                error_columns.append(col_def['type'])
    LOGGER.info("In dynamodbUtil.validate_attribute_schema, error_columns - %s", json.dumps(error_columns, default=str))
    return set(error_columns)


def convert_dataset_schema_to_dynamodb(dataset_schema, dataset_key_attrs_list):
    """

    :param dataset_schema:
    :param dataset_key_attrs_list:
    :return:
    """
    dynamodb_attr_key_types = {
        "string": "S",
        "number": "N",
        "binary": "B"
    }
    dataset_key_attr_names_list = [attr_def['AttributeName'] for attr_def in dataset_key_attrs_list]
    converted_dataset_schema_list = []
    converted_dataset_schema_list.extend(dataset_key_attrs_list)
    for attr_def in dataset_schema:
        if attr_def['name'] not in dataset_key_attr_names_list:
            LOGGER.info("In dynamodbUtil.convert_dataset_schema_to_dynamodb, AttributeName %s is not part of dataset keys", attr_def['name'])
            converted_dataset_schema_list.append({
                "AttributeName": attr_def['name'],
                "AttributeType": dynamodb_attr_key_types[attr_def['type'].lower()]
            })
        else:
            LOGGER.info("In dynamodbUtil.convert_dataset_schema_to_dynamodb, AttributeName %s is part of dataset keys. Ignore attribute conversion", attr_def['name'])
    return converted_dataset_schema_list
