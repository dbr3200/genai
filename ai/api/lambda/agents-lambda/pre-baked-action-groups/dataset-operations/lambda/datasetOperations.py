"""
This lambda is for dataset operations pre-baked action group.
This action group is designed to perform operations on amorphic datasets.
They can invoke APIs based on the inference from the model to perform the required action.
Possible operations include:
1. List all datasets accessible to the user
2. Get details of a dataset
3. List all files inside a dataset
4. Create/clone a dataset
5. Enable/disable/run dataprofiling job for a dataset
"""
import sys
import os
import json
import logging
import requests
import boto3

import actionGroupUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

#pylint: disable=no-member
#pylint: disable=missing-timeout

try:
    AWS_REGION = os.environ['awsRegion']
    ENVIRONMENT = os.environ['environment']
    STAGE_URL_PARAMETER_NAME = 'AMORPHIC.APIGATEWAY.APIURLWITHSTAGE'
    PROJECTSHORTNAME = os.environ['projectShortName']
    ENVIRONMENT = os.environ['environment']
    DATA_PROFILING_JOB_PREFIX = f"{PROJECTSHORTNAME}-{ENVIRONMENT}-api-sm-rDataProfilingScheduledRule"
    STAGE_URL = actionGroupUtil.get_decrypted_value(STAGE_URL_PARAMETER_NAME)

    SSM_CLIENT = boto3.client('ssm', AWS_REGION)
    EVENT_CLIENT = boto3.client('events', AWS_REGION )
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)

    USERS_TABLE = actionGroupUtil.USERS_TABLE
    SESSIONS_TABLE = actionGroupUtil.SESSIONS_TABLE
    SESSIONS_TABLE_SESSIONID_INDEX = actionGroupUtil.SESSIONS_TABLE_SESSIONID_INDEX
    AMORPHIC_DATASET_TABLE = actionGroupUtil.AMORPHIC_DATASET_TABLE
    AMORPHIC_DATASET_TABLE_INDEX_NAME = actionGroupUtil.AMORPHIC_DATASET_TABLE_INDEX_NAME

    DATASETS_DETAILS_FIELDS = ['DatasetId','DatasetName','DatasetDescription','Domain',
                               'FileType','TargetLocation','Keywords','TableUpdate','LastModified',
                               'LastModifiedBy','RegistrationStatus','CreatedBy','CreationTime',
                               'IsActive','AccessType','IsOwner','FileDelimiter','DatasourceType',
                               'IsDataCleanupEnabled', 'IsDataProfilingEnabled','DatasetSummaryFilePath','SkipLZProcess',
                               'IsTranslateAIResultsEnabled','DatasetS3Path','TenantName','DatasetStatus']

    DATASETS_CREATE_FIELDS = ['DatasetName','Domain','DatasourceType',
                              'FileType','TargetLocation','TableUpdate']

    # valid fields for dataset creation
    VALID_CONNECTION_TYPES = ["api", "jdbc", "s3", "email", "external api", "file-server"]
    SUPPORTED_CONNECTION_TYPES = ["api"]
    VALID_TARGET_LOCATIONS = ["s3", "s3athena", "redshift", "lakeformation", "dynamodb"]
    SUPPORTED_TARGET_LOCATIONS = ["s3"]
    VALID_UPDATE_METHODS = ["append", "reload", "latest record"]
    SUPPORTED_UPDATE_METHODS = ["append", "reload"]
    VALID_FILE_TYPES = ["csv", "tsv", "xlsx", "parquet", "json", "txt", "pdf", "jpg", "png", "mp3", "wav", "mp4", "others"]

    # valid fields for data profiling
    DATAPROFILING_VALID_ACTIONS = ["enable", "disable"]
    DATAPROFILING_VALID_FILE_TYPES = ["csv", "tsv", "xlsx", "parquet"]
    DATAPROFILING_VALID_TARGET_LOCATIONS = ["s3athena", "redshift", "lakeformation", "dynamodb"]


except Exception as ex:
    LOGGER.error("In datasetOperations.py, Failed to load environment variables with error: %s", str(ex))
    sys.exit()


def get_validate_input_body(user_id, event_parameters):
    """
    This function is to get the input body for create a dataset
    It also validates the inputs and returns appropriate messages
    """
    LOGGER.info("In datasetOperations.get_validate_input_body, entering method..")

    LOGGER.info("In datasetOperations.get_validate_input_body, initialising response code, message and input body")
    response_code = 200
    message = ""
    input_body = {
        "DatasetName": actionGroupUtil.get_parameter_from_event(event_parameters, 'datasetName'),
        "DatasetDescription": "Dataset created via Amorphic agent.",
        "Domain": actionGroupUtil.get_parameter_from_event(event_parameters, 'domain'),
        "Keywords": [f"owner:{user_id}"],
        "DatasourceType": actionGroupUtil.get_parameter_from_event(event_parameters, 'datasourceType'),
        "FileType": actionGroupUtil.get_parameter_from_event(event_parameters, 'fileType'),
        "IsDataCleanupEnabled": False,
        "LifeCyclePolicyStatus": "Disabled",
        "TargetLocation": actionGroupUtil.get_parameter_from_event(event_parameters, 'targetLocation'),
        "MalwareDetectionOptions": {
            "ScanForMalware": False,
            "AllowUnscannableFiles": False
        },
        "SkipFileHeader": False,
        "SkipLZProcess": False,
        "TableUpdate": actionGroupUtil.get_parameter_from_event(event_parameters, 'updateMethod'),
        "DataMetricsCollectionOptions": {
            "IsMetricsCollectionEnabled": False
        },
        "AreAIServicesEnabled": False,
        "DatasetType": "internal",
        "IsDataProfilingEnabled": False
    }

    # if the user request is to clone from a asks to clone from dataset, then remove domain part from dataset name as input may contain that
    if '.' in input_body['DatasetName']:
        LOGGER.info("In datasetOperations.get_validate_input_body, user has requested cloning of dataset so removing domain part froim dataset name")
        input_body['DatasetName'] = input_body['DatasetName'].split('.')[1]

    LOGGER.info("In datasetOperations.get_validate_input_body, now validating the input fields from the user")
    # validating connection type
    connection_type = input_body['DatasourceType'].lower()
    if connection_type not in VALID_CONNECTION_TYPES:
        LOGGER.info("In datasetOperations.get_validate_input_body, %s datasource type is not valid.", connection_type)
        response_code = 406
        message = f"{connection_type} is not a valid datasource type. Valid datasource types are {', '.join(VALID_CONNECTION_TYPES)}."
        return {}, response_code, message
    if connection_type not in SUPPORTED_CONNECTION_TYPES:
        LOGGER.info("In datasetOperations.get_validate_input_body, %s datasource type is not supported.", connection_type)
        response_code = 403
        message = f"Sorry, datasource type {connection_type} is currently not supported for dataset creation. Supported datasource types are : {', '.join(SUPPORTED_CONNECTION_TYPES)}."
        return {}, response_code, message
    # validating target location
    target_location = input_body['TargetLocation'].lower()
    if target_location not in VALID_TARGET_LOCATIONS:
        LOGGER.info("In datasetOperations.get_validate_input_body, %s target location is not valid.", target_location)
        response_code = 404
        message = f"{target_location} is not a valid target location. Valid target locations are {', '.join(VALID_TARGET_LOCATIONS)}."
        return {}, response_code, message
    if target_location not in SUPPORTED_TARGET_LOCATIONS:
        LOGGER.info("In datasetOperations.get_validate_input_body, %s target location is not supported.", target_location)
        response_code = 407
        message = f"Sorry, target location {target_location} is currently not supported for dataset creation. Supported target locations are : {', '.join(SUPPORTED_TARGET_LOCATIONS)}."
        return {}, response_code, message
    # validating update method
    update_method = input_body['TableUpdate'].lower()
    if update_method not in VALID_UPDATE_METHODS:
        LOGGER.info("In datasetOperations.get_validate_input_body, %s update method is not valid.", update_method)
        response_code = 408
        message = f"{update_method} is not a valid update method. Valid update methods are {', '.join(VALID_UPDATE_METHODS)}."
        return {}, response_code, message
    if update_method not in SUPPORTED_UPDATE_METHODS:
        LOGGER.info("In datasetOperations.get_validate_input_body, %s update method is not supported.", update_method)
        response_code = 405
        message = f"Sorry, update method {update_method} is currently not supported for dataset creation. Supported update methods are : {', '.join(SUPPORTED_UPDATE_METHODS)}."
        return {}, response_code, message
    # validating file type
    file_type = input_body['FileType'].lower()
    if file_type not in VALID_FILE_TYPES:
        LOGGER.info("In datasetOperations.get_validate_input_body, %s file type is not supported.", file_type)
        response_code = 409
        message = f"{file_type} is not a valid file type. Supported file types are {', '.join(VALID_FILE_TYPES)}."
        return {}, response_code, message

    LOGGER.info("In datasetOperations.get_validate_input_body, successfully validated all user input parameters")
    return input_body, response_code, message


def get_dataprofiling_job_name():
    """
    This function is to get the dataprofiling job name from event rules
    """
    LOGGER.info("In datasetOperations.get_dataprofiling_job_name, entering method")
    job_name = ""
    list_rules_response = EVENT_CLIENT.list_rules(NamePrefix=f"{PROJECTSHORTNAME}-{ENVIRONMENT}")
    for rule in list_rules_response["Rules"]:
        if DATA_PROFILING_JOB_PREFIX in rule['Name']:
            LOGGER.info("In datasetOperations.get_dataprofiling_job_name, dataprofiling job details - %s", rule)
            job_name = rule['Name']
    return job_name


def data_profiling_job_actions(action, dataset_id, dataset_name, dataset_item, api_headers):
    """
    This function is to enable/disable the dataprofiling job for a dataset and the validations around it
    """
    LOGGER.info("In datasetOperations.data_profiling_job_actions, entering method with action - %s", action)

    if action == "run":
        LOGGER.info("In datasetOperations.data_profiling_job_actions, action is to run data profiling for the dataset")
        if dataset_item.get("IsDataProfilingEnabled", ""):
            dataprofiling_job_name = get_dataprofiling_job_name()
            request_url = f"{STAGE_URL}/events/{dataprofiling_job_name}?rule_action=run-job"
            input_body = {"datasetIds": [dataset_id]}
            LOGGER.info("In datasetOperations.data_profiling_job_actions, making api request..")
            response = requests.put(url=request_url, json=input_body, headers=api_headers)
            run_dataprofiling_job_api_response = response.json()
            LOGGER.info("In datasetOperations.data_profiling_job_actions, response from api call in json - %s", run_dataprofiling_job_api_response)
            return 200, {"message": f"Successfully triggered dataprofiling job for dataset {dataset_name}."}
        else:
            LOGGER.info("In datasetOperations.data_profiling_job_actions, dataprofiling is not enabled for the dataset")
            return 403, {"message": f"Sorry, data profiling job has been disabled for the dataset {dataset_name}."}

    elif action in DATAPROFILING_VALID_ACTIONS:
        request_url = f"{STAGE_URL}/datasets/{dataset_id}/updatemetadata"
        if action == "enable":
            LOGGER.info("In datasetOperations.data_profiling_job_actions, action inferred is enable so enabling data profiling for the dataset")
            if dataset_item.get("IsDataProfilingEnabled", ""):
                LOGGER.info("In datasetOperations.data_profiling_job_actions, data profiling is already enabled for the dataset.")
                return 404, {"message": f"Data profiling is already enabled for the dataset {dataset_name}."}
            else:
                # validating dataset details for enabling data profiling
                if dataset_item['TargetLocation'].lower() not in DATAPROFILING_VALID_TARGET_LOCATIONS:
                    LOGGER.info("In datasetOperations.data_profiling_job_actions, data profiling is not supported for %s target location.", dataset_item['TargetLocation'].lower())
                    return 406, {"message": f"Sorry, data profiling is not supported for {dataset_item['TargetLocation']} target location. Supported target locations are {', '.join(DATAPROFILING_VALID_TARGET_LOCATIONS)}."}
                if dataset_item['FileType'].lower() not in DATAPROFILING_VALID_FILE_TYPES:
                    LOGGER.info("In datasetOperations.data_profiling_job_actions, data profiling is not supported for %s file type.", dataset_item['FileType'].lower())
                    return 407, {"message": f"Sorry, data profiling is not supported for {dataset_item['FileType']} file type. Supported file types are {', '.join(DATAPROFILING_VALID_FILE_TYPES)}."}
                dataset_item.pop('DatasetId')
                dataset_item['IsDataProfilingEnabled'] = True
                LOGGER.info("In datasetOperations.data_profiling_job_actions, making api request..")
                response = requests.put(url=request_url, json=dataset_item, headers=api_headers)
                enable_dataprofiling_api_response = response.json()
                LOGGER.info("In datasetOperations.data_profiling_job_actions, response from api call in json - %s", enable_dataprofiling_api_response)
                return 200, {"message": f"Successfully enabled data profiling for dataset {dataset_name}"}
        elif action == "disable":
            LOGGER.info("In datasetOperations.data_profiling_job_actions, action inferred is disable so disabling data profiling for the dataset")
            if not dataset_item.get("IsDataProfilingEnabled", ""):
                LOGGER.info("In datasetOperations.data_profiling_job_actions, data profiling is already disabled for the dataset.")
                return 405, {"message": f"Data profiling is already disabled for the dataset {dataset_name}."}
            else:
                dataset_item.pop('DatasetId')
                dataset_item['IsDataProfilingEnabled'] = False
                LOGGER.info("In datasetOperations.data_profiling_job_actions, making api request..")
                response = requests.put(url=request_url, json=dataset_item, headers=api_headers)
                disable_dataprofiling_api_response = response.json()
                LOGGER.info("In datasetOperations.data_profiling_job_actions, response from api call in json - %s", disable_dataprofiling_api_response)
                return 200, {"message": f"Successfully disabled data profiling for dataset {dataset_name}"}

    else:
        LOGGER.info("In datasetOperations.data_profiling_job_actions, action inferred is not valid - %s", action)
        return 403, {"message": "'{} data profiling job' is not a valid action. Valid actions are enable/disable."}


def lambda_handler(event, context):
    """"
    This lambda function handles all dataset actions related API's
    """
    # pylint: disable-msg=too-many-branches
    LOGGER.info("In datasetOperations.lambda_handler, entering method with event - %s and context - %s", event, context)

    event_parameters = event.get('parameters', [])
    LOGGER.info("In datasetOperations.lambda_handler, event parameters - %s", event_parameters)

    session_id = event.get('sessionId', '')
    user_id = actionGroupUtil.get_user_id(session_id, SESSIONS_TABLE, SESSIONS_TABLE_SESSIONID_INDEX)
    user_id_from_input = actionGroupUtil.get_parameter_from_event(event_parameters, "userId")
    # user_id = actionGroupUtil.get_parameter_from_event(event_parameters, "userId")
    LOGGER.info("In datasetOperations.lambda_handler, fetching auth token and role id for user - %s", user_id)
    role_id, auth_token = actionGroupUtil.get_auth_token_role_id(user_id, USERS_TABLE)
    api_headers = {
        "role_id": role_id,
        "authorization": auth_token
    }
    LOGGER.info("In datasetOperations.lambda_handler, setting api headers - %s", api_headers)

    response_code = 200
    action_group = event['actionGroup']
    api_path = event['apiPath']
    http_method = event['httpMethod']
    LOGGER.info("In datasetOperations.lambda_handler, api path inferred - %s, action group - %s, http method - %s", api_path, action_group, http_method)

    if api_path == '/datasets' and http_method == 'GET':
        # api inferred is GET /datasets so listing datasets
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 400
            body = {"message": "Access denied. Unable to list another user's datasets."}
        else:
            LOGGER.info("In datasetOperations.lambda_handler, making api request..")
            request_url = f"{STAGE_URL}/datasets"
            response = requests.get(url=request_url, headers=api_headers)
            datasets_list_api_response = response.json()
            LOGGER.info("In datasetOperations.lambda_handler, response from api call in json - %s", datasets_list_api_response)

            datasets_list = [f"{dataset['Domain']}.{dataset['DatasetName']}" for dataset in datasets_list_api_response['datasets']]
            LOGGER.info("In datasetOperations.lambda_handler, list of datasets - %s", datasets_list)
            response_code = 200
            body = {"datasets": datasets_list}

    elif api_path == '/datasets' and http_method == 'POST':
        # api inferred is POST /datasets so creating dataset
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 410
            body = {"message": "Access denied. Unable to create a dataset for another user."}
        else:
            input_body, response_code, message = get_validate_input_body(user_id, event_parameters)
            if response_code != 200:
                LOGGER.info("In datasetOperations.lambda_handler, initial input validation failed")
                body = {"message": message}
            else:
                LOGGER.info("In datasetOperations.lambda_handler, input body for create dataset call - %s", input_body)
                LOGGER.info("In datasetOperations.lambda_handler, making api request..")
                request_url = f"{STAGE_URL}/datasets"
                response = requests.post(url=request_url, json=input_body, headers=api_headers)
                dataset_create_api_response = response.json()
                LOGGER.info("In datasetOperations.lambda_handler, response from api call in json - %s", dataset_create_api_response)
                api_message = dataset_create_api_response.get('Message', '')
                if "IPV-1018" in api_message:
                    LOGGER.info("In datasetOperations.lambda_handler, dataset name is not unique")
                    response_code, body = 401, {"message": "Dataset name is already taken. Please try again with a different name."}
                elif "IPV-1002" in api_message:
                    LOGGER.info("In datasetOperations.lambda_handler, invalid domain name passed.")
                    response_code,body = 402, {"message": "Invalid domain passed. Please enter a valid domain name."}
                else:
                    LOGGER.info("In datasetOperations.lambda_handler, api request made successfully.")
                    body = {"message": f"Successfully created dataset. Dataset ID is {dataset_create_api_response['DatasetId']}"}

    elif api_path == '/datasets' and http_method == 'PUT':
        # api inferred is PUT /datasets so cloning dataset
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 402
            body = {"message": "Access denied. Unable to clone a dataset for another user."}
        else:
            input_body, response_code, message = get_validate_input_body(user_id, event_parameters)
            if response_code != 200:
                LOGGER.info("In datasetOperations.lambda_handler, initial input validation failed")
                body = {"message": message}
            else:
                LOGGER.info("In datasetOperations.lambda_handler, input body for cloning dataset call - %s", input_body)
                LOGGER.info("In datasetOperations.lambda_handler, making api request..")
                request_url = f"{STAGE_URL}/datasets"
                response = requests.post(url=request_url, json=input_body, headers=api_headers)
                dataset_create_api_response = response.json()
                LOGGER.info("In datasetOperations.lambda_handler, response from api call in json - %s", dataset_create_api_response)
                api_message = dataset_create_api_response.get('Message', '')
                if "IPV-1018" in api_message:
                    LOGGER.info("In datasetOperations.lambda_handler, dataset name is not unique")
                    response_code, body = 401, {"message": "Dataset name is already taken. Please try again with a different name."}
                else:
                    LOGGER.info("In datasetOperations.lambda_handler, api request made successfully.")
                    body = {"message": f"Successfully created dataset. Dataset ID is {dataset_create_api_response['DatasetId']}"}

    elif api_path == '/datasets/{dataset_name}' and http_method == 'GET':
        # api inferred is GET /datasets so getting details of a dataset
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 404
            body = {"message": "Access denied. Unable to get details of another user's dataset."}
        else:
            dataset_name = actionGroupUtil.get_parameter_from_event(event_parameters, "datasetName")
            LOGGER.info("In datasetOperations.lambda_handler, dataset name inferred - %s", dataset_name)
            if '.' not in dataset_name:
                LOGGER.info("In datasetOperations.lambda_handler, dataset name not in the format <domain>.<dataset>")
                response_code, body = 401, {"message": "Dataset entered by the user is not in valid format. Please provide as : DOMAIN_NAME.DATASET_NAME"}
            else:
                dataset_item = actionGroupUtil.get_item_from_resource_name("dataset", dataset_name, DYNAMODB_RESOURCE.Table(AMORPHIC_DATASET_TABLE), AMORPHIC_DATASET_TABLE_INDEX_NAME)
                if dataset_item:
                    dataset_id = dataset_item['DatasetId']
                    request_url = f"{STAGE_URL}/datasets/{dataset_id}"
                    response = requests.get(url=request_url, headers=api_headers)
                    dataset_details_api_response = response.json()
                    LOGGER.info("In datasetOperations.lambda_handler, response from api call in json - %s", dataset_details_api_response)
                    if "Message" in dataset_details_api_response and "AUTH-1011" in dataset_details_api_response['Message']:
                        LOGGER.info("In datasetOperations.lambda_handler, user is not authorized to the dataset.")
                        response_code, body = 403, {"message": f"User is not authorized to get the details of the dataset {dataset_name}."}
                    else:
                        dataset_details = {dataset_field: dataset_details_api_response[dataset_field] for dataset_field in DATASETS_DETAILS_FIELDS if dataset_field in dataset_details_api_response}
                        LOGGER.info("In datasetOperations.lambda_handler, dataset details - %s", dataset_details)
                        response_code, body = 200, {"dataset": dataset_details}
                else:
                    LOGGER.info("In datasetOperations.lambda_handler, no such dataset exists.")
                    response_code, body = 402, {"message": f"No such dataset exists with the name {dataset_name}."}

    elif api_path == '/datasets/{dataset_name}/files' and http_method == 'GET':
        # api inferred is GET /datasets/files so getting list of all files inside a dataset
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 403
            body = {"message": "Access denied. Unable to list files inside a dataset of another user."}
        else:
            dataset_name = actionGroupUtil.get_parameter_from_event(event_parameters, "datasetName")
            LOGGER.info("In datasetOperations.lambda_handler, dataset name inferred - %s", dataset_name)
            if '.' not in dataset_name:
                LOGGER.info("In datasetOperations.lambda_handler, dataset name not in the format <domain>.<dataset>")
                response_code, body = 401, {"message": "Dataset entered by the user is not in valid format. Please provide as : DOMAIN_NAME.DATASET_NAME"}
            else:
                dataset_item = actionGroupUtil.get_item_from_resource_name("dataset", dataset_name, DYNAMODB_RESOURCE.Table(AMORPHIC_DATASET_TABLE), AMORPHIC_DATASET_TABLE_INDEX_NAME)
                if dataset_item:
                    dataset_id = dataset_item['DatasetId']
                    request_url = f"{STAGE_URL}/datasets/{dataset_id}/files"
                    LOGGER.info("In datasetOperations.lambda_handler, making api request..")
                    response = requests.get(url=request_url, headers=api_headers)
                    files_list_api_response = response.json()
                    LOGGER.info("In datasetOperations.lambda_handler, response from api call in json - %s", files_list_api_response)
                    files_list = [
                        {
                            "FileName": '_'.join(file['FileName'].split('/')[-1].split('_')[3:]),
                            "Status": file['CurrentState']
                        } for file in files_list_api_response['files']
                    ]
                    LOGGER.info("In datasetOperations.lambda_handler, list of files - %s", files_list)
                    response_code, body = 200, {"files": files_list}
                else:
                    LOGGER.info("In datasetOperations.lambda_handler, either no such dataset exists or the user does not have access to the dataset.")
                    response_code, body = 402, {"message": f"Either no such dataset exists, or the user does not have access to the {dataset_name} dataset."}

    elif api_path == '/datasets/{dataset_name}/dataprofiling' and http_method == 'POST':
        # api inferred is POST /datasets/dataset_name/dataprofilingjob so triggering the dataprofiling job
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 404
            body = {"message": "Access denied. Unable to run dataprofiling on a dataset for another user."}
        else:
            dataset_name = actionGroupUtil.get_parameter_from_event(event_parameters, "datasetName")
            LOGGER.info("In datasetOperations.lambda_handler, dataset name inferred - %s", dataset_name)
            if '.' not in dataset_name:
                LOGGER.info("In datasetOperations.lambda_handler, dataset name not in the format <domain>.<dataset>")
                response_code, body = 401, {"message": "Dataset entered by the user is not in valid format. Please provide as : DOMAIN_NAME.DATASET_NAME"}
            else:
                dataset_item = actionGroupUtil.get_item_from_resource_name("dataset", dataset_name, DYNAMODB_RESOURCE.Table(AMORPHIC_DATASET_TABLE), AMORPHIC_DATASET_TABLE_INDEX_NAME)
                if dataset_item:
                    dataset_id = dataset_item['DatasetId']
                    response_code, body = data_profiling_job_actions("run", dataset_id, dataset_name, dataset_item, api_headers)
                else:
                    LOGGER.info("In datasetOperations.lambda_handler, either no such dataset exists or the user does not have access to the dataset.")
                    response_code, body = 402, {"message": f"Either no such dataset exists, or the user does not have access to the {dataset_name} dataset."}

    elif api_path == '/datasets/{dataset_name}/dataprofiling' and http_method == 'PUT':
        # api inferred is PUT /datasets/dataset_name/dataprofilingjob so enabling/disabling data profiling job for the dataset
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 408
            body = {"message": "Access denied. Unable to enable or disable dataprofiling on a dataset for another user."}
        else:
            dataset_name = actionGroupUtil.get_parameter_from_event(event_parameters, "datasetName")
            rule_action = actionGroupUtil.get_parameter_from_event(event_parameters, "ruleAction")
            LOGGER.info("In datasetOperations.lambda_handler, dataset name inferred - %s", dataset_name)
            if '.' not in dataset_name:
                LOGGER.info("In datasetOperations.lambda_handler, dataset name not in the format <domain>.<dataset>")
                response_code, body = 401, {"message": "Dataset entered by the user is not in valid format. Please provide as : DOMAIN_NAME.DATASET_NAME"}
            else:
                dataset_item = actionGroupUtil.get_item_from_resource_name("dataset", dataset_name, DYNAMODB_RESOURCE.Table(AMORPHIC_DATASET_TABLE), AMORPHIC_DATASET_TABLE_INDEX_NAME)
                if dataset_item:
                    dataset_id = dataset_item['DatasetId']
                    response_code, body = data_profiling_job_actions(rule_action, dataset_id, dataset_name, dataset_item, api_headers)
                else:
                    LOGGER.info("In datasetOperations.lambda_handler, either no such dataset exists or the user does not have access to the dataset.")
                    response_code, body = 402, {"message": f"Either no such dataset exists, or the user does not have access to the {dataset_name} dataset."}

    else:
        body = {f"{action_group}::{api_path} is not a valid api, try another one."}

    # now formatting the response from model into valid agent response
    LOGGER.info("In datasetOperations.lambda_handler, formatting return response from agent")
    response_string = json.dumps(body)
    response_body = {
        'application/json': {
            'body': response_string
        }
    }
    action_response = {
         'actionGroup': action_group,
         'apiPath': api_path,
         'httpMethod': http_method,
         'httpStatusCode': response_code,
         'responseBody': response_body
    }
    api_response = {'messageVersion': "1.0", 'response': action_response}

    LOGGER.info("In datasetOperations.lambda_handler, return response from agent - %s", api_response)
    return api_response
