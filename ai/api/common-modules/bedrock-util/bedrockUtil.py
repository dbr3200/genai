"""
This file has all the common functions that are used for bedrock and langchain.
"""
import os
import re
import ast
import json
import time
import logging
import warnings

from typing import List
from datetime import datetime
import commonUtil
import dynamodbUtil

from langchain.agents import AgentExecutor, create_structured_chat_agent
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain, create_history_aware_retriever

from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.runnables import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.callbacks.base import BaseCallbackHandler
from langchain_core.retrievers import BaseRetriever
from langchain_core.documents import Document
from langchain_core.messages import messages_from_dict
from langchain_core.callbacks.manager import CallbackManagerForRetrieverRun
from langchain_core.tools import Tool

from langchain_aws.llms import BedrockLLM
from langchain_aws.chat_models import ChatBedrock
from langchain_aws.embeddings import BedrockEmbeddings
from langchain_aws.retrievers import AmazonKnowledgeBasesRetriever
from langchain_community.document_loaders.csv_loader import CSVLoader

from langchain_openai import ChatOpenAI
from pypdf import PdfReader

# to prevent printing warning messages from langchain
warnings.filterwarnings("ignore", category=UserWarning)
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

NO_DOCS_FOUND_RESPONSE = "Apologies, Based on the context provided, I could not find any relevant documents or have enough information to answer the specific question. Please try again with specific details."
CHAT_QUERY_FAILED_MESSAGE = "Apologies, I wasn't able to process your request. Please try again."
MODEL_FAILURE_MESSAGE = "Apologies, I wasn't able to process your request as the model processing failed. Please try again."
FILE_TOO_BIG_MESSAGE = "The size of the file exceeds the acceptable limit. Kindly upload the file to a designated workspace to facilitate Question-and-Answer (QnA) processes."
INVALID_API_KEY_MESSAGE = "The OPEN AI API key you're using is invalid. Please setup a valid API key and try again."
MODEL_ACCESS_ERROR_MESSAGE = "You do not have access to the model: {}. Please request access for it from Amazon Bedrock console "
UNSUPPORTED_FILE_TYPE_MESSAGE = "Apologies, I wasn't able to process your request because of {} "
DEFAULT_MODEL_KWARGS = {
    "temperature": 0.5,
    "topP": 1,
    "maxTokens": 4096
}
INPUT_MESSAGE_SIZE_LIMIT = 16000
BEDROCK_RUNTIME_CLIENT = None
S3_CLIENT = None
LAMBDA_CLIENT = None
API_MANAGEMENT_CLIENT = None
DYNAMODB_RESOURCE = None
SESSIONS_TABLE = None
DATASET_FILES_LAMBDA = None
CHAT_HISTORY_TABLE = None
WORKSPACES_DOCUMENTS_TABLE = None
CHATBOTS_TABLE = None
CHAT_HISTORY_STORE = {}

CHAIN_TYPE = {
    "general-response": "stuff",
    "text-summarization": "map-reduce"
}

def is_model_accessible(model_item):
    """
    This method validates the model access
    :param model_item: The model item
    :return: True if the model access is valid, False otherwise
    """
    LOGGER.info("In bedrockUtil.is_model_accessible, model_item - %s", model_item)

    try:
        # allow enabling of model without invoking if customizations are supported on top of it
        if model_item["CustomizationsSupported"]:
            return True, ''
        model_name = model_item["ModelName"]
        model_provider = model_item["ModelProvider"]
        # Accept only text modalities for now, we are not supporting image
        if "TEXT" in model_item["Modalities"]:
            if model_item["ModelProvider"] == commonUtil.OPENAI_MODEL_PROVIDER:
                llm_args = {'model_name': model_name}
                llm = ChatOpenAI(**llm_args)
            else:
                model_provider = commonUtil.MODEL_PROVIDER_MAP.get(model_provider.lower(), model_name.split('.')[0])
                llm_args = {
                    'model_id': model_name if model_item["ModelType"] == "Base" else model_item["AdditionalConfiguration"]["ProvisionThroughputConfig"]["ProvisionedModelArn"],
                    'provider': model_provider,
                    'client': BEDROCK_RUNTIME_CLIENT
                }
                if model_provider.lower() in ["anthropic"]:
                    llm = ChatBedrock(**llm_args)
                else:
                    llm = BedrockLLM(**llm_args)
            llm.invoke(input="Test message")
        else:
            llm_args = {
                'model_id': model_name,
                'client': BEDROCK_RUNTIME_CLIENT
            }
            llm = BedrockEmbeddings(**llm_args)
            llm.embed_query("Test embedding")
        return True, ''
    except Exception as excp:
        LOGGER.error("In bedrockUtil.is_model_accessible, exception - %s", str(excp))
        return False, str(excp)

def retrieve_user_accessible_files(user_id, files, workspace_datasets):
    """
    This method retrieves the user accessible files using the file-access API
    :param user_id: The user id
    :param files: The files
    :param workspace_datasets: The workspace datasets
    :return: The user accessible files
    """
    LOGGER.info("In bedrockUtil.retrieve_user_accessible_files, user_id - %s, files - %s, workspace_datasets - %s", user_id, files, workspace_datasets)
    user_accessible_files = []
    dataset_name_files_map = {}
    for filepath in files:
        path_split = filepath.split('/')
        dataset_domain_and_name = f'{path_split[0]}/{path_split[1]}'
        if dataset_domain_and_name not in dataset_name_files_map:
            dataset_name_files_map[dataset_domain_and_name] = [filepath]
        else:
            if filepath not in dataset_name_files_map[dataset_domain_and_name]:
                dataset_name_files_map[dataset_domain_and_name].append(filepath)
    dataset_id_files_map = {}
    for dataset in workspace_datasets:
        dataset_domain_and_name = f'{dataset["Domain"]}/{dataset["DatasetName"]}'
        if dataset.get("IsTBACEnabled", False):
            dataset_id_files_map[dataset["DatasetId"]] = dataset_name_files_map.get(dataset_domain_and_name, [])
        else:
            # Add files to user accessible list if not TBAC dataset
            user_accessible_files.extend(dataset_name_files_map.get(dataset_domain_and_name, []))

    for dataset_id, ds_files in dataset_id_files_map.items():
        if ds_files:
            ds_files = commonUtil.check_user_files_access(user_id, dataset_id, ds_files, LAMBDA_CLIENT, DATASET_FILES_LAMBDA)
            for file in ds_files:
                user_accessible_files.extend([filename for filename,file_access in file.items() if file_access])
    LOGGER.info("In bedrockUtil.retrieve_user_accessible_files, user_accessible_files - %s", user_accessible_files)
    return user_accessible_files

# pylint: disable=too-few-public-methods
class WorkspaceRetriever(BaseRetriever):
    """This class is used as the retriever from RAG for Workspaces"""
    retriever: AmazonKnowledgeBasesRetriever
    workspace_details: dict
    user_id: str
    connection_id: str
    session_id: str
    message_id: str
    query_start_time: str

    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        # Use knowledge base retriever to get the documents
        documents = self.retriever.invoke(query, callbacks=run_manager.get_child())
        LOGGER.info("In bedrockUtil.WorkspaceRetriever._get_relevant_documents, retrieved  %s relevant results", len(documents))
        filtered_documents = []
        # for chatbot requests, we do not need to do any access based filtering. for chatbot requests, user id will be None
        if commonUtil.is_valid_uuid(self.user_id):
            filtered_documents = documents
        else:
            files = []
            for document in documents:
                # the path retrieved is the entire s3 path, but we only required the object keys, so trimming it
                s3_path = document.metadata['location']['s3Location']['uri']
                split_s3_path = s3_path.split('/')
                filepath = '/'.join(split_s3_path[3:])
                document.metadata['location']['s3Location']['filepath'] = filepath
                files.append(filepath)
            user_accessible_files = retrieve_user_accessible_files(self.user_id, files, self.workspace_details["AttachedDatasets"])
            LOGGER.info("In bedrockUtil.WorkspaceRetriever._get_relevant_documents, user_accessible_files - %s", user_accessible_files)
            filtered_documents = [document for document in documents if document.metadata['location']['s3Location']['filepath'] in user_accessible_files]
            # send message to user if any matching documents are found
            if self.connection_id and filtered_documents:
                kwargs = {"ApiManagementClient": API_MANAGEMENT_CLIENT, "DynamoDBResource": DYNAMODB_RESOURCE, "SessionsTable": SESSIONS_TABLE}
                formatted_sources = []
                for file in user_accessible_files:
                    filepath_split = file.split('/')
                    filename = filepath_split[-1]
                    source_details = {
                        'FileName': filename,
                        'Dataset': filepath_split[1],
                        'Domain' : filepath_split[0],
                        'Workspace': self.workspace_details["WorkspaceName"]
                    }
                    # if the document file is scraped from a website, add the website url to the source details
                    # website file name will end with website_{uuid}.txt
                    match = re.search(r'_([^_]+)\.txt$', filename)
                    if match:
                        document_id = match.group(1)
                        if commonUtil.is_valid_uuid(document_id):
                            document_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), {'WorkspaceId': self.workspace_details['WorkspaceId'], 'DocumentId': document_id})
                            if document_item and document_item["DocumentDetails"].get("FileName"):
                                source_details["WebsiteURL"] = document_item["DocumentDetails"]["WebsiteURL"]
                    formatted_sources.append(source_details)
                sources_message_time = commonUtil.get_current_time()
                sources_response_time = str((datetime.strptime(sources_message_time, commonUtil.DATETIME_ISO_FORMAT) - datetime.strptime(self.query_start_time, commonUtil.DATETIME_ISO_FORMAT)).total_seconds() * 1000)
                commonUtil.send_message_to_ws_connection(
                    self.user_id,
                    self.session_id,
                    {"AIMessage": f"We found {len(user_accessible_files)} resources with relevant information, formatting your response", "Metadata": {"IsComplete": False, "Sources": formatted_sources, "MessageId": self.message_id, "ResponseTime": sources_response_time}},
                    kwargs)
                # write sources to dynamodb
                ai_message_object = {
                    "Type": "ai",
                    "Data": f"We found {len(user_accessible_files)} resources with relevant information, formatting your response",
                    "MessageId": self.message_id,
                    "ClientId": self.user_id,
                    "SessionId": self.session_id,
                    "MessageTime": sources_message_time,
                    "ResponseTime": sources_response_time,
                    "Sources": formatted_sources,
                    "ReviewRequired": False
                }
                dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(CHAT_HISTORY_TABLE), ai_message_object)

        return filtered_documents

class CSVRetriever(BaseRetriever):
    """This class is used as the retriever from CSVLoader"""
    filename: str
    session_details: dict

    #pylint: disable=unused-argument
    def _get_relevant_documents(
        self, query: str, *, run_manager: CallbackManagerForRetrieverRun
    ) -> List[Document]:
        LOGGER.info('In bedrockUtil.CSVRetriever._get_relevant_documents, Processing file - %s', self.filename)
        s3_file_path = f"chat-sessions/{self.session_details['UserId']}/{self.session_details['SessionId']}/{self.filename}"
        bucket = os.environ['sessionFilesBucketName']
        input_file_path = f'/tmp/{self.filename}'
        commonUtil.download_file_from_s3(S3_CLIENT, bucket, s3_file_path, input_file_path)
        found_delimiter = commonUtil.find_delimiter(input_file_path)
        loader = CSVLoader(file_path=input_file_path, csv_args = {
            'delimiter': found_delimiter
        })
        documents = loader.load()
        return documents

def get_workspace_retriever(workspace_details, user_id, connection_id, session_id, message_id, query_start_time):
    """
    This method returns the required workspace retriever depending on the version
    :param workspace_details: The workspace details
    :return: The workspace retriever
    """
    retriever = AmazonKnowledgeBasesRetriever(
        knowledge_base_id=workspace_details.get("KnowledgeBaseId"),
        retrieval_config={"vectorSearchConfiguration": {"numberOfResults": int(commonUtil.get_decrypted_value(commonUtil.WORKSPACE_RETRIEVAL_MAXRESULTS_SSM_KEY))}},
    )
    # we create a custom retriever on top of the KnowledgeBaseRetriever so that we can filter retrieved documents based on access
    return WorkspaceRetriever(retriever=retriever, workspace_details=workspace_details, user_id=user_id, connection_id=connection_id, session_id=session_id, message_id=message_id, query_start_time=query_start_time)

def get_condense_question_prompt():
    """
    This method returns the prompt to use to condense the chat history and new question into a standalone question
    :return: The prompt
    """
    template = """Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.
    If the follow up input does not make sense, let the follow up input be the standalone question. If the follow up input is in another language, translate it to English first.
    \n\nChat History:\n{chat_history}\nFollow Up Input: {input}\nStandalone question:"""

    prompt_template = ChatPromptTemplate.from_messages([
        ("system", template),
        MessagesPlaceholder("chat_history"),
        ("human", ("content = {input}"))
    ])
    return prompt_template

def get_qa_prompt(client_id):
    """
    This method returns the prompt to use to ask a question to the chatbot
    :return: The prompt
    """
    LOGGER.info("In bedrockUtil.get_qa_prompt, with client id - %s", client_id)
    # If chatbot get chatbot details to retrieve Instructions and Redaction settings
    if commonUtil.is_valid_uuid(client_id):
        LOGGER.info("In bedrockUtil.get_qa_prompt, the request is to a chatbot")
        chatbot_details = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(CHATBOTS_TABLE), {"ChatbotId": client_id})
        instructions = chatbot_details.get("Instructions", "")
        enable_redaction = chatbot_details.get("EnableRedaction", False)
        if enable_redaction:
            LOGGER.info("In bedrockUtil.get_qa_prompt, redaction is enabled for chatbot")
            redact_prompt = """
                    - Please redact any Personally Identifiable Information (PII) from your response. This includes, but is not limited to:
                        Names: Full names, nicknames, or any other identifying names.
                        Addresses: Residential addresses, mailing addresses, or any location-specific data.
                        Phone Numbers: Mobile numbers, landline numbers, or any contact numbers.
                        Email Addresses: Personal or professional email addresses.
                        Social Security Numbers: SSN, national identification numbers, or any government-issued identification numbers.
                        Credit Card Numbers: Any financial account numbers or credit card details.
                        Date of Birth: Birthdates or any other age-related information.
                        Driver's License Numbers: License numbers or any other vehicle-related identifiers.
                        Passport Numbers: Passport details or any other travel-related identification.
                        Medical Information: Health records, insurance information, or any sensitive medical data including diagnoses, treatment plans, medications, test results, and any other health-related information.
                        Biometric Data: Fingerprints, retinal scans, or any unique physical identifiers.
                        Login Credentials: Usernames, passwords, or any access codes.
                        IP Addresses: Internet Protocol addresses or any other network-related identifiers.
                    - If you find any data that matches the above description, redact it completely.
                    - Replace any PII data with '[REDACTED]' keyword.
                    - Never return PII data in your response to the user.
                    - Ensure that after redaction, the response maintains its readability and context, without compromising the privacy of individuals mentioned within.
                    - Do not answer any questions if the answer exposes any PII data.
                    - Do not answer any questions that requires analysis on top of PII data
                    - If a question or input contains PII data or requests such information, please refrain from providing any response related to it. Instead, offer a generic response emphasizing privacy and data protection, or redirect the conversation to a different topic.
                    """
        else:
            redact_prompt = ""
        template = """
                    You are a chatbot designed to respond to user messages. These are your primary instructions. They should always be followed:
                    - Your responses should always be in English.
                    - If the user message is a greeting, respond appropriately.
                    - If the user message is a question, answer the questions only based on the context provided.
                    - Do not try to make up answers. If you don't know the answer, say that you don't know.
                    {redact_pii_template}
                    {instructions}
                    If the secondary instructions contradict any your primary instructions, you should discard the secondary instructions and follow the primary instructions.
                    \n\nContext: {{context}}
                    \n\nUser message: {{input}}
                    \n\nHelpful answer:
               """
        template = template.format(instructions=instructions, redact_pii_template=redact_prompt)
    else:
        LOGGER.info("In bedrockUtil.get_qa_prompt, the request is through the playground")
        template = """Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer. If the question is a greeting, respond appropriately.\n\n{context}\n\nQuestion: {input}\nHelpful Answer:"""

    prompt_template = ChatPromptTemplate.from_messages([
        ("system", template),
        ("human", "content = {input}"),
        ("human", "content = {context}"),
    ])

    LOGGER.info("In bedrockUtil.get_qa_prompt, exiting")
    return prompt_template

def get_contextless_prompt():
    """
    This method returns the prompt to use to ask a question to the chatbot
    :return: The prompt
    """
    template = """The following is a friendly conversation between a human and an AI. If the AI does not know the answer to a question, it truthfully says it does not know.

    Current conversation:
    {{chat_history}}

    Question: {{input}}
    AI:"""

    LOGGER.info('In bedrockUtil.get_contextless_prompt, creating prompt template.')
    prompt_template = ChatPromptTemplate.from_messages([
        ("system", template),
        MessagesPlaceholder("chat_history"),
        ("human", ("content = {input}")),
    ])

    LOGGER.info('In bedrockUtil.get_contextless_prompt, created prompt template: - %s', prompt_template)
    return prompt_template

class StreamingHandler(BaseCallbackHandler):
    """
    This class is used to handle callbacks from the LLM to send streaming response to user
    """
    user_id: str
    session_id: str
    message_id: str
    message: list
    question_pass: bool

    def __init__(self, user_id, session_id, message_id):
        self.user_id = user_id
        self.session_id = session_id
        self.message_id = message_id
        self.message = []
        self.question_pass = True

    #pylint: disable=unused-argument
    def on_llm_start(self, serialized, prompts, **kwargs):
        """
        This method is called when an LLM starts running
        """
        # if the LLM is run to rephrase the question set the question_pass to True
        if prompts[0].startswith('Given the following conversation and a follow up question'):
            self.question_pass = True
        else:
            self.question_pass = False


    def on_llm_new_token(self, token: str, **kwargs) -> None:
        """
        This method is called on every new token generated by the LLM
        """
        # don't need to send the response to user during the question rephrase step
        if not self.question_pass:
            self.message.append(token)
            if len(self.message) > 40:
                ws_kwargs = {"ApiManagementClient": API_MANAGEMENT_CLIENT, "DynamoDBResource": DYNAMODB_RESOURCE, "SessionsTable": SESSIONS_TABLE}
                commonUtil.send_message_to_ws_connection(self.user_id, self.session_id, {"AIMessage": ''.join(self.message), "Metadata": {"IsComplete": False, "MessageId": self.message_id}}, ws_kwargs)
                self.message = []

    def on_llm_end(self, response, **kwargs):
        """
        This method is called when an LLM stops
        """
        # don't need to send the response to user during the question rephrase step
        if not self.question_pass:
            ws_kwargs = {"ApiManagementClient": API_MANAGEMENT_CLIENT, "DynamoDBResource": DYNAMODB_RESOURCE, "SessionsTable": SESSIONS_TABLE}
            commonUtil.send_message_to_ws_connection(self.user_id, self.session_id, {"AIMessage": ''.join(self.message), "Metadata": {"IsComplete": True, "MessageId": self.message_id}}, ws_kwargs)
            self.message = []

def get_callback_handler():
    """
    This method returns the callback handler to be used by the retrieval chain
    :return: The callback handler
    """
    # we return a default template for now, we can modify it if needed
    return BaseCallbackHandler()

def get_memory_from_chat_history(session_id):
    """
    This method returns the memory object generated from the chat history of the session
    :param session_id: The session ID for which to fetch history
    :return: The chat memory object to be used by retrieval chain
    """
    LOGGER.info("In bedrockUtil.get_memory_from_chat_history method with session ID: %s", session_id)
    chat_history_from_ddb = CHAT_HISTORY_STORE.get(session_id, [])[-10:]
    chat_history_for_memory = []
    for message in chat_history_from_ddb:
        chat_history_for_memory.append({
            "type": message["Type"],
            "data": {
                "content": message["Data"]
            }
        })
    messages = messages_from_dict(chat_history_for_memory)
    chat_memory_object = InMemoryChatMessageHistory()
    chat_memory_object.add_messages(messages)
    LOGGER.info("In bedrockUtil.get_memory_from_chat_history method, exiting with memory object - %s", chat_memory_object)
    return chat_memory_object

def get_contextful_prompt_using_file(session_details, filename):
    """
    This method returns the prompt to use to ask a question to the chatbot
    :param session_details: The session details
    :param filename: The filename
    :return: The prompt
    """
    s3_file_path = f"chat-sessions/{session_details['UserId']}/{session_details['SessionId']}/{filename}"
    bucket = os.environ['sessionFilesBucketName']
    input_file = f'/tmp/{filename}'
    commonUtil.download_file_from_s3(S3_CLIENT, bucket, s3_file_path, input_file)

    file_type = filename.split('.')[-1]
    if file_type == 'csv':
        loader = CSVLoader(file_path=input_file)
        document_text = ""
        documents = loader.load()
        for document in documents:
            document_text += document.page_content
    elif file_type == 'txt':
        file_object = open(input_file, "r", encoding='UTF-8')
        document_text = file_object.read()
    elif file_type == 'pdf':
        reader = PdfReader(open(input_file, "rb"))
        document_text = ""
        for page in reader.pages:
            document_text += page.extract_text()
    else:
        LOGGER.error("In bedrockUtil.get_contextful_prompt_using_file, file type not supported - %s", file_type)
        raise Exception("unsupported file type - {} attached to the session".format(file_type))

    LOGGER.info("In bedrockUtil.get_contextful_prompt_using_file, context length - %s", len(document_text))
    # so that format call doesn't break anything
    document_text = document_text.replace('{', '{{')
    document_text = document_text.replace('}', '}}')
    context_template = f"""The following is a friendly conversation between a human and an AI. Answer the question based on the context provided. If the AI does not know the answer to a question, it truthfully says it does not know.

    Context: {json.dumps(document_text)}

    """
    final_template = context_template + """
    Current conversation:
    {chat_history}


    Question: {input}
    AI:"""

    prompt_template = ChatPromptTemplate.from_messages([
        ("system", final_template),
        MessagesPlaceholder("chat_history"),
        ("human", "content = {input}"),
    ])
    LOGGER.info("In bedrockUtil.get_contextful_prompt_using_file, prompt_template : %s", prompt_template)
    return prompt_template

def is_greeting(user_question, model_name, workspace_id):
    """
    This method returns the response of user greetings or thank you messages without going through RAG or other data sources
    :param user_question: The message to be sent to the chatbot
    :return: The response of the conversation chain
    """
    # This is to avoid an open issue : https://github.com/langchain-ai/langchain/issues/7606
    # This is a temporary fix suggested in langchain forums, a more permanent solution is
    # (1) we should use NLP to determine greetings or not.
    # (2) we should update the prompt "CONDENSE_QUESTION_PROMPT" to ignore memory on greeting messages
    greetings = ["hi there!", "hello!", "good morning!", "good afternoon!", "good evening!", "hey!", "greetings!", "howdy!",
                 "hi, how are you?", "what's up?", "yo!", "hiya!", "salutations!", "hi, nice to meet you!", "welcome!",
                 "how's it going?", "hi, how's your day?", "hi, how can I help you today?", "hi, what's new?",
                 "hi, long time no see!", "hi", "hello", "hey", "hey there", "good morning", "good evening", "hi there", "howdy"]
    thanks = ["thanks", "thank you"]
    LOGGER.info("In bedrockUtil.is_greeting method with questions - %s", user_question)
    chatbot_response = {
        "content": "N/A",
        "metadata": {
            "modelId": model_name,
            "mode": "N/A",
            "modelKwargs": "N/A",
            "workspaceId": workspace_id
            }
        }
    if user_question.lower() in greetings:
        chatbot_response["content"] = "Hello! How can I assist you today?"
        LOGGER.info("In bedrockUtil.is_greeting method, returning response - %s", chatbot_response)
        return chatbot_response
    elif user_question.lower() in thanks:
        chatbot_response["content"] = "You're welcome! If you have any more questions or if there's anything else I can help you with, feel free to ask."
        LOGGER.info("In bedrockUtil.is_greeting method, returning response - %s", chatbot_response)
        return chatbot_response
    else:
        LOGGER.info("In bedrockUtil.is_greeting method, user query is not a greeting")
        return {}

def get_model_params(model_name, model_params):
    """
    This method returns the model parameters to be used by the chatbot
    :param model_name: The name of the model
    :param model_params: The model params passed by user
    :return: The model parameters
    """
    model_params_dict = {
        "amazon": {
            "temperature": "temperature",
            "topP": "topP",
            "maxTokens": "maxTokenCount"
        },
        "anthropic": {
            "temperature": "temperature",
            "topP": "top_p",
            "maxTokens": "max_tokens"
        },
        "ai21": {
            "temperature": "temperature",
            "topP": "topP",
            "maxTokens": "maxTokens",
        },
        "cohere": {
            "temperature": "temperature",
            "topP": "p",
            "maxTokens": "max_tokens"
        },
        "meta": {
            "temperature": "temperature",
            "topP": "top_p",
            "maxTokens": "max_gen_len"
        },
        "mistral": {
            "temperature": "temperature",
            "topP": "top_p",
            "maxTokens": "max_tokens"
        }
    }
    model_provider = model_name.split('.')[0]
    params = {}
    if model_provider in model_params_dict:
        for key, value in DEFAULT_MODEL_KWARGS.items():
            # Max token supported for each model is different. This is mapped in commonUtil.MODEL_PROVIDER_MAX_TOKENS_MAP
            if key == "maxTokens":
                params[model_params_dict[model_provider][key]] = commonUtil.MODEL_PROVIDER_MAX_TOKENS_MAP.get(model_provider, DEFAULT_MODEL_KWARGS[key])
            else:
                params[model_params_dict[model_provider][key]] = model_params.get(key, value)
    return params

# pylint: disable=too-few-public-methods
# pylint: disable=too-many-instance-attributes
class ConversationObject():
    """This object is used to perform all the conversational chain related actions"""
    # pylint: disable=too-many-arguments
    def __init__(self, model_item, workspace_details, session_details, model_params, file_config, user_id, connection_id, message_id, query_start_time, retrieve_llm_trace):
        self.model_item = model_item
        self.user_id = user_id if user_id else ''
        self.workspace_details = workspace_details
        self.session_details = session_details
        self.model_params = model_params
        self.file_config = file_config
        self.connection_id = connection_id if connection_id else ''
        self.message_id = message_id
        self.query_start_time = query_start_time
        self.retrieve_llm_trace = retrieve_llm_trace

    def get_conversation_response(self, message: str):
        """
        This method returns the response of the conversation chain
        :param message: The message to be sent to the chatbot
        :return: The response of the conversation chain
        """
        LOGGER.info("In bedrockUtil.get_conversation_response method")
        model_name = self.model_item["ModelName"]
        model_provider = self.model_item["ModelProvider"]
        session_id = self.session_details["SessionId"]
        llm_args = {}
        # Adding the chat history to the global store (Useful for runnables later)
        CHAT_HISTORY_STORE[session_id] = self.session_details.get('History',[])
        # these params are needed in order for streaming and sending response to user
        if self.model_item["IsStreamingEnabled"] == "yes":
            llm_args.update({
                "streaming": True,
                "callbacks": [StreamingHandler(user_id=self.user_id, session_id=self.session_details["SessionId"], message_id=self.message_id)]
            })
        if model_provider == commonUtil.OPENAI_MODEL_PROVIDER:
            llm_args.update({'model_name': model_name})
            llm = ChatOpenAI(**llm_args)
        else:
            llm_args.update({
                'model_id': model_name,
                'model_kwargs': self.model_params,
                'client': BEDROCK_RUNTIME_CLIENT,
                'provider': commonUtil.MODEL_PROVIDER_MAP.get(model_provider.lower(), model_name.split('.')[0])
            })
            if model_provider.lower() in ["anthropic"]:
                llm = ChatBedrock(**llm_args)
            else:
                llm = BedrockLLM(**llm_args)
        LOGGER.info("In bedrockUtil.get_conversation_response, with message - %s", message)
        start_time = time.time()
        # Handling greeting messages
        chatbot_response = is_greeting(message, model_name, self.workspace_details["WorkspaceId"] if self.workspace_details else "N/A")
        if chatbot_response:
            ws_kwargs = {"ApiManagementClient": API_MANAGEMENT_CLIENT, "DynamoDBResource": DYNAMODB_RESOURCE, "SessionsTable": SESSIONS_TABLE}
            commonUtil.send_message_to_ws_connection(self.user_id, self.session_details["SessionId"], {"AIMessage": chatbot_response["content"], "Metadata": {"IsComplete": True, "MessageId": self.message_id}}, ws_kwargs)
            LOGGER.info("In bedrockUtil.get_conversation_response, identified a greeting message skipped LLM, LLM response time: 0, returning with response %s", chatbot_response["content"])
            return chatbot_response
        if self.file_config["UseOriginalFile"]:
            try:
                LOGGER.info("In bedrockUtil.get_conversation_response, getting response with file")
                filetype = self.file_config["FileName"].split('.')[-1]
                if filetype == 'csv':
                    # Use CSV Loader
                    history_aware_retriever = create_history_aware_retriever(
                        llm,
                        CSVRetriever(filename=self.file_config["FileName"], session_details=self.session_details),
                        get_condense_question_prompt()
                    )
                    combine_docs_chain = create_stuff_documents_chain(llm, get_qa_prompt(self.user_id))
                    conversation = create_retrieval_chain(history_aware_retriever, combine_docs_chain)

                    result = conversation.invoke({"input": f"{message} Use the data which is already loaded for answering the questions. DONOT SEARCH FOR EXTERNAL DATA"})
                    documents = [
                        {
                            "metadata": doc.metadata,
                        }
                        for doc in result["context"]
                    ]
                    chatbot_response = {
                        "content": result["answer"],
                        "metadata": {
                            "modelId": model_name,
                            "mode": CHAIN_TYPE["general-response"],
                            "modelKwargs": json.dumps(self.model_params),
                            "workspaceId": "N/A",
                            "documents": documents
                        }
                    }
                else:
                    # Using a Runnable with chat history for other file types
                    # Use of LCEL to create a prompt context chain for invoking via a history aware runnable.
                    LOGGER.info("In bedrockUtil.get_conversation_response, for non CSV files the session details - %s and file - %s",self.session_details, self.file_config["FileName"])
                    context_chain = get_contextful_prompt_using_file(self.session_details, self.file_config["FileName"]) | llm
                    conversation = RunnableWithMessageHistory(context_chain, get_memory_from_chat_history,
                        input_messages_key = "input",
                        history_messages_key = "chat_history")
                    answer = conversation.invoke(
                        {"input" : message},
                        config = {"configurable": {"session_id":session_id}},
                    )
                    chatbot_response = {
                        "content": answer.content,
                        "metadata": {
                            "modelId": model_name,
                            "mode": CHAIN_TYPE["general-response"],
                            "modelKwargs": json.dumps(self.model_params),
                            "workspaceId": "N/A",
                            "fileName": self.file_config["FileName"]
                        }
                    }
            except Exception as ex:
                if "too many tokens" in str(ex):
                    raise Exception(FILE_TOO_BIG_MESSAGE) from ex
                raise Exception(ex) from ex
        elif self.workspace_details:
            # For Workspaces, use of history aware retrievers (ConversationalRetrievalChain deprecated)
            LOGGER.info("In bedrockUtil.get_conversation_response, getting response with RAG engine")
            history_aware_retriever = create_history_aware_retriever(
                        llm,
                        get_workspace_retriever(workspace_details=self.workspace_details, user_id=self.user_id, connection_id=self.connection_id, session_id=self.session_details["SessionId"], message_id=self.message_id, query_start_time=self.query_start_time),
                        get_condense_question_prompt()
                    )
            combine_docs_chain = create_stuff_documents_chain(llm, get_qa_prompt(self.user_id))
            conversation = create_retrieval_chain(history_aware_retriever, combine_docs_chain)

            result = conversation.invoke({"input": message})
            documents = [
                {
                    "metadata": doc.metadata,
                    "page_content": doc.page_content
                }
                for doc in result["context"]
            ]
            chatbot_response = {
                "content": result["answer"],
                "metadata": {
                    "modelId": model_name,
                    "mode": CHAIN_TYPE["general-response"],
                    "modelKwargs": json.dumps(self.model_params),
                    "workspaceId": self.workspace_details["WorkspaceId"],
                    "documents": documents
                }
            }
        else:
            LOGGER.info("In bedrockUtil.get_conversation_response, getting normal conversation response")
            # For general conversations, using contextless prompt
            context_chain = get_contextless_prompt() | llm
            conversation = RunnableWithMessageHistory(context_chain, get_memory_from_chat_history,
                input_messages_key = "input",
                history_messages_key = "chat_history")
            answer = conversation.invoke(
                {"input" : message},
                config = {"configurable": {"session_id":session_id}}
            )

            chatbot_response = {
                "content": answer.content,
                "metadata": {
                    "modelId": model_name,
                    "mode": CHAIN_TYPE["general-response"],
                    "modelKwargs": json.dumps(self.model_params),
                    "workspaceId": "N/A"
                }
            }
        LOGGER.info("In bedrockUtil.get_conversation_response, LLM response time: %s", time.time() - start_time)
        LOGGER.info("In bedrockUtil.get_conversation_response, returning with response - %s", chatbot_response["content"])
        return chatbot_response

class SummarizationObject():
    """This object is used to perform all the summarization chain related actions"""
    def __init__(self, model_name, model_provider, model_params, file_config, summarization_metadata_dict, workspace_details):
        self.model_name = model_name
        self.model_provider = model_provider
        self.model_params = model_params
        self.file_config = file_config
        self.summarization_metadata_dict = summarization_metadata_dict
        self.workspace_details = workspace_details

    def get_text_summarization(self, message):
        """
        Wrapper function that invokes text summarization API
        """
        LOGGER.info("In bedrockUtil.get_text_summarization, input message is - %s", message)

        if self.workspace_details is None:
            LOGGER.info("In bedrockUtil.get_text_summarization, no workspace details are passed so defaulting")
            workspace_id = ""
        else:
            LOGGER.info("In bedrockUtil.get_text_summarization, workspace details are passed so fetching workspace id")
            workspace_id = self.workspace_details.get("WorkspaceId")
        invoke_payload={
            'ModelName': self.model_name,
            'ModelProvider': self.model_provider,
            'ModelParams': self.model_params,
            'FileConfig': self.file_config,
            'SessionId': self.summarization_metadata_dict["sessionId"],
            'UserId': self.summarization_metadata_dict["userId"],
            'WorkspaceId': workspace_id,
            'AgentInput': message
        }

        LOGGER.info("In bedrockUtil.get_text_summarization, lambda payload -%s", invoke_payload)

        lambda_response = commonUtil.invoke_lambda_function(lambda_client=self.summarization_metadata_dict["lambdaClient"],
                                                     function_name=self.summarization_metadata_dict["summarizationLambdaArn"],
                                                     payload=json.dumps(invoke_payload),
                                                     invocation_type='RequestResponse'
                                                     )
        lambda_response_body = lambda_response['Payload'].read().decode()
        LOGGER.info("In bedrockUtil.get_text_summarization, lambda response - %s, body is - %s", lambda_response, lambda_response_body)

        lambda_response_body = ast.literal_eval(ast.literal_eval(lambda_response_body)['body'])

        LOGGER.info("In bedrockUtil.get_text_summarization, formulating response for chat response")
        response = {
            "content": lambda_response_body['Message'],
            "metadata": {
                "modelId": self.model_name,
                "mode": CHAIN_TYPE["text-summarization"],
                "modelKwargs": json.dumps(self.model_params),
                "workspaceId": "N/A"
            }
        }

        LOGGER.info("In bedrockUtil.get_text_summarization, method completed with response -%s", response)

        return response

class VisualizationObject():
    """This class facilitates AI-powered data visualizations"""

    def __init__(self, model_item, model_params, file_config, session_details, auth_token, workspace_details, visualization_metadata_dict):
        LOGGER.info("In bedrockUtil.generate_visualizations, init method called")
        self.model_item = model_item
        self.model_params = model_params
        self.file_config = file_config
        self.session_details = session_details
        self.auth_token = auth_token
        self.workspace_details = workspace_details
        self.visualization_metadata_dict = visualization_metadata_dict

    def generate_visualizations(self, message):
        """
        Function to invoke underlying model and generate the visualizations. This function will generate the code for plotting the data
        and returns a S3 URL for UI to present it to the user
        """
        LOGGER.info("In bedrockUtil.generate_visualizations, input message is - %s", message)
        if self.model_item['IsStreamingEnabled'] != 'yes':
            LOGGER.error("In bedrockUtil.generate_visualizations, streaming is not enabled for the model. Please try another model.")
            raise Exception("Streaming is not enabled for the model. Please try another model.")

        model_name = self.model_item['ModelName']
        invoke_payload={
            'modelName': model_name,
            'fileConfig': self.file_config,
            'sessionDetails': self.session_details,
            'workspaceDetails': self.workspace_details,
            'agentInput': message
            }
        response = commonUtil.invoke_lambda_function(lambda_client=self.visualization_metadata_dict["lambdaClient"],
                                                     function_name=self.visualization_metadata_dict["visualizationsLambdaArn"],
                                                     payload=json.dumps(invoke_payload, default = commonUtil.DecimalEncoder),
                                                     invocation_type='RequestResponse'
                                                     )
        lambda_response_body = response['Payload'].read().decode()
        LOGGER.info("In bedrockUtil.generate_visualizations, lambda response - %s, body is - %s - %s", response, lambda_response_body, type(lambda_response_body))
        if response["ResponseMetadata"]["HTTPStatusCode"] != 200:
            LOGGER.error("In bedrockUtil.generate_visualizations, error: %s", lambda_response_body)
        lambda_response_body = ast.literal_eval(ast.literal_eval(lambda_response_body)['body'])
        LOGGER.info("In bedrockUtil.generate_visualizations, lambda response extracted - %s, - %s", lambda_response_body, type(lambda_response_body))
        tool_response = {
            "content": "<p>Please find the visualization below: <a href='{0}'>click here to download</a> </p><br/><img src='{0}' alt='Image' height= '1600' width= '720'>".format(lambda_response_body["presignedUrl"]) \
                        if "success" in lambda_response_body.get("message", "failed") else lambda_response_body.get("message", "Unable to generate the plot, please retry"),
            "metadata": {
                "modelId": model_name,
                "mode": "N/A",
                "modelKwargs": json.dumps(self.model_params),
                "workspaceId": "N/A"
            }
        }
        return tool_response

# pylint: disable=too-many-arguments
def define_tools(model_item, model_params, session_details, file_config, user_id, summarization_metadata_dict, visualization_metadata_dict, workspace_details, connection_id, message_id, query_start_time, retrieve_llm_trace):
    """
    Utility function to define the tools
    """
    LOGGER.info("In bedrockUtil.define_tools")
    conversational_object = ConversationObject(model_item, workspace_details, session_details, model_params, file_config, user_id, connection_id, message_id, query_start_time, retrieve_llm_trace)
    summarization_object = SummarizationObject(model_item["ModelName"], model_item["ModelProvider"], model_params, file_config, summarization_metadata_dict, workspace_details)
    visualization_object = VisualizationObject(model_item, model_params, file_config, session_details, visualization_metadata_dict["authToken"], workspace_details, visualization_metadata_dict)

    tools = [
                Tool.from_function(
                    func=conversational_object.get_conversation_response,
                    name="getConversationResponse",
                    description="useful for when you need to converse with the chatbot. This is the default tool. Do not modify the user input. Pass the entire agent input as the action input to this tool",
                    return_direct=True
                ),
                Tool.from_function(
                    func=summarization_object.get_text_summarization,
                    name="getTextSummarization",
                    description="""
                    Useful for when user needs to summarize a text. User will need to specify a valid file name (.txt or .pdf) in the prompt. Only pass the name of the file as input message into the function.
                    The prompt should contain keywords like summarize or summary.
                    """,
                    return_direct=True
                ),
                Tool.from_function(
                    func=visualization_object.generate_visualizations,
                    name="getAIVisuals",
                    description="Tool to plot user data. User will to specify the file name and the type of graph in the prompt. The prompt should contain keywords like plot or graph or subplot.",
                    return_direct=True
                )
    ]

    LOGGER.info("In bedrockUtil.define_tools, exiting with tools: %s", tools)
    return tools

def initialize_langchain_agent(bedrock_runtime_client, model_item, model_params, tools, session_details, workspace_details):
    """
    Utility function to initialize langchain agent
    """
    LOGGER.info("In bedrockUtil.initialize_langchain_agent, session id - %s", session_details["SessionId"])

    model_name = model_item["ModelName"]
    LOGGER.info("In bedrockUtil.initialize_langchain_agent, model name - %s", model_name)
    model_provider = model_item["ModelProvider"] if model_item["ModelProvider"] == commonUtil.OPENAI_MODEL_PROVIDER else commonUtil.MODEL_PROVIDER_MAP.get(model_item["ModelProvider"].lower(), model_name.split('.')[0])

    if model_provider == commonUtil.OPENAI_MODEL_PROVIDER:
        llm = ChatOpenAI(model_name=model_name)
    elif model_provider.lower() == "anthropic":
        llm = ChatBedrock(model_id=model_name, model_kwargs=model_params, client=bedrock_runtime_client, provider=model_provider.lower())
    else:
        llm = BedrockLLM(model_id=model_name, model_kwargs=model_params, client=bedrock_runtime_client, provider=model_provider.lower())

    LOGGER.info("In bedrockUtil.initialize_langchain_agent, initializing the agents")

    system = """ Respond the following questions as best you can to the human. Do no respond on your own. Use any one of the tools always. Do not give coded answers unless specified.
                If you don't know which tool to use, use the getConversationResponse(used to converse with the chatbot. this is the default tool to be used. Answer questions about specific data from the file the user provides which requires analyzing data from a file. This should NOT BE CALLED WHEN SUMMARY IS REQUESTED) tool. 
                Use getTextSummarization(Use this only if the input contains keywords 'summary' or 'summarize') when asked specifically to summarize.
                Use getAIVisuals(Use this only if the input contains keywords 'plot' or 'draw' or 'graph' or 'visualize') when asked specifically to get visual or graphs on the data.
                If you are not sure about the tool to use, use the getConversationResponse tool. If you are not sure about the input to the tool, use the getConversationResponse tool.

        {tools}

        Use a json blob to specify a tool by providing an action key (tool name) and an action_input key (tool input).
        Valid "action" values: "Final Answer" or {tool_names}
        "action_input" should only be of type string. Do not include the data type.
        Provide only ONE action per $JSON_BLOB, as shown:

        ```
        {{
        "action": $TOOL_NAME,
        "action_input": $INPUT
        }}
        ```

        Follow this format:

        Question: input question to answer
        Thought: consider previous and subsequent steps
        Action:
        ```
        $JSON_BLOB
        ```
        Observation: action result
        ... (repeat Thought/Action/Observation N times)
        Thought: I know what to respond
        Action:
        ```
        {{
        "action": "Final Answer",
        "action_input": "Final response to human"
        }}

        Begin! Reminder to ALWAYS respond with a valid json blob of a single action. Use tools if necessary. Respond directly if appropriate. Format is Action:```$JSON_BLOB```then Observation'''
        """
    human = """
        Question: {input}
        Thought:{agent_scratchpad}
        (reminder to respond in a JSON blob no matter what)
        """

    prompt = ChatPromptTemplate([
    ("system", system),
    MessagesPlaceholder(variable_name="chat_history", optional=True),
    ("human", human),]
    )

    # Using Structured agents with support for tools with multiple inputs.
    agent = create_structured_chat_agent(llm, tools, prompt)
    LOGGER.info("In bedrockUtil.initialize_langchain_agent, initializing complete with workspace details - %s", workspace_details)

    return agent

def get_chatbot_response(user_id, connection_id, message_id, model_item, workspace_details, session_details, message, summarization_metadata_dict, visualization_metadata_dict, **kwargs):
    """
    This method sends the user's message to the chatbot and returns the response.
    :param model_name: The name of the model to use.
    :param workspace_details: The ID of the workspace to use.
    :param session_details: The session details.
    :param message: The message to send to the chatbot.
    :return: The response from the chatbot.
    """
    LOGGER.info("In bedrockUtil.get_chatbot_response method with kwargs: %s", kwargs)
    # pylint: disable=global-statement
    global BEDROCK_RUNTIME_CLIENT, S3_CLIENT, DATASET_FILES_LAMBDA, LAMBDA_CLIENT, API_MANAGEMENT_CLIENT, DYNAMODB_RESOURCE, SESSIONS_TABLE, CHAT_HISTORY_TABLE, WORKSPACES_DOCUMENTS_TABLE, CHATBOTS_TABLE
    BEDROCK_RUNTIME_CLIENT = kwargs["Boto3Clients"]["BedrockRuntimeClient"]
    S3_CLIENT = kwargs["Boto3Clients"]["S3Client"]
    LAMBDA_CLIENT = kwargs["Boto3Clients"]["LambdaClient"]
    API_MANAGEMENT_CLIENT = kwargs["Boto3Clients"]["ApiManagementClient"]
    DYNAMODB_RESOURCE = kwargs["Boto3Clients"]["DynamoDBResource"]
    SESSIONS_TABLE = kwargs["SessionsTable"]
    CHAT_HISTORY_TABLE = kwargs["ChatHistoryTable"]
    DATASET_FILES_LAMBDA = kwargs["DatasetFilesLambda"]
    WORKSPACES_DOCUMENTS_TABLE = kwargs["WorkspacesDocumentsTable"]

    if kwargs.get("IsExternalChatbot", False):
        CHATBOTS_TABLE = kwargs["ChatbotsTable"]

    query_start_time = kwargs["QueryStartTime"]
    model_name = model_item["ModelName"]
    model_provider = model_item["ModelProvider"]
    if model_item["ModelType"] == "Custom" or model_provider == commonUtil.OPENAI_MODEL_PROVIDER:
        model_params = None
    else:
        model_params = get_model_params(model_name, kwargs.get("ModelParams", {}))
    file_config = {'UseOriginalFile': kwargs.get('UseOriginalFile', False), 'FileName': kwargs.get('FileName', '')}
    retrieve_llm_trace = bool(kwargs.get("RetrieveLLMTrace", False))
    LOGGER.info("In bedrockUtil.get_chatbot_response method, with debugging - %s ", retrieve_llm_trace)

    # Only using langchain agent with Anthropic and OpenAI models as other model performance is bad
    if kwargs.get("IsExternalChatbot", False) or commonUtil.MODEL_PROVIDER_MAP[model_provider.lower()] not in ["anthropic", "openai"]:
        conversational_object = ConversationObject(model_item, workspace_details, session_details, model_params, file_config, user_id, connection_id, message_id, query_start_time, retrieve_llm_trace)
        response = conversational_object.get_conversation_response(message)
    else:
        tools = define_tools(model_item, model_params, session_details, file_config, user_id, summarization_metadata_dict, visualization_metadata_dict, workspace_details, connection_id, message_id, query_start_time, retrieve_llm_trace)
        agent = initialize_langchain_agent(BEDROCK_RUNTIME_CLIENT, model_item, model_params, tools, session_details, workspace_details)
        agent_executor = AgentExecutor(agent=agent, tools=tools,max_iterations=3, early_stopping_method='force',
                                       handle_parsing_errors=True, return_intermediate_steps=True, verbose=retrieve_llm_trace)

        chatbot_response = agent_executor.invoke({'input': message})
        LOGGER.info("In bedrockUtil.get_chatbot_response method, chatbot response - %s", chatbot_response)
        # if summarization tool was used send response to user
        if "tool='getTextSummarization'" in str(chatbot_response["intermediate_steps"]) or "tool='getAIVisuals'" in str(chatbot_response["intermediate_steps"]):
            ts_message_time = commonUtil.get_current_time()
            ts_response_time = str((datetime.strptime(ts_message_time, commonUtil.DATETIME_ISO_FORMAT) - datetime.strptime(query_start_time, commonUtil.DATETIME_ISO_FORMAT)).total_seconds() * 1000)
            commonUtil.send_message_to_ws_connection(
                        user_id,
                        session_details["SessionId"],
                        {"AIMessage": chatbot_response.get("output").get("content"),
                         "Metadata": {"IsComplete": True, "MessageId": message_id, "ResponseTime": ts_response_time}},
                        {"ApiManagementClient": API_MANAGEMENT_CLIENT, "DynamoDBResource": DYNAMODB_RESOURCE, "SessionsTable": SESSIONS_TABLE}
            )
        response = chatbot_response["output"]

    LOGGER.info("In bedrockUtil.get_chatbot_response method, exiting")
    return response
