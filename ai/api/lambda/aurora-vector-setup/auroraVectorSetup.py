"""
This Lambda function enables vector extension in Aurora DB

# Modification History:
# ====================================================================
# Date                 Who                       Description
# ==========      =================     ==============================
 July 27th 2023   Daibin Raju           Added lambda function to enable vector extension in Aurora DB
 June 13th 2023   Rohan Joshi           Deprecated the linked custom resource and removed the vector setup functions
#
#########################################################################################################
"""
import logging
import json
import requests

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

FAILED = "FAILED"
SUCCESS = "SUCCESS"

def send_response(event, context, response_status, reason):
    """
    forming the response to CF and send it to S3 pre-signed URL
    """
    LOGGER.info("In auroraVectorSetup.send_response, Sending response to CloudFormation with status: %s", response_status)
    response_body = {'Status': response_status,
                     'Reason': "{}. For more information, Check the details in CloudWatch Log Group: {}, CloudWatch Log Stream: {}".format(reason, context.log_group_name, context.log_stream_name),
                     'PhysicalResourceId': "Enable Vector Extension",
                     'StackId': event['StackId'],
                     'RequestId': event['RequestId'],
                     'LogicalResourceId': event['LogicalResourceId']}
    LOGGER.info('In auroraVectorSetup.send_response, RESPONSE BODY:\n %s', json.dumps(response_body))
    try:
        req = requests.put(event['ResponseURL'], data=json.dumps(response_body), timeout=20)
        if req.status_code != 200:
            LOGGER.error("In auroraVectorSetup.send_response, Request object to CF is %s", req.text)
            raise Exception('Received non-200 response while sending response to CloudFormation.')
        return
    except requests.exceptions.RequestException as ex:
        LOGGER.error("In auroraVectorSetup.send_response, Exception while sending the response to CF - %s", str(ex))
        raise

def lambda_handler(event, context):
    """
    Handle Lambda event from AWS
    """
    try:
        LOGGER.info('In serviceUser.lambda_handler, event - %s, context - %s', event, context)

        if event["RequestType"] in [ "Create", "Update" ]:
            response_status, message = SUCCESS, "Created vector extension"
            send_response(event, context, response_status, message)
        elif event['RequestType'] == 'Delete':
            response_status, message = SUCCESS, "Resource deletion successful"
            send_response(event, context, response_status, message)
        return
    except Exception as ex:
        LOGGER.error("In auroraVectorSetup.lambda_handler, Exception while running the custom CF lambda - %s", str(ex))
        send_response(event, context, FAILED, str(ex))
        return
