"""
######################################################################################################
# File: traceDashboard.py
#
# Below are the operations we do as part of this Lambda
#
#    1. Get all dashboard details
#    2. Create a dashboard
#    2. Delete a dashboard
#
# Modification History:
# ====================================================================
# Date                 Who                       Description
# ==========      =================     ==============================
# 01/07/2024         Keerthana                 Initial commit
#########################################################################################################
"""
import logging
import os
import sys
import json
import requests
import boto3

import commonUtil
import errorUtil
import dynamodbUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

LOGGER.info("Loading traceDashboards Lambda Function")

try:
    AWS_REGION = os.environ["awsRegion"]
    TRACE_ALB_CUSTOM_DOMAIN = os.environ["traceALBCustomDomain"]
    GRAFANA_ADMIN_SECRET = os.environ['grafanaAdminSecret']
    # Define boto3 client/resources
    SECRETS_MANAGER_CLIENT = boto3.client('secretsmanager', AWS_REGION)
    DYNAMODB_RESOURCE = boto3.resource("dynamodb", AWS_REGION)
    TRACE_DASHBOARDS_TABLE = dynamodbUtil.TRACE_DASHBOARDS_TABLE

    EVENT_INFO = {}

except Exception as exc:
    LOGGER.error("Failed to set environment variables with: %s", "{0}".format(exc))
    sys.exit()

def get_grafana_admin_secret():
    '''
    This method gets the admin credentials from the Grafana Admin Secret
    '''
    LOGGER.info('In get_grafana_admin_secret method, starting method')
    secret_string = SECRETS_MANAGER_CLIENT.get_secret_value(
        SecretId=GRAFANA_ADMIN_SECRET
    )['SecretString']
    return json.loads(secret_string)

def validate_input_body(input_body):
    """
    Validate the input body for the create trace dashboard
    """
    LOGGER.info("In traceDashboards.validate_input_body, validating the input request body")

    commonUtil.validate_event_body(input_body, ["DashboardId"])

    # Check if there is any dashboard with the same ID
    dashboard_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(TRACE_DASHBOARDS_TABLE), {'DashboardId': input_body["DashboardId"]})
    if dashboard_item:
        LOGGER.error("In traceDashboards.create_dashboard, a dashboard with the same ID already exists in the system")
        ec_ipv_1018 = errorUtil.get_error_object("IPV-1018")
        ec_ipv_1018['Message'] = ec_ipv_1018['Message'].format("DashboardId")
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1018)

def validate_dasboard_id(dashboard_id):
    '''
    This methid validates the dashboard id by making a GET call to Grafana
    '''
    LOGGER.info('In traceDashboards.validate_dasboard_id, validating %s', dashboard_id)

    grafana_service_token = get_grafana_admin_secret()['ServiceToken']
    try:
        dashboard_response = requests.get(
            f"https://{TRACE_ALB_CUSTOM_DOMAIN}/api/dashboards/uid/{dashboard_id}",
            headers = {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {grafana_service_token}'
            },
            timeout = 5
        )
        if dashboard_response.status_code == 404:
            LOGGER.error("In traceDashboards.validate_dasboard_id, dashboard is not found")
            raise Exception("Invalid Dashboard Id provided. Could not find the dashboard in the system")
        return dashboard_response.json()

    except requests.exceptions.RequestException as http_err:
        LOGGER.error("Could not connect to Grafana endpoint, error - %s", str(http_err))
        raise Exception("Failed to connect to Grafana endpoint. Please check if Trace ALB endpoint is whitelisted in the proxy domain list") from http_err

def create_dashboard(user_id, input_body):
    '''
    This functions creates a new dasboard by validating and
    adding the metadata in the Trace Metadata table
    '''
    LOGGER.info("In traceDashboards.create_dashboard, input body is %s", input_body)

    validate_input_body(input_body)

    dashboard_data = validate_dasboard_id(input_body["DashboardId"])

    creation_staus = dynamodbUtil.put_item(
        DYNAMODB_RESOURCE.Table(TRACE_DASHBOARDS_TABLE),
        {
            "DashboardId": dashboard_data["dashboard"]["uid"],
            "DashboardName": dashboard_data["dashboard"]["title"],
            "DashboardDescription": dashboard_data["dashboard"].get("description", ""),
            "DashboardLink": f'https://{TRACE_ALB_CUSTOM_DOMAIN}{dashboard_data["meta"]["url"]}',
            "CreatedBy": user_id,
            "CreationTime": commonUtil.get_current_time(),
            "IsDefaultDashboard": False
        }
    )
    if creation_staus == 'success':
        return {
            "Message": f'Dashboard {dashboard_data["dashboard"]["title"]} created successfully'
        }

def get_dashboard(dashboard_id):
    '''
    This function is to get details of the given dashboard id
    '''
    LOGGER.info("In traceDashboards.get_dashboard, dashboard id is %s", dashboard_id)

    dashboard_item = dynamodbUtil.get_item_with_key(
        DYNAMODB_RESOURCE.Table(TRACE_DASHBOARDS_TABLE),
        {'DashboardId': dashboard_id}
    )
    if not dashboard_item:
        LOGGER.error("In traceDashboards.get_dashboard, dashboard item is not present in dynamodb")
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("DashboardId", dashboard_id)
        raise errorUtil.InvalidInputExecption(EVENT_INFO, ec_ipv_1002)
    return dashboard_item

def delete_dashboard(dashboard_id):
    '''
    This functions deletes a dasboard metadata from the Trace Metadata table
    '''
    LOGGER.info("In traceDashboards.delete_dashboard, dashboard to be deleted is %s", dashboard_id)

    # Check if the dashboard is present in the table
    dashboard_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(TRACE_DASHBOARDS_TABLE), {'DashboardId': dashboard_id})
    if not dashboard_item:
        LOGGER.error("In traceDashboards.delete_dashboard, a dashboard with the given ID does exist in the system")
        ec_ipv_1002 = errorUtil.get_error_object("IPV-1002")
        ec_ipv_1002['Message'] = ec_ipv_1002['Message'].format("DashboardId", dashboard_id)
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ipv_1002)

    if dashboard_item.get('IsDefaultDashboard', False):
        LOGGER.error('In traceDashboards.delete_dashboard, cannot delete the default dashboards')
        raise Exception('Cannot delete the default Amorphic Trace dashboards')

    status = dynamodbUtil.delete_item_by_key(
        DYNAMODB_RESOURCE.Table(TRACE_DASHBOARDS_TABLE),
        {'DashboardId': dashboard_id}
    )
    if status == 'success':
        return {
            "Message": f'Dashboard {dashboard_id} deleted successfully'
        }

def lambda_handler(event, context):
    """
    This Lambda function deals with the CRUD operations on Trace dashboards
    """
    try:
        # Remove authorization token while printing logs
        event = commonUtil.RedactAuthTokensClass(event)
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
        LOGGER.info("In traceDashboards.lambda_handler, event - %s \n context - %s", event, context)
        http_method = event["requestContext"]["httpMethod"]
        api_resource = event["resource"]
        LOGGER.info("In traceDashboards.lambda_handler, http_method - %s, api_resource - %s", http_method, api_resource)

        authtoken = event["headers"]["Authorization"]
        claims = commonUtil.get_claims(authtoken)
        user_id = claims["cognito:username"]
        commonUtil.is_valid_user(user_id)

        if http_method == "GET" and api_resource =="/tracedashboards":
            dashboard_items = dynamodbUtil.scan_with_pagination(DYNAMODB_RESOURCE.Table(TRACE_DASHBOARDS_TABLE))
            response = commonUtil.build_get_response(
                200,
                {
                    "Dashboards": dashboard_items
                }
            )

        elif http_method == "POST" and api_resource == "/tracedashboards":
            input_body = json.loads(event['body'])
            dashboard_creation_response = create_dashboard(user_id, input_body)
            response = commonUtil.build_post_response(200, dashboard_creation_response)

        elif http_method == "GET" and api_resource == "/tracedashboards/{id}":
            dashboard_id = event["pathParameters"]["id"]
            dashboard_item = get_dashboard(dashboard_id)
            response = commonUtil.build_get_response(200, dashboard_item)

        elif http_method == "DELETE" and api_resource == "/tracedashboards/{id}":
            dashboard_id = event["pathParameters"]["id"]
            status = delete_dashboard(dashboard_id)
            response = commonUtil.build_delete_response(200, status)

    except errorUtil.InvalidUserException as iue:
        LOGGER.error("In traceDashboards.lambda_handler, InvalidUserException occurred with error %s", iue)
        response = commonUtil.build_post_response(400, {'Message': str(iue)})
    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In traceDashboards.lambda_handler, InvalidInputException occurred with error %s", iie)
        response = commonUtil.build_post_response(400, {'Message': str(iie)})
    except errorUtil.GenericFailureException as gfe:
        LOGGER.error("In traceDashboards.lambda_handler, GenericFailureException occurred with error %s", gfe)
        response = commonUtil.build_post_response(500, {'Message': str(gfe)})
    except Exception as exc:
        LOGGER.error("In traceDashboards.lambda_handler, Exception occurred with error %s", exc)
        response = commonUtil.build_generic_response(500, {"Message": str(exc)})
    return response
