"""Utility file for handling all IAM related operations like role creation and deletion
"""
import os
import logging
import json
import sys
from string import Template
import boto3
from botocore.exceptions import ClientError

import errorUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

EVENT_INFO = errorUtil.EVENT_INFO

try:
    ACCOUNT_ID = os.environ['accountId']
    AWS_REGION = os.environ['awsRegion']
    AWS_PARTITION = os.environ['awsPartition']
    ENVIRONMENT = os.environ['environment']
    PROJECT_NAME = os.environ['projectName']
    PROJECT_SHORT_NAME = os.environ['projectShortName']
    VERTICAL_NAME = os.environ['verticalName']
except Exception as ex:
    LOGGER.error("In iamUtil, failed to set environment variables with: %s", '{0}'.format(ex))
    sys.exit()


def substitute_var_in_template(template_filename: str, substitute_values_dict: dict) -> dict:
    """This functions substitutes variables in the IAM template

    Args:
        template_filename (str): Filename of the IAM template
        substitute_values_dict (dict): Dictionary of values to substitute

    Returns:
        dict: IAM policy dictionary with the substituted values
    """
    LOGGER.info("In iamUtil.substitute_var_in_template, Substituting variables in the IAM template - %s", template_filename)
    import yaml
    with open(template_filename, encoding="utf8") as file_object:
        template_str = file_object.read()
    replaced_str = Template(template_str).substitute(substitute_values_dict)
    iam_policy_dict = yaml.safe_load(replaced_str)
    return iam_policy_dict

def get_assume_role_policy_doc(service_type: str) -> str:
    """This function creates new IAM role/policy as per job name

    Args:
        service_type (str): Service for which the assume role policy doc is to be created
    """
    LOGGER.info("In iamUtil.get_assume_role_policy_doc for service type - %s", service_type)

    substitute_values_dict = {
        'SERVICE_TYPE': service_type,
        'PROJ_SHORT_NAME': PROJECT_SHORT_NAME,
        'AWS_REGION': AWS_REGION,
        'ACCOUNT_ID': ACCOUNT_ID,
        'AWS_PARTITION': AWS_PARTITION
    }
    if service_type == "bedrock":
        template_filename = "/var/lang/lib/python3.12/site-packages/iam_assume_role_policy_document.yaml"

    assumed_role_policy_dict = substitute_var_in_template(template_filename, substitute_values_dict)
    LOGGER.info("In iamUtil.get_assume_role_policy_doc, assume policy doc retrieved - %s", json.dumps(assumed_role_policy_dict, indent=4, default=str))
    return json.dumps(assumed_role_policy_dict, indent=4, default=str)

def get_iam_inline_policy_document(service_type: str, custom_policy_list: list[dict], os_env_var_dict: dict) -> str:
    """Create a policy document containing the required permissions for the specified service

    Args:
        service_type (str): Service type to create the policy document for
        custom_policy_list (list[dict]): List
        os_env_var_dict (dict): Dictionary containing required variables

    Returns:
        str: _description_
    """
    LOGGER.info("In iamUtil.get_iam_inline_policy_document")

    substitute_values_dict = {
        'PROJ_SHORT_NAME': PROJECT_SHORT_NAME,
        'AWS_REGION': AWS_REGION,
        'ACCOUNT_ID': ACCOUNT_ID,
        'USER_ID': os_env_var_dict.get("userId", "*"),
        'AWS_PARTITION': AWS_PARTITION
    }

    if service_type == "bedrock":
        substitute_values_dict.update({
            'EMBEDDING_MODEL_ARN': os.environ.get('embeddingModelArn', '*'),
            'CLUSTER_ARN': os.environ.get('RAGEngineClusterArn', '*'),
            'SERVICE_USER_SECRET_ARN': os.environ.get('auroraServiceUserAuthArn', '*'),
            'DLZ_KMS_KEY_ARN': os.environ.get('dlzKMSKeyArn', '*')
        })
        template_filename = "/var/lang/lib/python3.12/site-packages/bedrock-inline-policy-template.yaml"
    LOGGER.info("In iamUtil.get_iam_inline_policy_document, template_filename: %s", template_filename)

    inline_policy_dict = substitute_var_in_template(template_filename, substitute_values_dict)

    inline_policy_dict['Statement'].extend(custom_policy_list)
    LOGGER.info("In iamUtil.get_iam_inline_policy_document, inline_policy_dict - %s", json.dumps(inline_policy_dict, default=str))
    return json.dumps(inline_policy_dict, indent=4, default=str)

def generate_iam_knowledge_base_action(dataset_list: list, os_env_var_dict: dict) -> list[dict]:
    """This function generates s3 policies that are required for creating a bedrock knowledge base

    Args:
        dataset_list (obj): Dict containing details about the datasets linked to the workspace
        os_env_var_dict (obj): Dictionary containing required variables

    Returns:
        list: Custom policy list
    """
    LOGGER.info("In iamUtil.generate_iam_knowledge_base_action, Generating IAM S3 actions for datasets - %s", dataset_list)
    custom_policy_list = []

    s3_dlz_bucket_name = os_env_var_dict['s3DlzBucketName']
    # creating a short name for the S3 bucket
    s3_dlz_bucket_short_name = "-".join([s3_dlz_bucket_name.split('-')[0], "*", s3_dlz_bucket_name.split('-')[-1]])

    dataset_prefixes_list = [f"{dataset['Domain']}/{dataset['DatasetName']}/*" for dataset in dataset_list]
    dataset_s3_paths = [f"arn:{AWS_PARTITION}:s3:::{s3_dlz_bucket_short_name}/{dataset_prefix}" for dataset_prefix in dataset_prefixes_list]
    s3_list_policy = {
        "Sid": "CustomS3ListBucketAction",
        "Effect": "Allow",
        "Action": [
            "s3:ListBucket"
        ],
        "Resource": f"arn:{AWS_PARTITION}:s3:::{s3_dlz_bucket_short_name}",
        "Condition": {
            "StringLike": {
                "s3:prefix": dataset_prefixes_list
            }
        }
    }
    custom_policy_list.append(s3_list_policy)
    s3_get_policy = {
        "Sid": "CustomS3GetObjectAction",
        "Effect": "Allow",
        "Action": [
            "s3:GetObject"
        ],
        "Resource": dataset_s3_paths
    }
    custom_policy_list.append(s3_get_policy)

    LOGGER.info("In iamUtil.generate_iam_knowledge_base_action, custom_policy_list - %s", json.dumps(custom_policy_list, default=str))
    return custom_policy_list

def create_iam_role(service_type: str, resource_id: str, dataset_list: list[dict], os_env_var_dict: dict) -> str:
    """This function creates/updates an IAM role required for the specified service

    Args:
        service_type (str): Service type to create the role for
        resource_id (str): The ID of the resource for which the role is being created
        dataset_list (list[dict]): A list containing datasets to be linked to the role
        os_env_var_dict (dict): A dictionary of environment variables

    Returns:
        str: Role arn
    """
    try:
        LOGGER.info("In iamUtil.create_iam_role, creating IAM role for resource ID - %s", resource_id)
        iam_client = boto3.client('iam', AWS_REGION)

        role_name = PROJECT_SHORT_NAME + '-custom-' + resource_id + '-Role'
        policy_name = 'custom_inline_policy'
        try:
            role_arn = iam_client.get_role(RoleName=role_name)['Role']['Arn']
            LOGGER.info("In iamUtil.create_iam_role, IAM role %s already exist.", role_name)
        except Exception as err:
            LOGGER.info("In iamUtil.create_iam_role, IAM role %s doesn't exist. Error message - %s. Hence creating one", role_name, err)
            create_role_response = iam_client.create_role(
                RoleName=role_name,
                AssumeRolePolicyDocument=get_assume_role_policy_doc(service_type),
                Description=f"Custom IAM role created for {service_type} - resource ID {resource_id}",
                Tags=[
                    {
                        'Key': 'Name',
                        'Value': f"{PROJECT_NAME}-{VERTICAL_NAME}-{service_type}-role"
                    },
                    {
                        'Key': 'Environment',
                        'Value': ENVIRONMENT
                    },
                    {
                        'Key': 'Region',
                        'Value': AWS_REGION
                    },
                ]
            )
            LOGGER.info("In iamUtil.create_iam_role, create IAM role response - %s", create_role_response)
            if create_role_response["ResponseMetadata"]["HTTPStatusCode"] == 200:
                LOGGER.info("In iamUtil.create_iam_role, successfully created IAM role with name - %s", role_name)
            role_arn = create_role_response['Role']['Arn']
        LOGGER.info("In iamUtil.create_iam_role, Role ARN: %s", role_arn)
        custom_policy_list = []
        if service_type == "bedrock":
            custom_policy_list.extend(generate_iam_knowledge_base_action(dataset_list, os_env_var_dict))

        LOGGER.info("In iamUtil.create_iam_role, custom_policy_list - %s", json.dumps(custom_policy_list, default=str))
        try:
            put_role_policy_response = iam_client.put_role_policy(
                RoleName=role_name,
                PolicyName=policy_name,
                PolicyDocument=get_iam_inline_policy_document(service_type, custom_policy_list, os_env_var_dict)
            )
        except ClientError as c_e:
            if c_e.response["Error"]["Code"] == "LimitExceeded":
                LOGGER.info("In iamUtil.create_iam_role, the policy to be assigned is larger than allowed")
                ec_ge_1044 = errorUtil.get_error_object("GE-1044")
                ec_ge_1044["Message"] = ec_ge_1044["Message"].format("Maximum resource allocation reached, reduce the number of resources to be linked to the role.")
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1044)
            else:
                LOGGER.error("In iamUtil.create_iam_role, Failed to create IAM role policy with error - %s", str(c_e))
                ec_role_1007 = errorUtil.get_error_object("ROLE-1007")
                ec_role_1007["Message"] = ec_role_1007["Message"].format(c_e)
                raise errorUtil.GenericFailureException(EVENT_INFO, ec_role_1007)
        response = iam_client.get_role_policy(
            RoleName=role_name,
            PolicyName=policy_name
        )
        LOGGER.info("In iamUtil.create_iam_role, Role Policy document: %s", json.dumps(response, default=str))
        if put_role_policy_response["ResponseMetadata"]["HTTPStatusCode"] == 200:
            LOGGER.info("In iamUtil.create_iam_role, successfully attached inline policy to IAM role - %s", role_name)
            return role_arn
    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In iamUtil.create_iam_role, Failed to create IAM role with error - %s", str(iie))
        ec_role_1007 = errorUtil.get_error_object("ROLE-1007")
        ec_role_1007["Message"] = ec_role_1007["Message"].format(str(iie))
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_role_1007)
    except Exception as err:
        LOGGER.error("In iamUtil.create_iam_role, failed to create IAM role with exception - %s", str(err))
        ec_ge_1004 = errorUtil.get_error_object("GE-1004")
        ec_ge_1004["Message"] = ec_ge_1004["Message"].format("create", "IAM role for service {}".format(service_type), str(err))
        raise errorUtil.GenericFailureException(EVENT_INFO, ec_ge_1004)


def delete_iam_role_with_custom_inline_policy(iam_role_name: str) -> str:
    """This function will delete IAM role along with custom inline policy

    Args:
        iam_role_name (str): Name of the role to delete

    Returns:
        str: 'succeeded' | 'failed'
    """
    try:
        LOGGER.info("In iamUtil.delete_iam_role_with_custom_inline_policy, deleting IAM role - %s", iam_role_name)
        iam_client = boto3.client('iam', AWS_REGION)
        delete_role_policy_response = iam_client.delete_role_policy(
            RoleName=iam_role_name,
            PolicyName='custom_inline_policy'
        )
        LOGGER.info("In iamUtil.delete_iam_role_with_custom_inline_policy, delete policy to IAM role response - %s", delete_role_policy_response)
        if delete_role_policy_response["ResponseMetadata"]["HTTPStatusCode"] == 200:
            LOGGER.info("In iamUtil.delete_iam_role_with_custom_inline_policy, successfully deleted inline policy to IAM role - %s", iam_role_name)
        delete_role_response = iam_client.delete_role(
            RoleName=iam_role_name
        )
        LOGGER.info("In iamUtil.delete_iam_role_with_custom_inline_policy, delete IAM role response - %s", delete_role_response)

        if delete_role_response["ResponseMetadata"]["HTTPStatusCode"] == 200:
            LOGGER.info("In iamUtil.delete_iam_role_with_custom_inline_policy, successfully deleted IAM role - %s", iam_role_name)
    except Exception as err:
        LOGGER.error("In iamUtil.delete_iam_role_with_custom_inline_policy, Failed to delete the role/policy due to the error: %s", str(err))
