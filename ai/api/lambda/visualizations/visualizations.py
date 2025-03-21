"""
This lambda facilitates AI-powered data visualizations
"""
import os
import sys
import json
import time
import re
from io import StringIO
import logging

import pandas as pd

import boto3
from botocore.client import Config

import commonUtil
import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading Function - %s", "visualizations.py")

try:
    LOGGER.info("In visualizations.py, Loading environment variables...")
    AWS_REGION = os.environ['awsRegion']
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    ENVIRONMENT = os.environ['environment']
    SESSION_FILES_BUCKET_NAME = os.environ['sessionFilesBucketName']
    AWS_USE_FIPS_ENDPOINT = os.environ["AWS_USE_FIPS_ENDPOINT"]
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
    S3_ENDPOINT_URL = f"https://s3.{AWS_REGION}.amazonaws.com" if AWS_USE_FIPS_ENDPOINT == 'False' else f"https://s3-fips.{AWS_REGION}.amazonaws.com"
    S3_RESOURCE = boto3.resource("s3", endpoint_url=S3_ENDPOINT_URL, region_name=AWS_REGION, config=Config(signature_version='s3v4', s3 ={"addressing_style":"virtual"}))
    LAMBDA_CLIENT = boto3.client('lambda', AWS_REGION)
    BEDROCK_RUNTIME_CLIENT = boto3.client('bedrock-runtime', AWS_REGION)

    DEFAULT_VISUALS_MODEL_NAME = "anthropic.claude-v2" # This is the default model we use for generating visuals
    ANTHROPIC_VERSION = "bedrock-2023-05-31"

    EVENT_INFO = {}
except Exception as ex:
    LOGGER.error("In visualizations.py, Failed to load environment variables. error: %s", str(ex))
    sys.exit()


def lambda_handler(event, context):
    """
    This Lambda function is to handle user visualization requests
    :param event: event information
    :type event: dict
    :param context: runtime information to the handler.
    :type context: LambdaContext
    :return: response to the api
    :rtype: dict
    """
    LOGGER.info("In visualizations.lambda_handler")
    try:
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
        LOGGER.info("In visualizations.lambda_handler, event - %s", event)
        #input_payload = json.loads(event['body'])
        input_payload = event
        response = {
            'message': 'N/A', # This will contain both success and error messages if any
            'presignedUrl': 'N/A' # This is the pre-signed url for the UI to show in the front end
            }
        # Step - I: Validate the input file type. Supported file types are [csv, tsv, xlsx].
        # If validations fails return "Unable to generate visuals message"
        doc_file_path = content = None
        if bool(input_payload['fileConfig']["UseOriginalFile"]):
            LOGGER.info("In visualizations.lambda_handler, input file is the original file")
            doc_file_path = f"chat-sessions/{input_payload['sessionDetails']['UserId']}/{input_payload['sessionDetails']['SessionId']}/{input_payload['fileConfig']['FileName']}"
            s3_doc_file = S3_RESOURCE.meta.client.get_object(Bucket=SESSION_FILES_BUCKET_NAME, Key=doc_file_path)
            content = s3_doc_file['Body'].read().decode('utf-8')
            LOGGER.info("In visualizations.lambda_handler, input file path is - %s", s3_doc_file)
        else:
            # We need to fetch the file from the dynamodb metadata and feed it to the tool, currently this target is not supported
            response['message'] = 'Unsupported file destination for visualizations. Currently only session files are supported for visualizations'
            raise Exception(response['message'])
        data_frame, column_names = fetch_input_data_from_files(doc_file_path, content)
        if not data_frame.empty and not column_names.empty:
            # If validations succeeds return the messages from the model outputs in a structured format
            response['message'], response['presignedUrl']  = handle_user_query(data_frame, column_names, input_payload)
        else:
            response['message'] = 'Unsupported file type for visualizations. Allowed types are [csv, tsv, xlsx, xls, parquet]'
            raise Exception(response['message'])
        response = commonUtil.build_post_response(200, response)
        LOGGER.info("In visualizations.lambda_handler, completed processing the visualization with response - %s", response)

    except Exception as exc:
        LOGGER.error("In visualizations.lambda_handler, Exception occurred with error %s", exc)
        response = commonUtil.build_generic_response(500, {'message': str(exc)})
    return response

# pylint: disable=W0122
def run_visualization(code, input_payload):
    """
    Runs the code generated by the model to generate the visualizations, save it s3 and generate a pre-signed url for displaying
    :param raw_output_code: Raw code generated from the model output
    :return: Return the extracted Python code
    """
    LOGGER.info("In visualizations.run_visualization with code: %s", code)
    try:
        # Execute the code
        response = None
        bucket = os.environ['sessionFilesBucketName']
        exec(code)
        local_file_name = "/tmp/visuals.png"
        LOGGER.info("In visualizations.run_visualization, completed executing code")
        if not os.path.exists(local_file_name):
            LOGGER.error("In visualizations.run_visualization, failed to export the plot image please check the code generated")
            raise Exception("Unable to export visualizations generated")
        s3_key_name = f"{int(time.time())}_plot.png"
        object_name = f"chat-sessions/{input_payload['sessionDetails']['UserId']}/{input_payload['sessionDetails']['SessionId']}/{s3_key_name}"
        LOGGER.info("In visualizations.run_visualization, file being uploaded to bucket  - %s, with name - %s from local file - %s", bucket, object_name, local_file_name)
        commonUtil.s3_upload_file_with_status(S3_RESOURCE.meta.client, local_file_name, bucket, object_name)
        # Uploading is done, generating the pre-signed url for the chat response. An expiry of 24 hours is set the the visualization presigned url
        presigned_url = commonUtil.get_presigned_url_get_object(S3_RESOURCE.meta.client, bucket, object_name, s3_key_name, expiration_in_seconds=86400)
        LOGGER.info("In visualizations.run_visualization, presigned url - %s", presigned_url)
        response = {'message': 'success', 'presigned_url': presigned_url}
        # Cleanup the /tmp directory
        if os.path.exists(local_file_name):
            os.remove(local_file_name)
    except Exception as ex:
        # Handle the exception and print an error message
        LOGGER.error("In visualizations.run_visualization, failed to run the visualizations - %s", {str(ex)})
        error_message = "failed to generate visualizations. Error encountered: {}".format(str(ex))
        response = {'message': error_message, 'presigned_url': 'N/A'}
    return response['message'], response['presigned_url']

def extract_code_from_markdown(raw_output_code):
    """
    Extract Python code from markdown text.
    :param raw_output_code: Raw code generated from the model output
    :return: Return the extracted Python code
    """
    LOGGER.info("In visualizations.extract_code_from_markdown, entering with raw_code: %s", raw_output_code)
    # Extract code between the delimiters
    code_blocks = re.findall(r"```(python)?(.*?)```", raw_output_code, re.DOTALL)
    LOGGER.info("In visualizations.extract_code_from_markdown, code blocks to generate code are: %s", code_blocks)
    # Strip leading and trailing whitespace and join the code blocks
    code = "\n".join([block[1].strip() for block in code_blocks])
    LOGGER.info("In visualizations.extract_code_from_markdown, generated code is - %s,", code)
    return code

def handle_user_query(data_frame, column_names, input_payload):
    """
    Handle the User query and display the response.

    :param data_frame: DataFrame containing the data
    :param column_names: List of column names in the DataFrame
    :param input_payload: Lambda payload containing user query and other details
    :return: Return the python code generated by the model based on the question user asked

    """
    LOGGER.info("In visualizations.handle_user_query, input variables are data_frame - %s, column names - %s, input payload - %s ", data_frame, column_names, input_payload)

    # Sample query will look like: "Plot a pie chart on number of people from each state"
    # Ensure the query is not empty
    query = input_payload["agentInput"]
    modelname = input_payload['modelName']
    LOGGER.info("In visualizations.handle_user_query, modelname is - %s", modelname)
    max_retries = 3
    for attempt in range(max_retries):
        try:
            if query and query.strip() != "":
                # Define the prompt content
                prompt = f"""
                The dataset is ALREADY loaded into a DataFrame named 'data_frame'. DO NOT attempt to load the data again programmatically.

                The DataFrame has the following columns: {column_names}

                Before plotting, ensure the data is ready:

                Write code to show AND save the graph to local directory '/tmp/' AND name the file 'visuals.png'
                Provide SINGLE CODE BLOCK with a solution using Pandas and Matplotlib plots in a single figure to address the following query:

                {query}

                VALIDATIONS INSTRUCTIONS:
                - If the query CANNOT be answered with the available data, respond with ONLY: ```INVALID_QUERY```.
                - Do not generate anything else if the query is irrelevant to the provided data. Do not generate code if query validations fail, instead respond with ONLY: ```INVALID_QUERY```
                - The query needs to be answered using the given dataframe and columns only. DO NOT attempt to create new columns.
                - If the query CAN be answered, follow these steps:
                    1. Check if columns required for axis that are supposed to be numeric are recognized as such. If not, attempt to convert them.
                    2. Handle NaN values by filling with mean or median if numeric, else "NA".

                VISUALIZATION INSTRUCTIONS:
                - Use only the following packages for code generation: pandas , matplotlib
                - USE SINGLE CODE BLOCK with a solution.
                - Do NOT EXPLAIN the code
                - DO NOT COMMENT the code.
                - ALWAYS WRAP UP THE CODE IN A SINGLE CODE BLOCK.
                - The code block must start and end with ```

                - Example code format ```code```

                - Colors to use for background and axes of the figure : #F0F0F6
                - The minimum figure size should be 15inches * 8inches
                - Labels for axis should be there and legible. X axis labels should also be rotated by 90 degrees and legible.
                - Try to use only among the following color palette for coloring the plots : #001219 #005f73 #0a9396 #94d2bd #e9d8a6 #ee9b00 #ca6702 #bb3e03 #ae2012 #9b2226 [Use only as per requirement]

                RESPONSE FORMAT:
                    - If query is invalid: ```INVALID_QUERY```
                    - If query is valid: ```python
                        [Your visualization code here]
                        ```

                YOUR RESPONSE MUST:
                - Start with ```python (for valid code) or ```INVALID_QUERY``` (for invalid queries)
                - End with ```
                - Contain no text outside the code block

                DO NOT include any explanations or comments in your response. Make sure final output is encapsulated in ```.
                """
                prompt_content = "Human: " + prompt + "\n\nAssistant:"
                user_message = {"role": "user", "content": prompt_content}
                # Call bedrock and display the response
                body = json.dumps(
                    {
                        "anthropic_version": ANTHROPIC_VERSION,
                        # Lower token count may lead to incomplete generation of visual code which leads to failure in generation of the visual itself as the determines the max length of output as well.
                        "max_tokens": 800,
                        "system": "Act as a visual generation tool which using the instructions provided in the messages to generates visuals.",
                        "messages": [user_message]
                    }
                )
                try:
                    response = BEDROCK_RUNTIME_CLIENT.invoke_model_with_response_stream(modelId=modelname,
                                                                                        body=body
                                                                                        )
                except Exception as ex:
                    LOGGER.error("In visualizations.handle_user_query, failed to invoke the model with the prompt - %s", prompt_content)
                    err_message = f"Unable to generate visualizations for the given query: {ex}"
                    return err_message, "N/A"
                # Retrieve the streaming response from the model and collect it
                LOGGER.info("In visualizations.handle_user_query, response from the model - %s", response)
                # Support for anthropic models only as currently using bedrock client for calls and OpenAI not supported by Bedrock.
                stream = response.get("body")
                output = []
                cur_chunk_list = []
                if stream:
                    for event in stream:
                        chunk = event.get("chunk")
                        if chunk:
                            output_dict = json.loads(chunk.get("bytes").decode())
                            if output_dict['type'] == 'content_block_delta':
                                cur_chunk_list.append(output_dict['delta']['text'])
                            if len(cur_chunk_list) >= 40:
                                output.extend(cur_chunk_list)
                                cur_chunk_list = []
                    if cur_chunk_list:
                        output.extend(cur_chunk_list)
                else:
                    LOGGER.info("In visualizations.handle_user_query, unable to generate the response from the model - %s", response.get("body"))
                    return None
                # Clean up the code and generate the visualization
                raw_output_code = "".join(output)
                if "INVALID_QUERY" in raw_output_code:
                    LOGGER.error("In visualizations.handle_user_query, invalid query passed to the model.")
                    error_message = "Unable to generate visualizations for the given query. Please try again with a valid query."
                    return error_message, "N/A"
                code = extract_code_from_markdown(raw_output_code)
                response_message, response_url = run_visualization(code, input_payload) if code else ("Unable to extract code from the model output", "N/A")
                LOGGER.info("In visualization.handle_user_query, response from run retrieved: %s", response_message)
                if response_message == "success":
                    return response_message, response_url
                raise Exception(f"{response_message}")
        except Exception as ex:
            LOGGER.error("In visualization.handle_user_query, attempt %d failed to generate visuals with %s", attempt+1, str(ex))
            if attempt < max_retries -1:
                LOGGER.info("In visualization.handle_user_query, Retrying...")
            else:
                LOGGER.error("In visualization.handle_user_query, All attempts failed")
                response_message = f"Unable to generate visualizations for the given query: {ex}"
                return response_message, "N/A"

def fetch_input_data_from_files(input_file, content):
    """
    Reads the input data to retrieve the records and the column names from it
    :param input_file: File on which the user requested visuals
    :return: Return the pandas dataframe and the column names
    """
    LOGGER.info("In visualizations.fetch_input_data_from_files, input file is - %s", input_file)
    supported_file_types = ["csv", "tsv", "xlsx", "xls", "parquet"]
    # pylint: disable=global-statement,C0103,W0601
    global data_frame
    if input_file.split(".")[-1] in supported_file_types:
        # Check the type of file uploaded and read accordingly
        if input_file.endswith('.csv'):
            data_frame = pd.read_csv(StringIO(content))
        elif input_file.endswith('.tsv'):
            data_frame = pd.read_csv(StringIO(content), sep='\t')
        elif input_file.endswith('.xlsx') or input_file.endswith('.xls'):
            data_frame = pd.read_excel(content)
        elif input_file.endswith('.parquet'):
            data_frame = pd.read_parquet(content)
        else:
            data_frame = None
        column_names = data_frame.columns if not data_frame.empty else None
        LOGGER.info("In visualizations.fetch_input_data_from_files, input data frame read is - %s, columns retrieved - %s", data_frame, column_names)
        return data_frame, column_names
    else:
        LOGGER.error("In visualizations.run_visualization, failed to read input file as the file format is not supported - %s ", input_file)
        return None, None
