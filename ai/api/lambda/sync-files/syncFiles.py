"""
syncFiles.py
"""
import sys
import os
import re
import logging
import json
import uuid
import boto3
from boto3.dynamodb.conditions import Key, Attr

import commonUtil
import dynamodbUtil
import errorUtil

# Initialize LOGGER.and set config and log level
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info('Loading Function %s', "syncFiles.py")

try:
    ENVIRONMENT = os.environ['environment']
    AWS_REGION = os.environ['awsRegion']
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    AWS_PARTITION = os.environ["awsPartition"]
    ACCOUNT_ID = os.environ['accountId']

    # aws service clients
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    SSM_CLIENT = boto3.client("ssm", AWS_REGION)
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)

    # dynamodb tables
    WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX
    WORKSPACES_DOCUMENTS_TABLE = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
    WORKSPACES_EXECUTIONS_TABLE = dynamodbUtil.WORKSPACES_EXECUTIONS_TABLE
    USERS_TABLE = dynamodbUtil.USERS_TABLE

    STEP_FUNCTION_CLIENT = boto3.client('stepfunctions', AWS_REGION)
    BEDROCK_AGENT_CLIENT = boto3.client('bedrock-agent', AWS_REGION)

    WORKSPACES_LAMBDA_ARN = os.environ['workspacesLambdaArn']
    EXECUTE_INPUT_LAMBDA_SM_ARN = os.environ['executeInputLambdaStateMachineArn']
    DATASET_OPERATIONS_LAMBDA = os.environ["amorphicDatasetOperationsLambdaArn"]

    EVENT_INFO ={}
except Exception as ex:
    LOGGER.error("In syncFiles, failed to set environment variables with: %s", '{0}'.format(ex))
    sys.exit()

def run_workspace(user_id: str, workspace_id: str) -> dict:
    """Trigger ingestion job for the knowledge base linked to the workspace

    Args:
        user_id (str): Id of the user triggering the workspace run
        workspace_id (str): Workspace ID
    """
    LOGGER.info("In syncFiles.run_workspace, Starting ingestion job for workspace id - %s", workspace_id)
    workspace_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), {'WorkspaceId': workspace_id})
    knowledge_base_id = workspace_item['KnowledgeBaseId']
    data_source_id = workspace_item['DataSourceId']
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
        "TriggerType": 'file-based'
    }
    put_response = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(WORKSPACES_EXECUTIONS_TABLE), workspace_run_db_item)
    if put_response == "error":
        LOGGER.info("In syncFiles.run_workspace, updating workspace execution table failed")
        ec_ge_1020 = errorUtil.get_error_object("GE-1020")
        ec_ge_1020['Message'] = ec_ge_1020['Message'].format("WORKSPACES EXECUTIONS")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1020)

    sf_payload = {
        "lambdaArn": WORKSPACES_LAMBDA_ARN,
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
    LOGGER.info("In syncFiles.run_workspace, check ingestion job sf invoke response - %s", str(sm_resp))
    if sm_resp["ResponseMetadata"]["HTTPStatusCode"] != 200:
        LOGGER.error("In syncFiles.run_workspace, error: %s", sm_resp['Payload'].read().decode())
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = f"Error- {sm_resp['Payload'].read().decode()}"
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1034)

    return {'Message': 'Run triggered', 'RunId': workspace_run_db_item['RunId']}


def sync_workspace_source_files(event):
    """
    This function syncs the output files of workspace from amorphic
    :param event: list of events from dynamodb streams
    """
    LOGGER.info("In syncFiles.sync_workspace_source_files, starting files sync")
    workspaces_to_sync = dynamodbUtil.scan_with_pagination(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), Attr("WorkspaceStatus").eq(commonUtil.WORKSPACES_CREATION_COMPLETED_STATUS),
                                                           "AttachedDatasets, WorkspaceId")
    source_dataset_ids = []
    workspace_dataset_ids = {}
    for workspace in workspaces_to_sync:
        datasets_linked_to_workspace = [dataset['DatasetId'] for dataset in workspace.get('AttachedDatasets', [])]
        source_dataset_ids.extend(datasets_linked_to_workspace)
        workspace_dataset_ids[workspace['WorkspaceId']] = datasets_linked_to_workspace
    source_dataset_ids = list(set(source_dataset_ids))

    for item in event:
        event_name = item.get('eventName', "")
        new_record = item.get('dynamodb').get('OldImage') if event_name == 'REMOVE' else item.get('dynamodb').get('NewImage')
        file_name = new_record.get('FileName').get('S')
        dataset_id = new_record.get('DatasetId').get('S')
        load_status = new_record.get('LoadStatus').get('S')
        if new_record.get('UserId'):
            user_id = new_record.get('UserId', {}).get('S', "N/A")
        else:
            user_id = new_record.get('LastModifiedBy', {}).get('S', "N/A")
        if dataset_id in source_dataset_ids:
            source_dataset_id = dataset_id
            LOGGER.info("In syncFiles.sync_workspace_source_files, syncing file for source dataset %s", dataset_id)

            workspace_id_list = [workspace['WorkspaceId'] for workspace in workspaces_to_sync if source_dataset_id in workspace_dataset_ids[workspace['WorkspaceId']]]
            LOGGER.info("In syncFiles.sync_workspace_source_files, workspaces who have source dataset %s are - %s", source_dataset_id, workspace_id_list)
            workspace_file_items = []
            for workspace_id in workspace_id_list:
                workspace_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), {'WorkspaceId': workspace_id})
                document_id = str(uuid.uuid4())
                file_item = {}
                # Check if the file is scraped web page from the workspace
                match = re.search(r'_([^_]+)\.txt$', file_name)
                if match:
                    website_document_id = match.group(1)
                    file_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), {'WorkspaceId': workspace_id, 'DocumentId': website_document_id})
                # Check if file already exists
                else:
                    key_condition_expression = Key('WorkspaceId').eq(workspace_id)
                    filter_expression = Attr('DocumentDetails.FileName').eq(file_name)
                    file_items = dynamodbUtil.get_items_by_query_index(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX, key_condition_expression,
                                                                    None, filter_expression)
                    if file_items:
                        file_item = file_items[0]
                if file_item:
                    document_id = file_item['DocumentId']
                workspace_file_item = {
                    "DocumentId": document_id,
                    "WorkspaceId": workspace_id
                }
                if event_name != "REMOVE":
                    workspace_file_item.update({
                        "DocumentType": file_item.get("DocumentType", "file"),
                        "DocumentDetails": {
                            "FileName": file_name,
                            "DatasetId": source_dataset_id
                        },
                        "LastModifiedBy": user_id,
                        "LastModifiedTime": commonUtil.get_current_time(),
                        "TriggerType": workspace_item["TriggerType"]
                    })
                    if file_item.get('DocumentType') == 'website':
                        workspace_file_item['DocumentDetails'].update({
                            'WebsiteURL': file_item['DocumentDetails']['WebsiteURL']
                        })
                    if load_status == "completed":
                        workspace_file_item.update({
                            "Message": "File uploaded successfully"
                        })
                    elif load_status == "failed":
                        workspace_file_item.update({
                            "Message": "File upload failed"
                        })
                workspace_file_items.append(workspace_file_item)
            if event_name != "REMOVE" and load_status in ["failed", "completed"]:
                LOGGER.info("In syncFiles.sync_workspace_source_files, adding file items to workspace files table - %s", workspace_file_items)
                dynamodbUtil.batch_write_items(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), workspace_file_items)
                for file_item in workspace_file_items:
                    if file_item['TriggerType'] == 'file-based' and load_status=="completed":
                        LOGGER.info("In syncFiles.sync_workspace_source_files, running filebased run for workspace %s", file_item["WorkspaceId"])
                        response = run_workspace(user_id, file_item["WorkspaceId"])
                        LOGGER.info("In syncFiles.sync_workspace_source_files, response from workspace job run - %s", response)
            elif event_name == "REMOVE" or load_status == 'deleted':
                LOGGER.info("In syncFiles.sync_workspace_source_files, workspace file items - %s", workspace_file_items)
                dynamodbUtil.batch_delete_items(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), workspace_file_items)
    LOGGER.info("In syncFiles.sync_workspace_source_files, exiting method")


def lambda_handler(event, context):
    """
    This is a lambda handler function which is called for every event pipe trigger
    :param event: event information
    :type event: dict
    :param context: runtime information to the handler.
    :type context: LambdaContext
    :return: response to the api
    :rtype: dict
    """
    try:
        #to remove authorization token while printing logs
        LOGGER.info("In syncFiles.lambda_handler, starting method with event: %s, context: %s", event, context)
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
        # triggered from event-bridge pipes
        if isinstance(event,list) and event[0].get('eventSource') == 'aws:dynamodb' and 'dynamodb' in event[0]:
            LOGGER.info("In syncFiles.lambda_handler, syncing files from amorphic")
            sync_workspace_source_files(event)
    except Exception as err:
        LOGGER.error("In syncFiles.lambda_handler, Failed to sync files from amorphic with error %s:", str(err))
        ec_ge_1008 = errorUtil.get_error_object("GE-1008")
        ec_emf_1001 = errorUtil.get_error_object("EMF-1001")
        response = commonUtil.build_generic_response(500, {'Message': ec_emf_1001['Message'].format(ec_ge_1008['Code'], ec_ge_1008['Message']) + "The exception occurred is: {}".format(str(err))})
        return response
