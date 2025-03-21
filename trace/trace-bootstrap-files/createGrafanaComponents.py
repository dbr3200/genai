'''
This script will create all the required datasources and dashboards inside Grafana
'''
import os
import json
import requests
import boto3

AWS_REGION = os.environ['AWS_REGION']
GRAFANA_SERVICE_TOKEN = os.environ['GRAFANA_SERVICE_TOKEN']
DEFAULT_ORG_ID = 1
BASE_URL = 'http://localhost:3000'
HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {GRAFANA_SERVICE_TOKEN}'
}

PROJECT_NAME = os.environ['PROJECT_NAME']
PROJECT_SHORT_NAME = os.environ['PROJECT_SHORT_NAME']
ENVIRONMENT = os.environ['ENVIRONMENT']

SSM_CLIENT = boto3.client('ssm', region_name=AWS_REGION)

SSM_BUCKET_LIST = 'AMORPHIC.CONFIG.BUCKETLIST'
SSM_OS_ENDPOINT = 'AMORPHIC.OPENSEARCH.DOMAINENDPOINT'
SSM_OS_VERSION = 'AMORPHIC.CONFIG.ESVERSION'
SSM_SQUID_PROXY_ASG = 'AMORPHIC.PROXY.AUTOSCALINGGROUPNAME'

def get_ssm_parameter(parameter_name):
    '''
    This function returns a parameter's value from ssm given its name
    :param parameter_name: name of parameter to be retrieved
    :type parameter_name: String
    :return type: string
    '''
    print(f'Retrieving value of param {parameter_name} from ssm')
    response = SSM_CLIENT.get_parameter(
        Name=parameter_name,
        WithDecryption=True
    )
    if response['Parameter']['Type'] == 'StringList':
        return response['Parameter']['Value'].split(',')
    return response['Parameter']['Value']

BUCKET_LIST = get_ssm_parameter(SSM_BUCKET_LIST)
SQUID_PROXY_ASG = get_ssm_parameter(SSM_SQUID_PROXY_ASG)
OS_ENDPOINT = get_ssm_parameter(SSM_OS_ENDPOINT)
OS_VERSION = get_ssm_parameter(SSM_OS_VERSION)

# Cloudwatch Datasource variables
# Hardcode the UID so that we can reuse the UID for dashboard input without fetching it again from the API
CLOUDWATCH_DS_UID = 'adt78kadv5loga'
# Athena Datasource variables
# Hardcode the UID so that we can reuse the UID for dashboard input without fetching it again from the API
ATHENA_DS_UID = 'cdt78kb3vljb4f'
GLUE_DATABASE = f'{PROJECT_SHORT_NAME}{ENVIRONMENT}system'
ATHENA_OUTPUT_LOCATION = f's3://{BUCKET_LIST[1].strip()}/grafana'
ATHENA_WORKKGROUP = 'AmazonAthenaEngineV3'
GLUE_CATALOG ='AwsDataCatalog'
# OpenSearch Datasource Variables
OS_DS_UID = 'edw98syea35dsd'
OS_DATABASE = f'catalog_index_{ENVIRONMENT}'
OS_TIME_FIELD = 'CreationTime'
OS_VERSION_MAPPINGS = {
    'OpenSearch_2.7': {
        'Version': '2.7.0',
        'VersionLabel': 'OpenSearch 2.7.0'
    },
    'OpenSearch_2.13': {
        'Version': '1.0.0',
        'VersionLabel': 'OpenSearch (compatibility mode)'
    }
}

def rename_default_org():
    '''
    Rename the default organization to Amorphic Data Platform
    '''
    print('In rename_default_org, renaming default org')
    org_data = {'name': 'Amorphic Data Platform'}
    rename_response = requests.put(
        f'{BASE_URL}/api/orgs/{DEFAULT_ORG_ID}',
        headers=HEADERS,
        data=json.dumps(org_data)
    )
    if rename_response.status_code != 200:
        print(f'Error renaming organization: {rename_response.text}')
    else:
        print('Organization renamed successfully.')

def create_datasource(ds_name, ds_data):
    '''
    Creates a datasource with the given input
    '''
    print(f'In create_datasource, creating datasource: {ds_name}')
    create_ds_response = requests.post(
        f'{BASE_URL}/api/datasources',
        headers=HEADERS,
        data=json.dumps(ds_data)
    )
    if create_ds_response.status_code != 200:
        print(f'Error creating {ds_name} Datasource: {create_ds_response.text}')
    else:
        print(f'{ds_name} Datasource created successfully.')

def create_cloudwatch_ds():
    '''
    Create Cloudwatch Datasource
    '''
    print('In create_cloudwatch_ds, starting method')
    ds_data = {
        'name': 'AWS Cloudwatch',
        'uid': CLOUDWATCH_DS_UID,
        'type': 'cloudwatch',
        'isDefault': True,
        'url': '',
        'access': 'proxy',
        'jsonData': {
            'authType': 'default',
            'defaultRegion': AWS_REGION
        },
        'orgId': DEFAULT_ORG_ID
    }
    create_datasource('AWS Cloudwatch', ds_data)
    print('In create_cloudwatch_ds, exiting method')

def create_athena_datasource():
    '''
    This function creates the athena datasource
    '''
    print('In create_athena_datasource, starting method')
    ds_data = {
        'name': 'AWS Athena',
        'uid': ATHENA_DS_UID,
        'type': 'grafana-athena-datasource',
        'isDefault': False,
        'url': '',
        'access': 'proxy',
        'jsonData': {
            'authType': 'default',
            'defaultRegion': AWS_REGION,
            'catalog': GLUE_CATALOG,
            'database': GLUE_DATABASE,
            'outputLocation': ATHENA_OUTPUT_LOCATION,
            'workgroup': ATHENA_WORKKGROUP
        },
        'orgId': DEFAULT_ORG_ID
    }
    create_datasource('AWS Athena', ds_data)
    print('In create_athena_datasource, exiting method')

def create_opensearch_datasource():
    '''
    This function creates the athena datasource
    '''
    print('In create_opensearch_datasource, starting method')
    ds_data = {
        'name': 'AWS OpenSearch',
        'uid': OS_DS_UID,
        'type': 'grafana-opensearch-datasource',
        'isDefault': False,
        'url': f'https://{OS_ENDPOINT}',
        'access': 'proxy',
        'jsonData': {
            'database': OS_DATABASE,
            'logLevelField': '',
            'logMessageField': '',
            'maxConcurrentShardRequests': 5,
            'pplEnabled': True,
            'sigV4Auth': True,
            'sigV4AuthType': 'default',
            'sigV4Region': AWS_REGION,
            'timeField': OS_TIME_FIELD,
            'version': OS_VERSION_MAPPINGS[OS_VERSION]['Version'],
            'versionLabel': OS_VERSION_MAPPINGS[OS_VERSION]['VersionLabel']
        },
        'orgId': DEFAULT_ORG_ID
    }
    create_datasource('AWS OpenSearch', ds_data)
    print('In create_opensearch_datasource, exiting method')

def create_dashboard(file_path, dashboard_inputs):
    '''
    Generic method to create the dashboards in Grafana
    '''
    print('In create_dashboard, creating dashboard')
    with open(file_path, encoding='utf8', mode= 'r') as file:
        dashboard_data = json.load(file)
    create_ds_body = {
        'dashboard': dashboard_data,
        'message': 'Dashboard updated from TRACE pipelines',
        'overwrite': True,
        'inputs' : dashboard_inputs
    }
    create_dashboard_response = requests.post(
        f'{BASE_URL}/api/dashboards/import',
        headers=HEADERS,
        data=json.dumps(create_ds_body)
    )
    if create_dashboard_response.status_code != 200:
        print(f'Error creating dashboard: {create_dashboard_response.text}')
    else:
        print('Dashboard created successfully.')

def create_api_stats_dashboard():
    '''
    Creates the api stats dashboard
    '''
    print('In create_api_stats_dashboard, creating dashboard')
    dashboard_inputs = [
		{
			'name': 'DS_AWS_CLOUDWATCH',
			'pluginId': 'cloudwatch',
			'type': 'datasource',
			'value': CLOUDWATCH_DS_UID
		},
		{
			'name': 'DS_AWS_ATHENA',
			'pluginId': 'grafana-athena-datasource',
			'type': 'datasource',
			'value': ATHENA_DS_UID
		},
        {
			'name': 'DS_AWS_OPENSEARCH',
			'pluginId': 'grafana-opensearch-datasource',
			'type': 'datasource',
			'value': OS_DS_UID
		},
		{
			'name': 'VAR_AMORPHIC_API_NAME',
			'type': 'constant',
			'value': f'{PROJECT_SHORT_NAME}-{ENVIRONMENT}'
		},
		{
			'name': 'VAR_SYSTEM_DATABASE',
			'type': 'constant',
			'value': f'{GLUE_DATABASE}'
		},
		{
			'name': 'VAR_API_GATEWAY_SYS_TABLE',
			'type': 'constant',
			'value': 'sys_api_gateway_logs'
		}
	]
    create_dashboard(
        'dashboards/ADPAPIStatsDashboard.json',
        dashboard_inputs
    )

def create_backend_service_stats_dashboard():
    '''
    Creates the backend service stats dashboard
    '''
    print('In create_backend_service_dashboard, creating dashboard')
    dashboard_inputs = [
		{
			'name': 'DS_AWS_CLOUDWATCH',
			'pluginId': 'cloudwatch',
			'type': 'datasource',
			'value': CLOUDWATCH_DS_UID
		}
	]
    create_dashboard(
        'dashboards/ADPBackendServiceStatsDashboard.json',
        dashboard_inputs
    )

def create_infra_stats_dashboard():
    '''
    Creates the infra stats dashboard
    '''
    print('In create_infra_stats_dashboard, creating dashboard')
    dashboard_inputs = [
		{
			'name': 'DS_AWS_CLOUDWATCH',
			'pluginId': 'cloudwatch',
			'type': 'datasource',
			'value': CLOUDWATCH_DS_UID
		},
		{
			'name': 'VAR_SQUID_PROXY_LOGS',
			'type': 'constant',
			'value': '/aws/squid-proxy/access-logs'
		}
	]
    create_dashboard(
        'dashboards/ADPInfraStatsDashboard.json',
        dashboard_inputs
    )

def create_support_service_stats_dashboard():
    '''
    Creates the support service stats dashboard
    '''
    print('In create_support_service_stats_dashboard, creating dashboard')
    dashboard_inputs = [
		{
			'name': 'DS_AWS_CLOUDWATCH',
			'pluginId': 'cloudwatch',
			'type': 'datasource',
			'value': CLOUDWATCH_DS_UID
		},
		{
			'name': 'VAR_REGIONAL_WAF_LOGS',
			'type': 'constant',
			'value': f'aws-waf-logs-{PROJECT_SHORT_NAME}-{AWS_REGION}-{ENVIRONMENT}'
		},
		{
			'name': 'VAR_GLOBAL_WAF_LOGS',
			'type': 'constant',
			'value': f'aws-waf-logs-{PROJECT_SHORT_NAME}-{ENVIRONMENT}'
		}
	]
    create_dashboard(
        'dashboards/ADPSupportServiceStatsDashboard.json',
        dashboard_inputs
    )

def create_user_activity_dashboard():
    '''
    Creates the user activity dashboard
    '''
    print('In create_user_activity_dashboard, creating dashboard')
    dashboard_inputs = [
		{
			'name': 'DS_AWS_ATHENA',
			'pluginId': 'grafana-athena-datasource',
			'type': 'datasource',
			'value': ATHENA_DS_UID
		},
        {
			'name': 'DS_AWS_OPENSEARCH',
			'pluginId': 'grafana-opensearch-datasource',
			'type': 'datasource',
			'value': OS_DS_UID
		},
		{
			'name': 'VAR_SYSTEM_DATABASE',
			'type': 'constant',
			'value': f'{GLUE_DATABASE}'
		},
        {
            'name': 'VAR_OS_CATALOG_INDEX',
            'type': 'constant',
            'value': f'catalog_index_{ENVIRONMENT}'
        }
	]
    create_dashboard(
        'dashboards/ADPUserActivityDashboard.json',
        dashboard_inputs
    )

def main():
    '''
    Main Function
    '''
    # Rename the default org
    rename_default_org()

    # Create the datasources
    create_cloudwatch_ds()
    create_athena_datasource()
    create_opensearch_datasource()

    # Create the dashboards
    create_api_stats_dashboard()
    create_backend_service_stats_dashboard()
    create_infra_stats_dashboard()
    create_support_service_stats_dashboard()
    create_user_activity_dashboard()

if __name__ == '__main__':
    main()
