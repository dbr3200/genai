"""
###########################################################################################################
# File: errorUtil.py
# Location: /cloudwick-datalake/api/common-modules/error-util/errorUtil.py
#
# This file contains custom exception class for handling all errors occuring in Amorphic application
#
# Modification History:
# ====================================================================
# Date                 Who                       Description
# ==========      =================     ==============================
#
# May 12th 2021   Kaushal Kumar Agarwal           Error Codes System Refactor
#
############################################################################################################
"""
import os
import logging
import sys
import json

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

EXCEPTIONS_CODE_MAPPING = {
    "II": "InvalidInputException",
    "IM": "InconsistentMetadataException",
    "FTUM": "FailedToUpdateMetadataException",
    "UU": "UnauthorizedUserException",
    "IU": "InvalidUserException",
    "SSM": "SNSSendMessageException",
    "IHMT": "InvalidHttpMethodTypeException",
    "GF": "GenericFailureException",
    "RSC": "RedshiftConnectionException",
    "RST": "RedshiftTableException"
}
ERROR_CODE_TO_CATEGORY_MAPPING = {
    "DOM": "domains",
    "IPV": "invalidParameterValues",
    "GE": "generic",
    "AUTH": "authorization",
    "RTE": "runtime",
    "DB": "dynamoDB",
    "EP": "endpoints",
    "ROLE": "roles",
    "DWH": "dwh",
    "DLL": "dataloadLimits",
    "EMF": "errorMessageFormat",
    "SA": "systemAlerts",
    "DS": "datasets",
    "PGS": "postgresSql",
    "RS": "redshift",
    "GRP": "groups",
    "MDL": "models",
    "DASH": "dashboards",
    "JOB": "jobs",
    "SCH": "schedules",
    "CON": "connections",
    "WF": "workflows",
    "STRM": "streams",
    "DSI": "deepsearch-indices",
    "LOG": "logs",
    "CER": "cer",
    "NB": "notebooks",
    "ACR": "accessRequests",
    "INS": "insights",
    "CE": "costExplorer",
    "PN": "pushNotifications"
}

def get_valid_error_codes():
    """
    Parse all valid error codes from catalog json file
    :return: List of all valid error codes
    """
    LOGGER.info("In errorUtil.get_valid_error_codes, started getting all valid error codes")
    all_err_codes = []
    for err_category in ERROR_CODE_DEFINITIONS:
        err_codes_by_category = [err_code_def["Code"] for err_code_def in ERROR_CODE_DEFINITIONS[err_category]]
        all_err_codes.extend(err_codes_by_category)
    LOGGER.info("In errorUtil.get_valid_error_codes, returning all valid error codes - %s", all_err_codes)
    return all_err_codes


def get_error_object(error_code):
    """
    Get the error definition for given errorCode
    :param error_code: error code provided by user
    :return: Dict containing error definition
    """
    LOGGER.info("In errorUtil.get_error_object, started getting definition object for error code - %s", error_code)
    if error_code in VALID_ERROR_CODES:
        error_code_prefix = error_code.split('-')[0]
        error_category = ERROR_CODE_TO_CATEGORY_MAPPING[error_code_prefix]
        for err_code_def in ERROR_CODE_DEFINITIONS[error_category]:
            if error_code == err_code_def["Code"]:
                modified_err_code_def = err_code_def.copy()
                LOGGER.info("In errorUtil.get_error_object, returning error object - %s", modified_err_code_def)
                modified_err_code_def.pop('Class', None)
                modified_err_code_def.pop('Title', None)
                modified_err_code_def.pop('Description', None)
                return modified_err_code_def
    else:
        LOGGER.error("In errorUtil.get_error_object, provided error code %s is invalid", error_code)
        return {"Code": error_code, "Message": "Unknown Issue"}


def raise_exception(event_info, exception_type, error_code, message, *args):
    """
    Raises exception based on the input data
    :param exception_type: Type of exception. Ex: InvalidInput, InvalidHttpMethodType
    :param error_code: Error code provided by user. Ex: "GE-1008", "IPV-1001"
    :param message: Custom message to be overwritten for some generic codes.
    :param args: Arguments to be replaced for specified code message. Ex: "DatasetId" for "Invalid {}"
    :return: Dict containing error definition
    """
    LOGGER.info("In errorUtil.raise_exception, Raising %sException for error code '%s' with message '%s' \
                and arguments - %s", EXCEPTIONS_CODE_MAPPING[exception_type], error_code, message, args)
    code_obj = get_error_object(error_code)
    if message:
        code_obj['Message'] = code_obj['Message'] if message == "default" else message
    elif args:
        code_obj['Message'] = code_obj['Message'].format(*args)
    else:
        code_obj['Message'] = get_error_object(DEFAULT_ERROR_CODE)['Message']
    raise globals()[EXCEPTIONS_CODE_MAPPING[exception_type]](event_info, code_obj)

def get_referenced_filepath(file_name):
    """
    This functions checks if a given file is present in any of the sys.path directories.
    This is for handling differences in file location betwen Glue python shell and spark jobs.
    :param file_name: file name to be searched
    """
    sys.path.insert(0, '/tmp')
    for dir_name in sys.path:
        candidate = os.path.join(dir_name, file_name)
        if os.path.isfile(candidate):
            return candidate
    LOGGER.error("In errorUtil.get_referenced_filepath,provided file %s could not be found", file_name)
    raise Exception(f"In errorUtil.get_referenced_filepath,provided file {file_name} could not be found")

try:
    try:
        LOGGER.info("In dynamodbUtil, Attempting to read errorCodeCatalog.json from layer")
        with open("/var/lang/lib/python3.12/site-packages/errorCodeCatalog.json", "r", encoding="utf8") as json_file:
            ERROR_CODE_CATALOG = json.load(json_file)
    except Exception:
        LOGGER.info("In errorUtil, invocation is from a Glue script, attempting to read errorCodeCatalog.json")
        with open(get_referenced_filepath("errorCodeCatalog.json"), "r", encoding="utf8") as json_file:
            ERROR_CODE_CATALOG = json.load(json_file)
    LOGGER.info("In errorUtil, Successfully loaded errorCodeCatalogDesc fsile")
    ERROR_CODE_DEFINITIONS = ERROR_CODE_CATALOG["errorCodeDefinitions"]
    VALID_ERROR_CODES = get_valid_error_codes()
    EVENT_INFO = {}
    DEFAULT_ERROR_CODE = "GE-1008"
except Exception as ex:
    LOGGER.error("In errorUtil, Failed to get valid error codes from catalog json - %s", ex)
    sys.exit()

# pylint: disable=consider-using-generator
class ApplicationException(Exception):
    """
    Creating a custom exception for server side errors
    """
    def __init__(self, event_info, error_info):
        event_identifier = event_info.get("eventIdentifier", "N/A")
        error_code = error_info.get("Code", "N/A")
        error_message = error_info.get("Message", "N/A")
        LOGGER.info("In errorUtil.ApplicationException init, eventIdentifier -> %s", event_identifier)
        # parse error_message if recursive exceptions have happened
        if error_message.startswith(tuple([prefix + "-" for prefix in ERROR_CODE_TO_CATEGORY_MAPPING])):
            formatted_error_msg = error_message.split(" - ")
            error_message = " - ".join(formatted_error_msg[1:])
        # Validate if the error code is defined
        if error_code in VALID_ERROR_CODES:
            LOGGER.info("In errorUtil.ApplicationException init, Valid ERROR_CODE - %s", error_code)
            Exception.__init__(self, "{} - {}".format(error_code, error_message))
        else:
            LOGGER.error("In errorUtil.ApplicationException init, Invalid ERROR_CODE - %s", error_code)
            Exception.__init__(self, "N/A - {}".format(error_message))


class InvalidInputException(ApplicationException):
    """
    Creating a custom exception for input validation
    """


class InconsistentMetadataException(ApplicationException):
    """
    Creating a custom exception for inconsistent metadata errors
    """


class FailedToUpdateMetadataException(ApplicationException):
    """
    Creating a custom exception for server side errors
    """


class UnauthorizedUserException(ApplicationException):
    """
    Creating a custom exception for unauthorized operations
    """


class InvalidUserException(ApplicationException):
    """
    Creating a custom exception for invalid user
    """


class SNSSendMessageException(ApplicationException):
    """
    Creating a custom exception when failing to send SNS message
    """


class InvalidHttpMethodTypeException(ApplicationException):
    """
    Creating a custom exception when wrong HTTP Method is used
    """


class GenericFailureException(ApplicationException):
    """
    Creating a custom exception for server side errors
    """
