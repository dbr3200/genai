"""
######################################################################################################
# File: models.py
#
# This lambda function is used for managing api's for models.
#
# Modification History:
# ====================================================================
# Date                      Who                       Description
# ==========          =================     ==============================
# March 1st 2024            Yadu                     Initial Commit
#
######################################################################################################
"""

import logging
import os
import sys
import json
import uuid
# import re
import boto3
import openai

import commonUtil
import errorUtil
import dynamodbUtil
import bedrockUtil

from botocore.client import Config
from boto3.dynamodb.conditions import Key, Attr


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading Models Lambda Function")

try:
    AWS_REGION = os.environ["awsRegion"]
    AI_DATA_BUCKET_NAME = os.environ['aiDataBucketName']
    CUSTOM_MODEL_ROLE_ARN = os.environ['customModelRoleArn']
    BEDROCK_KMS_KEY_ARN = os.environ['BedrockKMSKeyArn']
    EVENT_INFO = {}
    AWS_USE_FIPS_ENDPOINT = os.environ["AWS_USE_FIPS_ENDPOINT"]
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    s3_endpoint_url = f"https://s3.{AWS_REGION}.amazonaws.com" if AWS_USE_FIPS_ENDPOINT == 'False' else f"https://s3-fips.{AWS_REGION}.amazonaws.com"
    S3_CLIENT = boto3.client("s3", endpoint_url=s3_endpoint_url, region_name=AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    MODELS_TABLE = dynamodbUtil.MODELS_TABLE
    MODELS_TABLE_MODELNAME_INDEX = dynamodbUtil.MODELS_TABLE_MODELNAME_INDEX
    GROUPS_TABLE = dynamodbUtil.GROUPS_TABLE

    # Define boto3 client/resources
    BEDROCK_CLIENT = boto3.client("bedrock", AWS_REGION)
    BEDROCK_RUNTIME_CLIENT = boto3.client("bedrock-runtime", AWS_REGION)
    SSM_CLIENT = boto3.client("ssm", AWS_REGION)

    ALLOWED_CUSTOMIZATION_TYPES = ['FINE_TUNING']
    REQUIRED_MODEL_KEYS = ['providerName', 'outputModalities', 'inputModalities', 'modelArn']
    REQUIRED_CUSTOM_MODEL_KEYS = ['ModelName', 'CustomizationType', 'TrainingDataLocation', 'BaseModelId']
    REQUIRED_CUSTOM_MODEL_DATA_UPLOAD_KEYS = ['ModelName', 'DataType']
    REQUIRED_PROVISION_THROUGHPUT_KEYS = ['ModelUnits']
    # these parameters control the training process for the customization job
    BASE_MODEL_HYPER_PARAMS_WITH_DEFAULT_VALUES = {
        'cohere.command-text-v14:7:4k': {"batchSize": "8", "epochCount": "1", "learningRate": "0.00001", "earlyStoppingPatience": "6", "earlyStoppingThreshold": "0.01", "evalPercentage": "20"},
        'cohere.command-light-text-v14:7:4k': {"batchSize": "32", "epochCount": "1", "learningRate": "0.00001", "earlyStoppingPatience": "6", "earlyStoppingThreshold": "0.01", "evalPercentage": "20"},
        'amazon.titan-text-lite-v1:0:4k': {"batchSize": "1", "epochCount": "1", "learningRate": "0.00005"},
        'amazon.titan-text-express-v1:0:8k': {"batchSize": "1", "epochCount": "1", "learningRate": "0.00005"}
    }

    with open('modelDescriptions.json', encoding='utf8') as json_file:
        MODEL_DESCRIPTION_MAPPING = json.load(json_file)

except Exception as exc:
    LOGGER.error("Failed to set environment variables with: %s", "{0}".format(exc))
    sys.exit()

def sync_models_metadata():
    '''
    Function to update DynamoDB with latest available foundation base models
    '''
    LOGGER.info("In models.sync_models_metadata, entering method, fetching list of current models")
    models_list = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(MODELS_TABLE)
    )
    LOGGER.info("In models.sync_models_metadata, current models from dynamodb - %s", models_list)
    custom_models_list = [model for model in models_list if model["ModelType"] == commonUtil.CUSTOM_MODEL_TYPE]
    LOGGER.info("In models.sync_models_metadata, custom models - %s", custom_models_list)
    LOGGER.info("In models.sync_models_metadata, fetching foundation models from aws bedrock and checking parity with current models")
    bedrock_fm_response = BEDROCK_CLIENT.list_foundation_models()['modelSummaries']
    LOGGER.info("In models.sync_models_metadata, bedrock foundation models response - %s", bedrock_fm_response)

    # getting rid of provisioned base models without customization supported since these models cannot be provisioned and hence of no use
    updated_bedrock_fm_response = []
    skipped_bedrock_models = []
    for model in bedrock_fm_response:
        if "ON_DEMAND" in model.get('inferenceTypesSupported', []):
            updated_bedrock_fm_response.append(model)
        elif "PROVISIONED" in model.get('inferenceTypesSupported', []) and any(customization_type in model.get('customizationsSupported', []) for customization_type in ALLOWED_CUSTOMIZATION_TYPES):
            updated_bedrock_fm_response.append(model)
        else:
            skipped_bedrock_models.append(model)
    LOGGER.info("In models.sync_models_metadata, bedrock models after popping unusable models - %s, skipped models - %s", updated_bedrock_fm_response, skipped_bedrock_models)

    openai_key = commonUtil.get_openai_key(SSM_CLIENT)
    formatted_openai_models = []
    if openai_key:
        openai.api_key = openai_key
        try:
            openai_fm_response = openai.models.list()
            formatted_openai_models = [
                {
                    "providerName": commonUtil.OPENAI_MODEL_PROVIDER,
                    "modelId": model.id,
                    "modelName": model.id,
                    "modelArn": "N/A",
                    "responseStreamingSupported": True,
                    "inputModalities": ['TEXT'],
                    "outputModalities": ['TEXT'],
                    "customizationsSupported": []
                } for model in openai_fm_response.data if model.id.startswith('gpt') and not any(term in model.id for term in ['vision','instruct'])
            ]
        except Exception as ex:
            LOGGER.error("In models.sync_models_metadata, failed to fetch openai models with error - %s", str(ex))
            # populating from ddb list so that they don't get removed when key expires
            formatted_openai_models = [
                {
                    "providerName": commonUtil.OPENAI_MODEL_PROVIDER,
                    "modelId": model["ModelName"],
                    "modelName": model["ModelName"],
                    "modelArn": "N/A",
                    "responseStreamingSupported": True,
                    "inputModalities": ['TEXT'],
                    "outputModalities": ['TEXT'],
                    "customizationsSupported": []
                } for model in models_list if model["ModelProvider"] == commonUtil.OPENAI_MODEL_PROVIDER
            ]

    # response from bedrock and openai are clubbed and comparative modification is done
    combined_fm_response = updated_bedrock_fm_response + formatted_openai_models
    LOGGER.info("In models.sync_models_metadata, bedrock list models response - %s", bedrock_fm_response)
    LOGGER.info("In models.sync_models_metadata, openai list models response - %s", formatted_openai_models)

    models_list_names = [model["ModelName"] for model in models_list]
    fm_response_names = [model["modelId"] for model in combined_fm_response]
    models_to_add = list(set(fm_response_names) - set(models_list_names))
    LOGGER.info("In models.sync_models_metadata, models to add - %s", models_to_add)
    models_to_remove = list(set(models_list_names) - set(fm_response_names))
    LOGGER.info("In models.sync_models_metadata, models to remove - %s", models_to_remove)
    # for already entered models, creating mapping for getting unchanged attributes
    model_id_name_map = {
        model["ModelName"]: {
            "ModelId": model["ModelId"],
            "UserAccessible": model["UserAccessible"],
            "CreationTime": model["CreationTime"],
            "CreatedBy": model["CreatedBy"],
            "AvailabilityStatus": model["AvailabilityStatus"]
        } for model in models_list
    }

    models_ddb_list = []
    # Loops through all foundational models and prepares them for storing in DDB
    for model in combined_fm_response:
        model_item = {
            'ModelId': model_id_name_map.get(model["modelId"], {}).get('ModelId', str(uuid.uuid4())),
            'ModelName': model['modelId'],
            'ModelArn': model['modelArn'],
            'ModelProvider': model.get('providerName', '').capitalize(),
            'ModelType': commonUtil.BASE_MODEL_TYPE,
            'Modalities': model.get('outputModalities', []),
            'AvailabilityStatus': 'Available' if ("ON_DEMAND" in model.get('inferenceTypesSupported', []) or model.get('providerName', '') == commonUtil.OPENAI_MODEL_PROVIDER) else model_id_name_map.get(model["modelId"], {}).get('AvailabilityStatus', 'Unavailable'),
            'IsStreamingEnabled': 'yes' if model.get('responseStreamingSupported', '') else 'no',
            'LastModifiedTime': commonUtil.get_current_time(),
            'LastModifiedBy': commonUtil.SYSTEM_RUNNER_ID,
            # CustomizationsSupported refers to the Customization jobs that can be run on the model (FINE_TUNING, CONTINUED_PRE_TRAINING).
            'CustomizationsSupported': model.get('customizationsSupported', []),
            'InferenceTypesSupported': model.get('inferenceTypesSupported', ["ON_DEMAND"]),
            # Currently maintaining a mapping file for model descriptions
            "Description": MODEL_DESCRIPTION_MAPPING.get(model['modelId'], {}).get('Description','N/A'),
            "ModelTraits": MODEL_DESCRIPTION_MAPPING.get(model['modelId'], {}).get('ModelTraits','N/A'),
            "AdditionalConfiguration": {},
            "UserAccessible": model_id_name_map.get(model["modelId"], {}).get('UserAccessible', "no"),
            "CreationTime": model_id_name_map.get(model["modelId"], {}).get('CreationTime', commonUtil.get_current_time()),
            "CreatedBy": commonUtil.SYSTEM_RUNNER_ID
        }
        # updating model message status based on user accessiblity
        if model_item['UserAccessible'] == "yes":
            model_status_message = "Model is enabled and ready for use."
            model_status_code = commonUtil.MODEL_STATUS_GREEN
        else:
            model_status_message = "Model ready for use. Please enable it to start using."
            model_status_code = commonUtil.MODEL_STATUS_YELLOW
        model_item.update({
            "ModelStatusMessage": model_status_message,
            "ModelStatusCode": model_status_code
        })
        models_ddb_list.append(model_item)

    models_ddb_list = models_ddb_list + custom_models_list
    dynamodbUtil.batch_write_items(DYNAMODB_RESOURCE.Table(MODELS_TABLE), models_ddb_list)
    LOGGER.info("In models.sync_models_metadata, foundational models refresh completed")
    # Loops through all custom models and updates the respective message code and status in dynamodb
    for model in custom_models_list:
        model_details = get_model_details(model["ModelId"])
        LOGGER.info("In models.sync_models_metadata, custom model refresh completed for - %s", model_details)
    LOGGER.info("In models.sync_models_metadata, metadata sync completed")

def list_models_by_use(model_use):
    '''
    This function is to retrieve list the models that are available for a particular functionality(fine-tuning/agent)
    '''
    LOGGER.info("In models.list_models_by_use, listing available models and filtering out embedding type models")
    projection_expression = "ModelName,ModelId,ModelProvider,Modalities,ModelType,IsStreamingEnabled,ModelStatusMessage,ModelStatusCode,InferenceTypesSupported,AdditionalConfiguration,CustomizationsSupported"
    models_list = []
    if model_use.lower() == "agent":
        for model_name in commonUtil.AGENT_SUPPORTED_MODELS:
            model_item = dynamodbUtil.get_items_by_query_index(
                DYNAMODB_RESOURCE.Table(MODELS_TABLE),
                MODELS_TABLE_MODELNAME_INDEX,
                Key("ModelName").eq(model_name),
                projection_expression
            )
            if model_item and model_item[0]["ModelStatusCode"] == commonUtil.MODEL_STATUS_GREEN:
                models_list.append(model_item[0])
    # fine_tuning supported models
    else:
        available_models = dynamodbUtil.scan_with_pagination(
            DYNAMODB_RESOURCE.Table(MODELS_TABLE),
            Attr("ModelStatusCode").eq(commonUtil.MODEL_STATUS_GREEN),
            projection_expression
        )
        LOGGER.info("In models.list_models_by_use, available models - %s", available_models)

        for model in available_models:
            if model_use.upper() in model["CustomizationsSupported"]:
                models_list.append(model)
    LOGGER.info("In models.list_models_by_use, available %s models - %s", model_use.lower(), models_list)
    return {"Models": models_list}

def list_models_with_modality(modality):
    '''
    This function is to retrieve list of text/embedding models that are available to the user
    '''
    LOGGER.info("In models.list_models_with_modality, listing available models and filtering out embedding type models")
    available_models = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(MODELS_TABLE),
        Attr("ModelStatusCode").eq(commonUtil.MODEL_STATUS_GREEN),
        "ModelName,ModelId,ModelProvider,Modalities,ModelType,IsStreamingEnabled,ModelStatusMessage,ModelStatusCode,InferenceTypesSupported,AdditionalConfiguration,CustomizationsSupported"
    )
    LOGGER.info("In models.list_models_with_modality, available models - %s", available_models)

    models_list = []
    for model in available_models:
        if modality.upper() in model["Modalities"]:
            models_list.append(model)
    LOGGER.info("In models.list_models_with_modality, available %s models - %s", modality.lower(), models_list)
    models_reponse = {
        "Models": models_list
    }
    return models_reponse

def list_models(**kwargs):
    """
    This function is to retrieve list of models that are available to the user
    :param user_item: user information
    :type user_item: dict
    :return: response to the api
    :rtype: dict
    """
    LOGGER.info("In models.list_models, all models are accessible to all users hence listing")

    projection_expression = "ModelId,ModelName,ModelType,ModelProvider,Description,LastModifiedTime,CustomizationsSupported,Modalities,ModelTraits,ModelStatusMessage,ModelStatusCode"
    models_list = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(MODELS_TABLE),
        Attr("ModelStatusCode").is_in([commonUtil.MODEL_STATUS_GREEN, commonUtil.MODEL_STATUS_YELLOW, commonUtil.MODEL_STATUS_RED]),
        projection_expression=projection_expression
    )
    LOGGER.info("In models.list_models, models response from dynamodb - %s", models_list)
    # Sort & paginate results if applicable
    LOGGER.info("In models.list_models, Sorting & Paginating the results based on the input given")
    kwargs['dict_key'] = 'Models'
    kwargs['input_items'] = {'Models': models_list}
    models_response = commonUtil.sort_page_in_code(**kwargs)
    LOGGER.info("In models.list_models,  models response - %s", models_response)
    return models_response


def get_model_details(model_id):
    """
    Get details of a particular model
    """
    LOGGER.info("In models.get_model_details, starting method with model id: %s", model_id)
    model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), {'ModelId': model_id})
    if not model_item:
        LOGGER.error("In models.get_model_details, invalid model id - `%s`", model_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("ModelId", model_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    if "PROVISIONED" in model_item['InferenceTypesSupported'] and model_item['ModelType'] == 'Custom':
        if model_item['AdditionalConfiguration']['Status'] == 'InProgress':
            response = BEDROCK_CLIENT.get_model_customization_job(jobIdentifier=model_id)
            updated_status = response['status']
            LOGGER.info("In models.get_model_details, model customization job status - %s", updated_status)
            if updated_status != model_item['AdditionalConfiguration']['Status']:
                update_expression = "SET LastModifiedTime = :lastModifiedTime, LastModifiedBy = :lastModifiedBy"
                last_modified_time = commonUtil.get_current_time()
                expression_attributes = {
                    ":lastModifiedTime": last_modified_time,
                    ":lastModifiedBy": commonUtil.SYSTEM_RUNNER_ID
                }
                if updated_status == 'Completed':
                    model_item['AdditionalConfiguration'].update({
                        'Message': "Custom model creation successful",
                        'Status': updated_status
                    })
                    update_expression += ", ModelArn = :modelArn, AdditionalConfiguration = :additional_config, ModelStatusMessage = :model_status_message, ModelStatusCode = :model_status_code"
                    expression_attributes.update({
                        ":additional_config": model_item['AdditionalConfiguration'],
                        ":modelArn": response["outputModelArn"],
                        ":model_status_message": "Model unavailable. Please provision throughput to continue.",
                        ":model_status_code": commonUtil.MODEL_STATUS_RED
                    })
                    model_item["ModelArn"] = response["outputModelArn"]
                elif updated_status in ['Failed', 'Stopped']:
                    model_item["AdditionalConfiguration"].update({
                        'Message': response['failureMessage'] if updated_status == "Failed" else "Job was stopped from AWS console",
                        'Status': updated_status
                    })
                    update_expression += ", AdditionalConfiguration = :additional_config, ModelStatusMessage = :model_status_message, ModelStatusCode = :model_status_code"
                    expression_attributes.update({
                        ":additional_config": model_item["AdditionalConfiguration"],
                        ":model_status_message": "Model unavailable.",
                        ":model_status_code": commonUtil.MODEL_STATUS_RED
                    })

                key = {'ModelId': model_id}
                update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), key, update_expression, expression_attributes)
                if update_response == "error":
                    LOGGER.error("In models.get_model_details, failed to update the latest status of model item in dynamodb")
                    ec_ge_1020 = errorUtil.get_error_object("GE-1020")
                    ec_ge_1020['Message'] = ec_ge_1020['Message'].format("MODELS")
                    raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
                model_item.update({
                    "LastModifiedTime": last_modified_time,
                    "LastModifiedBy": commonUtil.SYSTEM_RUNNER_ID
                })
        elif model_item['AdditionalConfiguration']['Status'] == 'ProvisioningThroughput':
            response = BEDROCK_CLIENT.get_provisioned_model_throughput(provisionedModelId=model_item['AdditionalConfiguration']["ProvisionThroughputConfig"]["ProvisionedModelArn"])
            updated_status = response['status']
            LOGGER.info("In models.get_model_details, model throughput provisioning status - %s", updated_status)
            if updated_status != "Creating":
                update_expression = "SET LastModifiedTime = :lastModifiedTime, LastModifiedBy = :lastModifiedBy"
                last_modified_time = commonUtil.get_current_time()
                expression_attributes = {
                    ":lastModifiedTime": last_modified_time,
                    ":lastModifiedBy": commonUtil.SYSTEM_RUNNER_ID
                }
                if updated_status == 'Failed':
                    update_expression += ", AdditionalConfiguration = :additional_config, ModelStatusMessage = :model_status_message, ModelStatusCode = :model_status_code"
                    model_item["AdditionalConfiguration"].update({
                        "Message": response['failureMessage'],
                        "Status": "ProvisioningThroughputFailed",
                    })
                    expression_attributes.update({
                        ":additional_config": model_item["AdditionalConfiguration"],
                        ":model_status_message": "Model unavailable. Please provision throughput to continue.",
                        ":model_status_code": commonUtil.MODEL_STATUS_RED
                    })
                elif updated_status == "InService":
                    update_expression += ", AvailabilityStatus = :av_status, AdditionalConfiguration = :additional_config, ModelStatusMessage = :model_status_message,  ModelStatusCode = :model_status_code"
                    model_item["AdditionalConfiguration"].update({
                        "Message": "Custom model throughput provisioned successfully. Model is ready to use",
                        "Status": "InService"
                    })
                    expression_attributes.update({
                        ":av_status": "Available",
                        ":additional_config": model_item["AdditionalConfiguration"],
                        ":model_status_message": "Model ready for use. Please enable it to start using.",
                        ":model_status_code": commonUtil.MODEL_STATUS_YELLOW
                    })
                    model_item.update({
                        "AvailabilityStatus": expression_attributes[":av_status"],
                        "ModelStatusMessage": expression_attributes[":model_status_message"],
                        "ModelStatusCode": expression_attributes[":model_status_code"]
                    })

                key = {'ModelId': model_id}
                update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), key, update_expression, expression_attributes)
                if update_response == "error":
                    LOGGER.error("In models.get_model_details, failed to update the latest status of model item in dynamodb")
                    ec_ge_1020 = errorUtil.get_error_object("GE-1020")
                    ec_ge_1020['Message'] = ec_ge_1020['Message'].format("MODELS")
                    raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
                model_item.update({
                    "LastModifiedTime": last_modified_time,
                    "LastModifiedBy": commonUtil.SYSTEM_RUNNER_ID
                })
            else:
                update_expression = "SET LastModifiedTime = :lastModifiedTime, LastModifiedBy = :lastModifiedBy, ModelStatusMessage = :model_status_message, ModelStatusCode = :model_status_code"
                last_modified_time = commonUtil.get_current_time()
                if model_item['AdditionalConfiguration']['Status'] == 'Completed':
                    if (model_item.get("AvailabilityStatus", "").lower() == "unavailable") or (model_item.get("UserAccessible", "").lower() == "no"):
                        custom_model_status_message = "Model unavailable. Please provision throughput to continue."
                        custom_model_status_code = commonUtil.MODEL_STATUS_RED
                    else:
                        custom_model_status_message = "Model ready for use. Please enable it to start using."
                        custom_model_status_code = commonUtil.MODEL_STATUS_YELLOW
                else:
                    custom_model_status_message = "Model unavailable. Throughput status unknown."
                    custom_model_status_code = commonUtil.MODEL_STATUS_RED
                expression_attributes = {
                    ":lastModifiedTime": last_modified_time,
                    ":lastModifiedBy": commonUtil.SYSTEM_RUNNER_ID,
                    ":model_status_message": custom_model_status_message,
                    ":model_status_code": custom_model_status_code
                }
                key = {'ModelId': model_id}
                update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), key, update_expression, expression_attributes)
                if update_response == "error":
                    LOGGER.error("In models.get_model_details, failed to update the latest status of model item in dynamodb")
                    ec_ge_1020 = errorUtil.get_error_object("GE-1020")
                    ec_ge_1020['Message'] = ec_ge_1020['Message'].format("MODELS")
                    raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
                # Update the item to retun the response
                model_item.update({
                    "LastModifiedTime": last_modified_time,
                    "LastModifiedBy": commonUtil.SYSTEM_RUNNER_ID,
                    "ModelStatusMessage": expression_attributes[":model_status_message"],
                    "ModelStatusCode": expression_attributes[":model_status_code"]
                })
    # Validate Model status keys for FM models
    if any(key not in model_item for key in ['ModelStatusMessage', 'ModelStatusCode']):
        LOGGER.info("In models.get_model_details, missing model status keys in model id: %s", model_id)
        update_expression = "SET LastModifiedTime = :lastModifiedTime, LastModifiedBy = :lastModifiedBy, ModelStatusMessage = :model_status_message, ModelStatusCode = :model_status_code"
        last_modified_time = commonUtil.get_current_time()
        # If it is neither "ON_DEMAND" OR "PROVISIONED" with some throughput we are making them unavailable. These are the models which need fixed throughput assigned for consumption
        if ("ON_DEMAND" not in model_item.get('inferenceTypesSupported', [])) or \
        not ("PROVISIONED" in model_item.get('inferenceTypesSupported', []) and
             any(customization_type in model_item.get('customizationsSupported', []) for customization_type in ALLOWED_CUSTOMIZATION_TYPES)):
            custom_model_status_message = "Model unavailable. Model cannot be enabled because of its current inference configuration."
            custom_model_status_code = commonUtil.MODEL_STATUS_RED
        elif model_item['ModelType'] == 'Custom':
            if model_item['AdditionalConfiguration']['Status'] == 'Completed':
                if (model_item.get("AvailabilityStatus", "").lower() == "unavailable") or (model_item.get("UserAccessible", "").lower() == "no"):
                    custom_model_status_message = "Model unavailable. Please provision throughput to continue."
                    custom_model_status_code = commonUtil.MODEL_STATUS_RED
                else:
                    custom_model_status_message = "Model ready for use. Please enable it to start using."
                    custom_model_status_code = commonUtil.MODEL_STATUS_YELLOW
            else:
                custom_model_status_message = "Model unavailable. Throughput status unknown."
                custom_model_status_code = commonUtil.MODEL_STATUS_RED
        elif (model_item.get("AvailabilityStatus", "").lower() == "available") and (model_item.get("UserAccessible", "").lower() == "yes"):
            custom_model_status_message = "Model is enabled and ready for use."
            custom_model_status_code = commonUtil.MODEL_STATUS_GREEN
        else:
            LOGGER.info("In models.get_model_details, missing availability status keys in model id: %s", model_id)
            custom_model_status_message = "Model unavailable. Avalability status unknown."
            custom_model_status_code = commonUtil.MODEL_STATUS_RED
        expression_attributes = {
            ":lastModifiedTime": last_modified_time,
            ":lastModifiedBy": commonUtil.SYSTEM_RUNNER_ID,
            ":model_status_message": custom_model_status_message,
            ":model_status_code": custom_model_status_code
        }
        key = {'ModelId': model_id}
        update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), key, update_expression, expression_attributes)
        if update_response == "error":
            LOGGER.error("In models.get_model_details, failed to update the latest status of model item in dynamodb")
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("MODELS")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        # Update the item to retun the response
        model_item.update({
            "LastModifiedTime": last_modified_time,
            "LastModifiedBy": commonUtil.SYSTEM_RUNNER_ID,
            "ModelStatusMessage": expression_attributes[":model_status_message"],
            "ModelStatusCode": expression_attributes[":model_status_code"]
        })

    return model_item


def enable_disable_model(model_id, action, user_id):
    """
    This function is to enable or disable a model
    i.e. make model user accessible or not
    """
    LOGGER.info("In models.enable_disable_model, entering method with model id - %s and action - %s", model_id, action)
    status_code = 500
    message = f"Failed to {action.lower()} the model."
    # input action and model id validations
    if action not in ['enable', 'disable']:
        LOGGER.error("In models.enable_disable_model method, invalid value passed as action")
        ec_ipv_1073 = errorUtil.get_error_object("IPV-1073")
        ec_ipv_1073['Message'] = ec_ipv_1073['Message'].format(action)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1073)
    model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), {'ModelId': model_id})
    action_model_status_code = model_item.get("ModelStatusCode", "N/A")
    action_model_status_msg = model_item.get("ModelStatusMessage", "N/A")
    if not model_item:
        LOGGER.error("In models.enable_disable_model, invalid model id - `%s`", model_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("ModelId", model_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    if model_item["AdditionalConfiguration"].get("Status", "") and model_item["AdditionalConfiguration"]["Status"] not in ["InService"]:
        LOGGER.error("In models.enable_disable_model, custom model %s cannot be enabled. Please provision throughput and try again.", model_item['ModelName'])
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = f"Custom model {model_item['ModelName']} cannot be enabled. Please provision throughput and try again."
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    if action.lower() == "enable":
        # check if openai key exists if the model provider is openai
        if model_item["ModelProvider"] == commonUtil.OPENAI_MODEL_PROVIDER:
            openai_key = commonUtil.get_openai_key(SSM_CLIENT)
            if not openai_key:
                LOGGER.error("In chat.post_query_to_model, Open AI key not set")
                ec_ge_1034 = errorUtil.get_error_object("GE-1034")
                ec_ge_1034["Message"] = "Open AI key not set. Please set it before using Open AI models"
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
            os.environ["OPENAI_API_KEY"] = openai_key

        # sending a sample message to the model and expecting response
        # if access denies is encountered, then that means the AWS account does not have access to the model. Appropriate message is shown.
        model_access, model_error_message = bedrockUtil.is_model_accessible(model_item)
        if model_access:
            action_model_status_code = commonUtil.MODEL_STATUS_GREEN
            action_model_status_msg = "Model is enabled and ready for use."
        else:
            # Bedrock/Langchain raises a validation exception based on the required input format while testing.
            # Different models have specific input expectations, and using a single generic method may fail
            # depending on how each model expects input. For instance, the Mistral model requires input
            # in a different format compared to the Anthropic model.
            # Note:
            # Based on the Model's input definition, bedrockUtil.is_model_accessible() and the corresponding chat lambda functions needs to be updated
            # to add the Model support.
            if "ValidationException" in model_error_message:
                response = {
                    "Message": "This model is not currently supported by Amorphic. Please contact Amorphic support."
                }
            else:
                response = {
                    "Message": "Your AWS account does not have access to this model. Please contact your AWS administrator."
                }
            return 400, response
    else:
        if model_item.get("ModelStatusCode", "").lower() != "available":
            LOGGER.error("In models.enable_disable_model, model %s cannot be disabled. Its current status is not available.", model_item['ModelName'])
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034['Message'] = f"Model {model_item['ModelName']} cannot be disabled as it is not in available status."
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)
        action_model_status_code = commonUtil.MODEL_STATUS_YELLOW
        action_model_status_msg = "Model ready for use. Please enable it to start using."
        LOGGER.info("In models.enable_disable_model, disabling the model - %s", model_item['ModelName'])
    # updating metadata
    update_expression = "SET LastModifiedBy = :last_modified_by, LastModifiedTime = :last_modified_time, UserAccessible = :user_accessible, ModelStatusMessage = :model_status_message, ModelStatusCode = :model_status_code"
    expression_attributes = {
        ":last_modified_by": user_id,
        ":model_status_message": action_model_status_msg,
        ":model_status_code": action_model_status_code,
        ":last_modified_time": commonUtil.get_current_time(),
        ":user_accessible": "yes" if action.lower() == "enable" else "no"
    }
    update_status = dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(MODELS_TABLE),
        {"ModelId": model_id}, update_expression, expression_attributes)
    if update_status == "success":
        LOGGER.info("In models.enable_disable_model, successfully %sd the model.", action.lower())
        message = f"Successfully {action.lower()}d the model."
        status_code = 200
    response = {
        "Message": message
    }
    return status_code, response


def validate_model_name(model_name):
    """
    This function will validate the model name
    Args:
    model_name (string): Model name to validate
    """
    LOGGER.info("In models.validate_model_name, starting method with model_name: %s", model_name)
    custom_models = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(MODELS_TABLE),
        MODELS_TABLE_MODELNAME_INDEX,
        Key("ModelName").eq(model_name)
    )
    for custom_model in custom_models:
        if custom_model["AdditionalConfiguration"]["Status"] in ["Completed", "ProvisioningThroughput", "ProvisioningThroughputFailed", "InService"]:
            LOGGER.error("In models.validate_model_name, model name already exists - %s", model_name)
            ec_ipv_1018 = errorUtil.get_error_object("IPV-1018")
            ec_ipv_1018['Message'] = ec_ipv_1018['Message'].format("ModelName")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1018)


def delete_custom_model(model_id):
    """Delete a custom model:
    1> Delete model from bedrock
    2> Delete data from S3 with model name as prefix - Training/Validation(if present)/OutputData
    3> Delete model from dynamodb
    Args:
    model_id(str): The id of the model
    """
    LOGGER.info("In models.delete_custom_model, deleting model with id: %s", model_id)

    model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), {'ModelId': model_id})
    if not model_item:
        LOGGER.error("In models.delete_custom_model, invalid model id - `%s`", model_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("ModelId", model_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    if model_item["ModelType"] == "Base":
        LOGGER.error("In models.delete_custom_model, base models cannot be deleted.")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = "Base models cannot be deleted."
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    model_name = model_item["ModelName"]
    # custo model deletion will be restricted to only some statuses
    if model_item["AdditionalConfiguration"]['Status'] == 'InProgress':
        LOGGER.error("In models.delete_custom_model, cannot delete a model while it is in InProgress state")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Failed to delete custom model due to error - Cannot delete a model while it is in InProgress state")
    elif model_item["AdditionalConfiguration"]['Status'] == 'InService':
        LOGGER.error("In models.delete_custom_model, cannot delete a model while it is in InService state")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Failed to delete custom model. Please delete the throughput provisioned before deleting the model.")
    elif model_item["AdditionalConfiguration"]['Status'] in ['Completed', "ProvisioningThroughputFailed"]:
        try:
            BEDROCK_CLIENT.delete_custom_model(modelIdentifier=model_name)
        except Exception as ex:
            LOGGER.error("In models.delete_custom_model, Failed to delete model due to error: %s", str(ex))
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to delete custom model due to error - {str(ex)}")
    else:
        LOGGER.info("In customModel.delete_custom_model, Model creation failed. So no need to delete model")

    # deleting training/validation data related to the custom model
    custom_models_s3_data_prefix = f"custom-models/{model_name}"
    response = commonUtil.delete_s3_path(AI_DATA_BUCKET_NAME, [custom_models_s3_data_prefix], S3_CLIENT)
    if response != "success":
        LOGGER.error("In models.delete_custom_model, error while deleting model related data from s3: %s", response)

    # clearing metadata
    response = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(MODELS_TABLE),
        {'ModelId': model_id}
    )
    if response != "success":
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("MODELS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    LOGGER.info("In models.delete_custom_model, deleted metadata from dynamodb")

    response =  { "Message": "Deletion completed successfully" }
    return commonUtil.build_delete_response(200, response)


def download_custom_model_data(model_id, query_params):
    """
    Download data linked to custom model
    Args:
    model_id(str): Id of the model
    query_params(dict): Query parameters
    """
    LOGGER.info("In models.download_custom_model_data, starting method with model_id: %s", model_id)

    if not query_params or not query_params.get("data-type", ""):
        LOGGER.error("In models.download_custom_model_data, query_params are empty")
        ec_ipv_1052 = errorUtil.get_error_object("IPV-1052")
        ec_ipv_1052['Message'] = ec_ipv_1052['Message'].format("data-type")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1052)
    download_data_type = query_params["data-type"]
    if download_data_type not in ["training", "validation", "metrics"]:
        LOGGER.error("In models.download_custom_model_data, invalid value passed as data-type")
        ec_ipv_1041 = errorUtil.get_error_object("IPV-1041")
        ec_ipv_1041['Message'] = ec_ipv_1041['Message'].format("data-type", ["training", "validation", "metrics"])
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1041)

    model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), {'ModelId': model_id})
    s3_key_to_download = ""
    if download_data_type == "training":
        s3_key_to_download = model_item["AdditionalConfiguration"]["TrainingDataLocation"]
    elif download_data_type == "validation":
        s3_key_to_download = model_item["AdditionalConfiguration"].get("ValidationDataLocation", "")
        if not s3_key_to_download:
            LOGGER.error("In models.download_custom_model_data, validation data not found")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Validation data not found for given model")
    else:
        s3_key_to_download = model_item["AdditionalConfiguration"]["OutputDataLocation"]
    output_file_name = s3_key_to_download.split("/")[-1]
    try:
        S3_CLIENT.head_object(Bucket=AI_DATA_BUCKET_NAME, Key=s3_key_to_download)
        presigned_url = commonUtil.get_presigned_url_get_object(S3_CLIENT, AI_DATA_BUCKET_NAME, s3_key_to_download, output_file_name)
        response =  { "PresignedURL": presigned_url }
    except Exception as ex:
        LOGGER.error("In models.download_custom_model_data, error while downloading data from s3: %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Output data not found for given model. If the model is still in InProgress, please wait for the output data to be created")

    return commonUtil.build_get_response(200, response)


def provision_model_throughput(event, user_item):
    """
    This function is to provision model throughput
    :param event: event information
    :type event: dict
    :param user_item: user details
    :type user_item: dict
    :return: response to the api
    :rtype: dict
    """
    LOGGER.info("In models.provision_model_throughput, starting method")

    model_id = event['pathParameters']['id']
    model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), {'ModelId': model_id})
    if not model_item:
        LOGGER.error("In models.provision_model_throughput, invalid model id - `%s`", model_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("ModelId", model_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    if model_item['ModelType'] == commonUtil.BASE_MODEL_TYPE:
        LOGGER.error("In models.provision_model_throughput, throughput provisioning is not supported for base models")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = "Provisioning throughput is not supported for base models."
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)
    if "PROVISIONED" not in model_item["InferenceTypesSupported"]:
        LOGGER.error("In models.provision_model_throughput, throughput provisioning is not supported for the model - %s", model_item['ModelName'])
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = f"Provisioning throughput is not supported for the model - {model_item['ModelName']}"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    commonUtil.is_user_action_valid(user_item, "ModelId", model_id, MODELS_TABLE, GROUPS_TABLE, "update")
    # restricting provisioning throughput to certain statuses, and making sure throughput it not provisioned already
    if model_item["AdditionalConfiguration"].get("Status", "") in ["InProgress", "Failed", "Stopped"]:
        LOGGER.error("In models.provision_model_throughput, model status is %s", model_item["Status"])
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Throughput cannot be provisioned for model in {model_item['Status']} state")
    if model_item["AdditionalConfiguration"].get("Status", "") != "ProvisioningThroughputFailed" and "ProvisionThroughputConfig" in model_item["AdditionalConfiguration"]:
        LOGGER.error("In models.provision_model_throughput, provisioned throughput already exists")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Provisioned throughput already exists")
    # validate body attributes - ModelUnits
    event_body = json.loads(event['body'])
    for key in REQUIRED_PROVISION_THROUGHPUT_KEYS:
        if key not in event_body:
            LOGGER.error("In models.provision_model_throughput, %s is not present in the input_body", key)
            ec_ipv_1001 = errorUtil.get_error_object("IPV-1001")
            ec_ipv_1001['Message'] = ec_ipv_1001['Message'].format(key)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1001)
    kwargs = {
        "modelUnits": event_body["ModelUnits"],
        "provisionedModelName": f'{model_item["ModelName"]}-provisioned-throughput',
        "modelId": model_item["ModelName"]
    }
    resp =  BEDROCK_CLIENT.create_provisioned_model_throughput(**kwargs)
    LOGGER.info("In models.provision_model_throughput, bedrock response - %s", resp)
    # updating metadata
    model_item["AdditionalConfiguration"].update({
        "ProvisionThroughputConfig": {
            "ProvisionedModelArn": resp["provisionedModelArn"],
            "ModelUnits": event_body["ModelUnits"]
        },
        "Message": "Provision throughput process started",
        "Status": "ProvisioningThroughput"
    })
    update_expression = "SET AdditionalConfiguration = :updated_additional_config, ModelStatusMessage = :model_status_message, ModelStatusCode = :model_status_code"
    expression_attributes = {
        ":updated_additional_config": model_item["AdditionalConfiguration"],
        ":model_status_message": "Model unavailable. Please wait till provision throughput process is complete.",
        ":model_status_code": commonUtil.MODEL_STATUS_RED
    }
    key = {'ModelId': model_id}
    update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), key, update_expression, expression_attributes)
    LOGGER.info("In models.provision_model_throughput, metadata update response - %s", update_response)
    if update_response == "error":
        LOGGER.error("In models.provision_model_throughput, failed to update the provision throughput metadata")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("MODELS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

    return commonUtil.build_put_response(200, {"Message": "Throughput provision process started"})


def delete_provisioned_model_throughput(model_id, user_item):
    """
    Delete the provisioned model throughput
    Args:
    model_id (string): Input
    user_item (object): User item
    """
    LOGGER.info("In models.delete_provisioned_model_throughput, deleting throughput for model with id - %s", model_id)
    model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), {'ModelId': model_id})
    if not model_item:
        LOGGER.error("In models.delete_provisioned_model_throughput, invalid model id - `%s`", model_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("ModelId", model_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    commonUtil.is_user_action_valid(user_item, "ModelId", model_id, MODELS_TABLE, GROUPS_TABLE, "update")
    # checking for existence of provisioned throughput
    if "ProvisionThroughputConfig" not in model_item["AdditionalConfiguration"] or model_item["AdditionalConfiguration"]["Status"] not in [commonUtil.PROVISIONED_THROUGHPUT_SUCCESS_STATUS]:
        LOGGER.error("In models.delete_provisioned_model_throughput, provisioned throughput not found for the given model")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Provisioned throughput not found for the given model")

    provision_model_arn = model_item['AdditionalConfiguration']["ProvisionThroughputConfig"]["ProvisionedModelArn"]
    try:
        BEDROCK_CLIENT.delete_provisioned_model_throughput(provisionedModelId=provision_model_arn)
    except Exception as ex:
        LOGGER.error("In models.delete_provisioned_model_throughput, Failed to delete provisioned throughput due to exception - %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to delete throughput due to error - {str(ex)}")

    # updating metadata
    model_item["AdditionalConfiguration"].update({
        "Message": "Provisioned throughput deleted",
        "Status": "Completed"
    })
    model_item["AdditionalConfiguration"].pop('ProvisionThroughputConfig')
    update_expression = "SET AvailabilityStatus = :av_status, LastModifiedBy = :lmb, LastModifiedTime = :lmt, AdditionalConfiguration = :additional_config, ModelStatusMessage = :model_status_message, ModelStatusCode = :model_status_code, UserAccessible = :user_accessible"
    expression_attributes = {
        ":av_status": "Unavailable",
        ":additional_config": model_item["AdditionalConfiguration"],
        ":lmb": commonUtil.SYSTEM_RUNNER_ID,
        ":lmt": commonUtil.get_current_time(),
        ":user_accessible": "no",
        ":model_status_message": "Model unavailable. Please provision throughput to continue.",
        ":model_status_code": commonUtil.MODEL_STATUS_RED
    }

    key = {'ModelId': model_id}
    update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), key, update_expression, expression_attributes)
    LOGGER.info("In models.delete_provisioned_model_throughput, metadata update response - %s", update_response)
    if update_response == "error":
        LOGGER.error("In models.delete_provisioned_model_throughput, failed to delete the provisioned throughput metadata from dynamodb")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("MODELS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

    return commonUtil.build_delete_response(200, {"Message": "Provisioned throughput deleted successfully"})


def get_presigned_url(event):
    """
    Get presigned url for uploading training/validation data to S3
    Args:
    event (object): Input event object
    """
    LOGGER.info("In models.get_presigned_url, starting method with event: %s", event)
    input_body = json.loads(event.get('body', '{}'))
    # validating input body
    for key in REQUIRED_CUSTOM_MODEL_DATA_UPLOAD_KEYS:
        if key not in input_body:
            LOGGER.error("In models.validate_custom_model_input, %s is not present in the input_body", key)
            ec_ipv_1001 = errorUtil.get_error_object("IPV-1001")
            ec_ipv_1001['Message'] = ec_ipv_1001['Message'].format(key)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1001)
    model_data_type = input_body['DataType']
    if model_data_type not in ['training', 'validation']:
        LOGGER.error("In models.get_presigned_url, invalid value passed as model data type - %s", model_data_type)
        ec_ipv_1041 = errorUtil.get_error_object("IPV-1041")
        ec_ipv_1041['Message'] = ec_ipv_1041['Message'].format('DataType', ['training', 'validation'])
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1041)
    model_name = input_body['ModelName']
    validate_model_name(model_name)

    s3_key = f"custom-models/{model_name}/{model_data_type}/{model_data_type}_data.jsonl"
    s3_url = commonUtil.get_presigned_url_put_object(S3_CLIENT, AI_DATA_BUCKET_NAME, s3_key)
    response = {
        "PresignedURL": s3_url,
        "S3Path": s3_key
    }
    return commonUtil.build_post_response(200, response)


def validate_custom_model_input(input_body):
    """
    This function will validate the input body for custom model
    Args:
    input_body (object): Input body to validate
    """
    LOGGER.info("In models.validate_custom_model_input, starting method with input_body: %s", input_body)
    for key in REQUIRED_CUSTOM_MODEL_KEYS:
        if key not in input_body:
            LOGGER.error("In models.validate_custom_model_input, %s is not present in the input_body", key)
            ec_ipv_1001 = errorUtil.get_error_object("IPV-1001")
            ec_ipv_1001['Message'] = ec_ipv_1001['Message'].format(key)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1001)
        if not input_body[key]:
            LOGGER.error("In models.validate_custom_model_input, %s is empty in the input_body", key)
            ec_ipv_1004 = errorUtil.get_error_object("IPV-1004")
            ec_ipv_1004['Message'] = ec_ipv_1004['Message'].format(key)
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1004)

    if input_body['CustomizationType'].upper() not in ALLOWED_CUSTOMIZATION_TYPES:
        LOGGER.error("In models.validate_custom_model_input, invalid value passed as customization type - %s", input_body['CustomizationType'])
        ec_ipv_1041 = errorUtil.get_error_object("IPV-1041")
        ec_ipv_1041['Message'] = ec_ipv_1041['Message'].format('CustomizationType', ALLOWED_CUSTOMIZATION_TYPES)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1041)


def validate_customization_files(input_body):
    """
    This function validates the model customization training and validation files
    """
    try:
        model_name = input_body['ModelName']
        commonUtil.download_file_from_s3(S3_CLIENT, AI_DATA_BUCKET_NAME, f"custom-models/{model_name}/training/{input_body['TrainingDataLocation'].split('/')[-1]}", "/tmp/training_data.jsonl")
        if not commonUtil.is_valid_jsonl("/tmp/training_data.jsonl"):
            LOGGER.error("In models.validate_customization_files, the uploaded training file is invalid")
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034['Message'] = "The uploaded training file is invalid."
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)
        if input_body.get("ValidationDataLocation", ""):
            commonUtil.download_file_from_s3(S3_CLIENT, AI_DATA_BUCKET_NAME, f"custom-models/{model_name}/validation/{input_body['ValidationDataLocation'].split('/')[-1]}", "/tmp/validation_data.jsonl")
            if not commonUtil.is_valid_jsonl("/tmp/validation_data.jsonl"):
                LOGGER.error("In models.validate_customization_files, the uploaded validation file is invalid")
                ec_ge_1034 = errorUtil.get_error_object("GE-1034")
                ec_ge_1034['Message'] = "The uploaded validation file is invalid."
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)
    except Exception as ex:
        LOGGER.error("In models.validate_customization_files, %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid file found in the model customization training/validation files")


def create_custom_model(event, user_item):
    """
    This function will create a custom model and return the model id
    Args:
    event (object): Input event
    user_item (object): User item
    """
    LOGGER.info("In models.create_custom_model, starting method with event: %s", event)
    input_body = json.loads(event.get('body', '{}'))
    validate_custom_model_input(input_body)
    model_id = str(uuid.uuid4())
    model_name = input_body['ModelName']
    customization_type = input_body['CustomizationType']
    validate_model_name(model_name)
    base_model_id = input_body["BaseModelId"]
    LOGGER.info("In models.create_custom_model, validating base model id - %s", base_model_id)
    base_model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), {'ModelId': base_model_id})
    if not base_model_item:
        LOGGER.error("In models.create_custom_model, invalid base model id - `%s`", base_model_id)
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("BaseModelId", base_model_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)
    if base_model_item['UserAccessible'] == "no":
        LOGGER.error("In models.create_custom_model, base model %s is not enabled yet.", base_model_item['ModelName'])
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = f"Base model {base_model_item['ModelName']} is not enabled yet. Please enable from models page and try again."
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)
    if base_model_item["ModelName"] not in BASE_MODEL_HYPER_PARAMS_WITH_DEFAULT_VALUES:
        LOGGER.error("In models.create_custom_model, model customization not supported for model %s", base_model_item["ModelName"])
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034['Message'] = f"Model customization not supported for base model - {base_model_item['ModelName']}"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    LOGGER.info("In models.create_custom_model, starting model creation..")
    training_data_file_name = input_body['TrainingDataLocation'].split('/')[-1]
    bedrock_model_input = {
        "jobName": model_id,
        "customModelName": model_name,
        "roleArn": CUSTOM_MODEL_ROLE_ARN,
        "baseModelIdentifier" : base_model_item["ModelName"],
        "customizationType": customization_type,
        "customModelKmsKeyId": BEDROCK_KMS_KEY_ARN,
        "trainingDataConfig": {
            's3Uri': f"s3://{AI_DATA_BUCKET_NAME}/custom-models/{model_name}/training/{training_data_file_name}"
        },
        "outputDataConfig": {
            's3Uri': f"s3://{AI_DATA_BUCKET_NAME}/custom-models/{model_name}/output/"
        }
    }

    if input_body.get("ValidationDataLocation", ""):
        validation_data_file_name = input_body['ValidationDataLocation'].split('/')[-1]
        LOGGER.info("In models.create_custom_model, validation file name - %s", validation_data_file_name)
        bedrock_model_input.update({
            "validationDataConfig": {
                'validators': [
                    {
                        's3Uri': f"s3://{AI_DATA_BUCKET_NAME}/custom-models/{model_name}/validation/{validation_data_file_name}"
                    },
                ]
            },
        })

    # validate if training and validation files are present and if they are of type jsonl
    validate_customization_files(input_body)

    hyper_params = {}
    hyper_params_input = input_body.get("HyperParameters", {})
    for hyper_param in BASE_MODEL_HYPER_PARAMS_WITH_DEFAULT_VALUES[base_model_item["ModelName"]].keys():
        hyper_params.update({
            hyper_param: str(hyper_params_input.get(hyper_param, BASE_MODEL_HYPER_PARAMS_WITH_DEFAULT_VALUES[base_model_item["ModelName"]][hyper_param]))
        })

    bedrock_model_input.update({"hyperParameters": hyper_params})
    try:
        response = BEDROCK_CLIENT.create_model_customization_job(**bedrock_model_input)
        LOGGER.info("In models.create_custom_model, bedrock response - %s", response)
    except Exception as ex:
        LOGGER.error("In models.create_custom_model, failed to create model customization job due to error - %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to create custom model due to error - {str(ex)}")

    model_customization_job_arn = response['jobArn']
    message = "Custom Model creation triggered"
    model_item = {
        "ModelId": model_id,
        "ModelProvider": base_model_item["ModelProvider"],
        "ModelName": model_name,
        "Description": input_body.get('Description', f"Custom model created by {user_item['UserId']}"),
        "CreatedBy": user_item['UserId'],
        "CreationTime": commonUtil.get_current_time(),
        "LastModifiedBy": user_item['UserId'],
        "ModelArn": "N/A",
        "LastModifiedTime": commonUtil.get_current_time(),
        "IsStreamingEnabled": base_model_item["IsStreamingEnabled"],
        "UserAccessible": "no",
        "AvailabilityStatus": "Unavailable",
        "CustomizationsSupported": [],
        "ModelTraits": "N/A",
        # by default, custom models cannot be ON DEMAND
        "InferenceTypesSupported": ["PROVISIONED"],
        "Modalities": base_model_item["Modalities"],
        "ModelType": commonUtil.CUSTOM_MODEL_TYPE,
        "ModelStatusMessage": "Model unavailable. Please wait till creation is complete.",
        "ModelStatusCode": commonUtil.MODEL_STATUS_RED,
        "AdditionalConfiguration": {
            "HyperParameters": hyper_params,
            "Status": "InProgress",
            "BaseModelId": base_model_id,
            "BaseModelName": base_model_item["ModelName"],
            "Message": message,
            "CustomizationType": customization_type,
            "TrainingDataLocation": input_body["TrainingDataLocation"],
            "OutputDataLocation": f"custom-models/{model_name}/output/model-customization-job-{model_customization_job_arn.split('/')[-1]}/training_artifacts/step_wise_training_metrics.csv",
        }
    }

    if input_body.get("ValidationDataLocation", ""):
        model_item["AdditionalConfiguration"].update({"ValidationDataLocation": input_body["ValidationDataLocation"]})

    #create custom model in dynamodb
    dynamo_response = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(MODELS_TABLE), model_item)
    if dynamo_response == "error":
        LOGGER.error("In models.create_custom_model, failed to create model item in dynamodb")
        ec_db_1001 = errorUtil.get_error_object("DB-1001")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)

    response = { "Message": message, "ModelId": model_id }
    return commonUtil.build_get_response(200, response)


# pylint: disable=too-many-branches
def lambda_handler(event, context):
    """
    This is a lambda handler function which is called for every API call event
    :param event: event information
    :type event: dict
    :param context: runtime information to the handler.
    :type context: LambdaContext
    :return: response to the api
    :rtype: dict
    """
    try:
        # to remove authorization token while printing logs
        event = commonUtil.RedactAuthTokensClass(event)
        LOGGER.info("In models.lambda_handler, starting method with event: %s, context: %s", event, context)

        if event.get("Operation"):
            LOGGER.info("In models.lambda_handler, request is from schedule")
            if event["Operation"] == "sync-models-metadata":
                sync_models_metadata()
                response = None
        else:
            LOGGER.info("In models.lambda_handler, request is from API")
            api_request_id = event.get("requestContext", {"requestId": "N/A"}).get("requestId", "N/A")
            lambda_request_id = context.aws_request_id
            EVENT_INFO["eventIdentifier"] = lambda_request_id
            LOGGER.info("In models.lambda_handler, API Gateway Request ID: %s Lambda Request ID: %s", api_request_id, lambda_request_id)
            http_method = event.get("requestContext", {"httpMethod": "N/A"}).get("httpMethod", "N/A")

            if event.get("headers") and "Authorization" in event['headers'] and event['headers']["Authorization"]:
                claims = commonUtil.get_claims(str(event['headers']['Authorization']))
                user_id = claims['cognito:username']
            else:
                usr_auth_1019 = errorUtil.get_error_object("AUTH-1019")
                usr_auth_1019['Message'] = usr_auth_1019['Message'].format("exception")
                raise errorUtil.GenericFailureException(EVENT_INFO, usr_auth_1019)

            resource_path = event.get("resource", "N/A")

            # APIs
            resource_path = event['requestContext']['resourcePath'].lower()
            # event_body = json.loads(event.get('body')) if event.get('body', None) else '{}'
            LOGGER.info("In models.lambda_handler, resource path: %s, with HTTP method: %s", resource_path, http_method)
            user_item = commonUtil.is_valid_user(user_id)
            query_params = event.get("queryStringParameters", {})
            LOGGER.info("In models.lambda_handler, query params - %s", query_params)

            if resource_path == '/models':
                # list models
                if http_method == "GET":
                    # action query parameter takes precedence
                    if query_params and "action" in query_params:
                        action = query_params["action"]
                        if action == 'sync_models_metadata':
                            LOGGER.info("In models.lambda_handler, updating latest models and availability statuses")
                            sync_models_metadata()
                            response = commonUtil.build_get_response(200, {"Message": "Models metadata synced successfully."})
                        else:
                            LOGGER.error("In models.lambda_handler method, invalid value passed as action")
                            ec_ipv_1073 = errorUtil.get_error_object("IPV-1073")
                            ec_ipv_1073['Message'] = ec_ipv_1073['Message'].format(action)
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1073)

                    elif query_params and "modality" in query_params:
                        modality = query_params["modality"]
                        if modality.lower() not in ['text', 'embedding']:
                            LOGGER.error("In models.lambda_handler method, invalid value passed as modality")
                            ec_ipv_1073 = errorUtil.get_error_object("IPV-1073")
                            ec_ipv_1073['Message'] = ec_ipv_1073['Message'].format(modality)
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1073)
                        models_reponse = list_models_with_modality(modality)
                        response = commonUtil.build_get_response(200, models_reponse)

                    elif query_params and "model-use" in query_params:
                        model_use = query_params["model-use"]
                        if model_use.lower() not in ['fine_tuning', 'agent']:
                            LOGGER.error("In models.lambda_handler method, invalid value passed as model-use")
                            ec_ipv_1041 = errorUtil.get_error_object("IPV-1041")
                            ec_ipv_1041['Message'] = ec_ipv_1041['Message'].format(model_use, ['fine_tuning','agent'])
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1041)
                        models_reponse = list_models_by_use(model_use)
                        response = commonUtil.build_get_response(200, models_reponse)

                    else:
                        commonUtil.is_user_action_valid(user_item, "ModelId", None, MODELS_TABLE, GROUPS_TABLE, "read")
                        kwargs = {
                            "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
                            "items_limit": int(query_params.get('limit')) if query_params and 'limit' in query_params else 100,
                            "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                            "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                        }
                        if kwargs['items_limit'] > 1000:
                            ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                        response = list_models(**kwargs)
                        response = commonUtil.build_get_response(200, response, compression=commonUtil.is_compression_requested(event))

                elif http_method == "POST":
                    if query_params and query_params.get("action", "") == "get_presigned_url":
                        response = get_presigned_url(event)
                    else:
                        response = create_custom_model(event, user_item)

            elif resource_path == '/models/{id}':
                model_id = event['pathParameters']['id']
                if http_method == "GET":
                    # get model details
                    LOGGER.info("In models.lambda_handler, fetching details of a single model")
                    model_details = get_model_details(model_id)
                    response = commonUtil.build_get_response(200, model_details, compression=commonUtil.is_compression_requested(event))

                elif http_method == "PUT":
                    # enable/disable a model
                    # models needs to be first enabled inorder to be listed in the get models with modality call
                    if not query_params:
                        LOGGER.error("In models.lambda_handler, query parmaeter 'action' missing")
                        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
                        ec_ge_1034["Message"] = "Query parmaeter 'action' missing"
                        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
                    for query_param in list(query_params.keys()):
                        if query_param not in ["action"]:
                            LOGGER.error("In models.lambda_handler, invalid query parameter passed")
                            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
                            ec_ge_1034["Message"] = "Invalid query parameter passed."
                            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
                    commonUtil.is_user_action_valid(user_item, "ModelId", model_id, MODELS_TABLE, GROUPS_TABLE, "update")
                    status_code, response = enable_disable_model(model_id, query_params['action'], user_id)
                    return commonUtil.build_put_response(status_code, response)

                elif http_method == "DELETE":
                    model_id = event['pathParameters']['id']
                    commonUtil.is_user_action_valid(user_item, "ModelId", model_id, MODELS_TABLE, GROUPS_TABLE, "delete")
                    response = delete_custom_model(model_id)

            elif resource_path == "/models/{id}/download" and http_method == "GET":
                model_id = event['pathParameters']['id']
                commonUtil.is_user_action_valid(user_item, "ModelId", model_id, MODELS_TABLE, GROUPS_TABLE, "read")
                response = download_custom_model_data(model_id, query_params)

            elif resource_path == "/models/{id}/throughput":
                if http_method == "PUT":
                    response = provision_model_throughput(event, user_item)
                elif http_method == "DELETE":
                    model_id = event['pathParameters']['id']
                    response = delete_provisioned_model_throughput(model_id, user_item)

            else:
                LOGGER.error("In models.lambda_handler, invalid api call - %s %s", http_method, resource_path)
                ec_ge_1010 = errorUtil.get_error_object("GE-1010")
                ec_ge_1010['Message'] = ec_ge_1010['Message'].format(http_method, resource_path)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1010)

    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In models.lambda_handler, Failed to process the api request %s with error %s", api_request_id, iie)
        response = commonUtil.build_generic_response(400, {'Message': str(iie)})
    except errorUtil.UnauthorizedUserException as uue:
        LOGGER.error("In models.lambda_handler, Failed to process the api request %s with error %s", api_request_id, uue)
        response = commonUtil.build_generic_response(400, {'Message': str(uue)})
    except errorUtil.GenericFailureException as gfe:
        LOGGER.error("In models.lambda_handler, Failed to process the api request %s with error %s", api_request_id, gfe)
        response = commonUtil.build_generic_response(500, {'Message': str(gfe)})
    except errorUtil.FailedToUpdateMetadataException as fume:
        LOGGER.error("In models.lambda_handler, Failed to process the api request %s with error %s", api_request_id, fume)
        response = commonUtil.build_generic_response(400, {'Message': str(fume)})
    except Exception as err:
        api_request_id = event.get("requestContext", {"requestId": "N/A"}).get("requestId", "N/A")
        LOGGER.error("In models.lambda_handler, Failed to process the api request id: %s with error: %s", api_request_id, str(err))
        ec_ge_1008 = errorUtil.get_error_object("GE-1008")
        ec_emf_1001 = errorUtil.get_error_object("EMF-1001")
        response = commonUtil.build_generic_response(500, {'Message': ec_emf_1001['Message'].format(ec_ge_1008['Code'], ec_ge_1008['Message']) + "The exception occurred is: {}".format(str(err))})

    return response
