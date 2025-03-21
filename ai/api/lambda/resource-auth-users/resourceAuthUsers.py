"""
######################################################################################################
# File: resourceAuthUsers.py
# Location: /cloudwick-datalake/amorphic-verticals/api/lambda/resource-auth-groups-users/resourceAuthsUsers.py
#
# This is a common lambda to perform auth related operations on all resource
#
#    1. Grant or revoke access on a resource to a user
#    2. Get authorized users of a resource
#    3. No groups access for now
#
# Modification History:
# ====================================================================
# Date                 Who                       Description
# ==========      =================     ==============================
# 22/07/2023         K.Sainadh                  Initial commit
#########################################################################################################
"""

import json
import sys
import os
import logging
import boto3
from boto3.dynamodb.conditions import Key
# Common layer packages
import commonUtil
import dynamodbUtil
import errorUtil
import cognitoUtil

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)
LOGGER.info('Loading Function %s', "resourceAuthUsers.py")

try:

    # Common variables
    AWS_REGION = os.environ['awsRegion']
    ENVIRONMENT = os.environ['environment']
    USER_POOL_ID = os.environ['userPoolId']
    VERTICAL_NAME = os.environ['verticalName']

    USERS_TABLE = dynamodbUtil.USERS_TABLE
    GROUPS_TABLE = dynamodbUtil.GROUPS_TABLE

    # Workspaces Tables
    WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
    WORKSPACES_GROUPS_TABLE = dynamodbUtil.WORKSPACES_GROUPS_TABLE
    WORKSPACES_GROUPS_TABLE_WORKSPACEID_INDEX = dynamodbUtil.WORKSPACES_GROUPS_TABLE_WORKSPACEID_INDEX

    # Boto3 method initialization
    DYNAMODB_RES = boto3.resource('dynamodb', AWS_REGION)
    ACCESS_TYPES = ["owner", "read-only"]
    OWNER_ACCESS = ACCESS_TYPES[0]
    READ_ONLY_ACCESS = ACCESS_TYPES[1]
    EVENT_INFO = {}

except Exception as exc:
    LOGGER.error("In resourceAuthUsers, Failed to set environment variables with: %s", '{0}'.format(exc))
    sys.exit()


RESOURCE_DETAILS_MAP = {
    "workspaces": {
        "ResourceId": "WorkspaceId",
        "ResourceType": "Workspace",
        "ResourceTable": WORKSPACES_TABLE,
        "ResourceNameKey": "WorkspaceName",
        "GroupsResourceTable": WORKSPACES_GROUPS_TABLE,
        "GroupsResourceTableResourceIdKey": "WorkspaceId",
        "ResourceIdIndexGroupsResourceTable": WORKSPACES_GROUPS_TABLE_WORKSPACEID_INDEX,
        "ResourceIdsListKey": "WorkspaceIds",
        "GroupsTableResourcesListKey": "WorkspaceIdList"
    }
}

def get_user_items(u_table, group_resource_items):
    """
    This function returns users details
    :param u_table: user table
    :param group_resource_items: list of group resource items
    :return: users details list
    """
    LOGGER.info("In resourceAuthUsers.get_user_items, Retrieving users details from Group resource items - %s", group_resource_items)
    user_items = []
    for item in group_resource_items:
        if not commonUtil.is_valid_uuid(item['GroupId']):
            user_response = dynamodbUtil.get_item_by_key_with_exp_proj(
                u_table,
                {
                    'UserId': item['GroupId'].split("_")[1] #key
                },
                "UserId,#name_alias,EmailId,IsActive", #projection_expression
                {
                    "#name_alias": "Name" #ExpressionAttributeNames
                }
            )
            if user_response:
                user_items.append(user_response)
    LOGGER.info("In resourceAuthUsers.get_user_items, Successfully retrieved users details user_items - %s", user_items)
    return user_items


def get_group_items(resource_id, access_type, group_resource_key, group_resource_gsi_index, groups_resource_table):
    """
    This function returns the list of users that have access on a resource from groups
    :param resource_id:
    :param user_table:
    :param access_type:
    :param group_resource_key: ex:WorkspaceId in groups workspace table
    """
    LOGGER.info("In resourceAuthUsers.get_group_items, Querying groups_resource_table to get the list of groups along with users")
    groups_resource_items = dynamodbUtil.get_items_by_query_with_filter(
        DYNAMODB_RES.Table(groups_resource_table),
        Key(group_resource_key).eq(resource_id), None, 'AccessType =:val1',
        group_resource_gsi_index, {':val1': access_type}
    )
    LOGGER.info("In resourceAuthUsers.get_group_items, groups_resource_items - %s", groups_resource_items)

    for group_resource_item in groups_resource_items:
        group_item = dynamodbUtil.get_item_by_key_with_projection(
            DYNAMODB_RES.Table(GROUPS_TABLE),
            {"GroupId": group_resource_item["GroupId"]},
            "GroupName,GroupType,GroupId" # Added UpdateStatus and StatusMessage for CLOUD-2549
        )
        LOGGER.info("In resourceAuthUsers.get_group_items, group_item - %s", group_item)
        if not group_item:
            LOGGER.error("In resourceAuthUsers.get_group_items, group_item with id %s is empty, inconsistent metadata and ignoring this group.", group_resource_item["GroupId"])
            continue
        if not set(["GroupName", "GroupType", "GroupId"]).issubset(set(group_item.keys())):
            LOGGER.error("In resourceAuthUsers.get_group_items, for group - %s, not all attributes were returned items are %s", group_resource_item["GroupId"], str(group_item.keys()))
            ec_ge_1023 = errorUtil.get_error_object("GE-1023")
            ec_ge_1023["Message"] = "one or more required attributes are missing, required attributes- GroupName,GroupType,GroupId"
            raise errorUtil.InconsistentMetadataException(EVENT_INFO, ec_ge_1023)

    # Sending out the groups_resource_items variable to use the items out the method to avoid multiple get calls
    return groups_resource_items

def get_authorized_users(resource_key, resource_table, resource_id, group_resource_table, group_resource_id_gsi, group_resource_key, requestor_user_item):
    """
    There is a copy of this function as resourceAuthUsers.get_authorized_users_and_groups. Please sync future changes
    for this function to resourceAuthUsers.get_authorized_users_and_groups as well
    This function returns authorized users for the resource
    :param resource_id:
    :param group_resource_table:
    :param group_resource_id_gsi: global secondary index
    :return: dict
    """
    LOGGER.info("In resourceAuthUsers.get_authorized_users, Retrieving users who have access to the resource %s", resource_id)
    # Check requester_credentials whether authorized or not(has owner access or not)
    commonUtil.is_user_action_valid(requestor_user_item, resource_key, resource_id, resource_table, GROUPS_TABLE, "grant")
    # Output response format
    users = {'Users': {'owners': [], 'readOnly': []}}
    # Get users who have access (owner) from groups
    owner_grp_res_items = get_group_items(resource_id, OWNER_ACCESS, group_resource_key, group_resource_id_gsi, group_resource_table)
    # Get users who have access (owner)
    res_owners = get_user_items(DYNAMODB_RES.Table(USERS_TABLE), owner_grp_res_items)
    # Below two lines are to remove duplicate items from the list
    result = {user['EmailId']:user for user in res_owners}
    LOGGER.info("In resourceAuthUsers.get_authorized_users, owner result - %s", result)
    users['Users']['owners'] = list(result.values())
    # Get users who have access (read-only) from groups
    read_only_grp_res_items = get_group_items(resource_id, READ_ONLY_ACCESS, group_resource_key, group_resource_id_gsi, group_resource_table)
    # Get users who have access (read-only)
    res_readers = get_user_items(DYNAMODB_RES.Table(USERS_TABLE), read_only_grp_res_items)
    # Below two lines are to remove duplicate items from the list
    result = {user['EmailId']:user for user in res_readers}
    LOGGER.info("In resourceAuthUsers.get_authorized_users, read_only result - %s", result)
    users['Users']['readOnly'] = list(result.values())
    LOGGER.info("In resourceAuthUsers.get_authorized_users, Successfully retrieved resource authorized users - %s", users)
    return users

def grant_or_revoke_users_access_on_resource(event, requestor_user_item):
    """
    This method is to grant or revoke users(multiple) access on a resource
    :param event: event information  --> dict
    :param requestor_user_item: user item of user requested --> string
    """
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, starting the method")
    input_body = json.loads(event["body"])
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource method, validate access of the user before granting the access")
    resource_id = event["pathParameters"]["id"]
    resource_metadata = RESOURCE_DETAILS_MAP[event["pathParameters"]["resource"]]
    groups_resource_id_key = resource_metadata["GroupsResourceTableResourceIdKey"]

    # Check requester_credentials whether authorized or not(has owner access or not)
    resource_item, _ = commonUtil.is_user_action_valid(requestor_user_item, resource_metadata["ResourceId"], resource_id, resource_metadata["ResourceTable"], GROUPS_TABLE, "grant")

    # Validate if the user list is valid or not and also check their access to the vertical
    input_userid_list = input_body["Users"]

    # Check if the user has removed themself from the list of users and raise exception
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, checking if the user has removed themself from the list of accessible users")
    if input_body["AccessType"] == OWNER_ACCESS and resource_item["CreatedBy"] not in input_body["Users"]:
        LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, revoking permissions for the user who created the resource is not allowed")
        ec_ge_1034 = errorUtil.get_error_object("GE-1034")
        ec_ge_1034["Message"] = "Revoking permissions for the user who created the resource is not allowed"
        raise errorUtil.InvalidInputException(EVENT_INFO, ec_ge_1034)

    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, get the list of users from DynamoDB")
    dynamo_user_items = dynamodbUtil.batch_get_items(
        DYNAMODB_RES,
        USERS_TABLE,
        [{"UserId": user_id} for user_id in input_userid_list],
        "UserId"
    )
    dynamo_userid_list = [user_item["UserId"] for user_item in dynamo_user_items]
    valid_users = set(input_userid_list) & set(dynamo_userid_list)
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, validate the resultant users list against cognito and their corresponding access")
    # Get the cognito user_list and their corresponding access
    cognito_util = cognitoUtil.CognitoUtil(USER_POOL_ID, AWS_REGION)
    cognito_user_response = cognito_util.get_users_list(filter_condition='cognito:user_status = "CONFIRMED"')
    cognito_user_list = []
    for each_user in cognito_user_response:
        allowed_apps = ["amorphic"]
        user_name = each_user['Username']
        for each_attr in each_user.get('Attributes', []):
            if str(each_attr["Name"]) == "custom:attr3":
                # Value will be in format of "allowed_apps=amorphic,idp"
                allowed_apps = (each_attr["Value"].split("=")[1].split(","))
            elif str(each_attr["Name"]) == "custom:username":
                # In case of identity provider userid exists in a custom attribute called custom:username so overwriting the same
                user_name = each_attr["Value"]

        if VERTICAL_NAME.lower() in allowed_apps:
            cognito_user_list.append(user_name)

    # Final list of valid users are
    final_valid_users = valid_users & set(cognito_user_list)
    final_valid_users_group_ids = ["g_{}_{}".format(each_user, input_body["AccessType"]) for each_user in final_valid_users]

    # Invalid users list
    invalid_users = set(input_userid_list) - set(dynamo_userid_list)
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, invalid list of users passed in the input body are %s", str(list(invalid_users)))
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, valid list of users passed in the input body are %s", str(list(final_valid_users)))

    # Get the list of existing owners and read_only that have access for the resource
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, get list of existing owners & read_only that have access")
    resource_owner_read_only_items = dynamodbUtil.get_items_by_query_index(
        DYNAMODB_RES.Table(resource_metadata["GroupsResourceTable"]),
        resource_metadata["ResourceIdIndexGroupsResourceTable"],
        Key(groups_resource_id_key).eq(resource_id),
        None, None
    )
    # get groups ids from groups table (results both owner & read_only groups)
    existing_owner_groups = []
    existing_read_only_groups = []
    for each_grp_item in resource_owner_read_only_items:
        if each_grp_item.get("AccessType") == OWNER_ACCESS:
            existing_owner_groups.append(each_grp_item["GroupId"])
        elif each_grp_item.get("AccessType") == READ_ONLY_ACCESS:
            existing_read_only_groups.append(each_grp_item["GroupId"])
        else:
            LOGGER.error("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, invalid group id with no accesstype or invalid access type found - %s", str(each_grp_item["GroupId"]))

    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, existing owner groups are - %s", str(existing_owner_groups))
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, existing read_only groups are - %s", str(existing_read_only_groups))
    put_user_requests = []
    delete_user_requests = []

    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, proceeding with groups table add/remove users with the access")
    # Proceeding with updating access at groups table and add/remove users with their access
    user_groups_list = existing_owner_groups if input_body["AccessType"] == OWNER_ACCESS else existing_read_only_groups
    added_users_groups = set(final_valid_users_group_ids) - set(user_groups_list)
    removed_user_groups = set(user_groups_list) - set(final_valid_users_group_ids)

    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, added_users_groups are - %s", str(added_users_groups))
    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, removed_user_groups are - %s", str(removed_user_groups))
    # Add groups items - This is for groups resource table & Update generic groups table with the add
    for each_user_grp in added_users_groups:
        user_grp_item = {
            "GroupId": each_user_grp,
            groups_resource_id_key: resource_id,
            "AccessType": input_body["AccessType"],
            "LastModifiedTime": commonUtil.get_current_time(),
            "LastModifiedBy": requestor_user_item["UserId"]
        }
        # Below list is for resource groups table
        put_user_requests.append({'Put': {'Item': user_grp_item}})

        # Below update is for the generic groups table
        dynamodbUtil.update_item_by_key(DYNAMODB_RES.Table(GROUPS_TABLE),
            {"GroupId": each_user_grp},#key
            "ADD {0} :val1 SET LastModifiedTime = :val2, LastModifiedBy = :val3".format("{}List".format(groups_resource_id_key)), {":val1": set([resource_id]), ":val2": commonUtil.get_current_time(), ":val3": requestor_user_item["UserId"]}
        )

    # Remove groups items - This is for groups resource table & # Update generic groups table with the delete
    for each_user_grp in removed_user_groups:
        delete_user_requests.append({'Delete': {'Key': {"GroupId": each_user_grp, groups_resource_id_key: resource_id}}})

        # Below update is for the generic groups table
        dynamodbUtil.update_item_by_key(DYNAMODB_RES.Table(GROUPS_TABLE),
            {"GroupId": each_user_grp},#key
            "DELETE {0} :val1 SET LastModifiedTime = :val2, LastModifiedBy = :val3".format("{}List".format(groups_resource_id_key)), {":val1": set([resource_id]), ":val2": commonUtil.get_current_time(), ":val3": requestor_user_item["UserId"]}
        )

    LOGGER.info("In resourceAuthUsers.grant_or_revoke_users_access_on_resource, updating the respective dynamoDB tables")
    resource_group_table_requests = put_user_requests + delete_user_requests
    dynamodbUtil.batch_put_update_delete_items(DYNAMODB_RES.Table(resource_metadata["GroupsResourceTable"]), resource_group_table_requests)

    if not invalid_users:
        return commonUtil.build_post_delete_response(200, {"Message": "Successfully updated user access"})

    return commonUtil.build_post_delete_response(200, {"Message": "Successfully updated user access for valid users and ignore for invalid users - {0}".format(invalid_users)})

def get_authorized_users_for_resource(event, user_item):
    """
    This method is to get authorized users for a resource
    :param event: event information  --> dict
    :param user_item: user item of user requested --> string
    """
    LOGGER.info("In resourceAuthUsers.get_authorized_users_for_resource, starting the method")
    resource_name = event["pathParameters"]["resource"]
    resource_id = event["pathParameters"]["id"]
    resource_metadata = RESOURCE_DETAILS_MAP[resource_name]

    auth_users = get_authorized_users(
        resource_metadata["ResourceId"], resource_metadata["ResourceTable"], resource_id,
        resource_metadata["GroupsResourceTable"],
        resource_metadata["ResourceIdIndexGroupsResourceTable"],
        resource_metadata["GroupsResourceTableResourceIdKey"], user_item
    )
    response = commonUtil.build_get_response(200, auth_users)
    return response

def lambda_handler(event, context):
    """
    This is a lambda handler function which is called for every API call event
    :param event: event information
    :type event: dict
    :param context: runtime information to the handler.
    :type context: LambdaContext
    :return: response to the api
    :rtype: dict
    """
    try:
        # To remove authorization token while printing logs
        event = commonUtil.RedactAuthTokensClass(event)
        LOGGER.info("In resourceAuthUsers.lambda_handler, event - %s, context - %s", event, context)
        EVENT_INFO["eventIdentifier"] = context.aws_request_id
        errorUtil.EVENT_INFO.update({"eventIdentifier": context.aws_request_id})
        # Retrieve info from the input event & context objects
        api_request_id = event['requestContext']['requestId']
        user_id = commonUtil.get_claims(str(event['headers']['Authorization']))['cognito:username']
        http_method = event['httpMethod']
        resource_path = event['requestContext']['resourcePath'].lower()
        user_item = commonUtil.is_valid_user(user_id)
        LOGGER.info("In resourceAuthUsers.lambda_handler, Request method and API resource - %s %s", http_method, resource_path)
        LOGGER.info("In resourceAuthUsers.lambda_handler, API requested user is : %s", user_id)

        # Added PUT method for handling Dataset level access (CLOUD-2549) updates.
        if http_method == "PUT" and resource_path == "/{resource}/{id}/grants":
            LOGGER.info("In resourceAuthUsers.lambda_handler method, POST/PUT/DELETE /{resource}/{id}/users/{user_id}/grants, API call to provide access/revoke to a user for a resource")
            response = grant_or_revoke_users_access_on_resource(event, user_item)

        elif http_method == "GET" and resource_path == "/{resource}/{id}/authorizedusers":
            LOGGER.info("In resourceAuthUsers.lambda_handler method, GET /{resource}/{id}/authorizedusers, API call to retrieved authorized users for a resource")
            response = get_authorized_users_for_resource(event, user_item)

        else:
            LOGGER.error("In resourceAuthUsers.lambda_handler method, Invalid resource path, Failed to process the api request %s", api_request_id)
            ec_ge_1010 = errorUtil.get_error_object("GE-1010")
            ec_ge_1010['Message'] = ec_ge_1010['Message'].format(http_method, resource_path)
            raise errorUtil.InvalidHttpMethodTypeException(EVENT_INFO, ec_ge_1010)

    except errorUtil.FailedToUpdateMetadataException as fume:
        LOGGER.error("In resourceAuthUsers.lambda_handler, FailedToUpdateMetadataException with error - %s", str(fume))
        response = commonUtil.build_generic_response(400, {'Message': str(fume)})
    except errorUtil.InvalidHttpMethodTypeException as ihme:
        LOGGER.error("In resourceAuthUsers.lambda_handler, InvalidHttpMethodTypeException with error - %s", ihme)
        response = commonUtil.build_generic_response(400, {"Message": str(ihme)})
    except errorUtil.UnauthorizedUserException as uue:
        LOGGER.error("In resourceAuthUsers.lambda_handler, UnauthorizedUserException with error - %s", uue)
        response = commonUtil.build_generic_response(400, {'Message': str(uue)})
    except errorUtil.InvalidInputException as iie:
        LOGGER.error("In resourceAuthUsers.lambda_handler, InvalidInputException with error - %s", iie)
        response = commonUtil.build_generic_response(400, {'Message': str(iie)})
    except errorUtil.GenericFailureException as gfe:
        LOGGER.error("In resourceAuthUsers.lambda_handler method, GenericFailureException with error %s", gfe)
        response = commonUtil.build_generic_response(500, {'Message': str(gfe)})
    except errorUtil.InconsistentMetadataException as ime:
        LOGGER.error("In resourceAuthUsers.lambda_handler, InconsistentMetadataException with error %s", ime)
        response = commonUtil.build_generic_response(500, {'Message': str(ime)})
    except Exception as ex:
        LOGGER.error("In resourceAuthUsers.lambda_handler, failed with exception - %s", ex)
        error_msg_format = errorUtil.get_error_object("EMF-1001")
        err_msg = error_msg_format['Message'].format("RTE-1001", ex)
        response = commonUtil.build_generic_response(500, {'Message': err_msg})
    return response
