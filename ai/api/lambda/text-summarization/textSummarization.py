"""
This lambda performs text summarization
"""
import sys
import os
import json
import logging
import boto3
from pypdf import PdfReader

import commonUtil
import errorUtil
import dynamodbUtil

from boto3.dynamodb.conditions import Key

from langchain.chains.summarize import load_summarize_chain
from langchain_text_splitters.character import RecursiveCharacterTextSplitter
from langchain_aws.llms import BedrockLLM
from langchain_aws.chat_models import ChatBedrock


LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading App Management Lambda Function")

ALLOWED_SUMMARIZATION_MODELS = json.loads(os.environ["summarizationModels"])

try:
    AWS_REGION = os.environ["awsRegion"]
    AI_DATA_BUCKET = os.environ["aiDataBucket"]
    DLZ_BUCKET_NAME = os.environ["DLZBucketName"]

    SESSIONS_TABLE = dynamodbUtil.SESSIONS_TABLE
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
    WORKSPACES_DOCUMENTS_TABLE = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE
    WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX

    S3_CLIENT = boto3.client('s3', AWS_REGION)
    BEDROCK_RUNTIME_CLIENT = boto3.client('bedrock-runtime', AWS_REGION)
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    SSM_CLIENT = boto3.client('ssm', AWS_REGION)
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)
    DATASET_FILES_LAMBDA = os.environ["amorphicDatasetFilesLambdaArn"]

    EVENT_INFO = {}

except Exception as exc:
    LOGGER.error("Failed to set environment variables with: %s", "{0}".format(exc))
    sys.exit()


def generate_doc_summary(model_name, model_params, doc_file_contents):
    '''
    This function contains logic for summarizing the document
    :param model_provider : model provider
    :param model_name : name of the model
    :param model_params : additional params sent to the model
    :param doc_file_contents : content of the file to be summarized
    '''
    LOGGER.info("In textSummarization.generate_doc_summary, starting method")

    LOGGER.info("In textSummarization.generate_doc_summary, initializing langchain llm")
    model_provider = model_name.split('.')[0].lower()
    if model_provider == "anthropic":
        llm = ChatBedrock(model_id=model_name, model_kwargs=model_params, client=BEDROCK_RUNTIME_CLIENT, provider=model_provider)
    else:
        llm = BedrockLLM(model_id=model_name, model_kwargs=model_params, client=BEDROCK_RUNTIME_CLIENT, provider=model_provider)

    n_tokens = llm.get_num_tokens(doc_file_contents)
    LOGGER.info("In textSummarization.generate_doc_summary, number of tokens - %s, checking if its exceeding limit", n_tokens)
    if n_tokens > 10000:
        LOGGER.info("In textSummarization.generate_doc_summary, file is exceeding max token limit")
        response = {
                "Status": commonUtil.AGENT_FAILURE_STATE,
                "Message": "Document is too large for summarization. Please select another file."
            }

    LOGGER.info("In textSummarization.generate_doc_summary, initializing text splitter object")
    text_splitter = RecursiveCharacterTextSplitter(
        separators=["\n\n", "\n"],
        chunk_size=4000,
        chunk_overlap=100
    )

    LOGGER.info("In textSummarization.generate_doc_summary, create smaller documents from the main file")
    docs = text_splitter.create_documents([doc_file_contents])
    num_docs = len(docs)
    LOGGER.info("In textSummarization.generate_doc_summary, created %s docs", num_docs)

    LOGGER.info("In textSummarization.generate_doc_summary, initializing summarize chain")
    summary_chain = load_summarize_chain(llm=llm, chain_type="map_reduce", verbose=False)

    LOGGER.info("In textSummarization.generate_doc_summary, now summarizing each individual doc and combining the summaries")
    output = ""
    output = summary_chain.run(docs)
    doc_summary = output.strip()

    LOGGER.info("In textSummarization.generate_doc_summary, consolidated summary generated - %s", doc_summary)

    LOGGER.info("In textSummarization.generate_doc_summary, returning final response back to chat lambda")
    response = {
        "Status": commonUtil.AGENT_SUCCESS_STATE,
        "Message": doc_summary
    }

    return response


def get_file_content(bucket_name, file_path, file_type):
    """
    This function is to get the file contents of the file to be summarized
    :param bucket_name : name of the S3 bucket from where file is to be fetched
    :param file_path : S3 file path
    """
    LOGGER.info("In textSummarization.get_file_content, fetching file from %s bucket event ", bucket_name)
    doc_file_contents = ""

    if file_type == 'txt':
        LOGGER.info("In textSummarization.get_file_content, file type is .txt so performing get object on S3 file path")
        s3_doc_file = S3_CLIENT.get_object(Bucket=bucket_name, Key=file_path)
        doc_file_contents = s3_doc_file['Body'].read().decode('utf-8')

    elif file_type == 'pdf':
        LOGGER.info("In textSummarization.get_file_content, file type is .pdf so downloading file from S3")
        file_name = file_path.split('/')[-1]
        LOGGER.info("In textSummarization.get_file_content, storing downloaded file in tmp directory")
        input_file = f"/tmp/{file_name}"
        commonUtil.download_file_from_s3(S3_CLIENT, bucket_name, file_path, input_file)
        pdf_reader = PdfReader(open(input_file, "rb"))
        for page in pdf_reader.pages:
            doc_file_contents += page.extract_text()

    else:
        LOGGER.info("In textSummarization.get_file_content, invalid file type is passed")

    return doc_file_contents


def lambda_handler(event, context):
    """
    This is the handler function that is invoked from the API
    """
    LOGGER.info("In textSummarization.lambda_handler, event - %s \n context - %s", event, context)

    try:
        event = commonUtil.RedactAuthTokensClass(event)
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})

        LOGGER.info("In textSummarization.lambda_handler, fetching the event metadata for summarization")
        model_name = event['ModelName']
        model_params = event['ModelParams']
        file_config = event['FileConfig']
        session_id = event['SessionId']
        user_id = event['UserId']
        workspace_id = event['WorkspaceId']
        agent_input_file_name = event['AgentInput']

        LOGGER.info("In textSummarization.lambda_handler, input file name from agent - %s", agent_input_file_name)

        LOGGER.info("In textSummarization.lambda_handler, checking if summarization is possible with the provided model")
        LOGGER.info("In textSummarization.lambda_handler, input model is -%s", model_name)
        if model_name not in ALLOWED_SUMMARIZATION_MODELS:
            LOGGER.info("In textSummarization.lambda_handler, summarization is not possible with the provided model")
            response = {
                'Status': commonUtil.AGENT_FAILURE_STATE,
                'Message': "Sorry, document summarization is not possible. Please try again using a different model."
            }
            return commonUtil.build_post_response(400, response)

        LOGGER.info("In textSummarization.lambda_handler, setting up file metadata for summarization")

        if file_config["UseOriginalFile"]:
            LOGGER.info("In textSummarization.lambda_handler, summarizarion is to be done on the file - %s", file_config["FileName"])

            LOGGER.info("In textSummarization.lambda_handler, getting file type of the file")
            file_type = file_config["FileName"].split('.')[-1]

            LOGGER.info("In textSummarization.lambda_handler, summarizarion is to be done on session-file so file is to be fetched from AI DATA bucket")
            bucket_name = AI_DATA_BUCKET

            LOGGER.info("In textSummarization.lambda_handler, fetching session details to check for file existence")
            session_details = dynamodbUtil.get_item_with_key(
                DYNAMODB_RESOURCE.Table(SESSIONS_TABLE),
                {
                    "UserId": user_id,
                    "SessionId": session_id
                }
            )
            if file_config["FileName"] not in session_details['Files']:
                LOGGER.info("In textSummarization.lambda_handler, file %s not found in sessions table", file_config['FileName'])
                response = {
                    'Status': commonUtil.AGENT_FAILURE_STATE,
                    'Message': "Sorry, document summarization is not possible. Please try again using a different model."
                }
                return commonUtil.build_post_response(400, response)

            LOGGER.info("In textSummarization.lambda_handler, session file is found so generating file key")
            doc_file_path = f"chat-sessions/{user_id}/{session_id}/{file_config['FileName']}"

        elif workspace_id:
            LOGGER.info("In textSummarization.lambda_handler, summarizarion is to be done on the file - %s", agent_input_file_name)

            workspace_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_TABLE), {'WorkspaceId': workspace_id})

            LOGGER.info("In textSummarization.lambda_handler, getting file type of the file")
            file_type = agent_input_file_name.split('.')[-1]

            LOGGER.info("In textSummarization.lambda_handler, summarizarion is to be done on workspace-file so file is to be fetched from DLZ bucket")
            bucket_name = DLZ_BUCKET_NAME

            LOGGER.info("In textSummarization.lambda_handler, getting file name from DynamoDB and checking if its a valid file")
            projection_expression="DocumentDetails"
            doc_items = dynamodbUtil.get_items_by_query_index(
                DYNAMODB_RESOURCE.Table(dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE),
                dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE_WORKSPACEID_INDEX,
                Key('WorkspaceId').eq(workspace_id),
                projection_expression,None
            )
            # checking if there are any files in the workspace
            if not doc_items[0]:
                LOGGER.info("In textSummarization.lambda_handler, there are no active files in the workspace.")
                response = {
                    "Status": commonUtil.AGENT_FAILURE_STATE,
                    "Message": f"No files found by the name - {agent_input_file_name}"
                }
                return commonUtil.build_post_response(400, response)

            # getting path of the first file with that name from docs table
            doc_file_path=""
            for doc_item in doc_items:
                doc_file_name = doc_item["DocumentDetails"].get("FileName","").split('/')[-1]
                if '_'.join(doc_file_name.split('_')[3:]) == agent_input_file_name:
                    doc_dataset_id = doc_item["DocumentDetails"]["DatasetId"]
                    is_dataset_tbac_enabled = False
                    # check if dataset is tbac enabled
                    for dataset in workspace_item["AttachedDatasets"]:
                        if dataset["DatasetId"] == doc_dataset_id:
                            is_dataset_tbac_enabled = dataset.get("IsTBACEnabled", False)
                    if is_dataset_tbac_enabled:
                        # check user access to file
                        file_access_list = commonUtil.check_user_files_access(user_id, doc_dataset_id, [doc_item["DocumentDetails"]["FileName"]], LAMBDA_CLIENT, DATASET_FILES_LAMBDA)
                        user_file_access = file_access_list[0][doc_item["DocumentDetails"]["FileName"]]
                    else:
                        user_file_access = True
                    if user_file_access:
                        doc_file_path = doc_item["DocumentDetails"]["FileName"]
                        LOGGER.info("In textSummarization.lambda_handler, there may be multiple files with the same name so going for the first one")
                        break

            if not doc_file_path:
                LOGGER.info("In textSummarization.lambda_handler, file %s not found in workspace documents table", agent_input_file_name)
                response = {
                    "Status": commonUtil.AGENT_FAILURE_STATE,
                    "Message": f"No files found by the name - {agent_input_file_name}"
                }
                return commonUtil.build_post_response(400, response)

        else:
            LOGGER.info("In textSummarization.lambda_handler, no session file or workspace is chosen so exiting")
            response = {
                    "Status": commonUtil.AGENT_FAILURE_STATE,
                    "Message": "Please attach a file or enter valid file/workspace."
                }
            return commonUtil.build_post_response(400, response)

        LOGGER.info("In textSummarization.lambda_handler, checking file type of the input file. Input file type is - %s", file_type)
        if file_type not in ['pdf', 'txt']:
            LOGGER.info("In textSummarization.lambda_handler, invalid file type (only pdf, txt files are supported)")
            response = {
                    "Status": commonUtil.AGENT_FAILURE_STATE,
                    "Message": "Sorry, document summarization is not possible. Please upload a txt or pdf file."
                }
            return commonUtil.build_post_response(400, response)


        LOGGER.info("In textSummarization.lambda_handler, file path is generated - %s, now fetching file contents from S3", doc_file_path)
        doc_file_contents = get_file_content(bucket_name, doc_file_path, file_type)

        LOGGER.info("In textSummarization.lambda_handler, fetched file contents now generating summary")
        summary_response = generate_doc_summary(model_name, model_params, doc_file_contents)

        if summary_response['Status'] == commonUtil.AGENT_FAILURE_STATE:
            return commonUtil.build_post_response(400, summary_response)


    except Exception as ex:
        LOGGER.error("In textSummarization.lambda_handler, failed to summarize the doc with error - %s", str(ex))
        response = {
            "Status": commonUtil.AGENT_FAILURE_STATE,
            "Message": "Unable to summarize document. Please try again after some time."
        }
        return commonUtil.build_post_response(400, response)

    return commonUtil.build_post_response(200, summary_response)
