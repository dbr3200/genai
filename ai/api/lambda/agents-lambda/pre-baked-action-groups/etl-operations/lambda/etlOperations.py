"""
This lambda is for etl operations pre-baked action group.
This action group is designed to perform operations on amorphic etl components.
They can invoke APIs based on the inference from the model to perform the required action.
Possible operations include:
1. List all jobs accessible to the user
2. Get details of a job
3. List all executions of a job (max 5)
4. Run a job
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
    PROJECTSHORTNAME = os.environ['projectShortName']

    STAGE_URL_PARAMETER_NAME = 'AMORPHIC.APIGATEWAY.APIURLWITHSTAGE'
    STAGE_URL = actionGroupUtil.get_decrypted_value(STAGE_URL_PARAMETER_NAME)
    SSM_CLIENT = boto3.client('ssm', AWS_REGION)
    EVENT_CLIENT = boto3.client('events', AWS_REGION )
    DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)

    USERS_TABLE = actionGroupUtil.USERS_TABLE
    SESSIONS_TABLE = actionGroupUtil.SESSIONS_TABLE
    SESSIONS_TABLE_SESSIONID_INDEX = actionGroupUtil.SESSIONS_TABLE_SESSIONID_INDEX
    AMORPHIC_JOBS_TABLE = actionGroupUtil.AMORPHIC_JOBS_TABLE
    AMORPHIC_JOBS_TABLE_INDEX_NAME = actionGroupUtil.AMORPHIC_JOBS_TABLE_INDEX_NAME

    JOBS_DETAILS_FIELDS = ['Id','JobName','PythonVersion','GlueVersion','DefaultArguments',
                               'NetworkConfiguration','LastModifiedBy','Keywords','SecurityConfiguration','ScriptLocation',
                               'IsDataLineageEnabled','IsActive','Description','NumberOfWorkers','RoleUsed',
                               'LastModified','WorkerType','CreationTime','ETLJobType',
                               'CreatedBy','RegistrationStatus','JobBookmarkOption','IsAutoScalingEnabled']

    JOBS_EXECUTIONS_FIELDS = ['ErrorMessage','StartedOn','JobRunState','Id',
                               'CompletedOn','StartTime']

    EXECUTE_JOB_FIELDS = ['WorkerType','NumberOfWorkers','DefaultArguments','GlueVersion',
                               'JobBookmarkOption','JobName','NetworkConfiguration','PythonVersion','IsAutoScalingEnabled']

except Exception as ex:
    LOGGER.error("In etlOperations.py, Failed to load environment variables with error: %s", str(ex))
    sys.exit()


def lambda_handler(event, context):
    """"
    This lambda function handles all etl actions related API's
    """
    LOGGER.info("In etlOperations.lambda_handler, entering method with event - %s and context - %s", event, context)

    event_parameters = event.get('parameters', [])
    LOGGER.info("In etlOperations.lambda_handler, event parameters - %s", event_parameters)

    session_id = event.get('sessionId', '')
    user_id = actionGroupUtil.get_user_id(session_id, SESSIONS_TABLE, SESSIONS_TABLE_SESSIONID_INDEX)
    user_id_from_input = actionGroupUtil.get_parameter_from_event(event_parameters, "userId")
    # user_id = actionGroupUtil.get_parameter_from_event(event_parameters, "userId")
    LOGGER.info("In etlOperations.lambda_handler, fetching auth token and role id for user - %s", user_id)
    role_id, auth_token = actionGroupUtil.get_auth_token_role_id(user_id, USERS_TABLE)
    api_headers = {
        "role_id": role_id,
        "authorization": auth_token
    }
    LOGGER.info("In etlOperations.lambda_handler, setting api headers - %s", api_headers)

    response_code = 200
    action_group = event['actionGroup']
    api_path = event['apiPath']
    http_method = event['httpMethod']
    LOGGER.info("In etlOperations.lambda_handler, api path inferred - %s, action group - %s, http method - %s", api_path, action_group, http_method)

    if api_path == '/jobs' and http_method == 'GET':
        # api inferred is GET /jobs so listing jobs
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 400
            body = {"message": "Access denied. Unable to list another user's jobs."}
        else:
            LOGGER.info("In etlOperations.lambda_handler, making api request..")
            request_url = f"{STAGE_URL}/jobs"
            response = requests.get(url=request_url, headers=api_headers)
            jobs_list_api_response = response.json()
            LOGGER.info("In etlOperations.lambda_handler, response from api call in json - %s", jobs_list_api_response)

            jobs_list = [f"{job['JobName']}" for job in jobs_list_api_response['jobs']]
            LOGGER.info("In etlOperations.lambda_handler, list of jobs - %s", jobs_list)
            response_code, body = 200, {"jobs": jobs_list}

    elif api_path == '/jobs/{job_name}' and http_method == 'GET':
        # api inferred is GET /jobs/job_name so getting details of a job
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 404
            body = {"message": "Access denied. Unable to get details of another user's job."}
        else:
            job_name = actionGroupUtil.get_parameter_from_event(event_parameters, "jobName")
            LOGGER.info("In etlOperations.lambda_handler, job name inferred - %s", job_name)
            job_item = actionGroupUtil.get_item_from_resource_name("job", job_name, DYNAMODB_RESOURCE.Table(AMORPHIC_JOBS_TABLE), AMORPHIC_JOBS_TABLE_INDEX_NAME)
            if job_item:
                job_id = job_item['Id']
                request_url = f"{STAGE_URL}/jobs/{job_id}"
                response = requests.get(url=request_url, headers=api_headers)
                job_details_api_response = response.json()
                LOGGER.info("In etlOperations.lambda_handler, response from api call in json - %s", job_details_api_response)
                if "Message" in job_details_api_response and "AUTH-1010" in job_details_api_response['Message']:
                    LOGGER.info("In etlOperations.lambda_handler, user is not authorized to the job.")
                    response_code, body = 403, {"message": f"User is not authorized to get the details of the job {job_name}."}
                else:
                    job_details = {job_field: job_details_api_response[job_field] for job_field in JOBS_DETAILS_FIELDS if job_field in job_details_api_response}
                    LOGGER.info("In etlOperations.lambda_handler, job details - %s", job_details)
                    response_code, body = 200, {"job": job_details}
            else:
                LOGGER.info("In etlOperations.lambda_handler, no such job exists.")
                response_code, body = 402, {"message": f"No such job exists with the name {job_name}."}

    elif api_path == '/jobs/{job_name}/executions' and http_method == 'GET':
        # api inferred is GET /jobs/job_name/executions so getting executions of a job
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 405
            body = {"message": "Access denied. Unable to list executions of another user's job."}
        else:
            job_name = actionGroupUtil.get_parameter_from_event(event_parameters, "jobName")
            LOGGER.info("In etlOperations.lambda_handler, job name inferred - %s", job_name)
            job_item = actionGroupUtil.get_item_from_resource_name("job", job_name, DYNAMODB_RESOURCE.Table(AMORPHIC_JOBS_TABLE), AMORPHIC_JOBS_TABLE_INDEX_NAME)
            if job_item:
                job_id = job_item['Id']
                request_url = f"{STAGE_URL}/jobs/{job_id}/executions"
                response = requests.get(url=request_url, headers=api_headers)
                job_executions_api_response = response.json()
                LOGGER.info("In etlOperations.lambda_handler, response from api call in json - %s", job_executions_api_response)
                if "Message" in job_executions_api_response and "AUTH-1010" in job_executions_api_response['Message']:
                    LOGGER.info("In etlOperations.lambda_handler, user is not authorized to the job.")
                    response_code, body = 403, {"message": f"User is not authorized to get the execution details of the job {job_name}."}
                elif not job_executions_api_response['JobExecutions']:
                    LOGGER.info("In etlOperations.lambda_handler, no executions found for the job.")
                    response_code, body = 404, {"message": f"No executions found for the job {job_name}."}
                else:
                    job_executions = [
                        {
                            execution_field: execution[execution_field] for execution_field in JOBS_EXECUTIONS_FIELDS if execution_field in execution
                        } for execution in job_executions_api_response['JobExecutions']
                    ]
                    LOGGER.info("In etlOperations.lambda_handler, job executions - %s", job_executions)
                    response_code, body = 200, {"executions": job_executions}
            else:
                LOGGER.info("In etlOperations.lambda_handler, no such job exists.")
                response_code, body = 402, {"message": f"No such job exists with the name {job_name}."}

    elif api_path == '/jobs/{job_name}/executions' and http_method == 'POST':
        # api inferred is POST /jobs/job_name/executions so executing the job
        if user_id_from_input and user_id_from_input != user_id:
            LOGGER.info("In datasetOperations.lambda_handler, userid inferred from input is not same as user id so throwing access denied error")
            response_code = 404
            body = {"message": "Access denied. Unable to run another user's job."}
        else:
            job_name = actionGroupUtil.get_parameter_from_event(event_parameters, "JobName")
            LOGGER.info("In etlOperations.lambda_handler, job name inferred - %s", job_name)
            job_item = actionGroupUtil.get_item_from_resource_name("job", job_name, DYNAMODB_RESOURCE.Table(AMORPHIC_JOBS_TABLE), AMORPHIC_JOBS_TABLE_INDEX_NAME)
            if job_item:
                job_id = job_item['Id']
                request_url = f"{STAGE_URL}/jobs/{job_id}/executions"
                input_body = {}
                for input_field in EXECUTE_JOB_FIELDS:
                    input_body.update({
                        input_field: json.loads(actionGroupUtil.get_parameter_from_event(event_parameters, input_field)) if input_field in ["DefaultArguments", "IsAutoScalingEnabled"] else actionGroupUtil.get_parameter_from_event(event_parameters, input_field)
                    })
                LOGGER.info("In etlOperations.lambda_handler, input body for execute job call - %s", input_body)
                response = requests.post(url=request_url, json=input_body, headers=api_headers)
                job_executions_api_response = response.json()
                LOGGER.info("In etlOperations.lambda_handler, response from api call in json - %s", job_executions_api_response)
                if "Message" in job_executions_api_response and "AUTH-1010" in job_executions_api_response['Message']:
                    LOGGER.info("In etlOperations.lambda_handler, user is not authorized to the job.")
                    response_code, body = 403, {"message": f"User is not authorized to execute the job {job_name}."}
                else:
                    LOGGER.info("In etlOperations.lambda_handler, successfully triggered job execution")
                    response_code, body = 200, {"message": f"Successfully triggered job execution for {job_name}"}
            else:
                LOGGER.info("In etlOperations.lambda_handler, no such job exists.")
                response_code, body = 402, {"message": f"No such job exists with the name {job_name}."}

    else:
        body = {f"{action_group}::{api_path} is not a valid api, try another one."}

    # now formatting the response from model into valid agent response
    LOGGER.info("In etlOperations.lambda_handler, formatting return response from agent")
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

    LOGGER.info("In etlOperations.lambda_handler, return response from agent - %s", api_response)
    return api_response
