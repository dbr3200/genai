"""
Lambda for CRUD operations and documents handling related to Workspaces
"""

import logging
import time
import sys
import os
import json
import uuid
import signal
import ast
from urllib.parse import unquote
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Attr, Key

import auroraUtil
import commonUtil
import dynamodbUtil
import errorUtil
import iamUtil
import webcrawling

# Initialize LOGGER.and set config and log level
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info('Loading Function %s', "workspaces.py")

try:
    PROJECT_NAME = os.environ['projectName']
    ENVIRONMENT = os.environ['environment']
    AWS_REGION = os.environ['awsRegion']
    AWS_PARTITION = os.environ["awsPartition"]
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    ACCOUNT_ID = os.environ['accountId']
    VERTICAL_NAME = os.environ['verticalName']

    AI_DATA_BUCKET = os.environ["aiDataBucket"]
    EXECUTE_INPUT_LAMBDA_SM_ARN = os.environ['executeInputLambdaStateMachineArn']
    WEB_CONTENT_SCRAPING_SM_ARN = os.environ['workspaceWebsiteContentScrapingStateMachineArn']
    DLZ_BUCKET_NAME = os.environ['DLZBucketName']
    SENDER = os.environ['sesEmailFrom']
    RAG_ENGINES = os.environ['ragEngines']

    RAG_CLUSTER_ARN = os.environ['RAGEngineClusterArn']
    RAG_DATABASE = os.environ['RAGDatabase']
    RAG_SERVICE_USER_SECRET_ARN = os.environ['auroraServiceUserAuthArn']
    DLZ_BUCKET_KMS_KEY_ARN = os.environ['DLZKMSKeyArn']
    BEDROCK_KMS_KEY_ARN = os.environ['BedrockKMSKeyArn']

    # global variables
    USERS_TABLE = dynamodbUtil.USERS_TABLE
    GROUPS_TABLE = dynamodbUtil.GROUPS_TABLE
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
    WORKSPACES_DOCUMENTS_TABLE = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE
    WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX
    WORKSPACES_EXECUTIONS_TABLE = dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE
    WORKSPACES_EXECUTIONS_TABLE_WORKSPACEID_INDEX = dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE_WORKSPACEID_INDEX
    WORKSPACES_GROUPS_TABLE = dynamodbUtil.WORKSPACES_GROUPS_TABLE
    WORKSPACES_GROUPS_TABLE_WORKSPACEID_INDEX = dynamodbUtil.WORKSPACES_GROUPS_TABLE_WORKSPACEID_INDEX
    MODELS_TABLE = dynamodbUtil.MODELS_TABLE
    CHATBOTS_TABLE = dynamodbUtil.CHATBOTS_TABLE
    AGENTS_TABLE = dynamodbUtil.AGENTS_TABLE

    # ARNs for required Amorphic lambdas
    DATASET_OPERATIONS_LAMBDA = os.environ["amorphicDatasetOperationsLambdaArn"]
    DATASET_FILES_LAMBDA = os.environ["amorphicDatasetFilesLambdaArn"]
    GET_PRESIGNED_URL_LAMBDA = os.environ["amorphicGetPresignedURLLambdaArn"]
    WORKSPACES_LAMBDA_ARN = os.environ["workspacesLambdaArn"]
    AWS_USE_FIPS_ENDPOINT = os.environ["AWS_USE_FIPS_ENDPOINT"]
    # Global params
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)
    STEP_FUNCTION_CLIENT = boto3.client('stepfunctions', AWS_REGION)
    s3_endpoint_url = f"https://s3.{AWS_REGION}.amazonaws.com" if AWS_USE_FIPS_ENDPOINT == 'False' else f"https://s3-fips.{AWS_REGION}.amazonaws.com"
    S3_CLIENT = boto3.client("s3", endpoint_url=s3_endpoint_url, region_name=AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    SES_CLIENT = boto3.client('ses', AWS_REGION)
    EVENT_CLIENT = boto3.client('events', AWS_REGION)
    BEDROCK_AGENT_CLIENT = boto3.client('bedrock-agent', AWS_REGION)
    SECRETS_MANAGER_CLIENT = boto3.client('secretsmanager', AWS_REGION)
    # For fetch account limit for knowledge base limit
    SERVICE_QUOTA_CLIENT = boto3.client('service-quotas', AWS_REGION)
    SERVICE_CODE = "bedrock"
    # Retrieve this from the AWS account under service quotas. For more information refer: https://docs.aws.amazon.com/servicequotas/latest/userguide/gs-request-quota.html
    QUOTA_CODE = "L-60DA3E0D"

    IAMUTIL_OS_ENV_VAR_DICT = {
        'awsRegion': AWS_REGION,
        's3DlzBucketName': DLZ_BUCKET_NAME,
        'projectShortName': PROJECT_SHORT_NAME,
        'environment': ENVIRONMENT,
        'projectName': PROJECT_NAME,
        'accountId': ACCOUNT_ID,
        'verticalName': VERTICAL_NAME,
        'dlzKMSKeyArn': DLZ_BUCKET_KMS_KEY_ARN
    }

    EVENT_INFO = errorUtil.EVENT_INFO
except Exception as ex:
    LOGGER.error("In workspaces.py, failed to set environment variables with: %s", str(ex))
    sys.exit()

VALID_TRIGGER_TYPES = ['time-based', 'file-based', 'on-demand']
SUPPORTED_DATASET_TARGET_LOCATIONS = ['s3', 's3athena']

ALLOWED_DOCUMENT_TYPES = ['file', 'website']
FILE_DOCUMENT_TYPE = 'file'
WEBSITE_DOCUMENT_TYPE = 'website'
DOCUMENT_REQUIRED_KEYS = {
    'file': ['DocumentName', 'DatasetId'],
    'website': [ 'WebsiteURLs' ]
}
SUPPORTED_EMBEDDING_MODELS = ['amazon.titan-embed-text-v1', 'cohere.embed-english-v3', 'cohere.embed-multilingual-v3']
EMBEDDING_MODEL_DIMENSIONS = {
    'amazon.titan-embed-text-v1': 1536,
    'cohere.embed-english-v3': 1024,
    'cohere.embed-multilingual-v3': 1024
}
MAX_TOKENS_LIMIT = {
    'amazon.titan-embed-text-v1': 8192,
    'cohere.embed-english-v3': 512,
    'cohere.embed-multilingual-v3': 512
}

class LambdaTimer():
    """
    Calling a function in a specified time.
    If you call it several times, any previously scheduled alarm
    will be canceled (only one alarm can be scheduled at any time).
    """
    #pylint: disable=unused-argument
    def __init__(self, sec, event, context):
        self.sec = sec
        self.event = event
        self.context = context

    def __enter__(self):
        signal.signal(signal.SIGALRM, self.timeout_handler)
        signal.alarm(self.sec)
        return self.event

    def __exit__(self, *args):
        signal.alarm(0) # disable alarm

    def timeout_handler(self, *args):
        """
        Timed out before completing the lambda
        """
        #pylint: disable=unused-argument
        LOGGER.error("In workspaces.LambdaTimer, Lambda has been timed out")
        self.event.update({
            "Operation": "lambda_time_out",
            "LambdaException": "Lambda timed out before performing the operation"
        })


def get_default_domain(user_id: str) -> str:
    """Get default domain of user

    Args:
        user_id (str): User ID

    Returns:
        str: Default domain of the user
    """
    LOGGER.info("In workspaces.get_default_domain, starting method with user_id: %s", user_id)
    default_domain = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(USERS_TABLE),
        {'UserId': user_id}
    )
    return default_domain['DefaultDomain']


def trigger_dataset_files_metadata_sync_sf(workspace_id: str, user_id: str, attached_datasets: list[dict], workspaces_lambda_arn: str) -> None:
    """Invoke step function for trigger dataset files metadata sync

    Args:
        workspace_id (str): Id of the workspace
        user_id (str): Id of the user
        attached_datasets (list): list of datasets linked to the workspace
        workspaces_lambda_arn (str): Lambda ARN for the workspaces lambda
    """
    try:
        sf_payload = {
            "lambdaArn": workspaces_lambda_arn,
            "Operation": "sync_dataset_files_metadata",
            "UserId": user_id,
            "WorkspaceId": workspace_id,
            "AttachedDatasets": attached_datasets
        }
        sm_resp = STEP_FUNCTION_CLIENT.start_execution(
            stateMachineArn=EXECUTE_INPUT_LAMBDA_SM_ARN,
            input=json.dumps(sf_payload),
            name=str(uuid.uuid4())
        )
        LOGGER.info("In workspaces.trigger_dataset_files_metadata_sync_sf, create workspace sf invoke response - %s", str(sm_resp))
        if sm_resp["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In workspaces.lambda_handler, error: %s", sm_resp['Payload'].read().decode())
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Source dataset metadata sync failed - {sm_resp['Payload'].read().decode()}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    except Exception as err:
        LOGGER.error("In workspaces.trigger_dataset_files_metadata_sync_sf, failed to invoke lambda with error: %s", str(err))
        # update workspaces table message with metadata sync failed
        dynamo_update_params = {
            "Message": f"Source dataset metadata sync failed. Error: {str(err)}",
            "SourceFileSyncStatus": commonUtil.FILE_SYNC_STATUS_FAILED
        }
        update_workspaces_table(workspace_id, user_id, dynamo_update_params)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"{str(err)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)


def create_workspace_groups(user_id: str, workspace_id: str) -> None:
    """Creates an entry in the workspace groups table

    Args:
        user_id (str): Id of the user creating the workspace
        workspace_id (str): Workspace Id
    """
    LOGGER.info("In workspaces.create_workspace_groups, creating entries in workspace groups table")
    workspace_owner_group_put_item = {
        "GroupId": f"g_{user_id}_owner",
        "WorkspaceId": workspace_id,
        "AccessType": "owner",
        "LastModifiedTime": commonUtil.get_current_time(),
        "LastModifiedBy": user_id
    }
    put_status = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(WORKSPACES_GROUPS_TABLE), workspace_owner_group_put_item)
    if put_status == "error":
        LOGGER.error("In workspaces.create_workspace_groups, failed to create workspace group item in dynamodb")
        ec_db_1001 = errorUtil.get_error_object("DB-1001")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)

    LOGGER.info("In workspaces.create_workspace_groups, updating WorkspaceIdList in groups table")
    key = {"GroupId": f"g_{user_id}_owner"}
    update_expression = "ADD WorkspaceIdList :val1 SET LastModifiedTime = :val2, LastModifiedBy = :val3"
    expression_attributes = {
        ":val1": {workspace_id},
        ":val2": commonUtil.get_current_time(),
        ":val3": user_id
        }
    status = dynamodbUtil.update_item_by_key(
        DYNAMODB_RESOURCE.Table(GROUPS_TABLE),
        key, update_expression, expression_attributes)
    if status == "error":
        LOGGER.error("In workspaces.create_workspace_groups, failed to create group item in dynamodb")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("GROUPS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)


def delete_amorphic_dataset(dataset_id: str, auth_token: str, role_id: str):
    """
    This method is to trigger amorphic dataset deletion in case of any failure during workspace creation
    """
    LOGGER.info("In workspaces.delete_amorphic_dataset, triggering deletion of dataset with id: %s in amorphic", dataset_id)
    lambda_obj = {
        "FunctionName": DATASET_OPERATIONS_LAMBDA,
        "LambdaClient": LAMBDA_CLIENT
    }
    commonUtil.trigger_amorphic_dataset_deletion(dataset_id, auth_token, role_id, lambda_obj)
    LOGGER.info("In workspaces.delete_amorphic_dataset, triggered dataset deletion, exiting method")

def validate_workspace_body(workspace_obj: dict, embedding_model_item: dict) -> None:
    """Validate the parameters passed for creating a workspace

    Args:
        workspace_obj (dict): Input workspace body
        embedding_model_item (dict): Input embedding model item
    """
    LOGGER.info("In workspaces.validate_workspace_body, validating workspace creation input body - %s", workspace_obj)
    required_keys = {"WorkspaceName", "TriggerType"}
    # validations for required keys, trigger types, features
    if not all(key in workspace_obj for key in required_keys):
        LOGGER.error("In workspaces.validate_workspace_body, Invalid input request body, missing required keys: %s", required_keys - set(workspace_obj.keys()))
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format(required_keys - set(workspace_obj.keys()))
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
    if workspace_obj["TriggerType"] not in VALID_TRIGGER_TYPES:
        LOGGER.error("In workspaces.validate_workspace_body, Invalid TriggerType: %s", workspace_obj["TriggerType"])
        errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1041", None, "TriggerType", VALID_TRIGGER_TYPES)
    if workspace_obj["TriggerType"] == "time-based" and not workspace_obj.get("ScheduleExpression", ""):
        LOGGER.error("In workspaces.validate_workspace_body, ScheduleExpression is required for time-based TriggerType")
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("ScheduleExpression")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
    elif workspace_obj["TriggerType"] in ["on-demand", "file-based"] and workspace_obj.get("ScheduleExpression"):
        LOGGER.error("In workspaces.validate_workspace_body, ScheduleExpression is not required for on-demand/file-based TriggerType")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "ScheduleExpression is not required for on-demand/file-based TriggerType")
    if not commonUtil.is_valid_string(workspace_obj["WorkspaceName"]):
        LOGGER.error("In workspaces.validate_workspace_body, WorkspaceName is not valid.")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid WorkspaceName, WorkspaceName should start with an alphabet, should not contain special characters(except '-' and '_') and spaces")
    # check if workspace with same name already exists
    if dynamodbUtil.scan_with_pagination(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), Attr("WorkspaceName").eq(workspace_obj["WorkspaceName"])):
        LOGGER.error("In workspaces.validate_workspace_body, Workspace with name: %s already exists.", workspace_obj["WorkspaceName"])
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1009", f"Name: {workspace_obj['WorkspaceName']} already exists")
    if 'EMBEDDING' not in embedding_model_item['Modalities']:
        LOGGER.error("In workspaces.validate_workspace_body, the specified model is not an embedding model")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Specified Model cannot be used for creating embeddings")
    if embedding_model_item['UserAccessible'] == 'no':
        LOGGER.error("In workspaces.validate_workspace_body, the specified model is not an embedding model")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Specified Model is not yet enabled")
    # Only selected models can be used for embeddings creation
    if embedding_model_item['ModelName'] not in SUPPORTED_EMBEDDING_MODELS:
        LOGGER.error("In workspaces.validate_workspace_body, Currently embedding creation is only supported with the models - %s", SUPPORTED_EMBEDDING_MODELS)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Currently embedding creation is only supported with the models - {SUPPORTED_EMBEDDING_MODELS}")

    if workspace_obj.get("ChunkingConfig", {}).get("MaxTokens") and (workspace_obj["ChunkingConfig"]["MaxTokens"] < 100 or workspace_obj["ChunkingConfig"]["MaxTokens"] > MAX_TOKENS_LIMIT[embedding_model_item['ModelName']]):
        LOGGER.error("In workspaces.validate_workspace_body, invalid chunk size specified - %s", workspace_obj["ChunkingConfig"]["MaxTokens"])
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Invalid MaxTokens specified, value must be between 100 and {MAX_TOKENS_LIMIT[embedding_model_item['ModelName']]}")
    if workspace_obj.get("ChunkingConfig", {}).get("OverlapPercentage") and (workspace_obj["ChunkingConfig"]["OverlapPercentage"] < 1 or workspace_obj["ChunkingConfig"]["OverlapPercentage"] > 100):
        LOGGER.error("In workspaces.validate_workspace_body, invalid chunk size specified - %s", workspace_obj["ChunkingConfig"]["OverlapPercentage"])
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid OverlapPercentage specified, value must be between 1 and 100")

def create_knowledge_base_data_source(workspace_id: str, knowledge_base_id: str, attached_datasets: list[dict], max_tokens: int, overlap_percentage: int) -> str:
    """Create a data source to be linked to the knowledge base

    Args:
        workspace_id (str): Workspace id
        knowledge_base_id (str): Knowledge base id
        attached_datasets (list): List of datasets attached to the workspace
        max_tokens (int): Size of each chunk
        overlap_percentage (int): Chunk Overlap Percentage

    Returns:
        str: Data Source Id
    """
    LOGGER.info("In workspaces.create_knowledge_base_data_source, starting method. Workspace id: %s, knowledge base id: %s", workspace_id, knowledge_base_id)
    s3_prefixes_to_include = [f"{dataset['Domain']}/{dataset['DatasetName']}/" for dataset in attached_datasets]
    response = BEDROCK_AGENT_CLIENT.create_data_source(
        knowledgeBaseId=knowledge_base_id,
        name=f"{workspace_id}-{knowledge_base_id}",
        description=f"Data source for workspace with id - {workspace_id}",
        dataSourceConfiguration={
            'type': 'S3',
            's3Configuration': {
                'bucketArn': f"arn:{AWS_PARTITION}:s3:::{DLZ_BUCKET_NAME}",
                'inclusionPrefixes': s3_prefixes_to_include
            }
        },
        serverSideEncryptionConfiguration = {
            'kmsKeyArn': BEDROCK_KMS_KEY_ARN
        },
        vectorIngestionConfiguration={
            'chunkingConfiguration': {
                'chunkingStrategy': 'FIXED_SIZE',
                'fixedSizeChunkingConfiguration': {
                    'maxTokens': max_tokens,
                    'overlapPercentage': overlap_percentage
                }
            }
        }
    )['dataSource']

    LOGGER.info("In workspaces.create_data_source, successfully created data source with response - %s", response)
    return response['dataSourceId']

def create_knowledge_base_for_workspace(workspace_id: str, workspace_name: str, description: str,
    embedding_model_name: str, attached_datasets: list[dict], max_tokens: int, overlap_percentage: int) -> tuple[str, str, str, str]:
    """Create a bedrock knowledge base for the workspace

    Args:
        workspace_id (str): Workspace id
        workspace_name (str): Workspace name
        description (str): Description of the workspace
        embedding_model_name (str): Embedding model name
        attached_datasets (list[dict]): List of datasets attached to the workspace
        max_tokens (int): Chunk size
        overlap_percentage (int): Chunk overlap percentage

    Returns
        tuple[str, str, str, str]: Knowledge Base Id, Knowledge Base Status, Knowledge Base Role Name, Data Source Id
    """
    LOGGER.info("In workspaces.create_knowledge_base, starting method. Workspace id: %s, embedding model name: %s", workspace_id, embedding_model_name)
    embedding_model_arn = f"arn:{AWS_PARTITION}:bedrock:{AWS_REGION}::foundation-model/{embedding_model_name}"

    IAMUTIL_OS_ENV_VAR_DICT.update({
        'embeddingModelArn': embedding_model_arn
    })
    knowledge_base_role_arn = iamUtil.create_iam_role("bedrock", workspace_id, attached_datasets, IAMUTIL_OS_ENV_VAR_DICT)
    # Adding sleep for role to get created
    time.sleep(8)
    try:
        response = BEDROCK_AGENT_CLIENT.create_knowledge_base(
            name=workspace_name,
            description=description,
            roleArn=knowledge_base_role_arn,
            knowledgeBaseConfiguration={
                'type': 'VECTOR',
                'vectorKnowledgeBaseConfiguration': {
                    'embeddingModelArn': embedding_model_arn
                }
            },
            storageConfiguration={
                'type': 'RDS',
                'rdsConfiguration': {
                    'resourceArn': RAG_CLUSTER_ARN,
                    'credentialsSecretArn': RAG_SERVICE_USER_SECRET_ARN,
                    'databaseName': RAG_DATABASE,
                    'tableName': f"table_{workspace_id.replace('-', '')}",
                    'fieldMapping': {
                        'primaryKeyField': 'chunk_id',
                        'vectorField': 'embeddings',
                        'textField': 'chunks',
                        'metadataField': 'metadata'
                    }
                }
            },
            tags={
                'Name': "-".join([PROJECT_NAME, ENVIRONMENT, workspace_name]),
                'Environment': ENVIRONMENT,
                'Region': AWS_REGION
            }
        )['knowledgeBase']

    except ClientError as ex:
        if ex.response["Error"]["Code"] == "ServiceQuotaExceededException":
            role_name = knowledge_base_role_arn.split("role/")[1]
            # Incase of failure in creation of knowledge base, delete the created role as well.
            iamUtil.delete_iam_role_with_custom_inline_policy(role_name)
            LOGGER.error(
                "In workspaces.create_knowledge_base_for_workspace, ServiceQuotaExceededException for creating knowledge base - %s",
                ex.response["Error"]["Message"],
            )
            service_quota_response = SERVICE_QUOTA_CLIENT.get_aws_default_service_quota(ServiceCode=SERVICE_CODE , QuotaCode =QUOTA_CODE)
            service_limit = int(service_quota_response["Quota"]["Value"])
            errorUtil.raise_exception(
                EVENT_INFO,
                "GF",
                "GE-1004",
                "Failed to create Knowledge Base due to service quota exhaustion [Limit: {}]: {}".format(
                    service_limit,ex.response["Error"]["Message"]
                ),
            )

    LOGGER.info("In workspaces.create_knowledge_base_for_workspace, response received from create api - %s", response)
    if response['status'] == 'FAILED':
        # Incase of failure in creation of knowledge base, delete the created role as well.
        iamUtil.delete_iam_role_with_custom_inline_policy(role_name)
        LOGGER.error("In workspaces.create_knowledge_base, failed to create knowledge base for workspace with id - %s due to error", workspace_id)
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Failed to create knowledge base for workspace with id - {}".format(workspace_id))

    knowledge_base_id = response['knowledgeBaseId']
    knowledge_base_status = response['status']
    # Create a data source to be linked to the knowledge base
    data_source_id = create_knowledge_base_data_source(workspace_id, knowledge_base_id, attached_datasets, max_tokens, overlap_percentage)

    LOGGER.info("In workspaces.create_knowledge_base, successfully created knowledge base and data source for the workspace")
    return knowledge_base_id, knowledge_base_status, knowledge_base_role_arn.split("/")[-1], data_source_id

def create_workspace(workspace_obj: dict, user_id: str) -> dict:
    """Create a new workspace

    Args:
        workspace_obj (dict): Input workspace object
        user_id (str): User ID requesting the workspace creation

    Returns:
        dict: Dictionary containing message and workspace Id
    """
    LOGGER.info("In workspaces.create_workspace, starting method. User %s has requested to create a workspace with configuration: %s", user_id, workspace_obj)
    auth_token, role_id = commonUtil.get_user_auth_resources(user_id, USERS_TABLE)

    embedding_model_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(MODELS_TABLE), {'ModelId': workspace_obj['EmbeddingsModel']})
    # Check if the embedding model specified is valid
    if not embedding_model_item:
        LOGGER.error("In workspaces.create_workspace, Embedding Model specified is not valid.")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Invalid EmbeddingModel specified")
    validate_workspace_body(workspace_obj, embedding_model_item)

    attached_datasets = []
    workspace_db_put_item = {
        "WorkspaceId": str(uuid.uuid4()),
        "WorkspaceName": workspace_obj["WorkspaceName"],
        "TriggerType": workspace_obj["TriggerType"],
        "Message": "Creation in progress",
        "WorkspaceStatus": commonUtil.WORKSPACES_CREATING_STATUS,
        "SourceFileSyncStatus": commonUtil.FILE_SYNC_STATUS_COMPLETED,
        "Description": workspace_obj.get("Description", ""),
        "Keywords": workspace_obj.get("Keywords", []),
        "CreationTime": commonUtil.get_current_time(),
        "CreatedBy": user_id,
        "LastModifiedTime": commonUtil.get_current_time(),
        "LastModifiedBy": user_id,
        "ChunkingConfig": {
            "MaxTokens": workspace_obj.get("ChunkingConfig", {}).get("MaxTokens", 1000),
            "OverlapPercentage": workspace_obj.get("ChunkingConfig", {}).get("OverlapPercentage", 1)
        },
        "RAGEngine": RAG_ENGINES,
        "EmbeddingsModel": {
            "Name": embedding_model_item['ModelName'],
            "Id": workspace_obj["EmbeddingsModel"],
        }
    }

    # Validate when user attaches source datasets
    if workspace_obj.get("AttachedDatasets", []):
        LOGGER.info("In workspaces.create_workspace, creating workspace with attached datasets - %s", workspace_obj["AttachedDatasets"])

        # Restrict linking only one source dataset per workspace for now
        if len(workspace_obj["AttachedDatasets"]) > 1:
            LOGGER.error("In workspaces.create_workspace, cannot attach more than one source dataset to a workspace")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Cannot attach more than one source dataset to a workspace")

        attached_datasets = []
        for dataset_id in workspace_obj["AttachedDatasets"]:
            # check given source dataset is exists in Amorphic
            dataset_operations_lambda_obj = {
                "AuthorizationToken": auth_token,
                "RoleId": role_id,
                "LambdaClient": LAMBDA_CLIENT,
                "FunctionName": DATASET_OPERATIONS_LAMBDA
            }
            amorphic_dataset_item = commonUtil.retrieve_amorphic_dataset(user_id, dataset_id, dataset_operations_lambda_obj)
            attached_datasets.append({
                'DatasetId': dataset_id,
                'DatasetName': amorphic_dataset_item['DatasetName'],
                'Domain': amorphic_dataset_item['Domain'],
                'TargetLocation': amorphic_dataset_item['TargetLocation'],
                'FileType': amorphic_dataset_item['FileType'],
                'IsTBACEnabled': amorphic_dataset_item.get('IsTBACEnabled', False)
            })
        workspace_db_put_item.update({
            "SourceFileSyncStatus": commonUtil.FILE_SYNC_STATUS_RUNNING,
            "Message": "Creation completed. File sync in progress.",
        })
    # Create a source dataset for workspace when no datasets are attached
    else:
        LOGGER.info("In workspaces.create_workspace, creating a source dataset for the workspace")
        lambda_obj = {
            "AuthorizationToken": auth_token,
            "RoleId": role_id,
            "LambdaClient": LAMBDA_CLIENT,
            "FunctionName": DATASET_OPERATIONS_LAMBDA
        }
        dataset_item = {
            "DatasetName": commonUtil.substitute_characters(workspace_obj["WorkspaceName"]) + "_workspace",
            "DatasetDescription": workspace_obj.get("Description", f"Source dataset for the Workspace - {workspace_obj['WorkspaceName']} being used in the Vertical - {VERTICAL_NAME}"),
            "Domain": workspace_obj.get("DatasetDomain", get_default_domain(user_id)),
            "Keywords": workspace_obj.get("Keywords", []),
            "TargetLocation": "s3"
        }

        create_source_dataset_response = commonUtil.create_amorphic_dataset(dataset_item, user_id, lambda_obj)
        attached_datasets = [{
            "DatasetId": create_source_dataset_response["DatasetId"],
            "DatasetName": dataset_item["DatasetName"],
            "Domain": dataset_item['Domain'],
            "TargetLocation": "s3",
            "FileType": "others"
        }]

    workspace_db_put_item.update({
        "AttachedDatasets": attached_datasets
    })

    # create schedule for time-based trigger type
    if workspace_obj["TriggerType"] == "time-based":
        # create event rule if necessary
        LOGGER.info("In workspaces.create_workspace, trigger type is time-based, so creating new event rule")
        event_rule_obj = {
            "RuleName": f"{VERTICAL_NAME}-{workspace_db_put_item['WorkspaceId']}-rule",
            "ScheduledExpression": workspace_obj["ScheduleExpression"],
            "TargetLambdaArn": WORKSPACES_LAMBDA_ARN,
            "LambdaEvent": {
                "EventType": "ScheduledEvent",
                'WorkspaceId': workspace_db_put_item['WorkspaceId'],
                "UserId": user_id
            }
        }
        commonUtil.create_event_rule(event_rule_obj)

        # update store item
        workspace_db_put_item.update({
            "ScheduleExpression": workspace_obj["ScheduleExpression"],
            "EventRuleName": event_rule_obj["RuleName"]
        })

    try:
        auroraUtil.create_workspace_table(workspace_db_put_item, RAG_SERVICE_USER_SECRET_ARN, SECRETS_MANAGER_CLIENT, EMBEDDING_MODEL_DIMENSIONS[embedding_model_item['ModelName']])
    except Exception as ex:
        LOGGER.error("In workspaces.create_workspace, failed to create aurora table for workspace due to error - %s", str(ex))
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Failed to create aurora table for workspace due to error - {str(ex)}")

    # Create a bedrock knowledge base for the workspace
    knowledge_base_id, knowledge_base_status, knowledge_base_role_name, data_source_id = create_knowledge_base_for_workspace(workspace_db_put_item['WorkspaceId'], workspace_db_put_item['WorkspaceName'],
        workspace_db_put_item['Description'], embedding_model_item['ModelName'], attached_datasets, workspace_db_put_item['ChunkingConfig']['MaxTokens'], workspace_db_put_item['ChunkingConfig']['OverlapPercentage'])
    workspace_db_put_item.update({
        'KnowledgeBaseId': knowledge_base_id,
        'WorkspaceStatus': knowledge_base_status,
        'KnowledgeBaseRoleName': knowledge_base_role_name,
        'DataSourceId': data_source_id
    })

    LOGGER.info("In workspaces.create_workspace, adding entry to workspaces table: %s", str(workspace_db_put_item))
    put_status = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), workspace_db_put_item)
    if put_status == "error":
        LOGGER.error("In workspaces.create_workspace, failed to create workspace item in dynamodb, please check for errors.")
        ec_db_1001 = errorUtil.get_error_object("DB-1001")
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)

    if workspace_obj.get("AttachedDatasets", []):
        # trigger step function to sync source dataset metadata files metadata into workspaces table
        trigger_dataset_files_metadata_sync_sf(workspace_db_put_item["WorkspaceId"], user_id, attached_datasets, WORKSPACES_LAMBDA_ARN)
        message = "Creation completed. File sync is in progress."
    else:
        message = "Creation completed successfully"

    # addd entry in workspace groups table
    create_workspace_groups(user_id, workspace_db_put_item["WorkspaceId"])

    return {"Message": message, "WorkspaceId": workspace_db_put_item["WorkspaceId"]}


def list_workspaces(user_item: dict, **kwargs) -> dict:
    """
    Get all workspaces user have access to
    """
    LOGGER.info("In workspaces.list_workspaces, starting method")

    # get user accessible workspace ids from groupstable
    owner_workspaces_id_list, read_only_workspaces_id_list = commonUtil.get_user_accessible_resources(user_item, GROUPS_TABLE, WORKSPACES_TABLE, "workspaces")

    # user read-only workspaces & user owner workspaces
    workspace_items = []
    projection_expression = "WorkspaceName, WorkspaceId, TriggerType, ScheduleExpression, Description, LastModifiedTime, Keywords"

    read_only_workspace_items = dynamodbUtil.batch_get_items(
        DYNAMODB_RESOURCE,
        WORKSPACES_TABLE,
        [{"WorkspaceId": workspace_id} for workspace_id in read_only_workspaces_id_list],
        projection_expression
    )
    for item in read_only_workspace_items:
        item["AccessType"] = "read-only"
        workspace_items.append(item)

    owner_workspace_items = dynamodbUtil.batch_get_items(
        DYNAMODB_RESOURCE,
        WORKSPACES_TABLE,
        [{"WorkspaceId": workspace_id} for workspace_id in owner_workspaces_id_list],
        projection_expression
    )
    for item in owner_workspace_items:
        item["AccessType"] = "owner"
        workspace_items.append(item)

    # Sort & paginate results if applicable
    LOGGER.info("In workspaces.list_workspaces, Sorting & Paginating the results based on the input given")
    kwargs['dict_key'] = 'Workspaces'
    kwargs['input_items'] = {'Workspaces': workspace_items}
    workspaces_list = commonUtil.sort_page_in_code(**kwargs)

    LOGGER.info("In workspaces.list_workspaces, exiting method")
    return workspaces_list


def get_workspace(workspace_id: str, user_item: dict) -> dict:
    """
    This function will append access type to workspace item and remove non required keys
    """
    LOGGER.info("In workspaces.get_workspace, starting method with workspace_item: %s", workspace_id)
    workspace_item, permission = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")

    # Check knowledge base status and update the item with the latest status if it is not active
    # Added try except block in order to avoid failure for older workspaces since knowledge base were not linked to those
    try:
        if workspace_item['WorkspaceStatus'] != commonUtil.WORKSPACES_CREATION_COMPLETED_STATUS:
            response = BEDROCK_AGENT_CLIENT.get_knowledge_base(knowledgeBaseId = workspace_item['KnowledgeBaseId'])['knowledgeBase']
            knowledge_base_status = response['status']
            if knowledge_base_status != workspace_item['WorkspaceStatus']:
                update_workspaces_table(workspace_id, user_item['UserId'], {'WorkspaceStatus': knowledge_base_status})
    except Exception as ex:
        LOGGER.error("In workspaces.get_workspace, failed to retrieve knowledge base status due to the error: %s", str(ex))

    non_required_keys = ["EventRuleName", "KnowledgeBaseId", "KnowledgeBaseRoleName", "DataSourceId"]
    workspace_item_new = commonUtil.remove_keys_from_dictionary(workspace_item, non_required_keys)
    workspace_item_new.update({"AccessType": permission})

    return workspace_item_new


def update_workspaces_table(workspace_id: str, user_id: str, dynamo_update_params: dict) -> None:
    """This function will update workspaces table

    Args:
        workspace_id (str): Workspace Id
        user_id (str): User Id updating the workspace
        dynamo_update_params (dict): Dictionary containing parameters and the values to update

    Raises:
        errorUtil.InconsistentMetadataException: _description_
    """
    LOGGER.info("In workspaces.update_workspaces_table, starting method with dynamodb update params: %s", dynamo_update_params)

    key = {"WorkspaceId": workspace_id}
    update_expression = "SET LastModifiedBy = :val1, LastModifiedTime = :val2"
    expression_attributes = {
        ":val1": user_id,
        ":val2": commonUtil.get_current_time()
    }

    update_params = ["Message", "SourceFileSyncStatus", "TriggerType", "ScheduleExpression", "Keywords", "Description", "EventRuleName", "WorkspaceStatus"]
    for param in update_params:
        if dynamo_update_params.get(param):
            update_expression += f", {param} = :{param}"
            expression_attributes.update({
                f":{param}": dynamo_update_params[param]
            })

    update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), key, update_expression, expression_attributes)
    if update_response == "error":
        LOGGER.error("In workspaces.update_workspaces_table method, response received is %s", update_response)
        db_auth_1002 = errorUtil.get_error_object("DB-1002")
        raise errorUtil.InconsistentMetadataException(EVENT_INFO, db_auth_1002)


def update_workspace(workspace_item: dict, event_body: dict, user_id: str, current_lambda_arn: str) -> dict:
    """This method is to update details for a workspace

    Args:
        workspace_item (dict): Existing workspace item in DDB
        event_body (dict): Incoming event body containing updated body
        user_id (str): User Id requesting the update
        current_lambda_arn (str): Workspaces Lambda Arn

    Returns:
        dict: Message regarding update status
    """
    LOGGER.info("In workspaces.update_workspace, starting method with event body: %s", event_body)
    workspace_id = workspace_item["WorkspaceId"]

    dynamo_update_params = {}
    # Validations for trigger type
    trigger_type = event_body.get("TriggerType", "")
    if trigger_type:
        if event_body["TriggerType"] not in VALID_TRIGGER_TYPES:
            LOGGER.error("In workspaces.update_workspace, Invalid TriggerType: %s", event_body["TriggerType"])
            errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1041", None, "TriggerType", VALID_TRIGGER_TYPES)
        dynamo_update_params.update({
            "TriggerType": trigger_type
        })

        if trigger_type == "time-based" and not event_body.get("ScheduleExpression", ""):
            LOGGER.error("In workspaces.update_workspace, ScheduleExpression is required for time-based TriggerType")
            ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
            ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("ScheduleExpression")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
        elif trigger_type in ["on-demand", "file-based"] and event_body.get("ScheduleExpression"):
            LOGGER.error("In workspaces.update_workspace, ScheduleExpression is not allowed for on-demand/file-based TriggerType")
            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "ScheduleExpression is not allowed for on-demand/file-based TriggerType")

        # delete event rule for on-demand/file-based scheduling
        if trigger_type in ["on-demand", "file-based"] and workspace_item["TriggerType"] == "time-based":
            try:
                LOGGER.info("In workspaces.update_workspace, changing trigger type to %s, deleting existing event rule", trigger_type)
                # Get the rule details to retrieve the targets
                list_targets_by_rule_response = EVENT_CLIENT.list_targets_by_rule(Rule=workspace_item["EventRuleName"])
                targets = list_targets_by_rule_response['Targets']
                # Loop through the targets and remove each one
                for target in targets:
                    target_id = target['Id']
                    EVENT_CLIENT.remove_targets(Rule=workspace_item["EventRuleName"], Ids=[target_id])
                delete_rule_response = EVENT_CLIENT.delete_rule(Name=workspace_item["EventRuleName"])
                LOGGER.info("In workspaces.update_workspace, event rule deleted successfully: %s", delete_rule_response)

                key_condition_expression = {'WorkspaceId': workspace_id}
                update_expression = "REMOVE ScheduleExpression, EventRuleName"
                update_response = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), key_condition_expression, update_expression)
                if update_response == "error":
                    LOGGER.error("In workspaces.update_workspace, response received is %s", update_response)
                    db_auth_1002 = errorUtil.get_error_object("DB-1002")
                    raise errorUtil.InconsistentMetadataException(EVENT_INFO, db_auth_1002)
            except Exception as ex:
                LOGGER.error("In workspaces.update_workspace, an error occurred while updating the workspace, error: %s", str(ex))
                errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Update failed with error: {str(ex)}")

        # update event rule for time based scheduling
        elif trigger_type == "time-based" and workspace_item["TriggerType"] == "time-based" and event_body["ScheduleExpression"] != workspace_item["ScheduleExpression"]:
            try:
                LOGGER.info("In workspaces.update_workspace, updating event rule schedule from from %s to %s", workspace_item["ScheduleExpression"], event_body["ScheduleExpression"])
                put_rule_response = EVENT_CLIENT.put_rule(Name=workspace_item["EventRuleName"], ScheduleExpression=event_body["ScheduleExpression"])
                LOGGER.info("In workspace.update_workspace, put rule response: %s", put_rule_response)
            except Exception as ex:
                LOGGER.error("In workspaces.update_workspace, an error occurred while updating the workspace, error: %s", str(ex))
                errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Update failed with error: {str(ex)}")

        # create event rule for time-based scheduling
        elif trigger_type == "time-based" and workspace_item["TriggerType"] in ["on-demand", "file-based"]:
            try:
                LOGGER.info("In workspaces.update_workspace, trigger type is time-based, so creating new event rule")
                event_rule_obj = {
                    "RuleName": f"{VERTICAL_NAME}-{workspace_id}-rule",
                    "ScheduledExpression": event_body.get("ScheduleExpression"),
                    "TargetLambdaArn": current_lambda_arn,
                    "LambdaEvent": {
                        "EventType": "ScheduledEvent",
                        'WorkspaceId': workspace_id,
                        "UserId": user_id
                    }
                }
                event_rule_arn = commonUtil.create_event_rule(event_rule_obj)
                LOGGER.info("In workspaces.update_workspace, event rule created for workspace : %s with ARN: %s", workspace_item["WorkspaceName"], event_rule_arn)
                dynamo_update_params.update({'EventRuleName': event_rule_obj["RuleName"]})
            except Exception as ex:
                LOGGER.error("In workspaces.update_workspace, an error occurred while updating the workspace, error: %s", str(ex))
                errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Update failed with error: {str(ex)}")

    if event_body.get("ScheduleExpression", ""):
        dynamo_update_params.update({"ScheduleExpression": event_body["ScheduleExpression"]})
    if "Description" in event_body:
        dynamo_update_params.update({"Description": event_body.get("Description", "-")})
    if "Keywords" in event_body:
        dynamo_update_params.update({"Keywords": event_body["Keywords"]})

    update_workspaces_table(workspace_id, user_id, dynamo_update_params)
    LOGGER.info("In workspaces.update_workspace, exiting method")
    return {"Message": "Update completed successfully"}

def get_amorphic_datasets(user_id: str) -> dict:
    """This method will return a list of datasets that the user has owner permission in Amorphic

    Args:
        user_id (str): User Id to get datasets for

    Returns:
        dict: Dict containing list of datasets
    """
    LOGGER.info("In workspaces.get_amorphic_datasets, starting method")
    auth_token, role_id = commonUtil.get_user_auth_resources(user_id, USERS_TABLE)

    # Get user datasets from amorphic by invoking lambda
    try:
        invoke_payload = {
            "headers": {
                "Authorization": auth_token,
                "user_id": user_id,
                "role_id": role_id
            },
            "pathParameters": {},
            "requestContext": {
                "httpMethod": "GET",
                "resourcePath": "/datasets"
            },
            "queryStringParameters": {},
            "user_id": user_id,
            "resource": "/datasets",
            "httpMethod": "GET",
        }
        LOGGER.info("In workspaces.get_amorphic_datasets, invoking %s lambda with payload: %s", DATASET_OPERATIONS_LAMBDA, invoke_payload)
        response = commonUtil.invoke_lambda_function(
            lambda_client=LAMBDA_CLIENT,
            function_name=DATASET_OPERATIONS_LAMBDA,
            payload=json.dumps(invoke_payload),
            invocation_type='RequestResponse'
        )
        LOGGER.info("In workspaces.get_amorphic_datasets, lambda: %s invoke response: %s", DATASET_OPERATIONS_LAMBDA, response)
        if response["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In workspaces.lambda_handler, error: %s", response['Payload'].read().decode())
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Error- {response['Payload'].read().decode()}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        datasets_list_body = json.loads(json.loads(response['Payload'].read().decode('utf-8'))["body"])

        datasets_list = []
        for dataset_item in datasets_list_body["datasets"]:
            if (dataset_item['IsActive'] == 'yes' and dataset_item['DatasetType'] != 'view'
            and (dataset_item['TargetLocation'] in SUPPORTED_DATASET_TARGET_LOCATIONS)
            and (dataset_item['RegistrationStatus'] == 'completed')
            and (dataset_item['FileType'] in commonUtil.SUPPORTED_DATASET_FILETYPES)
            ):
                dataset_obj = {
                    "DatasetId": dataset_item["DatasetId"],
                    "DatasetName": dataset_item["DatasetName"],
                    "DatasetDescription": dataset_item["DatasetDescription"],
                    "Domain": dataset_item["Domain"],
                    "FileType": dataset_item["FileType"],
                    "TargetLocation": dataset_item["TargetLocation"],
                    "TenantName": dataset_item["TenantName"],
                    "CreatedBy": dataset_item["CreatedBy"],
                    "AccessType": dataset_item["AccessType"]
                }
                datasets_list.append(dataset_obj)

        LOGGER.info("In workspaces.get_amorphic_datasets, return %s no of datasets", len(datasets_list))
        return {"Datasets": datasets_list}
    except Exception as ex:
        LOGGER.error("In workspaces.get_amorphic_datasets, getting amorphic datasets failed with error: %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = str(ex)
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

def run_workspace(user_id: str, workspace_id: str, knowledge_base_id: str, data_source_id: str, workspaces_lambda_arn: str, trigger_type = "on-demand") -> dict:
    """Trigger ingestion job for the knowledge base linked to the workspace

    Args:
        user_id (str): Id of the user triggering the workspace run
        workspace_id (str): Workspace ID
        knowledge_base_id (str): ID of the Knowledge base linked to the workspace
        data_source_id (str): ID of the data source linked to the knowledge base
        workspaces_lambda_arn (str): ARN of the workspaces lambda
    """
    LOGGER.info("In workspaces.run_workspace, Starting ingestion job for workspace id - %s", workspace_id)
    response = BEDROCK_AGENT_CLIENT.start_ingestion_job(
        knowledgeBaseId=knowledge_base_id,
        dataSourceId=data_source_id
    )['ingestionJob']

    workspace_run_db_item = {
        "RunId": response['ingestionJobId'],
        "WorkspaceId": workspace_id,
        "RunStatus": commonUtil.RUN_STATUS_IN_PROGRESS,
        "StartTime": commonUtil.get_current_time(),
        "Message": "Run triggered",
        "LastModifiedBy": user_id,
        "LastModifiedTime": commonUtil.get_current_time(),
        "TriggeredBy": user_id,
        "TriggerType": trigger_type
    }
    put_response = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(WORKSPACES_EXECUTIONS_TABLE), workspace_run_db_item)
    if put_response == "error":
        LOGGER.info("In workspaces.run_workspace, updating workspace execution table failed")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("WORKSPACES EXECUTIONS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

    sf_payload = {
        "lambdaArn": workspaces_lambda_arn,
        "Operation": "check_ingestion_job_status",
        "UserId": user_id,
        "WorkspaceId": workspace_id,
        "RunStatus": commonUtil.RUN_STATUS_IN_PROGRESS,
        "RunId": workspace_run_db_item['RunId'],
        "KnowledgeBaseId": knowledge_base_id,
        "DataSourceId": data_source_id
    }
    sm_resp = STEP_FUNCTION_CLIENT.start_execution(
        stateMachineArn=EXECUTE_INPUT_LAMBDA_SM_ARN,
        input=json.dumps(sf_payload),
        name=str(uuid.uuid4())
    )
    LOGGER.info("In workspaces.run_workspace, check ingestion job sf invoke response - %s", str(sm_resp))
    if sm_resp["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In workspaces.run_workspace, step function invocation failed due to the error: %s", sm_resp['Payload'].read().decode())
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Error- {sm_resp['Payload'].read().decode()}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    return {'Message': 'Run triggered', 'RunId': workspace_run_db_item['RunId']}

def check_and_update_ingestion_job_status(event):
    """This function checks and updates the status of the ingestion job

    Args:
        event (dict): Input event containing details about the ingestion job

    Returns:
        dict: Updated event for the step function
    """
    run_id = event['RunId']
    knowledge_base_id = event['KnowledgeBaseId']
    data_source_id = event['DataSourceId']
    current_run_status = event['RunStatus']

    response = BEDROCK_AGENT_CLIENT.get_ingestion_job(
        knowledgeBaseId=knowledge_base_id,
        dataSourceId=data_source_id,
        ingestionJobId=run_id
    )['ingestionJob']

    message = "Run Triggered"
    if response['status'] == 'FAILED':
        failure_reasons = "\n".join(response['failureReasons'])
        message = f"Embedding process failed due to the following error(s) - {failure_reasons}"
    elif response['status'] == 'COMPLETE':
        message = "Embedding process completed for all the documents and are now ready for utilization."

    if response['status'] != current_run_status:
        commonUtil.update_execution_status({'RunId': run_id}, response['status'], message)

    if response['status'] in ['COMPLETE', 'FAILED']:
        event.update({'RunStatus': response['status'], 'Operation': 'Complete'})

    return event

def trigger_web_crawling_sf(event_body, workspace_id: str, user_id: str, workspaces_lambda_arn: str) -> dict:
    """Invoke step function for triggering web crawling files metadata sync

    Args:
        event: Input event object
        workspace_id: Workspace ID
        user_id (str): Id of the user
        workspaces_lambda_arn (str): Lambda ARN for the workspaces lambda
    """
    LOGGER.info("In workspaces.trigger_web_crawling_sf, starting the method")
    workspace_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE),
        {'WorkspaceId': workspace_id})
    if not workspace_item:
        LOGGER.error("In workspaces.trigger_web_crawling_sf, no item found with the specified workspace id: %s", workspace_id)
        errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1002", None, "WorkspaceId", workspace_id)
    try:
        document_id = str(uuid.uuid4())
        document_item = {
            'DocumentId': document_id,
            'DocumentType': 'WebCrawling',
            'WorkspaceId': workspace_id,
            'CrawlStatus': commonUtil.RUN_STATUS_STARTING,
            'DocumentDetails': {
                'WebsiteURL': event_body['WebsiteURL'],
                'FollowLinks': event_body.get('FollowLinks', False),
                'PageLimit': event_body.get('PageLimit', 1)
            }
        }
        put_response = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), document_item)
        if put_response == "error":
            LOGGER.error("In workspaces.trigger_web_crawling_sf, failed to create an entry in DynamoDB, admin must cleanup this inconsistency.")
            ec_db_1001 = errorUtil.get_error_object("DB-1001")
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)
        # Invoke step function to invoke the web crawling operation
        sf_payload = {
            "lambdaArn": workspaces_lambda_arn,
            "Operation": "crawl_website",
            "UserId": user_id,
            "DocumentId": document_id,
            "WorkspaceId": workspace_id
        }
        sm_resp = STEP_FUNCTION_CLIENT.start_execution(
            stateMachineArn=EXECUTE_INPUT_LAMBDA_SM_ARN,
            input=json.dumps(sf_payload),
            name=str(uuid.uuid4())
        )
        LOGGER.info("In workspaces.trigger_web_crawling_sf, trigger web crawling sf invoke response - %s", str(sm_resp))
        if sm_resp["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In workspaces.trigger_web_crawling_sf, error: %s", sm_resp['Payload'].read().decode())
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Source dataset metadata sync failed - {sm_resp['Payload'].read().decode()}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        return commonUtil.build_get_post_response(200, {
            'CrawlId': document_id,
            'Message': 'Web crawling initiated successfully'
        })
    except Exception as err:
        LOGGER.error("In workspaces.trigger_web_crawling_sf, failed to invoke lambda with error: %s", str(err))
        # update documents table message with web crawling status failed
        commonUtil.update_document_status(document_id, workspace_id, commonUtil.RUN_STATUS_FAILED, f'Failed to start website crawling due to error - ${str(err)}')
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Failed to trigger web crawling due to the error - {str(err)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

def list_nested_urls(workspace_id: str, web_crawl_id: str, **kwargs) -> dict:
    """This function will return list of nested file items for a given workspace

    Args:
        workspace_id (str): Workspace ID
        web_crawl_id (str): Website ID

    Returns:
        dict: Dictionary containing the nested urls list along with the pagination parameters
    """
    LOGGER.info("In workspaces.list_nested_urls, retrieving nested urls for website crawl job with id: %s", web_crawl_id)
    document_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE),
        {'DocumentId': web_crawl_id, 'WorkspaceId': workspace_id}
    )
    if not document_item:
        LOGGER.error("In workspaces.list_nested_urls, no web crawl job exists with the specified web crawl id")
        errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1002", None, "DocumentId", web_crawl_id)
    crawl_status = document_item['CrawlStatus']
    nested_urls = []
    if crawl_status == commonUtil.RUN_STATUS_COMPLETE:
        nested_urls = document_item['DocumentDetails']['NestedURLs']
    # Sort & paginate results if applicable
    LOGGER.info("In workspaces.list_nested_urls, Sorting & Paginating the results based on the input given")
    nested_urls_dict = {'Websites': []}
    if 'items_limit' in kwargs and kwargs.get('items_limit'):
        nested_urls_dict['Websites'] = nested_urls[kwargs['offset']: kwargs['offset']+kwargs['items_limit']]
        nested_urls_dict['next_available'] = 'yes' if len(nested_urls) > kwargs['offset']+kwargs['items_limit'] else 'no'
    else:
        nested_urls_dict['Websites'] = nested_urls[kwargs['offset']:]
        nested_urls_dict['next_available'] = 'no'
    nested_urls_dict['count'] = len(nested_urls_dict['Websites'])
    nested_urls_dict['total_count'] = len(nested_urls)
    nested_urls_dict.update({'CrawlStatus': crawl_status})

    LOGGER.info("In workspaces.list_nested_urls, exiting method")
    return nested_urls_dict


def get_workspace_document(workspace_id: str, document_id: str) -> dict:
    """
    This method will return details of workspace file and presigned url to download raw file
    """
    LOGGER.info("In workspaces.get_workspace_document, starting method with workspace id: %s and filename: %s", workspace_id, document_id)
    projection_expression = "DocumentId,DocumentType,DocumentDetails,LastModifiedTime,LastModifiedBy,Message"
    document_item = dynamodbUtil.get_item_by_key_with_projection(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE),
        {'WorkspaceId': workspace_id, "DocumentId": document_id},
        projection_expression)
    if not document_item:
        LOGGER.error("In workspaces.get_workspace_document, document id: %s not found for workspace id: %s", document_id, workspace_id)
        errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1002", None, "DocumentId", document_id)

    if document_item['DocumentType'] == FILE_DOCUMENT_TYPE:
        try:
            LOGGER.info("In workspaces.get_workspace_document, generating raw file download url")
            # generate persinged url for raw file
            raw_file_name = document_item["DocumentDetails"]["FileName"]
            raw_file_s3_output_file_key = raw_file_name.split("/")[-1]
            raw_file_presigned_url = commonUtil.get_presigned_url_get_object(S3_CLIENT, DLZ_BUCKET_NAME, raw_file_name, raw_file_s3_output_file_key)
            document_item["RawFileDownloadURL"] = raw_file_presigned_url
        except Exception as err:
            LOGGER.error("In workspaces.get_workspace_document, failed to generate pre-signed url with error: %s", str(err))
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = str(err)
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    return commonUtil.build_get_response(200, document_item)

def delete_workspace_document(document_id: str, workspace_id: str, user_id: str) -> dict:
    """This method will return a list of datasets that the user has owner permission in Amorphic

    Args:
        document_id (str): Document ID
        workspace_id (str): The id of the workspace
        user_id (str): User Id to get datasets for

    Returns:
        dict: Dict containing list of datasets
    """
    LOGGER.info("In workspaces.delete_workspace_document, user has requested to delete document id: %s from workspace with id: %s", document_id, workspace_id)
    auth_token, role_id = commonUtil.get_user_auth_resources(user_id, USERS_TABLE)
    document_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE),
        {'DocumentId': document_id, 'WorkspaceId': workspace_id}
    )
    # Check if the document deletion is already in progress
    if document_item['Message'] == 'Document deletion triggered':
        LOGGER.error("In workspaces.delete_workspace_document, document deletion has already been triggered for the given document")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Document deletion is already in progress"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    dataset_id = document_item['DocumentDetails'].get('DatasetId')
    file_name = document_item['DocumentDetails'].get('FileName')
    # trigger file deletion only if dataset_id and file_name are present. these won't be present for empty web crawls
    if dataset_id and file_name:
        delete_message = "Document deletion triggered"
        delete_file_body = {
            'Files': [file_name],
            'Operation': 'permanent_delete',
            'TruncateDataset': False
        }
        # Get user datasets from amorphic by invoking lambda
        try:
            invoke_payload = {
                "headers": {
                    "Authorization": auth_token,
                    "user_id": user_id,
                    "role_id": role_id
                },
                "pathParameters": {'id': dataset_id},
                "requestContext": {
                    "requestId": "N/A",
                    "httpMethod": "PUT"
                },
                "body": json.dumps(delete_file_body),
                "queryStringParameters": {},
                "user_id": user_id,
                "resource": "/datasets/{id}/files",
                "httpMethod": "PUT",
            }
            LOGGER.info("In workspaces.delete_workspace_document, invoking %s lambda with payload: %s", DATASET_FILES_LAMBDA, invoke_payload)
            response = commonUtil.invoke_lambda_function(
                lambda_client=LAMBDA_CLIENT,
                function_name=DATASET_FILES_LAMBDA,
                payload=json.dumps(invoke_payload),
                invocation_type='RequestResponse'
            )
            LOGGER.info("In workspaces.delete_workspace_document, lambda: %s invoke response: %s", DATASET_OPERATIONS_LAMBDA, response)
            if response["ResponseMetadata"]["HTTPStatusCode"] != 200:
                LOGGER.error("In workspaces.lambda_handler, error: %s", response['Payload'].read().decode())
                ec_ge_1034 = errorUtil.get_error_object("GE-1034")
                ec_ge_1034["Message"] = f"Error- {response['Payload'].read().decode()}"
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
            file_delete_body = json.loads(json.loads(response['Payload'].read().decode('utf-8'))["body"])
            delete_message = file_delete_body["Message"]
            LOGGER.info("In workspaces.delete_workspace_document, message recieved from file deletion operation - %s", delete_message)
            # Update deletion message for the document
            update_expression = "SET Message = :msg, LastModifiedTime = :lmt, LastModifiedBy = :lmb"
            expression_attribute_values = {
                ':msg': "Document deletion triggered",
                ':lmt': commonUtil.get_current_time(),
                ':lmb': user_id
            }
            key = {'WorkspaceId': workspace_id, 'DocumentId': document_id}
            status = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), key, update_expression, expression_attribute_values)
            if status == "error":
                LOGGER.error("In workspaces.delete_workspace_document, failed to update document item in dynamodb")
                ec_ge_1020 = errorUtil.get_error_object("GE-1020")
                ec_ge_1020['Message'] = ec_ge_1020['Message'].format("WORKSPACES DOCUMENTS")
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
        except Exception as ex:
            LOGGER.error("In workspaces.delete_workspace_document, file deletion failed with the error: %s", str(ex))
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = str(ex)
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    else:
        LOGGER.info("In workspaces.delete_workspace_document, deleting documents with no corresponding file")
        delete_message = "Document deleted successfully"
        response = dynamodbUtil.delete_item_by_key(
            DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE),
            {'DocumentId': document_id, 'WorkspaceId': workspace_id}
        )
        if response != "success":
            ec_ge_1020 = errorUtil.get_error_object("GE-1020")
            ec_ge_1020['Message'] = ec_ge_1020['Message'].format("WorkspaceDocuments")
            raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    return commonUtil.build_delete_response(200, {"Message": delete_message})


def delete_workspace(workspace_item: dict, user_id: str) -> dict:
    """This method deletes the workspace, workspace documents and executions metadata from AI, dataset remains available in amorphic

    Args:
        workspace_item (dict): Workspace DDB item
        user_id (str): User Id

    Returns:
        dict: Message containing deletion status
    """
    LOGGER.info("In workspaces.delete_workspace, stating method")
    workspace_id = workspace_item["WorkspaceId"]
    LOGGER.info("In workspaces.delete_workspace, user %s is requested to delete workspace : %s", user_id, workspace_id)

    # steps to cleanup workspace
    # 0. check if there are any dependent chatbots
    # 1. Check if there are any dependent agents
    # 2. cleanup execution table if all are completed or failed
    # 3. cleanup documents table
    # 4. delete dependent schedule if exists
    # 5. delete knowledge base and linked iam role (newer workspaces)
    # 6. delete workspaces metadata from workspaces table
    # 7, 8. delete workspace id from WorkspacesGroups table and GroupsTable
    # 9. Cleanup of run payloads and website content stored in the AI data bucket
    # 10. delete aurora table

    ### 0. check if there are any dependent chatbots
    LOGGER.info("In workspaces.delete_workspace, checking for any chatbots dependent on the workspace - %s", workspace_id)
    chatbots_items = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE),
        Attr("Workspace").eq(workspace_id)
    )
    if chatbots_items:
        chatbots_list = [chatbot["ChatbotName"] for chatbot in chatbots_items]
        LOGGER.error("In workspaces.delete_workspace, can't delete workspace because the following chatbots are dependent : %s", chatbots_list)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Failed to delete. There are {len(chatbots_list)} dependent chabot(s) on this workspace"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    ### 1. Check if there are any dependent agents
    LOGGER.info("In workspaces.delete_workspace, checking for any agents dependent on the workspace - %s", workspace_id)
    agents_items = dynamodbUtil.scan_with_pagination(
        DYNAMODB_RESOURCE.Table(AGENTS_TABLE),
    )
    agents_items_using_workspace = []
    for agent in agents_items:
        agent_workspaces = agent.get('AttachedWorkspaces', [])
        for workspace in agent_workspaces:
            if workspace['WorkspaceId'] == workspace_id:
                agents_items_using_workspace.append(agent)
                break
    if agents_items_using_workspace:
        agents_list = [f"'{agent['AgentName']}'" for agent in agents_items_using_workspace]
        LOGGER.error("In workspaces.delete_workspace, can't delete workspace because the following agents are dependent : %s", agents_list)
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Failed to delete. There are dependent agents({','.join(agents_list)}) on this workspace"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    ### 2. clean up workspaces execution table
    LOGGER.info("In workspaces.delete_workspace, deleting execution entries from workspaces execution table for workspace id: %s", workspace_id)
    execution_items_list = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE),
        dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE_WORKSPACEID_INDEX,
        Key('WorkspaceId').eq(workspace_id),
        "RunId, WorkspaceId, RunStatus", None
    )
    for exec_item in execution_items_list:
        if exec_item["RunStatus"].lower() == commonUtil.RUN_STATUS_IN_PROGRESS:
            LOGGER.error("In workspaces.delete_workspace, cant delete workspace because there's a started/running execution for this workspace id: %s", workspace_id)
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Failed to delete. There's a running job with id: {exec_item['RunId']}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    LOGGER.info("In workspaces.delete_workspace, deleting %s executions entries from workspaces executions table", len(execution_items_list))
    executions_keys_list = [{"RunId": exec_item["RunId"] } for exec_item in execution_items_list]
    dynamodbUtil.batch_delete_items(DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE), executions_keys_list)
    LOGGER.info("In workspaces.delete_workspace, workspace executions table cleanup completed")

    ### 3. clean up workspaces documents table
    LOGGER.info("In workspaces.delete_workspace, checking document entries from workspaces documents table for workspace id: %s", workspace_id)
    document_items_list = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE),
        dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX,
        Key('WorkspaceId').eq(workspace_id),
        None, None
    )
    LOGGER.info("In workspaces.delete_workspace, deleting %s documents entries from workspaces documents table", len(document_items_list))
    document_keys_list = [{"DocumentId": document_item["DocumentId"], "WorkspaceId": document_item["WorkspaceId"]} for document_item in document_items_list]
    dynamodbUtil.batch_delete_items(DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE), document_keys_list)
    LOGGER.info("In workspaces.delete_workspace, workspace documents table cleanup completed")

    ### 4. delete event schedule for a workspace if exist
    if workspace_item.get("EventRuleName"):
        LOGGER.info("In workspaces.delete_workspace, event rule with name: %s exist for workspace id: %s. Deleting event rule...", workspace_item["EventRuleName"], workspace_id)
        response = EVENT_CLIENT.list_targets_by_rule(Rule=workspace_item["EventRuleName"])
        targets = response['Targets']
        # Loop through the targets and remove each one
        for target in targets:
            target_id = target['Id']
            EVENT_CLIENT.remove_targets(Rule=workspace_item["EventRuleName"], Ids=[target_id])
        response = EVENT_CLIENT.delete_rule(Name=workspace_item["EventRuleName"])
        LOGGER.info("In workspaces.delete_workspace, delete event response: %s", response)

    ### 5. For newer workspaces, delete the linked data source and the knowledge base and the role linked to the knowledge base.
    # Added in the try catch block to avoid failures while deleting older workspaces. Needs to be updated in the future
    try:
        knowledge_base_id = workspace_item['KnowledgeBaseId']
        BEDROCK_AGENT_CLIENT.delete_knowledge_base(
            knowledgeBaseId=knowledge_base_id
        )
        LOGGER.info("In workspaces.delete_workspace, successfully deleted the knowledge base")
        iamUtil.delete_iam_role_with_custom_inline_policy(workspace_item['KnowledgeBaseRoleName'])
        LOGGER.info("In workspaces.delete_workspace, successfully deleted the knowledge base role")
    except Exception as ex:
        LOGGER.error("In workspaces.delete_workspace, failed to delete the knowledge base due to error: %s", str(ex))

    ### 6. clean up workspace entry from workspaces table
    LOGGER.info("In workspaces.delete_workspace, deleting workspace with id: %s from workspaces table", workspace_id)
    response = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_TABLE),
        {'WorkspaceId': workspace_id}
    )
    if response != "success":
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("Workspace")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    LOGGER.info("In workspaces.delete_workspace, Workspaces table cleanup completed")

    ### 7. clean up group entries from WorkspacesGroups table
    LOGGER.info("In workspaces.delete_workspace, cleaning up all WorkspaceGroups table")
    groups_workspaces_items = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(WORKSPACES_GROUPS_TABLE),
        WORKSPACES_GROUPS_TABLE_WORKSPACEID_INDEX,
        Key('WorkspaceId').eq(workspace_id),
        None, None
    )
    groups_workspaces_keys_list = [{"GroupId": item["GroupId"], "WorkspaceId": item["WorkspaceId"]} for item in groups_workspaces_items]
    dynamodbUtil.batch_delete_items(DYNAMODB_RESOURCE.Table(WORKSPACES_GROUPS_TABLE), groups_workspaces_keys_list)
    LOGGER.info("In workspaces.delete_workspace, WorkspaceGroups table cleanup completed")

    ### 8. delete workspace id from WorkspaceIdList in the Groups table
    LOGGER.info("In workspaces.delete_workspace, cleaning up WorkspaceId: %s from groups table from the users who have access", workspace_id)
    # get groups ids from workspaces groups table
    workspaces_groups_ids_key_list = [{"GroupId": item["GroupId"]} for item in groups_workspaces_items]
    group_items = dynamodbUtil.batch_get_items(DYNAMODB_RESOURCE, GROUPS_TABLE, workspaces_groups_ids_key_list)
    for group_item in group_items:
        if workspace_id in group_item["WorkspaceIdList"]:
            group_item["WorkspaceIdList"].remove(workspace_id)
        # if user only has one workspace, WorkspaceIdList will be empty, so need to remove that attribute to batch_write_items
        if not group_item["WorkspaceIdList"]:
            group_item.pop("WorkspaceIdList", None)
    dynamodbUtil.batch_write_items(DYNAMODB_RESOURCE.Table(GROUPS_TABLE), group_items)
    LOGGER.info("In workspaces.delete_workspace, Groups table cleanup completed")

    #### 9. Starting cleanup of run payloads and website content stored in the AI data bucket
    LOGGER.info("In workspaces.delete_workspace, cleaning up all run payloads from s3 %s", workspace_id)
    workspaces_payloads_s3_prefix = f"workspaces/{workspace_id}"
    response = commonUtil.delete_s3_path(AI_DATA_BUCKET, [workspaces_payloads_s3_prefix], S3_CLIENT)
    if response != "success":
        LOGGER.error("In workspaces.delete_workspace, error while deleting run payloads from s3: %s", response)

    #### 10. Delete the table from aurora
    auroraUtil.delete_workspace_table(workspace_id, RAG_SERVICE_USER_SECRET_ARN, SECRETS_MANAGER_CLIENT)

    LOGGER.info("In workspaces.delete_workspace, Workspace deletion completed successfully.")
    return {
        "Message": "Deletion completed successfully"
    }

def upload_file_to_source_dataset(workspace_item: dict, event_body: dict, user_id: str) -> dict:
    """This function will call amorphic file upload api to retrieve the presigned url for uploading file to specified source dataset

    Args:
        workspace_item (dict): Workspace DDB item
        event_body (dict): input event body
        user_id (str): User uploading the file

    Returns:
        dict: Dictionary containing the Presigned URL for uploading the file
    """
    workspace_id = workspace_item["WorkspaceId"]
    LOGGER.info("In workspaces.upload_file_to_source_dataset, starting method with workspace id %s and event_body %s", workspace_id, event_body)

    if not event_body:
        LOGGER.error("In workspaces.upload_file_to_source_dataset, Event body received is empty")
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("Event body")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
    if not event_body.get("FileName") or not event_body.get("SourceDatasetId"):
        LOGGER.error("In workspaces.upload_file_to_source_dataset, 'FileName' or 'SourceDatasetId' is missing from event body")
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format("FileName/SourceDatasetId")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
    if not any(dataset["DatasetId"] == event_body["SourceDatasetId"] for dataset in workspace_item.get("AttachedDatasets", [])):
        LOGGER.error("In workspaces.upload_file_to_source_dataset, Specified 'SourceDatasetId' is either invalid or not yet linked to the workspace")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Dataset specified in the request is not linked to the workspace"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    # validate connection to amorphic and decide which PAT token to use
    # case 1) if user's pat token is expired, we use owner's pat token to connect to amorphic, else use his own pat token
    # case 2) if user don't have write access to amorphic dataset, then we use owner's pat token to connect to amorphic
    try:
        is_token_expired = False
        auth_token, role_id = commonUtil.get_user_auth_resources(user_id, USERS_TABLE)
        LOGGER.info("In workspaces.upload_file_to_source_dataset, user: %s's PAT is valid", user_id)
    except Exception as err:
        # this error code is coming from get_user_auth_resources(), don't change error message in get_user_auth_resources()
        if "Invalid access token, Token expired" in str(err):
            LOGGER.error("In workspaces.upload_file_to_source_dataset, user %s's PAT is expired.", user_id)
            is_token_expired = True
        else:
            LOGGER.error("In workspaces.upload_file_to_source_dataset, exception occurred: %s", err)
            raise Exception(err) from err

    # check if user have dataset write access
    user_have_dataset_write_access = False
    if not is_token_expired:
        for dataset_item in get_amorphic_datasets(user_id)["Datasets"]:
            if dataset_item["DatasetId"] == event_body["SourceDatasetId"] and dataset_item["AccessType"].lower() == "owner":
                user_have_dataset_write_access = True
                break
        LOGGER.info("In workspaces.upload_file_to_source_dataset, status of user %s have write access on dataset is: %s", user_id, user_have_dataset_write_access)

    # if user's token is expired/don't have write access, allow them to upload file using creator's token
    if is_token_expired or not user_have_dataset_write_access:
        LOGGER.info("In workspaces.upload_file_to_source_dataset, user %s's PAT token is expired/user dont have dataset write access in amorphic. Using owner's PAT token & RoleId to connect to Amorphic", user_id)
        # check if owner has connected to amorphic
        owner_integration_status = commonUtil.validate_amorphic_integration_status(workspace_item["CreatedBy"], "integration-status")
        if owner_integration_status != "connected":
            LOGGER.info("In workspaces.upload_file_to_source_dataset, owner %s is not connected to amorphic", workspace_item["CreatedBy"])
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"owner {workspace_item['CreatedBy']} is not connected to Amorphic. File upload is not allowed."
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        auth_token, role_id = commonUtil.get_user_auth_resources(workspace_item["CreatedBy"], USERS_TABLE)
        user_id = workspace_item["CreatedBy"]

    # upload file to raw dataset by calling invoking amorphic lambda
    file_name = event_body["FileName"]
    try:
        invoke_payload = {
            "headers": {
                "Authorization": auth_token,
                "user_id": user_id,
                "role_id": role_id
            },
            "pathParameters": {},
            "requestContext": {
                "httpMethod": "POST",
                "resourcePath": "/datasets/file"
            },
            "queryStringParameters": {},
            "user_id": user_id,
            "resource": "/datasets/file",
            "httpMethod": "POST",
            "body": json.dumps({
                "FileName": file_name,
                "DatasetId": event_body["SourceDatasetId"]
            })
        }
        LOGGER.info("In workspaces.upload_file_to_source_dataset, invoking %s lambda with payload: %s", GET_PRESIGNED_URL_LAMBDA, invoke_payload)
        lambda_invoke_response = commonUtil.invoke_lambda_function(
            lambda_client=LAMBDA_CLIENT,
            function_name=GET_PRESIGNED_URL_LAMBDA,
            payload=json.dumps(invoke_payload),
            invocation_type='RequestResponse'
        )
        LOGGER.info("In workspaces.upload_file_to_source_dataset, %s lambda invoke response: %s", GET_PRESIGNED_URL_LAMBDA, lambda_invoke_response)
        if lambda_invoke_response["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In workspaces.upload_file_to_source_dataset, error: %s", lambda_invoke_response['Payload'].read().decode('utf-8'))
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Error- {lambda_invoke_response['Payload'].read().decode()}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        lambda_invoke_response_payload = ast.literal_eval(lambda_invoke_response['Payload'].read().decode())
        lambda_response_body = ast.literal_eval(lambda_invoke_response_payload['body'])

        if lambda_invoke_response_payload['statusCode'] != 200:
            LOGGER.error("In workspaces.upload_file_to_source_dataset, Error: %s", str(lambda_response_body))
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"{lambda_response_body['Message']}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

        # add metadata to workspaces files table about file upload
        LOGGER.info("In workspaces.upload_file_to_source_dataset, adding metadata to workspaces files table about file upload")
        # construct filename: domain-name/dataset-name/upload_date=epoch_time/<userid>_<dataset-id>_<epoch_time>_<file-name>
        # from decoded url 2 formats - 1> "https://s3.eu-west-1.amazonaws.com/<LZ_Bucket_Name>/<domain_name>/<dataset_name>/upload_date%3D1691132804/<user_id>/others/file2.pdf?AWSAccessKeyId=AAC....."
        # 2> https://<lz_bucket_name>.s3.us-west-2.amazonaws.com/<domain_name>/<dataset_name>/upload_date%1700545003/<user_id>/others/file.txt?X-Amz-Algorithm=AWS4-HMAC-SHA256&...."
        s3_object_url = unquote(lambda_response_body["Message"]).split('?')[0].split("/")
        domain_name = s3_object_url[-6]
        dataset_name = s3_object_url[-5]
        epoch_w_time = s3_object_url[-4]
        dataset_id = event_body["SourceDatasetId"]
        uploaded_file_name = s3_object_url[-1]
        file_name = f"{domain_name}/{dataset_name}/{epoch_w_time}/{user_id}_{dataset_id}_{epoch_w_time.split('=')[1]}_{uploaded_file_name}"
        db_file_item = {
            "DocumentId": str(uuid.uuid4()),
            "DocumentDetails": {
                "FileName": file_name,
                "DatasetId": dataset_id
            },
            "DocumentType": "file",
            "WorkspaceId": workspace_item["WorkspaceId"],
            "LastModifiedBy": user_id,
            "LastModifiedTime": commonUtil.get_current_time(),
            "Message": "File upload is pending",
        }
        put_response = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), db_file_item)
        if put_response == "error":
            LOGGER.error("In workspaces.upload_file_to_source_dataset, failed to create an entry in DynamoDB, admin must cleanup this inconsistency.")
            ec_db_1001 = errorUtil.get_error_object("DB-1001")
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)

        LOGGER.info("In workspaces.upload_file_to_source_dataset, returning file upload pre-signed url")
        return {
            "PresignedURL": lambda_response_body["Message"]
        }

    except Exception as ex:
        LOGGER.error("In workspaces.upload_file_to_source_dataset, uploading file to amorphic datasets failed with error: %s", str(ex))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = str(ex)
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

def list_workspace_web_crawling_jobs(workspace_id: str, **kwargs) -> dict:
    """This function will return list of file items for a given workspace

    Args:
        workspace_id (str): Workspace ID
        document_type (str): file/website

    Returns:
        dict: Dictionary containing the web crawling jobs list along with the pagination parameters
    """
    LOGGER.info("In workspaces.list_workspace_web_crawling_jobs, retreiving web crawling jobs for workspace with id: %s", workspace_id)
    projection_expression = 'DocumentId,DocumentDetails,LastModifiedBy,LastModifiedTime,CrawlStatus'
    filter_expression = Attr('DocumentType').eq('WebCrawling')
    workspace_web_crawling_jobs_list = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE),
        WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX,
        Key('WorkspaceId').eq(workspace_id),
        projection_expression, filter_expression
    )
    # Renaming the attributes to cater to the specific response
    for job in workspace_web_crawling_jobs_list:
        job['CrawlId'] = job['DocumentId']
        job['WebsiteURL'] = job['DocumentDetails']['WebsiteURL']
        job['CrawlCount'] = len(job['DocumentDetails'].get('NestedURLs', []))
        job['IndexedCount'] = len([website for website in job['DocumentDetails'].get('NestedURLs', []) if website['Indexed']]) if job['CrawlStatus'] == commonUtil.RUN_STATUS_COMPLETE else 0
        job.pop('DocumentId', None)
        job.pop('DocumentDetails', None)
    # Sort & paginate results if applicable
    LOGGER.info("In workspaces.list_workspace_web_crawling_jobs, Sorting & Paginating the results based on the input given")
    kwargs['dict_key'] = 'WebCrawlings'
    kwargs['input_items'] = {'WebCrawlings': workspace_web_crawling_jobs_list}
    web_crawling_jobs = commonUtil.sort_page_in_code(**kwargs)

    LOGGER.info("In workspaces.list_workspace_web_crawling_jobs, exiting method")
    return web_crawling_jobs

def trigger_website_content_upload_sf(websites: list[str], workspace_id: str, user_id: str, domain_name: str, dataset_name: str, web_crawl_id: str = None) -> None:
    """Invoke step function for storing contents from websites to workspace dataset

    Args:
        websites (list[str]): List of websites to scrape from
        workspace_id (str): Id of the workspace
        user_id (str): Id of the user
        domain_name (str): Domain name of the workspace dataset
        dataset_name (str): Dataset name
        crawl_id (str): Id of crawl job if added from crawl job | Defaults to None
    """
    LOGGER.info("In workspaces.trigger_website_content_upload_sf, triggering step function for storing contents from websites to workspace dataset")
    try:
        sf_payload = {
            "Operation": "crawl_and_store_web_content",
            "UserId": user_id,
            "WorkspaceId": workspace_id,
            "Domain": domain_name,
            "DatasetName": dataset_name,
            "Websites": websites,
            "WebCrawlId": web_crawl_id
        }
        sm_resp = STEP_FUNCTION_CLIENT.start_execution(
            stateMachineArn=WEB_CONTENT_SCRAPING_SM_ARN,
            input=json.dumps(sf_payload),
            name=str(uuid.uuid4())
        )
        LOGGER.info("In workspaces.trigger_website_content_upload_sf, step function invoke response - %s", str(sm_resp))
        if sm_resp["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In workspaces.trigger_website_content_upload_sf, error: %s", sm_resp['Payload'].read().decode())
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"Source dataset metadata sync failed - {sm_resp['Payload'].read().decode()}"
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
    except Exception as err:
        LOGGER.error("In workspaces.trigger_website_content_upload_sf, failed to invoke lambda with error: %s", str(err))
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Failed to add websites due to the error - {str(err)}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

def delete_web_crawling_job(workspace_id: str, web_crawl_id: str) -> dict:
    """Delete a web crawling job from workspace

    Args:
        workspace_id (str): Workspace ID
        website_id (str): Website ID
    """
    LOGGER.info("In workspaces.delete_web_crawling_job, deleting web crawling with id: %s linked to workspace with id: %s", web_crawl_id, workspace_id)
    response = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE),
        {'DocumentId': web_crawl_id, 'WorkspaceId': workspace_id}
    )
    if response != "success":
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("WorkspaceDocuments")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)
    LOGGER.info("In workspaces.delete_web_crawling_job, Workspaces table cleanup completed")
    return commonUtil.build_delete_response(200, {'Message': 'Successfully deleted the web crawling job'})

def add_document_to_workspace(workspace_item: dict, event_body: dict, user_id: str) -> dict:
    """Add document to workspace documents table

    Args:
        workspace_item (dict): Workspace details object
        event_body (dict): Input event body
        user_id (str): Id of the user adding the document
    """
    LOGGER.info("In workspaces.add_document_to_workspace, starting method. User %s has requested to add document to the workspace - %s with configuration: %s", user_id, workspace_item['WorkspaceId'], event_body)

    required_keys = {"DocumentType", "DocumentDetails"}
    # validations for required keys, trigger types, features
    if not all(key in event_body for key in required_keys):
        LOGGER.error("In workspaces.add_document_to_workspace, Invalid input request body, missing required keys: %s", required_keys - set(event_body.keys()))
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format(required_keys - set(event_body.keys()))
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)
    if event_body["DocumentType"] not in ALLOWED_DOCUMENT_TYPES:
        LOGGER.error("In workspaces.add_document_to_workspace, Invalid DocumentType: %s", event_body["DocumentType"])
        errorUtil.raise_exception(EVENT_INFO, "II", "IPV-1041", None, "DocumentType", ALLOWED_DOCUMENT_TYPES)
    document_type = event_body["DocumentType"]
    if not all(key in event_body['DocumentDetails'] for key in DOCUMENT_REQUIRED_KEYS[document_type]):
        LOGGER.error("In workspaces.add_document_to_workspace, Invalid input request body, missing required keys: %s", set(DOCUMENT_REQUIRED_KEYS[document_type]) - set(event_body['DocumentDetails'].keys()))
        ec_ipv_1008 = errorUtil.get_error_object("IPV-1008")
        ec_ipv_1008['Message'] = ec_ipv_1008['Message'].format(set(DOCUMENT_REQUIRED_KEYS[document_type]) - set(event_body['DocumentDetails'].keys()))
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1008)

    if document_type == FILE_DOCUMENT_TYPE:
        document_item = {
            "DocumentId": str(uuid.uuid4()),
            "WorkspaceId": workspace_item['WorkspaceId'],
            "DocumentType": document_type,
            "LastModifiedBy": user_id,
            "LastModifiedTime": commonUtil.get_current_time(),
            "DocumentDetails": {}
        }
        for key in DOCUMENT_REQUIRED_KEYS[document_type]:
            document_item['DocumentDetails'].update({
                key: event_body['DocumentDetails'][key]
            })

        put_status = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), document_item)
        if put_status == "error":
            LOGGER.error("In workspaces.add_document_to_workspace, failed to create document item in dynamodb, please check for errors.")
            ec_db_1001 = errorUtil.get_error_object("DB-1001")
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_db_1001)

        message = {
            "Message": "Added document to workspace successfully",
            "DocumentId": document_item["DocumentId"]
        }

    elif document_type == WEBSITE_DOCUMENT_TYPE:
        domain = workspace_item['AttachedDatasets'][0]['Domain']
        dataset_name = workspace_item['AttachedDatasets'][0]['DatasetName']
        trigger_website_content_upload_sf(event_body['DocumentDetails']['WebsiteURLs'], workspace_item['WorkspaceId'], user_id, domain, dataset_name, event_body['DocumentDetails'].get('CrawlId', None))
        message = {
            "Message": "Triggered addition of website(s) to the workspace"
        }

    return message


def list_workspace_documents(workspace_id: str, document_type: str, **kwargs) -> dict:
    """This function will return list of file items for a given workspace

    Args:
        workspace_id (str): Workspace ID
        document_type (str): file/website

    Returns:
        dict: Dictionary containing the documents list along with the pagination parameters
    """
    LOGGER.info("In workspaces.list_workspace_documents, retreiving documents for workspace with id: %s", workspace_id)
    filter_expression = None
    if document_type:
        filter_expression = Attr('DocumentType').eq(document_type)
    workspace_documents_list = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE),
        WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX,
        Key('WorkspaceId').eq(workspace_id),
        None,
        filter_expression
    )
    # Sort & paginate results if applicable
    LOGGER.info("In workspaces.list_workspace_documents, Sorting & Paginating the results based on the input given")
    kwargs['dict_key'] = 'Documents'
    kwargs['input_items'] = {'Documents': workspace_documents_list}
    documents = commonUtil.sort_page_in_code(**kwargs)

    LOGGER.info("In workspaces.list_workspace_documents, exiting method")
    return documents


def initiate_workspace_run(workspace_item: dict, user_id: str, workspaces_lambda_arn: str) -> dict:
    """This function will initiate workspace run

    Args:
        workspace_item (dict): Workspace DDB item
        user_id (str): User ID of the user triggering the run
        workspaces_lambda_arn (str): Workspace Lambda ARN

    Returns:
        dict: Run Id and the Message
    """
    LOGGER.info("In workspaces.initiate_workspace_run, running workspace with id: %s", workspace_item["WorkspaceId"])
    workspace_id = workspace_item["WorkspaceId"]

    if workspace_item["SourceFileSyncStatus"] != commonUtil.FILE_SYNC_STATUS_COMPLETED:
        LOGGER.error("In workspaces.initiate_workspace_run, Cannot start run because source file sync is not completed")
        errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", "Cannot start run because source file sync is not completed")

    knowledge_base_id = workspace_item['KnowledgeBaseId']
    data_source_id = workspace_item['DataSourceId']
    response = run_workspace(user_id, workspace_id, knowledge_base_id, data_source_id, workspaces_lambda_arn)
    return response

def get_workspace_stats(workspace_item: dict) -> dict:
    """This method returns latest ingestion job statistics for workspaces

    Args:
        workspace_item (dict): Workspace ddb item

    Returns:
        dict: Dictionary containing statistics of workspace runs
    """
    LOGGER.info("In workspaces.get_workspace_stats, starting method with workspace_id: %s", workspace_item['WorkspaceId'])
    workspace_id = workspace_item['WorkspaceId']
    projection_exp = "RunId, LastModifiedTime"
    workspace_runs_items = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE),
        WORKSPACES_EXECUTIONS_TABLE_WORKSPACEID_INDEX,
        Key('WorkspaceId').eq(workspace_id),
        projection_exp,
        None
    )
    ingestion_job_statistics = {}
    if workspace_runs_items:
        latest_run = max(workspace_runs_items, key=lambda x: x['LastModifiedTime'])
        ingestion_job_statistics = BEDROCK_AGENT_CLIENT.get_ingestion_job(
            knowledgeBaseId=workspace_item['KnowledgeBaseId'],
            dataSourceId=workspace_item['DataSourceId'],
            ingestionJobId=latest_run['RunId']
        )['ingestionJob'].get('statistics', {})

    latest_run_info = {
        'DocumentsScanned': ingestion_job_statistics.get('numberOfDocumentsScanned', 0),
        'NewDocumentsIndexed': ingestion_job_statistics.get('numberOfNewDocumentsIndexed', 0),
        'ModifiedDocumentsIndexed': ingestion_job_statistics.get('numberOfModifiedDocumentsIndexed', 0),
        'DocumentsDeleted': ingestion_job_statistics.get('numberOfDocumentsDeleted', 0),
        'DocumentsFailed': ingestion_job_statistics.get('numberOfDocumentsFailed', 0)
    }
    LOGGER.info("In workspaces.get_workspace_stats, exiting method")
    return {"LatestRunInfo": latest_run_info}

def list_workspace_runs(workspace_id: str, **kwargs) -> dict:
    """
    This method will return list of all workspace job run
    """
    LOGGER.info("In workspaces.list_workspace_runs, checking for all workspace job run for workspace id: %s", workspace_id)

    projection_exp = "RunId, StartTime, EndTime, TriggerType, RunStatus, LastModifiedTime, TriggeredBy, Message"
    workspace_runs_items = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE),
        dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE_WORKSPACEID_INDEX,
        Key('WorkspaceId').eq(workspace_id),
        projection_exp,
        None
    )
    # Sort & paginate results if applicable
    LOGGER.info("In workspaces.list_workspace_runs, Sorting & Paginating the results based on the input given")
    kwargs['dict_key'] = 'Runs'
    kwargs['input_items'] = {'Runs': workspace_runs_items}
    job_runs = commonUtil.sort_page_in_code(**kwargs)

    LOGGER.info("In workspaces.list_workspace_runs, exiting method")
    return job_runs


def get_workspace_run(workspace_id: str, run_id: str) -> dict:
    """
    This method will return the detatils of a single workspace run
    """
    LOGGER.info("In workspaces.get_workspace_run, checking the workspace run for workspace id: %s with run id: %s", workspace_id, run_id)
    projection_expression = "RunId, StartTime, EndTime, TriggerType, RunStatus, LastModifiedTime, Message, TriggeredBy"
    workspace_run_item = dynamodbUtil.get_item_by_key_with_projection(
        DYNAMODB_RESOURCE.Table(WORKSPACES_EXECUTIONS_TABLE),
        {'RunId': run_id},
        projection_expression
    )
    return workspace_run_item

def sync_amorphic_dataset_files(attached_datasets: list[dict], workspace_id: str, user_id: str, workspaces_lambda_arn: str) -> None:
    """This function will sync amorphic dataset files to workspace documents tables

    Args:
        attached_datasets (list[dict]): List of datasets attached to the workspace
        workspace_id (str): Workspace ID to sync
        user_id (str): User ID of the user who created the workspace
        workspaces_lambda_arn (str): Workspaces Lambda arn
    """
    LOGGER.info("In workspaces.sync_amorphic_dataset_files, syncing files from source datasets: %s to workspace id: %s", attached_datasets, workspace_id)
    commonUtil.is_valid_user(user_id)

    workspace_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE),
        {"WorkspaceId": workspace_id}
    )

    # check user access on amorphic dataset for resync else fallback to creators PAT token to connect to amorphic
    # validate user's PAT token
    try:
        is_token_expired = False
        commonUtil.get_user_auth_resources(user_id, USERS_TABLE)
        LOGGER.info("In workspaces.sync_amorphic_dataset_files, user: %s's PAT is valid", user_id)
    except Exception as err:
        if "Invalid access token, Token expired" in str(err):
            LOGGER.error("In workspaces.sync_amorphic_dataset_files, user %s's PAT has expired.", user_id)
            is_token_expired = True
        else:
            LOGGER.error("In workspaces.sync_amorphic_dataset_files, exception occurred: %s", err)
            raise Exception(err) from err

    # check if user has access on source datasets
    user_has_datasets_access = False
    source_dataset_ids = [dataset['DatasetId'] for dataset in attached_datasets]
    if not is_token_expired:
        amorphic_dataset_ids = [dataset_item['DatasetId'] for dataset_item in get_amorphic_datasets(user_id)["Datasets"]]
        if set(source_dataset_ids).issubset(set(amorphic_dataset_ids)):
            user_has_datasets_access = True
        LOGGER.info("In workspaces.sync_amorphic_dataset_files, status of user %s having access on dataset is: %s", user_id, user_has_datasets_access)

    # if user's token is expired/don't have access, use creators PAT token to connect to amorphic
    use_creators_pat = False
    if is_token_expired or not user_has_datasets_access:
        LOGGER.info("In workspaces.sync_amorphic_dataset_files, user %s's PAT token is expired/user dont have dataset write access in amorphic. Using owner's PAT token & RoleId to connect to Amorphic", user_id)
        # check if owner has connected to amorphic
        owner_integration_status = commonUtil.validate_amorphic_integration_status(workspace_item["CreatedBy"], "integration-status")
        if owner_integration_status != "connected":
            LOGGER.info("In workspaces.sync_amorphic_dataset_files, owner %s is not connected to amorphic", workspace_item["CreatedBy"])
            ec_ge_1034 = errorUtil.get_error_object("GE-1034")
            ec_ge_1034["Message"] = f"owner {workspace_item['CreatedBy']} is not connected to Amorphic. Can't do source file sync."
            raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)
        commonUtil.get_user_auth_resources(workspace_item["CreatedBy"], USERS_TABLE)
        use_creators_pat = True

    dataset_files = []
    # get amorphic dataset files
    for dataset_id in source_dataset_ids:
        dataset_files.extend(commonUtil.get_amorphic_datasets_files(dataset_id, workspace_item["CreatedBy"] if use_creators_pat else user_id, LAMBDA_CLIENT, DATASET_FILES_LAMBDA))

    # update workspace files table with amorphic dataset files metadata
    workspaces_files = []
    # update workspace files metadata with required details and run status as pending
    if dataset_files:
        for file_item in dataset_files:
            workspace_file_item = {
                "DocumentId": str(uuid.uuid4()),
                "DocumentType": "file",
                "Message": "File metadata successfully synced to workspace",
                "DocumentDetails": {
                    "FileName": file_item["FileName"],
                    "DatasetId": file_item["DatasetId"]
                },
                "WorkspaceId": workspace_id,
                "LastModifiedTime": commonUtil.get_current_time(),
                "LastModifiedBy": user_id
            }
            workspaces_files.append(workspace_file_item)

        LOGGER.info("In workspaces.sync_amorphic_dataset_files, writing metadata into workspace documents table")
        dynamodbUtil.batch_write_items(
            DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE),
            workspaces_files
        )

    dynamo_update_params = {
        "Message": "Source file syncing completed.",
        "SourceFileSyncStatus": commonUtil.FILE_SYNC_STATUS_COMPLETED
    }
    update_workspaces_table(workspace_id, user_id, dynamo_update_params)

    if workspace_item["TriggerType"].lower() == "file-based":
        LOGGER.info("In workspaces.sync_amorphic_dataset_files, trigger type in file-based, proceeding to run workspace")
        run_workspace(user_id, workspace_id, workspace_item['KnowledgeBaseId'], workspace_item['DataSourceId'], workspaces_lambda_arn, trigger_type="file-based")

    LOGGER.info("In workspaces.sync_amorphic_dataset_files, Exiting")


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
    # pylint: disable-msg=too-many-locals
    # pylint: disable-msg=too-many-branches
    try:
        # to remove authorization token while printing logs
        event = commonUtil.RedactAuthTokensClass(event)
        LOGGER.info("In workspaces.lambda_handler, starting method with event: %s, context: %s", event, context)

        api_request_id = event.get("requestContext", {"requestId": "N/A"}).get("requestId", "N/A")
        lambda_request_id = context.aws_request_id
        EVENT_INFO["eventIdentifier"] = lambda_request_id
        LOGGER.info("In workspaces.lambda_handler, API Gateway Request ID: %s Lambda Request ID: %s", api_request_id, lambda_request_id)

        # Scheduled runs
        if event.get("EventType") == "ScheduledEvent":
            try:
                workspace_id = event["WorkspaceId"]
                user_id = event["UserId"]
                workspace_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), {'WorkspaceId': workspace_id})
                user_item = commonUtil.is_valid_user(user_id)
                integration_status = commonUtil.validate_amorphic_integration_status(user_id, "integration-status")
                recipient = user_item['EmailId']
                title = "Scheduled Run Failed"
                event_type = "Scheduled Run"
                resource_type = "Workspace"
                resource_name = workspace_item["WorkspaceName"]
                email_type = "failure"
                email_subject = f"{PROJECT_SHORT_NAME} | {ENVIRONMENT} | {email_type} | Run Failed"
                if integration_status != "connected":
                    LOGGER.info("In workspaces.lambda_handler, user %s is not connected to Amorphic, sending alert")
                    message = f"Scheduled run not triggered because user {user_id} is not connected to Amorphic. Please integrate with Amorphic"
                    body_text = commonUtil.generate_email_body(title, event_type, resource_type, resource_name, workspace_id, message, email_type)
                    response = commonUtil.send_email(recipient, body_text, email_subject, f"{commonUtil.EMAIL_SENDER_NAME} <{SENDER}>", SES_CLIENT)
                    return response
            except Exception as ex:
                LOGGER.error("In workspaces.lambda_handler, exception occurred while validating user: %s", str(ex))
                errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"exception occurred while validating user, error: {ex}")
            LOGGER.info("In workspaces.lambda_handler, run workspace, id: %s ", workspace_id)
            commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "run")
            try:
                response = run_workspace(user_id, workspace_id, workspace_item['KnowledgeBaseId'], workspace_item['DataSourceId'], context.invoked_function_arn, trigger_type="time-based")
                LOGGER.info("In workspaces.lambda_handler, run workspace response: %s ", response)
                if "Run triggered" not in response.get("Message", ""):
                    LOGGER.error("In workspaces.lambda_handler, workspace run failed: %s ", response)
                    message = f"Scheduled run failed with error:{response}"
                    body_text = commonUtil.generate_email_body(title, event_type, resource_type, resource_name, workspace_id, message, email_type)
                    response = commonUtil.send_email(recipient, body_text, email_subject, f"{commonUtil.EMAIL_SENDER_NAME} <{SENDER}>", SES_CLIENT)
            except Exception as ex:
                LOGGER.error("In workspaces.lambda_handler, exception occurred while running workspace: %s", str(ex))

        # Step Function Operations
        elif event.get("Operation", None):
            LOGGER.info('In workspaces.lambda_handler, Input request is from Step Function with event operation - %s', event['Operation'])
            user_id = event.get("UserId", "N/A")
            with LambdaTimer(int((context.get_remaining_time_in_millis() / 1000) - 10), event, context):
                if event["Operation"] == "sync_dataset_files_metadata":
                    LOGGER.info('In workspaces.lambda_handler, Request is to sync dataset files metadata into workspace documents table')
                    sync_amorphic_dataset_files(event["AttachedDatasets"], event["WorkspaceId"], user_id, context.invoked_function_arn)
                    event["Operation"] = "Complete"

                elif event['Operation'] == 'crawl_website':
                    event = webcrawling.process_website(event)
                elif event['Operation'] == 'process_pending_urls':
                    event = webcrawling.crawl_urls(event)
                elif event['Operation'] == 'crawl_and_store_web_content':
                    LOGGER.info("In workspaces.lambda_handler, Request is to crawl website content and store it in dataset")
                    event = webcrawling.store_web_content_in_dataset(event)
                elif event['Operation'] == 'update_crawling_job_metadata':
                    LOGGER.info("In workspaces.lambda_handler, Request is to crawl website content and store it in dataset")
                    webcrawling.update_crawling_job_metadata(event)

                elif event['Operation'] == 'check_ingestion_job_status':
                    LOGGER.info("In workspaces.lambda_handler, Request is to check the status of the ingestion job with id - %s for the workspace with id - %s", event['RunId'], event['WorkspaceId'])
                    event = check_and_update_ingestion_job_status(event)
                return event

        # APIs
        else:
            if event.get("headers") and "Authorization" in event['headers'] and event['headers']["Authorization"]:
                claims = commonUtil.get_claims(str(event['headers']['Authorization']))
                user_id = claims['cognito:username']
            else:
                usr_auth_1019 = errorUtil.get_error_object("AUTH-1019")
                usr_auth_1019['Message'] = usr_auth_1019['Message'].format("exception")
                raise errorUtil.GenericFailureException(EVENT_INFO, usr_auth_1019)
            resource_path = event['requestContext']['resourcePath'].lower()
            http_method = event.get("requestContext", {"httpMethod": "N/A"}).get("httpMethod", "N/A")
            event_body = json.loads(event.get('body')) if event.get('body', None) else '{}'
            query_params = event["queryStringParameters"] if event.get("queryStringParameters", {}) else {}
            LOGGER.info("In workspaces.lambda_handler, resource path: %s, with HTTP method: %s", resource_path, http_method)
            user_item = commonUtil.is_valid_user(user_id)

            if resource_path == '/workspaces':
                # create workspace
                if http_method == "POST":
                    commonUtil.validate_amorphic_integration_status(user_id)
                    commonUtil.is_user_action_valid(user_item, "WorkspaceId", None, WORKSPACES_TABLE, GROUPS_TABLE, "create")
                    message = create_workspace(event_body, user_id)
                    response = commonUtil.build_post_response(200, message)
                # list workspaces
                elif http_method == "GET":
                    commonUtil.is_user_action_valid(user_item, "WorkspaceId", None, WORKSPACES_TABLE, GROUPS_TABLE, "read")
                    kwargs = {
                        "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
                        "items_limit": int(query_params.get('limit')) if query_params and 'limit' in query_params else 100,
                        "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                        "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                    }
                    if kwargs['items_limit'] > 1000:
                        ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                    message = list_workspaces(user_item, **kwargs)
                    response = commonUtil.build_get_response(200, message, compression=commonUtil.is_compression_requested(event))
            elif resource_path == '/workspaces/{id}':
                workspace_id = event['pathParameters']['id']
                # get workspace
                if http_method == "GET":
                    message = get_workspace(workspace_id, user_item)
                    response = commonUtil.build_get_response(200, message)
                # update workspace
                elif http_method == "PUT":
                    workspace_item, _ = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "update")
                    message = update_workspace(workspace_item, event_body, user_id, context.invoked_function_arn)
                    response = commonUtil.build_put_response(200, message)
                # delete workspace
                elif http_method == "DELETE":
                    workspace_item, _ = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "delete")
                    message = delete_workspace(workspace_item, user_id)
                    response = commonUtil.build_delete_response(200, message)
            # get workspace stats
            elif resource_path == '/workspaces/{id}/stats' and http_method == "GET":
                workspace_id = event['pathParameters']['id']
                workspace_item, _ = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")
                message = get_workspace_stats(workspace_item)
                response = commonUtil.build_get_response(200, message)
            elif resource_path == '/workspaces/{id}/runs':
                workspace_id = event['pathParameters']['id']
                # run a workspace
                if http_method == "POST":
                    workspace_item, _ = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "run")
                    message = initiate_workspace_run(workspace_item, user_id, context.invoked_function_arn)
                    response = commonUtil.build_post_response(200, message)
                # list runs
                elif http_method == "GET":
                    commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")
                    kwargs = {
                        "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
                        "items_limit": int(query_params.get('limit')) if query_params and 'limit' in query_params else 100,
                        "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                        "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                    }
                    if kwargs['items_limit'] > 1000:
                        ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                    message = list_workspace_runs(workspace_id, **kwargs)
                    response = commonUtil.build_get_response(200, message, compression=commonUtil.is_compression_requested(event))
            # get run details
            elif resource_path == '/workspaces/{id}/runs/{runid}' and http_method == "GET":
                workspace_id = event['pathParameters']['id']
                run_id = event['pathParameters']['runid']
                commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")
                message = get_workspace_run(workspace_id, run_id)
                response = commonUtil.build_get_response(200, message)

            elif resource_path == '/workspaces/{id}/documents':
                workspace_id = event['pathParameters']['id']
                # List documents or get document details
                if http_method == "GET":
                    workspace_item, _ = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")
                    document_type = None
                    if query_params and query_params.get("documentType"):
                        document_type = query_params["documentType"]
                        if document_type not in ALLOWED_DOCUMENT_TYPES:
                            LOGGER.error("In workspaces.lambda_handler, Invalid document type specified - %s", document_type)
                            errorUtil.raise_exception(EVENT_INFO, "GF", "GE-1034", f"Invalid document type specified. Allowed values are {ALLOWED_DOCUMENT_TYPES}")
                    kwargs = {
                        "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
                        "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                        "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                    }
                    if query_params and 'limit' in query_params:
                        kwargs['items_limit'] = int(query_params.get('limit'))
                    if 'items_limit' in kwargs and kwargs['items_limit'] > 1000:
                        ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                    message = list_workspace_documents(workspace_id, document_type, **kwargs)
                    response = commonUtil.build_get_response(200, message, compression=commonUtil.is_compression_requested(event))

                elif http_method == "POST":
                    workspace_item, _ = commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "update")
                    # Get presigned URL for uploading file to a specified source dataset
                    if query_params and query_params.get('action') == 'get_presigned_url':
                        commonUtil.validate_amorphic_integration_status(user_id)
                        message = upload_file_to_source_dataset(workspace_item, event_body, user_id)

                    else:
                        message = add_document_to_workspace(workspace_item, event_body, user_id)
                    response = commonUtil.build_post_response(200, message)

            elif resource_path == '/workspaces/{id}/documents/{documentid}':
                workspace_id = event['pathParameters']['id']
                document_id = event['pathParameters']['documentid']
                # Get details of a documents
                if http_method == "GET":
                    commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "read")
                    response = get_workspace_document(workspace_id, document_id)

                if http_method == "DELETE":
                    commonUtil.is_user_action_valid(user_item, "WorkspaceId", workspace_id, WORKSPACES_TABLE, GROUPS_TABLE, "update")
                    commonUtil.validate_amorphic_integration_status(user_id)
                    response = delete_workspace_document(document_id, workspace_id, user_id)

            elif resource_path == '/workspaces/{id}/crawl-website':
                workspace_id = event['pathParameters']['id']
                if http_method == 'GET':
                    kwargs = {
                        "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0,
                        "sort_order": query_params.get('sortorder') if query_params and 'sortorder' in query_params else 'desc',
                        "sort_by": query_params.get('sortby') if query_params and 'sortby' in query_params else 'LastModifiedTime'
                    }
                    if query_params and 'limit' in query_params:
                        kwargs['items_limit'] = int(query_params.get('limit'))
                    if 'items_limit' in kwargs and kwargs['items_limit'] > 1000:
                        ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                    message = list_workspace_web_crawling_jobs(workspace_id, **kwargs)
                    response = commonUtil.build_get_response(200, message, compression=commonUtil.is_compression_requested(event))

                elif http_method == 'POST':
                    response = trigger_web_crawling_sf(event_body, workspace_id, user_id, context.invoked_function_arn)

            elif resource_path == '/workspaces/{id}/crawl-website/{crawlid}':
                workspace_id = event['pathParameters']['id']
                crawl_id = event['pathParameters']['crawlid']
                if http_method == 'GET':
                    kwargs = {
                        "offset": int(query_params.get('offset')) - 1 if query_params and 'offset' in query_params else 0
                    }
                    if query_params and 'limit' in query_params:
                        kwargs['items_limit'] = int(query_params.get('limit'))
                    if 'items_limit' in kwargs and kwargs['items_limit'] > 1000:
                        ec_ge_1028 = errorUtil.get_error_object("GE-1028")
                        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1028)
                    urls = list_nested_urls(workspace_id, crawl_id, **kwargs)
                    response = commonUtil.build_get_response(200, urls, commonUtil.is_compression_requested(event))

                elif http_method == 'DELETE':
                    response = delete_web_crawling_job(workspace_id, crawl_id)

            # list user accessible datasets from Amorphic
            elif resource_path == "/amorphic/datasets" and http_method == "GET":
                commonUtil.validate_amorphic_integration_status(user_id)
                message = get_amorphic_datasets(user_id)
                response = commonUtil.build_get_response(200, message)

    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In workspaces.lambda_handler, Failed to process the api request %s with error %s", api_request_id, iie)
        response = commonUtil.build_generic_response(400, {'Message': str(iie)})
    except errorUtil.UnauthorizedUserException as uue:
        LOGGER.error("In workspaces.lambda_handler, Failed to process the api request %s with error %s", api_request_id, uue)
        response = commonUtil.build_generic_response(400, {'Message': str(uue)})
    except errorUtil.GenericFailureException as gfe:
        LOGGER.error("In workspaces.lambda_handler, Failed to process the api request %s with error %s", api_request_id, gfe)
        response = commonUtil.build_generic_response(500, {'Message': str(gfe)})
    except errorUtil.FailedToUpdateMetadataException as fume:
        LOGGER.error("In workspaces.lambda_handler, Failed to process the api request %s with error %s", api_request_id, fume)
        response = commonUtil.build_generic_response(400, {'Message': str(fume)})
    except Exception as err:
        api_request_id = event.get("requestContext", {"requestId": "N/A"}).get("requestId", "N/A")
        LOGGER.error("In workspaces.lambda_handler, Failed to process the api request id: %s with error: %s", api_request_id, str(err))
        ec_ge_1008 = errorUtil.get_error_object("GE-1008")
        ec_emf_1001 = errorUtil.get_error_object("EMF-1001")
        response = commonUtil.build_generic_response(500, {'Message': ec_emf_1001['Message'].format(ec_ge_1008['Code'], ec_ge_1008['Message']) + "The exception occurred is: {}".format(str(err))})

    return response
