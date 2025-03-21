"""
Helper functions for agent libraries
"""
import os
import sys
import uuid
import json
import logging
import zipfile
import shutil
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
    AWS_USE_FIPS_ENDPOINT = os.environ["AWS_USE_FIPS_ENDPOINT"]
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    s3_endpoint_url = f"https://s3.{AWS_REGION}.amazonaws.com" if AWS_USE_FIPS_ENDPOINT == 'False' else f"https://s3-fips.{AWS_REGION}.amazonaws.com"
    S3_CLIENT = boto3.client("s3", endpoint_url=s3_endpoint_url, region_name=AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    S3_RESOURCE = boto3.resource('s3', AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)

    AGENTS_LIBRARIES_TABLE = dynamodbUtil.AGENTS_LIBRARIES_TABLE
    AGENTS_ACTION_GROUPS_TABLE = dynamodbUtil.AGENTS_ACTION_GROUPS_TABLE

    EVENT_INFO = {}
    INPUT_EXTRACT_DIRECTORY = '/tmp/input'
    OUTPUT_ZIP_DIRECTORY = '/tmp/output'

    REQUIRED_LIBRARY_KEYS = {
        "create": ['LibraryName'],
        "update": ['FileName']
    }

except Exception as ex:
    LOGGER.error("In chat.py, Failed to load environment variables. error: %s", str(ex))
    sys.exit()


def list_agent_libraries(**kwargs):
    """
    This function returns list of agent libraries
    """
    LOGGER.info("In agentsLibraries.list_agent_libraries, entering method")

    projection_expression = "LibraryId,LibraryName,Description,Packages,CreatedBy,CreationTime,LastModifiedBy,LastModifiedTime"
    agent_libraries_list = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),
        projection_expression=projection_expression
    )
    LOGGER.info("In agentsLibraries.list_agent_libraries, response from dynamodb - %s", agent_libraries_list)

    # Sort & paginate results if applicable
    LOGGER.info("In agentsLibraries.list_agent_libraries, sorting & paginating the results based on the input given")
    kwargs['dict_key'] = 'Libraries'
    kwargs['input_items'] = {'Libraries': agent_libraries_list}
    agent_libraries_list = commonUtil.sort_page_in_code(**kwargs)

    LOGGER.info("In agentsLibraries.list_agent_libraries, api response - %s", agent_libraries_list)
    return agent_libraries_list

def get_agent_library_details(query_params, library_id):
    """
    This function returns details of a single agent library
    """
    LOGGER.info("In agentsLibraries.get_agent_library_details, starting method with library id: %s", library_id)

    if query_params:
        # Return a presigned URL for downloading the library package
        if "action" in query_params and "s3path" in query_params:
            if query_params["action"].lower() == "download_package":
                LOGGER.info("In agentsLibraries.get_agent_library_details, request is for generating presigned URLs")

                LOGGER.info("In agentsLibraries.get_agent_library_details, generating presigned url for downloading library package")
                s3_object_key = urlparse(query_params['s3path']).path.lstrip('/')
                library_presigned_url = commonUtil.get_presigned_url_get_object(S3_CLIENT, AI_MISC_BUCKET, s3_object_key, query_params['s3path'].split('/')[-1])

                response = {
                    "Message": "Generated presigned URL",
                    "PresignedURL": library_presigned_url
                }

                return commonUtil.build_put_response(200, response)

            else:
                LOGGER.error("In agentsLibraries.get_agent_library_details, action must be 'download_package'.")
                ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
                ec_ipv_1008['Message'] = "action must be 'download_package'."
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)

    library_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),
        {"LibraryId": library_id}
    )
    LOGGER.info("In agentsLibraries.get_agent_library_details, response from dynamodb - %s", library_item)

    if not library_item:
        LOGGER.error("In agentsLibraries.get_agent_library_details, invalid agent library id passed")
        ec_ge_1046 = errorUtil.get_error_object("GE-1046")
        ec_ge_1046['Message'] = ec_ge_1046['Message'].format("LibraryId", library_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1046)

    LOGGER.info("In agentsLibraries.get_agent_library_details, exiting method")
    return commonUtil.build_get_response(200, library_item)


def validate_agent_library_input_body(input_body, action):
    """
    This function is to validate the input body for agent library create/update
    """
    LOGGER.info("In agentsLibraries.validate_agent_library_input_body, starting method with input body: %s", input_body)

    LOGGER.info("In agentsLibraries.validate_agent_library_input_body, validating input body for %s action", action)
    for key in REQUIRED_LIBRARY_KEYS[action]:
        if key not in input_body:
            LOGGER.error("In agentsLibraries.validate_agent_library_input_body, %s is not present in the input_body", key)
            ec_ipv_1001 = errorUtil.get_error_object("IPV-1001")
            ec_ipv_1001['Message'] = ec_ipv_1001['Message'].format(key)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1001)
        if not input_body[key]:
            LOGGER.error("In agentsLibraries.validate_agent_library_input_body, %s is empty in the input_body", key)
            ec_ipv_1004 = errorUtil.get_error_object("IPV-1004")
            ec_ipv_1004['Message'] = ec_ipv_1004['Message'].format(key)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1004)


def create_agent_library(event, user_id):
    """
    This function is to create an agent library
    """
    LOGGER.info("In agentsLibraries.create_agent_library, starting method with event: %s and user id: %s", event, user_id)

    # creating a library only creates a metadata entry, later on only packages are added
    input_body = json.loads(event.get('body', '{}'))
    validate_agent_library_input_body(input_body, "create")

    library_id = str(uuid.uuid4())
    library_db_item = {
        "LibraryId": library_id,
        "LibraryName": input_body["LibraryName"],
        "Description": input_body.get("Description", ""),
        "CreationTime": commonUtil.get_current_time(),
        "LastModifiedTime": commonUtil.get_current_time(),
        "CreatedBy": user_id,
        "LastModifiedBy": user_id
    }

    library_put_status = dynamodbUtil.put_item(
        DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),
        library_db_item
    )
    if library_put_status == "error":
        LOGGER.error("In agentsLibraries.create_agent_library, failed to create library item in dynamodb, please check for errors.")
        ec_db_1001 = errorUtil.get_error_object("DB-1001")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)

    LOGGER.info("In agentsLibraries.create_agent_library, successfully created a new agent library")

    response = {
        "Message": "Successfully created agent library",
        "LibraryId": library_id
    }
    return commonUtil.build_post_response(200, response)


def update_agent_library(query_params, event, user_id, library_id, context):
    """
    This function is to update a library and add packages
    """
    LOGGER.info("In agentsLibraries.update_agent_library, starting method with event: %s and user id: %s", event, user_id)
    input_body = json.loads(event.get('body', '{}'))

    if query_params:
        # Return a presigned URL for uploading lambda code and api def file
        if "action" in query_params:
            if query_params["action"].lower() == "get_presigned_url":
                LOGGER.info("In agentsLibraries.update_agent_library, request is for generating presigned URLs")

                validate_agent_library_input_body(input_body, "update")

                LOGGER.info("In agentsLibraries.update_agent_library, generating presigned url for library package")
                library_s3_object_key = f"libraries/{library_id}/{input_body['FileName']}"
                library_presigned_url = commonUtil.get_presigned_url_put_object(S3_CLIENT, AI_MISC_BUCKET, library_s3_object_key, content_type="application/zip")

                response = {
                    "Message": "Generated presigned URLs",
                    "PresignedURL": library_presigned_url,
                    "UploadPath": f"s3://{AI_MISC_BUCKET}/{library_s3_object_key}"
                }

                return commonUtil.build_put_response(200, response)

            else:
                LOGGER.error("In agentsLibraries.update_agent_library, action must be 'get_presigned_url'.")
                ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
                ec_ipv_1008['Message'] = "action must be 'get_presigned_url'."
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)

    # updating metadata in dynamodb
    LOGGER.info("In agentsLibraries.update_agent_library, updating metadata on dynamodb")
    update_expression = "SET LastModifiedTime = :last_modified_time, LastModifiedBy = :last_modified_by"
    expression_attributes = {
        ":last_modified_by": user_id,
        ":last_modified_time": commonUtil.get_current_time()
    }
    if input_body.get("Description", ""):
        update_expression += ", Description = :description"
        expression_attributes.update({
            ":description": input_body["Description"]
        })

    if input_body.get("Packages", ""):
        update_expression += ", Packages = :packages"
        expression_attributes.update({
            ":packages": input_body["Packages"]
        })

    library_update_response = dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),
        {"LibraryId": library_id},
        update_expression,
        expression_attributes
    )
    LOGGER.info("In agentsLibraries.update_agent_library, update response from dynamodb - %s", library_update_response)
    if library_update_response == "error":
        LOGGER.error("In agentsLibraries.update_agent_library, failed to update the metadata library in dynamodb")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("AGENTS_LIBRARIES")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

    if input_body.get("Packages", ""):
        # packages are updated so triggering associated action group lambda layer updation
        action_groups = dynamodbUtil.scan_with_pagination(DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE))
        associated_action_groups = []
        for action_group in action_groups:
            if library_id in action_group['AttachedLibraries']:
                associated_action_groups.append({
                    'ActionGroupId': action_group['ActionGroupId'],
                    'AttachedLibraries': action_group['AttachedLibraries'],
                    'FunctionName': action_group['LambdaArn'].split(':')[-1]
                })
        invoke_payload={
            'AssociatedActionGroups': associated_action_groups,
            'Operation': "async_update_action_groups_layers"
        }
        LOGGER.info("In agentsLibraries.trigger_agent_action_groups_update, input payload is - %s", invoke_payload)
        response = commonUtil.invoke_lambda_function(
            lambda_client=LAMBDA_CLIENT,
            function_name=context.function_name,
            payload=json.dumps(invoke_payload),
            invocation_type='Event'
        )
        LOGGER.info("In agentsLibraries.update_agent_library, successfully triggered associated action group(s) layer updation.")

    LOGGER.info("In agentsLibraries.update_agent_library, successfully updated the agent library")
    response =  { "Message": "Updated library successfully. Triggered action group updation." }
    return commonUtil.build_put_response(200, response)


def update_associated_action_groups(event):
    """
    This helper function is to update action group lambda layers upon library updation
    """
    LOGGER.info("in update_associated_action_groups, entering method with event - %s", event)
    associated_action_groups = event['AssociatedActionGroups']

    try:
        for action_group in associated_action_groups:
            action_group_id =  action_group['ActionGroupId']
            function_name =  action_group['FunctionName']
            attached_libraries = action_group['AttachedLibraries']
            LOGGER.info("In agentsLibraries.update_associated_action_groups, constructing layer for the lambda")
            for library_id in attached_libraries:
                library_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),{'LibraryId': library_id})
                LOGGER.info("In agentsLibraries.update_associated_action_groups, extracting each package and building layer zip file")
                for package_s3_uri in library_item.get("Packages", []):
                    parsed_uri = urlparse(package_s3_uri)
                    input_zip_file_key = parsed_uri.path.lstrip('/')
                    package_name = input_zip_file_key.split('/')[-1]

                    LOGGER.info("In agentsLibraries.update_associated_action_groups, extracting package - %s", package_name)
                    LOGGER.info("In agentsLibraries.update_associated_action_groups, downloading the package file from S3")

                    # downloading each zip file from s3 into tmp directory
                    os.makedirs(INPUT_EXTRACT_DIRECTORY, exist_ok=True)
                    input_zip_file_path = f"/{INPUT_EXTRACT_DIRECTORY}/{package_name}"
                    download_package_response = S3_CLIENT.download_file(
                        AI_MISC_BUCKET,
                        input_zip_file_key,
                        input_zip_file_path
                    )
                    LOGGER.info("In agentsLibraries.update_associated_action_groups, download package response - %s", download_package_response)

                    LOGGER.info("In agentsLibraries.update_associated_action_groups, extracting contents of the package file into %s", INPUT_EXTRACT_DIRECTORY)
                    # unzipping each zip file and dumping on one place
                    with zipfile.ZipFile(input_zip_file_path, 'r') as zip_ref:
                        zip_ref.extractall(INPUT_EXTRACT_DIRECTORY)

            LOGGER.info("In agentsLibraries.update_associated_action_groups, now zipping all the extracted files in %s", INPUT_EXTRACT_DIRECTORY)
            # now zipping all files into a single zip file and using this to build the layer
            os.makedirs(OUTPUT_ZIP_DIRECTORY, exist_ok=True)
            output_zip_file_path = os.path.join(OUTPUT_ZIP_DIRECTORY, 'output.zip')
            with zipfile.ZipFile(output_zip_file_path, 'w') as zipf:
                for root, _, files in os.walk(INPUT_EXTRACT_DIRECTORY):
                    for file in files:
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, INPUT_EXTRACT_DIRECTORY)
                        zipf.write(file_path, arcname)

            LOGGER.info("In agentsLibraries.update_associated_action_groups, uploading the zip file back into S3")
            # uploading zip from tmp to s3
            upload_zip_response = S3_CLIENT.upload_file(
                output_zip_file_path,
                AI_MISC_BUCKET,
                f"definitions/{action_group_id}/lambda/layer.zip"
            )
            LOGGER.info("In agentsLibraries.update_associated_action_groups, upload zip response - %s", upload_zip_response)

            LOGGER.info("In agentsLibraries.update_associated_action_groups, finally cleaning up the tmp directories")
            # lambda directory cleanup
            shutil.rmtree(INPUT_EXTRACT_DIRECTORY)
            shutil.rmtree(OUTPUT_ZIP_DIRECTORY)

            custom_layer_name = f"{function_name}-customLayer"

            LOGGER.info("In agentsLibraries.update_associated_action_groups, now publishing the layer")
            publish_layer_response = LAMBDA_CLIENT.publish_layer_version(
                LayerName=custom_layer_name,
                Description='This is a custom lambda layer for action group lambda',
                Content={
                    'S3Bucket': AI_MISC_BUCKET,
                    'S3Key': f"definitions/{action_group_id}/lambda/layer.zip"
                },
                CompatibleRuntimes=[commonUtil.AGENT_ACTION_GROUP_RUNTIME]
            )
            LOGGER.info("In agentsLibraries.update_associated_action_groups, publish layer response - %s", publish_layer_response)

            # only maintaing the latest version of the layer and deleting the older versions
            if publish_layer_response['Version'] > 1:
                previous_layer_version = publish_layer_response['Version'] - 1
                LOGGER.info("In agentsLibraries.update_associated_action_groups, deleting previous version (%s) of custom layer", previous_layer_version)
                delete_layer_version_response = LAMBDA_CLIENT.delete_layer_version(
                    LayerName=custom_layer_name,
                    VersionNumber=previous_layer_version
                )
                LOGGER.info("In agentsLibraries.update_associated_action_groups, delete_layer_version_response - %s", delete_layer_version_response)

            LOGGER.info("In agentsLibraries.update_associated_action_groups, successfully built and published custom layer")

            config_input = {
                "FunctionName": function_name,
                "Layers": [publish_layer_response['LayerVersionArn']]
            }
            lambda_config_update_response = LAMBDA_CLIENT.update_function_configuration(**config_input)
            LOGGER.info("In agentsLibraries.update_action_group_lambda, lambda config update response - %s", lambda_config_update_response)

        LOGGER.info("In agentsLibraries.update_action_group_lambda, successfully updated associated action group lambda layers.")

    except Exception as ex:
        LOGGER.error("In agentsLibraries.update_associated_action_groups, lambda layer creation failed with error - %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Lambda layer creation failed with error - {str(ex)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)


def delete_library_s3_files(library_id):
    """
    This function is to delete the package files associated with the library
    """
    LOGGER.info("In agentsLibraries.delete_library_s3_files, starting method with library id - %s", library_id)

    s3_delete_status = commonUtil.delete_s3_path(AI_MISC_BUCKET, [f'libraries/{library_id}'], S3_RESOURCE.meta.client)
    if s3_delete_status != 'success':
        LOGGER.error("In agentsLibraries.delete_library_s3_files, error while deleting files from s3: %s", s3_delete_status)
    else:
        LOGGER.info("In agentsLibraries.delete_library_s3_files, succesfully deleted all s3 files associated with the agent library")


def delete_agent_library(library_id):
    """
    This function is to delete an agent library and its associated resources
    """
    LOGGER.info("In agentsLibraries.delete_agent_library, starting method with library id - %s", library_id)

    LOGGER.info("In agentsLibraries.delete_agent_library, checking if library exists")
    library_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),
        {'LibraryId': library_id}
    )
    if not library_item:
        LOGGER.error("In agentsLibraries.delete_agent_library, library with id %s not found", library_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("LibraryId", library_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    # checking if there are any action groups using this library. if yes, deletion is not allowed
    action_groups_list = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(AGENTS_ACTION_GROUPS_TABLE),
        projection_expression="AttachedLibraries,ActionGroupName,ActionGroupId"
    )
    associated_action_groups = []
    for action_group in action_groups_list:
        if action_group.get("AttachedLibraries", ""):
            if library_id in action_group["AttachedLibraries"]:
                associated_action_groups.append(action_group["ActionGroupName"])
    if associated_action_groups:
        LOGGER.error("In agentLibraries.delete_agent_library, library is associated with the following action groups - %s", associated_action_groups)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Library is associated with the following action groups - {associated_action_groups}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    # deleting library package files (if any) from s3
    delete_library_s3_files(library_id)

    # removing entry from dynamodb
    LOGGER.info("In agentsLibraries.delete_agent_library, now clearing metadata")
    library_delete_response = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(AGENTS_LIBRARIES_TABLE),
        {'LibraryId': library_id}
    )
    if library_delete_response != "success":
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("Library")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    LOGGER.info("In agentsLibraries.delete_agent_library, deleted metadata from dynamodb")

    response =  { "Message": "Deletion completed successfully" }
    return commonUtil.build_delete_response(200, response)
