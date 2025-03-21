"""
Helper functions for agent action groups
"""
import os
import uuid
import sys
import json
import time
import logging
import zipfile
import shutil
from datetime import datetime
from urllib.parse import urlparse

import boto3
from botocore.client import Config

import commonUtil
import dynamodbUtil
import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

try:
    AWS_REGION = os.environ["awsRegion"]
    AI_MISC_BUCKET = os.environ['aiMiscBucketName']
    ACTION_GROUP_LAMBDA_POLICY_ARN = os.environ['actionGroupLambdaPolicyArn']
    VERTICAL_NAME = os.environ['verticalName']
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    ENVIRONMENT = os.environ['environment']
    PROJECT_NAME = os.environ['projectName']
    ACCOUNT_ID = os.environ['accountId']
    AWS_PARTITION = os.environ['awsPartition']
    DATASET_OPERATIONS_ACTION_GROUP_LAMBDA_ARN = os.environ['datasetOperationsActionGroupLambdaArn']
    ETL_OPERATIONS_ACTION_GROUP_LAMBDA_ARN = os.environ['etlOperationsActionGroupLambdaArn']

    GROUPS_TABLE = dynamodbUtil.GROUPS_TABLE
    AGENTS_TABLE = dynamodbUtil.AGENTS_TABLE
    AGENTS_ACTION_GROUPS_TABLE = dynamodbUtil.AGENTS_ACTION_GROUPS_TABLE
    AGENTS_LIBRARIES_TABLE = dynamodbUtil.AGENTS_LIBRARIES_TABLE
    AWS_USE_FIPS_ENDPOINT = os.environ["AWS_USE_FIPS_ENDPOINT"]
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    s3_endpoint_url = f"https://s3.{AWS_REGION}.amazonaws.com" if AWS_USE_FIPS_ENDPOINT == 'False' else f"https://s3-fips.{AWS_REGION}.amazonaws.com"
    S3_CLIENT = boto3.client("s3", endpoint_url=s3_endpoint_url, region_name=AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    S3_RESOURCE = boto3.resource('s3', AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    IAM_CLIENT = boto3.client('iam', AWS_REGION)
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)
    CW_LOGS_CLIENT = boto3.client('logs', AWS_REGION)

    REQUIRED_ACTION_GROUP_KEYS = {
        "create": ['LambdaS3Path', 'LambdaHandler', 'ApiDefS3Path', 'ActionGroupName'],
        "update": ['LambdaS3Path', 'LambdaHandler', 'ApiDefS3Path']
    }
    EVENT_INFO = {}

    COMMONUTIL_OS_ENV_VAR_DICT = {
        'awsRegion': AWS_REGION,
        'projectShortName': PROJECT_SHORT_NAME,
        'environment': ENVIRONMENT,
        'projectName': PROJECT_NAME,
        'accountId': ACCOUNT_ID
    }

    PRE_BAKED_ACTION_GROUS_MAPPINGS = {
        "DatasetOperations": {
            "LambdaHandler": "datasetOperations.lambda_handler",
            "Description": "Prebaked action group designed to perform operations on Amorphic datasets.",
            "LambdaArn": DATASET_OPERATIONS_ACTION_GROUP_LAMBDA_ARN
        },
        "EtlOperations": {
            "LambdaHandler": "etlOperations.lambda_handler",
            "Description": "Prebaked action group designed to perform Amorphic etl operations.",
            "LambdaArn": ETL_OPERATIONS_ACTION_GROUP_LAMBDA_ARN
        }
    }

    INPUT_EXTRACT_DIRECTORY = '/tmp/input'
    OUTPUT_ZIP_DIRECTORY = '/tmp/output'

except Exception as ex:
    LOGGER.error("In agentsActionGroups.agentsActionGroups, Failed to load environment variables. error: %s", str(ex))
    sys.exit()


def upload_presigned_url(object_key, file_type):
    """
    Generate a presigned URL for put requests
    :param object_key: Object key
    :param file_type: content type
    :return type: str
    """
    LOGGER.info("In agentsActionGroups.upload_presigned_url, generating S3 presigned url.")
    content_type = "application/zip" if file_type == "lambda" else "application/json"
    url = commonUtil.get_presigned_url_put_object(S3_CLIENT, AI_MISC_BUCKET, object_key, content_type=content_type)

    LOGGER.info("In agentsActionGroups.upload_presigned_url, successfully generated upload_presigned_url")
    return url


def initialise_prebaked_action_groups():
    """
    This function is to initialise the pre-baked action groups
    """
    LOGGER.info("In agentsActionGroups.initialise_prebaked_action_groups, entering method")
    agent_action_groups_list = dynamodbUtil.scan_with_pagination(DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE), projection_expression="ActionGroupName")
    action_group_names = [each_action_group["ActionGroupName"] for each_action_group in agent_action_groups_list]

    LOGGER.info("In agentsActionGroups.initialise_prebaked_action_groups, checking whether any pre-baked action groups have not been initialised.")
    uninitialised_action_groups = list(set(commonUtil.PREBAKED_ACTION_GROUPS) - set(action_group_names))
    for prebaked_action_group in uninitialised_action_groups:
        LOGGER.info("In agentsActionGroups.initialise_prebaked_action_groups, %s prebaked action group not found in action groups list so initialising", prebaked_action_group)
        action_group_id = str(uuid.uuid4())

        # uploading api definition to s3
        action_group_prefix = ''.join(['-' + char.lower() if char.isupper() else char for char in prebaked_action_group]).lstrip('-')
        with open(f'pre-baked-action-groups/{action_group_prefix}/api/{action_group_prefix}-api-definition.json', 'rb') as file:
            file_content = file.read()
        s3_object_key = f'definitions/{action_group_id}/api/api_definition.json'
        S3_CLIENT.put_object(Body=file_content, Bucket=AI_MISC_BUCKET, Key=s3_object_key)

        # uploading lambda zip file to s3
        with zipfile.ZipFile('/tmp/lambda_definition.zip', 'w') as zipf:
            # Walk through each file in the directory
            for foldername, _, filenames in os.walk(f"pre-baked-action-groups/{action_group_prefix}/lambda"):
                for filename in filenames:
                    # Add each file to the zip
                    file_path = os.path.join(foldername, filename)
                    zipf.write(file_path, os.path.relpath(file_path, f"pre-baked-action-groups/{action_group_prefix}/lambda"))

        s3_object_key = f'definitions/{action_group_id}/lambda/lambda_definition.zip'
        with open('/tmp/lambda_definition.zip', 'rb') as f:
            S3_CLIENT.put_object(Body=f, Bucket=AI_MISC_BUCKET, Key=s3_object_key)

        # updating metadata in dynamodb
        action_group_db_item = {
            "ActionGroupId": action_group_id,
            "ActionGroupName": prebaked_action_group,
            "CreationTime": commonUtil.get_current_time(),
            "LastModifiedTime": commonUtil.get_current_time(),
            "CreatedBy": commonUtil.SYSTEM_RUNNER_ID,
            "LastModifiedBy": commonUtil.SYSTEM_RUNNER_ID,
            "AttachedLibraries": [],
            "ActionGroupStatus": "READY",
            "Message": "Action group initialised successfully.",
            "ApiDefS3Uri": f"s3://{AI_MISC_BUCKET}/definitions/{action_group_id}/api/api_definition.json",
            "LambdaS3Uri": f"s3://{AI_MISC_BUCKET}/definitions/{action_group_id}/lambda/lambda_definition.zip",
            "SystemGenerated": "yes",
            "LambdaHandler": PRE_BAKED_ACTION_GROUS_MAPPINGS[prebaked_action_group]["LambdaHandler"],
            "Description": PRE_BAKED_ACTION_GROUS_MAPPINGS[prebaked_action_group]["Description"],
            "LambdaArn": PRE_BAKED_ACTION_GROUS_MAPPINGS[prebaked_action_group]["LambdaArn"]
        }

        action_group_put_status = dynamodbUtil.put_item(
            DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
            action_group_db_item
        )
        if action_group_put_status == "error":
            LOGGER.error("In agentsActionGroups.initialise_prebaked_action_groups, failed to create action group item in dynamodb, please check for errors.")
            ec_db_1001 = errorUtil.get_error_object("DB-1001")
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)
        else:
            LOGGER.info("In agentsActionGroups.initialise_prebaked_action_groups, successfully created action group item in dynamodb")

    LOGGER.info("In agentsActionGroups.initialise_prebaked_action_groups, pre-baked action groups have been initialised.")


def list_action_groups(query_params, **kwargs):
    """
    This function returns list of action groups accessible to the user
    """
    LOGGER.info("In agentsActionGroups.list_action_groups, entering method")

    if query_params:
        # Return a presigned URL for uploading lambda code and api def file
        if "action" in query_params:
            if query_params["action"].lower() == "get_presigned_url":
                LOGGER.info("In agentsActionGroups.list_action_groups, request is for generating presigned URLs")

                LOGGER.info("In agentsActionGroups.list_action_groups, generating UUID for the action group")
                action_group_id = str(uuid.uuid4())

                LOGGER.info("In agentsActionGroups.list_action_groups, generating presigned url for lambda zip file")
                lambda_s3_object_key = f"definitions/{action_group_id}/lambda/lambda_definition.zip"
                lambda_presigned_url = upload_presigned_url(lambda_s3_object_key, "lambda")

                LOGGER.info("In agentsActionGroups.list_action_groups, generating presigned url for api def file")
                apidef_s3_object_key = f"definitions/{action_group_id}/api/api_definition.json"
                apidef_presigned_url = upload_presigned_url(apidef_s3_object_key, "api-def")

                return {
                    "Message": "Generated presigned URLs",
                    "ActionGroupId": action_group_id,
                    "LambdaPresignedURL": lambda_presigned_url,
                    "LambdaS3Path": lambda_s3_object_key,
                    "ApiDefPresignedURL": apidef_presigned_url,
                    "ApiDefS3Path": apidef_s3_object_key
                }

            else:
                LOGGER.error("In agentsActionGroups.list_action_groups, action must be 'get_presigned_url'.")
                ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
                ec_ipv_1008['Message'] = "action must be 'get_presigned_url'."
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)

    initialise_prebaked_action_groups()

    projection_expression = "ActionGroupId,ActionGroupName,Description,LambdaArn,ApiDefS3Uri,CreatedBy,CreationTime,LastModifiedBy,LastModifiedTime,SystemGenerated"
    agent_action_groups_list = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
        projection_expression=projection_expression
    )
    LOGGER.info("In agentsActionGroups.list_action_groups, response from dynamodb - %s", agent_action_groups_list)

    # backfilling system generated attribute for action groups default sorting
    for agent_action_group in agent_action_groups_list:
        if "SystemGenerated" not in agent_action_group:
            agent_action_group.update({
                "SystemGenerated": "no"
            })
    # Sort & paginate results if applicable
    LOGGER.info("In agentsActionGroups.list_action_groups, sorting & paginating the results based on the input given")
    kwargs['dict_key'] = 'ActionGroups'
    kwargs['input_items'] = {'ActionGroups': agent_action_groups_list}
    agent_action_groups_list = commonUtil.sort_page_in_code(**kwargs)

    LOGGER.info("In agentsActionGroups.list_action_groups, api response - %s", agent_action_groups_list)
    return agent_action_groups_list


def check_datetime_format(input_str):
    """
    This function is to validate input datetime format
    """
    try:
        # Attempt to parse the input string with the specified format
        datetime.strptime(input_str, "%Y-%m-%dT%H:%M:%S")
        return True
    except ValueError:
        return False


def download_action_group_lambda_logs(action_group_id, query_params):
    """
    This function is to download the action group lambda function logs
    """
    LOGGER.info("In agentsActionGroups.download_action_group_lambda_logs, starting method with action group id: %s", action_group_id)

    LOGGER.info("In agentsActionGroups.download_action_group_lambda_logs, checking if action group is valid")
    action_group_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),{"ActionGroupId": action_group_id})
    if not action_group_item:
        LOGGER.error("In agentsActionGroups.download_action_group_lambda_logs, invalid action group id passed")
        ec_ge_1046 = errorUtil.get_error_object("GE-1046")
        ec_ge_1046['Message'] = ec_ge_1046['Message'].format("ActionGroupId", action_group_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1046)

    # validating query parameters
    if not query_params or not query_params.get('start-time', '') or not query_params.get('end-time', ''):
        LOGGER.error("In agentsActionGroups.download_action_group_lambda_logs, missing/invalid query string parameters passed.")
        ec_ipv_1051 = errorUtil.get_error_object("IPV-1051")
        ec_ipv_1051["Message"] = ec_ipv_1051["Message"].format("start-time/end-time")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ipv_1051)
    start_time = query_params['start-time']
    end_time = query_params['end-time']
    if not check_datetime_format(start_time):
        LOGGER.error("In agentsActionGroups.download_action_group_lambda_logs, invalid value passed as start-time.")
        ec_ipv_1004 = errorUtil.get_error_object("IPV-1004")
        ec_ipv_1004["Message"] = ec_ipv_1004["Message"].format("start-time")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ipv_1004)
    if not check_datetime_format(end_time):
        LOGGER.error("In agentsActionGroups.download_action_group_lambda_logs, invalid value passed as end-time.")
        ec_ipv_1004 = errorUtil.get_error_object("IPV-1004")
        ec_ipv_1004["Message"] = ec_ipv_1004["Message"].format("end-time")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ipv_1004)

    try:
        # getting start and end time in UTC
        start_time_utc = datetime.strptime(start_time, "%Y-%m-%dT%H:%M:%S")
        end_time_utc = datetime.strptime(end_time, "%Y-%m-%dT%H:%M:%S")
        lambda_function_name = action_group_item["LambdaArn"].split(':')[-1]
        get_log_events_response = CW_LOGS_CLIENT.filter_log_events(
            logGroupName=f"/{AWS_PARTITION}/lambda/{lambda_function_name}",
            startTime=int(start_time_utc.timestamp())*1000, # converting to epoch in milliseconds
            endTime=int(end_time_utc.timestamp())*1000
        )
        LOGGER.info("In agentsActionGroups.download_action_group_lambda_logs, get log events response - %s", get_log_events_response)

        # formulating log events into a single file and uploading to s3
        log_text = ''.join([event['message'] for event in get_log_events_response['events']])
        logs_output_file_key = f"{start_time} - {end_time}.txt"
        logs_s3_object_key = f"logs/{action_group_id}/lambda/{logs_output_file_key}"
        S3_CLIENT.put_object(Bucket=AI_MISC_BUCKET, Key=logs_s3_object_key, Body=log_text)

        download_logs_presigned_url = commonUtil.get_presigned_url_get_object(S3_CLIENT, AI_MISC_BUCKET, logs_s3_object_key, output_file_key=logs_output_file_key)

        LOGGER.info("In agentsActionGroups.download_action_group_lambda_logs, successfully generated pre-signed url for logs.")
        response = {
            "Message": "Generated presigned URL",
            "PresignedURL": download_logs_presigned_url
        }
        return commonUtil.build_get_response(200, response)

    except Exception as ex:
        LOGGER.error("In agentsActionGroups.download_action_group_lambda_logs, generating lambda logs failed with error - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Action group lambda log generation failed with error - {str(ex)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)


def get_action_group_details(query_params, action_group_id):
    """
    This function returns details of a single action group
    """
    LOGGER.info("In agentsActionGroups.get_action_group_details, starting method with action group id: %s", action_group_id)

    if query_params:
        # Return a presigned URL for uploading lambda code and api def file
        if "action" in query_params:
            if query_params["action"].lower() == "get_presigned_url":
                LOGGER.info("In agentsActionGroups.get_action_group_details, request is for generating presigned URLs")

                LOGGER.info("In agentsActionGroups.get_action_group_details, generating presigned url for lambda zip file")
                lambda_s3_object_key = f"definitions/{action_group_id}/lambda/lambda_definition.zip"
                lambda_presigned_url = upload_presigned_url(lambda_s3_object_key, "lambda")

                LOGGER.info("In agentsActionGroups.get_action_group_details, generating presigned url for api def file")
                apidef_s3_object_key = f"definitions/{action_group_id}/api/api_definition.json"
                apidef_presigned_url = upload_presigned_url(apidef_s3_object_key, "api-def")

                response = {
                    "Message": "Generated presigned URLs",
                    "ActionGroupId": action_group_id,
                    "LambdaPresignedURL": lambda_presigned_url,
                    "LambdaS3Path": lambda_s3_object_key,
                    "ApiDefPresignedURL": apidef_presigned_url,
                    "ApiDefS3Path": apidef_s3_object_key
                }

                return commonUtil.build_get_response(200, response)

            elif query_params["action"].lower() in ["download_lambda_file", "download_apidef_file"]:
                LOGGER.info("In agentsActionGroups.get_action_group_details, request is for downloading the zip/apidef file")

                if query_params["action"].lower() == "download_lambda_file":
                    s3_object_key = f"definitions/{action_group_id}/lambda/lambda_definition.zip"
                elif query_params["action"].lower() == "download_apidef_file":
                    s3_object_key = f"definitions/{action_group_id}/api/api_definition.json"

                LOGGER.info("In agentsActionGroups.get_action_group_details, generating presigned url")
                output_file_key = s3_object_key.split("/")[-1]
                presigned_url = commonUtil.get_presigned_url_get_object(S3_CLIENT, AI_MISC_BUCKET, s3_object_key, output_file_key=output_file_key)

                response = {
                    "Message": "Generated presigned URLs",
                    "PresignedURL": presigned_url
                }

                return commonUtil.build_get_response(200, response)

            else:
                LOGGER.error("In agentsActionGroups.get_action_group_details, action must be 'get_presigned_url/download_lambda_file/download_apidef_file'.")
                ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
                ec_ipv_1008['Message'] = "action must be 'get_presigned_url/download_lambda_file/download_apidef_file'."
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)

    action_group_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
        {"ActionGroupId": action_group_id}
    )
    LOGGER.info("In agentsActionGroups.get_action_group_details, response from dynamodb - %s", action_group_item)

    # modifying action group attached libraries response
    if action_group_item.get('AttachedLibraries', []):
        attached_libraries_list = []
        for library_id in action_group_item['AttachedLibraries']:
            library_item = dynamodbUtil.get_item_with_key(
                DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),
                {"LibraryId": library_id}
            )
            attached_libraries_list.append({
                "LibraryId": library_id,
                "LibraryName": library_item['LibraryName']
            })
        action_group_item.update({
            'AttachedLibraries': attached_libraries_list
        })

    if not action_group_item:
        LOGGER.error("In agentsActionGroups.get_action_group_details, invalid action group id passed")
        ec_ge_1046 = errorUtil.get_error_object("GE-1046")
        ec_ge_1046['Message'] = ec_ge_1046['Message'].format("ActionGroupId", action_group_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1046)

    LOGGER.info("In agentsActionGroups.get_action_group_details, exiting method")
    return commonUtil.build_get_response(200, action_group_item)


def build_action_group_lambda_layer(action_group_id, attached_libraries, function_name):
    """
    This function is to the build action group lambda layer
    """
    LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, starting method")

    try:
        LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, constructing layer for the lambda")

        for library_id in attached_libraries:
            LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, checking if library %s exists", library_id)
            library_item = dynamodbUtil.get_item_with_key(
                DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),
                {'LibraryId': library_id}
            )
            if not library_item:
                LOGGER.error("In agentsActionGroups.build_action_group_lambda_layer, invalid agent library id passed")
                ec_ge_1046 = errorUtil.get_error_object("GE-1046")
                ec_ge_1046['Message'] = ec_ge_1046['Message'].format("LibraryId", library_id)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1046)

            LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, extracting each package and building layer zip file")
            for package_s3_uri in library_item.get("Packages", []):
                parsed_uri = urlparse(package_s3_uri)
                input_zip_file_key = parsed_uri.path.lstrip('/')
                package_name = input_zip_file_key.split('/')[-1]

                LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, extracting package - %s", package_name)
                LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, downloading the package file from S3")

                # downloading each zip file from s3 into tmp directory
                os.makedirs(INPUT_EXTRACT_DIRECTORY, exist_ok=True)
                input_zip_file_path = f"/{INPUT_EXTRACT_DIRECTORY}/{package_name}"
                download_package_response = S3_CLIENT.download_file(
                    AI_MISC_BUCKET,
                    input_zip_file_key,
                    input_zip_file_path
                )
                LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, download package response - %s", download_package_response)

                LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, extracting contents of the package file into %s", INPUT_EXTRACT_DIRECTORY)
                # unzipping each zip file and dumping on one place
                with zipfile.ZipFile(input_zip_file_path, 'r') as zip_ref:
                    zip_ref.extractall(INPUT_EXTRACT_DIRECTORY)

        LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, now zipping all the extracted files in %s", INPUT_EXTRACT_DIRECTORY)
        # now zipping all files into a single zip file and using this to build the layer
        os.makedirs(OUTPUT_ZIP_DIRECTORY, exist_ok=True)
        output_zip_file_path = os.path.join(OUTPUT_ZIP_DIRECTORY, 'output.zip')
        with zipfile.ZipFile(output_zip_file_path, 'w') as zipf:
            for root, _, files in os.walk(INPUT_EXTRACT_DIRECTORY):
                for file in files:
                    file_path = os.path.join(root, file)
                    arcname = os.path.relpath(file_path, INPUT_EXTRACT_DIRECTORY)
                    zipf.write(file_path, arcname)

        LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, uploading the zip file back into S3")
        # uploading zip from tmp to s3
        upload_zip_response = S3_CLIENT.upload_file(
            output_zip_file_path,
            AI_MISC_BUCKET,
            f"definitions/{action_group_id}/lambda/layer.zip"
        )
        LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, upload zip response - %s", upload_zip_response)

        LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, finally cleaning up the tmp directories")
        # lambda directory cleanup
        shutil.rmtree(INPUT_EXTRACT_DIRECTORY)
        shutil.rmtree(OUTPUT_ZIP_DIRECTORY)

        custom_layer_name = f"{function_name}-customLayer"

        LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, now publishing the layer")
        publish_layer_response = LAMBDA_CLIENT.publish_layer_version(
            LayerName=custom_layer_name,
            Description='This is a custom lambda layer for action group lambda',
            Content={
                'S3Bucket': AI_MISC_BUCKET,
                'S3Key': f"definitions/{action_group_id}/lambda/layer.zip"
            },
            CompatibleRuntimes=[commonUtil.AGENT_ACTION_GROUP_RUNTIME]
        )
        LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, publish layer response - %s", publish_layer_response)

        # only maintaing the latest version of the layer and deleting the older versions
        if publish_layer_response['Version'] > 1:
            previous_layer_version = publish_layer_response['Version'] - 1
            LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, deleting previous version (%s) of custom layer", previous_layer_version)
            delete_layer_version_response = LAMBDA_CLIENT.delete_layer_version(
                LayerName=custom_layer_name,
                VersionNumber=previous_layer_version
            )
            LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, delete_layer_version_response - %s", delete_layer_version_response)

        LOGGER.info("In agentsActionGroups.build_action_group_lambda_layer, successfully built and published custom layer")

        return publish_layer_response['LayerVersionArn']

    except Exception as ex:
        LOGGER.error("In agentsActionGroups.build_action_group_lambda_layer, lambda layer creation failed with error - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Lambda layer creation failed with error - {str(ex)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)


def create_action_group_lambda(function_item):
    """
    This function is to create action group lambda
    """
    LOGGER.info("In agentsActionGroups.create_action_group_lambda, starting method with function item - %s", function_item)

    try:
        LOGGER.info("In agentsActionGroups.create_action_group_lambda, creating iam role for function - %s", function_item['FunctionName'])
        create_role_response = IAM_CLIENT.create_role(
            RoleName=f"{function_item['FunctionName']}-custom-ExecRole",
            AssumeRolePolicyDocument=commonUtil.get_assume_role_policy_doc("lambda", COMMONUTIL_OS_ENV_VAR_DICT),
            Description='Execution role for agent action group lambda',
            Tags=[
                {
                    'Key': 'Name',
                    'Value': f"{function_item['FunctionName']}-ExecRole"
                },
                {
                    'Key': 'Environment',
                    'Value': ENVIRONMENT
                },
                {
                    'Key': 'Region',
                    'Value': AWS_REGION
                },
            ]
        )
        LOGGER.info("In agentsActionGroups.create_action_group_lambda, create iam role response - %s", create_role_response)

        LOGGER.info("In agentsActionGroups.create_action_group_lambda, now attaching pre-baked lambda policy to this newly created role")
        attach_policy_response = IAM_CLIENT.attach_role_policy(
            RoleName=create_role_response['Role']['RoleName'],
            PolicyArn=ACTION_GROUP_LAMBDA_POLICY_ARN
        )
        LOGGER.info("In agentsActionGroups.create_action_group_lambda, attach iam policy response - %s", attach_policy_response)

        time.sleep(10)

        LOGGER.info("In agentsActionGroups.create_action_group_lambda, creating the lambda function")
        create_function_response = LAMBDA_CLIENT.create_function(
            FunctionName=function_item["FunctionName"],
            Runtime=commonUtil.AGENT_ACTION_GROUP_RUNTIME, # update this variable if you want to upgrade to a latest version
            Role=create_role_response['Role']['Arn'],
            Handler=function_item["LambdaHandler"],
            Code={
                "S3Bucket": AI_MISC_BUCKET,
                "S3Key": function_item["CodeS3Key"],
            },
             Environment= {
                        "Variables": {
                            "AWS_USE_FIPS_ENDPOINT": AWS_USE_FIPS_ENDPOINT
                        }
                    },
            Description="Custom function which is used for agent action groups.",
            Timeout=300,
            MemorySize=1024,
            Publish=True,
            PackageType="Zip",
            Layers=[function_item['LayerArn']] if function_item.get('LayerArn') else [],
            Tags={
                "Name": function_item["FunctionName"]
            }
        )
        LOGGER.info("In agentsActionGroups.create_action_group_lambda, create lambda response - %s", create_function_response)

        LOGGER.info("In agentsActionGroups.create_action_group_lambda, adding permissions for bedrock to invoke this lambda")
        add_permission_response = LAMBDA_CLIENT.add_permission(
            Action='lambda:InvokeFunction',
            FunctionName=function_item["FunctionName"],
            Principal='bedrock.amazonaws.com',
            SourceArn=f"arn:{AWS_PARTITION}:bedrock:{AWS_REGION}:{ACCOUNT_ID}:agent/*",
            StatementId='bedrock-invoke-permission',
        )
        LOGGER.info("In agentsActionGroups.create_action_group_lambda, add lambda permission response - %s", add_permission_response)

        action_group_lambda_arn = create_function_response['FunctionArn']

        LOGGER.info("In agentsActionGroups.create_action_group_lambda, succesfully created action group lambda with arn - %s", action_group_lambda_arn)
        return action_group_lambda_arn

    except Exception as ex:
        LOGGER.error("In agentsActionGroups.create_action_group_lambda, lambda creation failed with error - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Lambda creation failed with error - {str(ex)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)


def validate_action_group_input_body(input_body, action):
    """
    This function is to validate the input body for agent action group create/update
    """
    LOGGER.info("In agentsActionGroups.validate_action_group_input_body, starting method with input body: %s", input_body)

    LOGGER.info("In agentsActionGroups.validate_action_group_input_body, validating input body for %s action", action)
    for key in REQUIRED_ACTION_GROUP_KEYS[action]:
        if key not in input_body:
            LOGGER.error("In agentsActionGroups.validate_action_group_input_body, %s is not present in the input_body", key)
            ec_ipv_1001 = errorUtil.get_error_object("IPV-1001")
            ec_ipv_1001['Message'] = ec_ipv_1001['Message'].format(key)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1001)
        if not input_body[key] and action == "create":
            LOGGER.error("In agentsActionGroups.validate_action_group_input_body, %s is empty in the input_body", key)
            ec_ipv_1004 = errorUtil.get_error_object("IPV-1004")
            ec_ipv_1004['Message'] = ec_ipv_1004['Message'].format(key)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1004)


def trigger_action_group_create(event, user_id, context):
    """
    This function is to trigger action group creation and put metadata
    """
    LOGGER.info("In agentsActionGroups.trigger_action_group_create, starting method with user_id - %s, and event - %s", user_id, event)

    input_body = json.loads(event.get('body', '{}'))
    validate_action_group_input_body(input_body, "create")
    action_group_id = input_body.get("ActionGroupId", input_body["ApiDefS3Path"].split("/")[1])

    invoke_payload={
        'ActionGroupId': action_group_id,
        'UserId': user_id,
        'InputBody': input_body,
        'Operation': "create_action_group"
    }
    LOGGER.info("In agentsActionGroups.trigger_action_group_create, input payload is - %s", invoke_payload)
    lambda_trigger_response = commonUtil.invoke_lambda_function(
        lambda_client=LAMBDA_CLIENT,
        function_name=context.function_name,
        payload=json.dumps(invoke_payload),
        invocation_type='Event'
    )
    LOGGER.info("In agentsActionGroups.trigger_action_group_create, action groups create process trigger response - %s", lambda_trigger_response)

    LOGGER.info("In agentsActionGroups.trigger_action_group_create, creating metadata for the action group")
    # updating metadata in dynamodb
    action_group_db_item = {
        "ActionGroupId": action_group_id,
        "ActionGroupName": input_body["ActionGroupName"],
        "Description": input_body.get("Description", ""),
        "LambdaHandler": input_body["LambdaHandler"],
        "ApiDefS3Uri": f"s3://{AI_MISC_BUCKET}/{input_body['ApiDefS3Path']}",
        "LambdaS3Uri": f"s3://{AI_MISC_BUCKET}/{input_body['LambdaS3Path']}",
        "CreationTime": commonUtil.get_current_time(),
        "LastModifiedTime": commonUtil.get_current_time(),
        "CreatedBy": user_id,
        "LastModifiedBy": user_id,
        "AttachedLibraries": input_body.get('AttachedLibraries', []),
        "ActionGroupStatus": "CREATING", #initially set to CREATING state
        "Message": "Action group creation running in the background.",
        "SystemGenerated": "no"
    }

    action_group_put_status = dynamodbUtil.put_item(
        DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
        action_group_db_item
    )
    if action_group_put_status == "error":
        LOGGER.error("In agentsActionGroups.trigger_action_group_create, failed to create action group item in dynamodb, please check for errors.")
        ec_db_1001 = errorUtil.get_error_object("DB-1001")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)
    else:
        LOGGER.info("In agentsActionGroups.trigger_action_group_create, successfully created action group item in dynamodb")

    LOGGER.info("In agentsActionGroups.trigger_action_group_create, triggered new action group creation with action group id: %s", action_group_id)

    response = {
        "Message": "Successfully triggered action group creation.",
        "ActionGroupId": action_group_id
    }
    return commonUtil.build_post_response(200, response)


def create_action_group(event):
    """
    This function is to create an agent action group and its required resources
    """
    LOGGER.info("In agentsActionGroups.create_action_group, starting method with event %s", event)
    try:
        input_body = event['InputBody']

        LOGGER.info("In agentsActionGroups.create_action_group, converting to camel case for function name")
        # for ex, if action group name is test-action-group, its lambda function name will cdap-ai-develop-agents-testActionGroup
        words = input_body['ActionGroupName'].split('-')
        camel_case_words = [words[0]] + [word.capitalize() for word in words[1:]]
        function_name = ''.join(camel_case_words)
        lambda_name = f"{PROJECT_SHORT_NAME}-{VERTICAL_NAME}-{ENVIRONMENT}-agents-{function_name}"

        # action group id is generated initially in get_presigned_url call so retrieving from one of the s3 paths
        action_group_id = input_body.get("ActionGroupId", input_body["ApiDefS3Path"].split("/")[1])
        function_item = {}

        if input_body.get('AttachedLibraries', []):
            # if there are libraries attached in the body, build a layer for this lambda using the s3 zip files
            LOGGER.info("In agentsActionGroups.create_action_group, there are libraries attached to the action group so building layer for the lambda")
            action_group_layer_arn = build_action_group_lambda_layer(action_group_id, input_body["AttachedLibraries"], lambda_name)
            LOGGER.info("In agentsActionGroups.create_action_group, action group layer arn - %s", action_group_layer_arn)
            function_item.update({
                "LayerArn": action_group_layer_arn
            })

        LOGGER.info("In agentsActionGroups.create_action_group, initializing function item")
        function_item.update({
            "CodeS3Key": input_body['LambdaS3Path'],
            "FunctionName": lambda_name,
            "LambdaHandler": input_body['LambdaHandler'],
        })

        action_group_lambda_arn = create_action_group_lambda(function_item)
        LOGGER.info("In agentsActionGroups.create_action_group, succesfully created all action group resources with lambda arn - %s", action_group_lambda_arn)

        LOGGER.info("In agentsActionGroups.create_action_group, now updating the metadata and setting status to READY")
        update_expression = "SET ActionGroupStatus = :action_group_status, LambdaArn = :lambda_arn, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time, Message = :message"
        expression_attributes = {
            ":action_group_status": "READY",
            ":lambda_arn": action_group_lambda_arn,
            ":last_modified_by": event['UserId'],
            ":message": "Action group created successfully",
            ":last_modified_time": commonUtil.get_current_time()
        }
        key = {'ActionGroupId': event['ActionGroupId']}
        update_response = dynamodbUtil.update_item_by_key(
            DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
            key, update_expression, expression_attributes
        )

        if update_response == "error":
            LOGGER.error("In agentsActionGroups.create_action_group, failed to update the action group metadata")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS_ACTION_GROUPS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        else:
            LOGGER.info("In agentsActionGroups.create_action_group, updated the action group metadata")

        return commonUtil.build_post_response(200, {"Message": "Succesfully created all action group resources"})
    except Exception as ex:
        LOGGER.error("In agentsActionGroups.create_action_group, failed to create action group resources due to error - %s", str(ex))
        update_expression = "SET ActionGroupStatus = :action_group_status, LambdaArn = :lambda_arn, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time, Message = :message"
        expression_attributes = {
            ":action_group_status": "CREATE_FAILED",
            ":message": f"Failed to create action group resources due to error - {str(ex)}",
            ":lambda_arn": "N/A",
            ":last_modified_by": commonUtil.SYSTEM_RUNNER_ID,
            ":last_modified_time": commonUtil.get_current_time()
        }
        key = {'ActionGroupId': event['ActionGroupId']}
        update_response = dynamodbUtil.update_item_by_key(
            DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
            key, update_expression, expression_attributes)
        if update_response == "error":
            LOGGER.error("In agentsActionGroups.create_action_group, failed to update the latest status of action group item in dynamodb")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENT_ACTION_GROUPS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to update action group due to error - {str(ex)}")


def delete_action_group_lambda(lambda_arn):
    """
    This function is to delete the lambda associated with the action group
    """
    LOGGER.info("In agentsActionGroups.delete_action_group_lambda, starting method with lambda arn - %s", lambda_arn)

    try:
        function_name = lambda_arn.split(':')[-1]
        function_role_name = f"{function_name}-custom-ExecRole"

        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, deleting lambda function")
        delete_lambda_response = LAMBDA_CLIENT.delete_function(
            FunctionName=function_name
        )
        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, delete lambda response - %s", delete_lambda_response)

        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, detaching the pre-baked policy before deleting the lambda role")
        detach_policy_response = IAM_CLIENT.detach_role_policy(
            RoleName=function_role_name,
            PolicyArn=ACTION_GROUP_LAMBDA_POLICY_ARN
        )
        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, detach role policy response - %s", detach_policy_response)

        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, deleting the lambda role")
        delete_role_response = IAM_CLIENT.delete_role(
            RoleName=function_role_name
        )
        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, delete role response - %s", delete_role_response)

        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, deleting the lambda layer (if any)")
        list_layer_versions_response = LAMBDA_CLIENT.list_layer_versions(
            LayerName=f"{function_name}-customLayer"
        )
        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, list_layer_versions_response - %s", list_layer_versions_response)
        if len(list_layer_versions_response['LayerVersions']) > 0:
            delete_layer_version_response = LAMBDA_CLIENT.delete_layer_version(
                LayerName=f"{function_name}-customLayer",
                VersionNumber=list_layer_versions_response['LayerVersions'][0]['Version']
            )
            LOGGER.info("In agentsActionGroups.delete_action_group_lambda, delete_layer_version_response - %s", delete_layer_version_response)

        LOGGER.info("In agentsActionGroups.delete_action_group_lambda, successfully deleted action group lambda and its associated resources")

    except Exception as ex:
        LOGGER.error("In agentsActionGroups.delete_action_group_lambda, lambda deletion failed with error - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Lambda deletion failed with error - {str(ex)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    LOGGER.info("In agentsActionGroups.delete_action_group_lambda, successfully deleted lambda and associated role")


def delete_action_group_s3_files(action_group_id):
    """
    This function is to delete the lambda and apidef files associated with the action group
    """
    LOGGER.info("In agentsActionGroups.delete_action_group_s3_files, starting method with action group id - %s", action_group_id)

    # deleting api and lambda defintions
    s3_delete_status = commonUtil.delete_s3_path(AI_MISC_BUCKET, [f'definitions/{action_group_id}'], S3_RESOURCE.meta.client)
    if s3_delete_status != 'success':
        LOGGER.error("In agentsActionGroups.delete_action_group_s3_files, error while deleting files from s3: %s", s3_delete_status)
    else:
        LOGGER.info("In agentsActionGroups.delete_action_group_s3_files, succesfully deleted all definition files associated with the action group")

    # deleting lambda log files (if any)
    s3_delete_status = commonUtil.delete_s3_path(AI_MISC_BUCKET, [f'logs/{action_group_id}'], S3_RESOURCE.meta.client)
    if s3_delete_status != 'success':
        LOGGER.error("In agentsActionGroups.delete_action_group_s3_files, error while deleting files from s3: %s", s3_delete_status)
    else:
        LOGGER.info("In agentsActionGroups.delete_action_group_s3_files, succesfully deleted all log files associated with the action group")


def delete_action_group(action_group_id):
    """
    This function is to delete an agent action group and its associated resources
    """
    LOGGER.info("In agentsActionGroups.delete_action_group, starting method with action group id - %s", action_group_id)

    LOGGER.info("In agentsActionGroups.delete_action_group, checking if action group exists")
    action_group_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
        {'ActionGroupId': action_group_id}
    )
    if not action_group_item:
        LOGGER.error("In agentsActionGroups.delete_action_group, action group with id %s not found", action_group_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("ActionGroupId", action_group_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    # checking if action group is a prebaked action group
    if action_group_item['ActionGroupName'] in commonUtil.PREBAKED_ACTION_GROUPS:
        LOGGER.error("In agentsActionGroups.delete_action_group, action group deletion is not permitted for prebaked action group")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Cannot delete system created action group."
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    LOGGER.info("In agentsActionGroups.delete_action_group, checking if action group is in CREATING/UPDATING state")
    # if action group is in creating or updating state, delete shouldn't be allowed
    if action_group_item['ActionGroupStatus'] in ['UPDATING', 'CREATING']:
        LOGGER.error("In agentsActionGroups.delete_action_group, cannot delete action group in %s state", action_group_item['ActionGroupStatus'])
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Cannot delete action group in {action_group_item['ActionGroupStatus']} state"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    LOGGER.info("In agentsActionGroups.delete_action_group, checking if action group is associated with any agent")
    # agent is a dependency for action groups, inorder to delete an AG you should first disassociate all agents it is associated with
    agents_list = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(AGENTS_TABLE),
        projection_expression="AttachedActionGroups,AgentName,AgentId"
    )
    associated_agents = []
    for agent in agents_list:
        if agent.get("AttachedActionGroups", ""):
            for action_group in agent["AttachedActionGroups"]:
                if action_group["ActionGroupId"] == action_group_id:
                    associated_agents.append(agent["AgentName"])
    if associated_agents:
        LOGGER.error("In agentsActionGroups.delete_action_group, action group is associated with the following agents - %s", associated_agents)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Action group is associated with the following agents - {associated_agents}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    LOGGER.info("In agentsActionGroups.delete_action_group, no agents are associated so proceeding with resource deletion")

    # if create is not failed, it means lambda creation succeeded hence deleting it and the role associated with it
    if action_group_item['ActionGroupStatus'] not in ['CREATE_FAILED']:
        delete_action_group_lambda(action_group_item['LambdaArn'])

    # deleting s3 definition and log files associated with the action group
    delete_action_group_s3_files(action_group_id)

    LOGGER.info("In agentsActionGroups.delete_action_group, now clearing metadata")
    # deleting metadata
    action_group_delete_response = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
        {'ActionGroupId': action_group_id}
    )
    if action_group_delete_response != "success":
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("ActionGroup")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    LOGGER.info("In agentsActionGroups.delete_action_group, deleted metadata from dynamodb")

    response =  { "Message": "Deletion completed successfully" }
    return commonUtil.build_delete_response(200, response)


def update_action_group_lambda(lambda_arn, lambda_s3_path, lambda_handler, layer_arn):
    """
    This function is to update lambda associated with an action group
    """
    LOGGER.info("In agentsActionGroups.update_action_group_lambda, starting method")

    try:
        if lambda_s3_path:
            LOGGER.info("In agentsActionGroups.update_action_group_lambda, user has updated the lambda code so updating the lambda function")
            lambda_code_update_response = LAMBDA_CLIENT.update_function_code(
                FunctionName=lambda_arn.split(':')[-1],
                S3Bucket=AI_MISC_BUCKET,
                S3Key=urlparse(lambda_s3_path).path.lstrip('/'),
                Publish=True
            )
            LOGGER.info("In agentsActionGroups.update_action_group_lambda, lambda code update response - %s", lambda_code_update_response)
            lambda_state = "InProgress"
            retries = 0
            max_retries = 6
            # Use exponential backoff retry mechanism to wait for agentStatus to become CREATED
            while retries < max_retries and lambda_state!="Successful":
                LOGGER.info("In agentsActionGroups.update_action_group_lambda, waiting for lambda to be updated, try - %s, lambda state - %s", retries, lambda_state)
                retries+=1
                time.sleep(3**retries)
                get_lambda_response = LAMBDA_CLIENT.get_function(FunctionName=lambda_arn.split(':')[-1])
                LOGGER.info("In agentsActionGroups.update_action_group_lambda, get lambda response - %s", get_lambda_response)
                lambda_state = get_lambda_response['Configuration']['LastUpdateStatus']

        config_input = {
            "FunctionName": lambda_arn.split(':')[-1],
            "Handler": lambda_handler
        }

        if layer_arn:
            LOGGER.info("In agentsActionGroups.update_action_group_lambda, user has updated the lambda layer so updating lambda config")
            config_input["Layers"] = [layer_arn]
        else:
            LOGGER.info("In agentActionGroups.update_action_group_lambda, user has removed agent libraries so updating lambda config")
            config_input["Layers"] = []
        lambda_config_update_response = LAMBDA_CLIENT.update_function_configuration(**config_input)
        LOGGER.info("In agentsActionGroups.update_action_group_lambda, lambda config update response - %s", lambda_config_update_response)

    except Exception as ex:
        LOGGER.error("In agentsActionGroups.update_action_group_lambda, lambda updation failed with error - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Lambda updation failed with error - {str(ex)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    LOGGER.info("In agentsActionGroups.update_action_group_lambda, successfully updated lambda code/config")


def trigger_action_group_update(event, user_id, action_group_id, context):
    """
    This function is to trigger updation of an agent action group
    """
    LOGGER.info("In agentsActionGroups.trigger_action_group_update, starting method with action group id - %s and event - %s", action_group_id, event)

    LOGGER.info("In agentsActionGroups.trigger_action_group_update, checking if action group exists")
    action_group_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
        {'ActionGroupId': action_group_id}
    )
    if not action_group_item:
        LOGGER.error("In agentsActionGroups.trigger_action_group_update, action group with id %s not found", action_group_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("ActionGroupId", action_group_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    # checking if action group is a prebaked action group
    if action_group_item['ActionGroupName'] in commonUtil.PREBAKED_ACTION_GROUPS:
        LOGGER.error("In agentsActionGroups.trigger_action_group_update, action group updation is not permitted for prebaked action group")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Cannot update system created action group."
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    # checking AG status, onky allow update operation if not already in CREATING or UPDATING states
    if action_group_item['ActionGroupStatus'] in ['UPDATING', 'CREATING']:
        LOGGER.error("In agentsActionGroups.trigger_action_group_update, cannot update action group in %s state", action_group_item['ActionGroupStatus'])
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Cannot update action group in {action_group_item['ActionGroupStatus']} state"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    input_body = json.loads(event.get('body', '{}'))

    # validate input
    validate_action_group_input_body(input_body, "update")

    invoke_payload={
        'ActionGroupId': action_group_id,
        'UserId': user_id,
        'InputBody': input_body,
        'Operation': "update_action_group",
        "ActionGroupItem": action_group_item
    }
    LOGGER.info("In agentsActionGroups.trigger_action_group_update, input payload is - %s", invoke_payload)
    lambda_trigger_response = commonUtil.invoke_lambda_function(
        lambda_client=LAMBDA_CLIENT,
        function_name=context.function_name,
        payload=json.dumps(invoke_payload),
        invocation_type='Event'
    )
    LOGGER.info("In agentsActionGroups.trigger_action_group_update, action groups update process trigger response - %s", lambda_trigger_response)

    update_expression = "SET LastModifiedTime = :last_modified_time, LastModifiedBy = :last_modified_by, Message = :message, ActionGroupStatus = :action_group_status"
    expression_attributes = {
        ":action_group_status": "UPDATING",
        ":last_modified_by": user_id,
        ":message": "Action group updation running in the background.",
        ":last_modified_time": commonUtil.get_current_time()
    }
    key = {'ActionGroupId': action_group_id}
    update_response = dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
        key, update_expression, expression_attributes
    )
    if update_response == "error":
        LOGGER.error("In agentsActionGroups.trigger_action_group_update, failed to update the action group metadata")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS_ACTION_GROUPS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    else:
        LOGGER.info("In agentsActionGroups.trigger_action_group_update, updated the action group metadata")

    LOGGER.info("In agentsActionGroups.trigger_action_group_update, triggered action group updation with action group id: %s", action_group_id)

    response = {
        "Message": "Successfully triggered action group updation.",
        "ActionGroupId": action_group_id
    }
    return commonUtil.build_put_response(200, response)


def update_action_group(event):
    """
    This function is to update an agent action group
    """
    LOGGER.info("In agentsActionGroups.update_action_group, starting method with event - %s", event)

    try:
        input_body = event['InputBody']
        action_group_id = event['ActionGroupId']
        user_id = event['UserId']
        action_group_item = event['ActionGroupItem']

        if input_body.get("AttachedLibraries", ""):
            LOGGER.info("In agentsActionGroups.update_action_group, there are libraries attached to the action group so building layer for the lambda")
            custom_layer_arn = build_action_group_lambda_layer(action_group_id, input_body["AttachedLibraries"], action_group_item['LambdaArn'].split(':')[-1])
        else:
            custom_layer_arn=None

        update_action_group_lambda(action_group_item['LambdaArn'], input_body.get("LambdaS3Path", ""), input_body.get("LambdaHandler", ""), custom_layer_arn)

        LOGGER.info("In agentsActionGroups.update_action_group, updating metadata on dynamodb")
        update_expression = "SET LastModifiedTime = :last_modified_time, LastModifiedBy = :last_modified_by, ActionGroupStatus = :action_group_status, Message = :message"
        expression_attributes = {
            ":last_modified_by": user_id,
            ":last_modified_time": commonUtil.get_current_time(),
            ":message": "Action group updated successfully",
            ":action_group_status": "READY"
        }

        if input_body.get("Description", ""):
            update_expression += ", Description = :description"
            expression_attributes.update({
                ":description": input_body["Description"]
            })

        if input_body.get("LambdaHandler", ""):
            update_expression += ", LambdaHandler = :lambda_handler"
            expression_attributes.update({
                ":lambda_handler": input_body["LambdaHandler"]
            })

        if input_body.get("AttachedLibraries", []) != action_group_item["AttachedLibraries"]:
            update_expression += ", AttachedLibraries = :attached_libraries"
            expression_attributes.update({
                ":attached_libraries": input_body["AttachedLibraries"]
            })

        action_group_update_response = dynamodbUtil.update_item_by_key(
            DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
            {"ActionGroupId": action_group_id},
            update_expression,
            expression_attributes
        )
        LOGGER.info("In agentsActionGroups.update_action_group, update response from dynamodb - %s", action_group_update_response)
        if action_group_update_response == "error":
            LOGGER.error("In agentsActionGroups.update_action_group, failed to update the metadata of action group in dynamodb")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS_ACTION_GROUPS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

        LOGGER.info("In agentsActionGroups.update_action_group, successfully updated the action group")

        response =  { "Message": "Updation completed successfully" }
        return commonUtil.build_put_response(200, response)

    except Exception as ex:
        LOGGER.error("In agentsActionGroups.update_action_group, failed to update action group resources due to error - %s", str(ex))
        update_expression = "SET ActionGroupStatus = :action_group_status, LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time, Message = :message"
        expression_attributes = {
            ":action_group_status": "UPDATE_FAILED",
            ":message": f"Failed to update action group resources due to error - {str(ex)}",
            ":last_modified_by": commonUtil.SYSTEM_RUNNER_ID,
            ":last_modified_time": commonUtil.get_current_time()
        }
        key = {'ActionGroupId': event['ActionGroupId']}
        update_response = dynamodbUtil.update_item_by_key(
            DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
            key, update_expression, expression_attributes
        )
        if update_response == "error":
            LOGGER.error("In agentsActionGroups.update_action_group, failed to update the latest status of action group item in dynamodb")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS_ACTION_GROUPS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to update action group due to error - {str(ex)}")
