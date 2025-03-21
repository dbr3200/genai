"""
Cognito util to interact with aws cognito
"""

import logging
import json
import boto3
import errorUtil

EVENT_INFO = errorUtil.EVENT_INFO


class InvalidUserPoolIdException(Exception):
    """
    Exception if user pool Id is invalid
    """

    def __init__(self, error_arguments):
        Exception.__init__(self, error_arguments)


class CognitoUtil():
    """
    Class to interact with aws cognito
    """

    def __init__(self, user_pool_id, region):
        self.region = region
        self.__logger = logging.getLogger()
        self.__logger.setLevel(logging.INFO)
        self.__cognito_client = boto3.client("cognito-idp", region_name=region)
        self.__user_pool_id = user_pool_id

    def get_cognito_username_from_email(self, user_id, email):
        """
        Get Cognito username from user emailID
        :param user_id:
        :param email:
        :return:
        """
        try:
            filter_str = "email = '{0}'".format(email)
            self.__logger.info("In cognitoUtil.get_cognito_username_from_email, getting cognito username from email %s", email)
            users_response = self.__cognito_client.list_users(
                UserPoolId=self.__user_pool_id,
                Filter=filter_str
            )
            self.__logger.info("In cognitoUtil.get_cognito_username_from_email, users_response - %s",
                               json.dumps(users_response, default=str))
            if not users_response['Users']:
                self.__logger.error("In cognitoUtil.get_cognito_username_from_email, there is no user with email %s", email)
                ec_grp_1008 = errorUtil.get_error_object("GRP-1008")
                ec_grp_1008["Message"] = ec_grp_1008["Message"] + "with user_id {}".format(user_id)
                raise errorUtil.InvalidInputException(EVENT_INFO, ec_grp_1008)

            return users_response['Users'][0]['Username']
        except self.__cognito_client.exceptions.ResourceNotFoundException as cognito_ex:
            self.__logger.error("In cognitoUtil.get_cognito_username_from_email, User pool %s is not available",
                                self.__user_pool_id)
            raise InvalidUserPoolIdException("User pool {} id invalid".format(self.__user_pool_id)) from cognito_ex

    def get_user(self, userid):
        """
        Get the user details from cognito
        :param userid: userId
        :return:
        """

        try:
            self.__logger.info("In %s, under get_user, getting user details", str(__file__))
            user_detail = self.__cognito_client.admin_get_user(
                UserPoolId=self.__user_pool_id,
                Username=userid
            )
        except self.__cognito_client.exceptions.UserNotFoundException:
            self.__logger.error("In %s under get_user, User %s not found under user pool %s.",
                                str(__file__), userid, self.__user_pool_id)
            user_detail = None
        except self.__cognito_client.exceptions.ResourceNotFoundException as cognito_ex:
            self.__logger.error("In %s under get_user, User pool %s is not available",
                                str(__file__), self.__user_pool_id)
            raise InvalidUserPoolIdException("User pool {} id invalid".format(self.__user_pool_id)) from cognito_ex

        return user_detail

    def logout_user(self, userid):
        """
        Logs out user from all devices
        :param userid:
        :return:
        """

        success = False
        try:
            self.__logger.info("In %s, under logout_user, logging out user from all devices.", str(__file__))

            # Invoke get_user to check valid user id
            self.get_user(userid)

            response = self.__cognito_client.admin_user_global_sign_out(
                UserPoolId=self.__user_pool_id,
                Username=userid
            )
            if "ResponseMetadata" in response and response["ResponseMetadata"]["HTTPStatusCode"] == 200:
                success = True
        except Exception as ex:
            self.__logger.error("In %s under logout_user, Unable to logout user %s with error %s",
                                str(__file__), userid, str(ex))
        return success

    def disable_user(self, userid):
        """
        Disables user in cognito
        :param userid:
        :return:
        """

        status = False
        try:
            self.__logger.info("In %s under disable_user, getting user details from cognito.", str(__file__))
            user_details = self.get_user(userid)
            self.__logger.info("In %s uder disable_user, disabling user %s", str(__file__), userid)
            response = self.__cognito_client.admin_disable_user(
                UserPoolId=self.__user_pool_id,
                Username=userid
            )
            if "ResponseMetadata" in response and response["ResponseMetadata"]["HTTPStatusCode"] == 200:
                user_details = self.get_user(userid)
                if "Enabled" in user_details and not user_details["Enabled"]:
                    status = True
        except Exception as ex:
            self.__logger.error("In %s under disable_user, Unable to disable user %s with error %s",
                                str(__file__), userid, str(ex))
        return status

    def enable_user(self, userid):
        """
        Enables user in cognito
        :param userid:
        :return:
        """

        status = False
        try:
            self.__logger.info("In %s under enable_user, getting user details from cognito.", str(__file__))
            user_details = self.get_user(userid)
            self.__logger.info("In %s uder enable_user, enabling user %s", str(__file__), userid)
            response = self.__cognito_client.admin_enable_user(
                UserPoolId=self.__user_pool_id,
                Username=userid
            )
            if "ResponseMetadata" in response and response["ResponseMetadata"]["HTTPStatusCode"] == 200:
                user_details = self.get_user(userid)
                if "Enabled" in user_details and user_details["Enabled"]:
                    status = True
        except Exception as ex:
            self.__logger.error("In %s under enable_user, Unable to enable user %s with error %s",
                                str(__file__), userid, str(ex))

        return status

    def disable_user_mfa(self, userid):
        """
        Disables user software token mfa in cognito
        :param userid:
        :return:
        """

        status = False
        error = None
        try:
            self.__logger.info("In %s under disable_user_mfa, disabling software token mfa for user %s", str(__file__), userid)
            response = self.__cognito_client.admin_set_user_mfa_preference(
                SoftwareTokenMfaSettings={
                    'Enabled': status
                },
                UserPoolId=self.__user_pool_id,
                Username=userid
            )
            if "ResponseMetadata" in response and response["ResponseMetadata"]["HTTPStatusCode"] == 200:
                status = True
        except Exception as ex:
            self.__logger.error("In %s under disable_user_mfa, Unable to disable software token mfa for user %s with error %s", str(__file__), userid, str(ex))
            error = str(ex)
        return status, error

    def get_users_list(self, filter_condition=""):
        """
        function to return list of users in cognito
        :param filter_condition: condition to be applied on filtering the listing of users
        """

        kwargs = {
            'UserPoolId': self.__user_pool_id,
            'Filter': filter_condition
        }

        users_remain = True
        users = []

        while users_remain:
            response = self.__cognito_client.list_users(**kwargs)
            users.extend(response['Users'])
            pagination_token = response.get('PaginationToken', None)
            if pagination_token is None:
                users_remain = False
            else:
                kwargs['PaginationToken'] = pagination_token
        return users
