'''
This script will create Grafana Service account and a service token during the initial deployment.
This token will be used to invoke the Grafana APIs in all other scripts so that even if the password is changed,
the scripts will continue to work.
'''
import os
import sys
import json
import requests
import boto3

AWS_REGION = os.environ['AWS_REGION']
GRAFANA_ADMIN_SECRET = os.environ['GRAFANA_ADMIN_SECRET']
SECRETS_MANAGER_CLIENT = boto3.client('secretsmanager', region_name=AWS_REGION)

BASE_URL = 'http://localhost:3000'
HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
}

def get_grafana_admin_secret():
    '''
    This method gets the admin credentials from the Grafana Admin Secret
    '''
    print('In get_grafana_admin_secret method, starting method')
    secret_string = SECRETS_MANAGER_CLIENT.get_secret_value(
        SecretId=GRAFANA_ADMIN_SECRET
    )['SecretString']
    return json.loads(secret_string)

def create_service_token(grafana_admin_auth):
    '''
    This method creates a service account and token in Grafana
    '''
    print('In create_service_token method, starting method')
    # Create a service account
    service_account_data = {
        'name': 'Amorphic Service Account',
        'role': 'Admin'
    }
    service_account_response = requests.post(
        f"{BASE_URL}/api/serviceaccounts",
        auth=grafana_admin_auth,
        headers=HEADERS,
        data=json.dumps(service_account_data)
    )
    if service_account_response.status_code not in range(200, 300):
        print(f'Error creating service account: {service_account_response.text}')
        raise Exception(f'Error creating service account: {service_account_response.text}')
    else:
        service_account_response_json = service_account_response.json()
        service_account_id = service_account_response_json['id']
        print(f"Created service account with ID: {service_account_id}")

    # Create a token for the service account
    token_data = {
        'name': 'service-account-token'
    }
    token_response = requests.post(
        f"{BASE_URL}/api/serviceaccounts/{service_account_id}/tokens",
        auth=grafana_admin_auth,
        headers=HEADERS,
        data=json.dumps(token_data)
    )
    if token_response.status_code != 200:
        print(f'Error creating service account token: {token_response.text}')
        raise Exception(f'Error creating service account token: {token_response.text}')
    else:
        token_response_json = token_response.json()
        token_key = token_response_json['key']
        print("Created service account token")
    print('In create_service_token method, exiting method')

    return service_account_id, token_key

def update_secret(secret_string):
    '''
    This method updates the Grafana Admin Secret with the service token
    '''
    print('In update_secret method, starting method')
    SECRETS_MANAGER_CLIENT.update_secret(
        SecretId=GRAFANA_ADMIN_SECRET,
        SecretString=json.dumps(secret_string)
    )

def main():
    '''
    Main function
    '''
    print('In main method, starting method')

    # Get the grafana admin secret from secrets manager
    grafana_admin_secret = get_grafana_admin_secret()

    # Check if a service token isalready present in the secret by any chance
    if 'ServiceToken' in grafana_admin_secret:
        print('In main method, a service token exist in the secret, exiting')
        # Set the token env variable
        os.environ['GRAFANA_SERVICE_TOKEN'] = grafana_admin_secret['ServiceToken']
        sys.exit()

    grafana_admin_auth = (grafana_admin_secret['username'], grafana_admin_secret['password'])

    # Create a service token
    service_account_id, token_key = create_service_token(grafana_admin_auth)

    grafana_admin_secret.update({
        'ServiceAccountId': service_account_id,
        'ServiceToken': token_key
    })

    update_secret(grafana_admin_secret)
    print('In main method, secret updated, exiting method')

if __name__ == '__main__':
    main()
