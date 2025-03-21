"""
######################################################################################################
# File: buildCythonLambda.py
# Location: /cloudwick-datalake/buildCythonLambda.py
#
# This lambda is to used to perform all operations related to file format conversion
#
#    1. Convert all ".py" files to ".so" files based on the input directory passed
#    2. Convert all common modules files to ".so" files as well
#
# Modification History:
# ====================================================================
# Date                 Who                       Description
# ==========      =================     ==============================
# 08/12/2020         K.Sainadh                  Initial commit
#########################################################################################################
"""
#!/usr/bin/env python

import os
import sys
import logging
import shutil
from distutils.core import setup
from distutils.extension import Extension
from distutils.sysconfig import get_config_var
#from setuptools import setup, Extension

logging.basicConfig()
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

try:
    from Cython.Distutils import build_ext
    from Cython.Build import cythonize
except Exception:
    LOGGER.error("In buildCythonLambda, Cython not installed, please verify")
    sys.exit(1)

# Below is the list of files and directories that we shouldn't change to ".so" format
EXCLUDE_DIRS = ["wf-module-glue-scripts"]
EXCLUDE_FILES = []

# By default cython builds the files names in the format of file.cpython-37m-x86_64-linux-gnu.so instead of file.so
# To eliminate the additional info in the file name and to get only file.so as the result below class will do the trick
class NoSuffixBuilder(build_ext):
    """
    Create custom file name instead of default cython naming convention
    """
    def get_ext_filename(self, ext_name):
        filename = super().get_ext_filename(ext_name)
        suffix = get_config_var('EXT_SUFFIX')
        ext = os.path.splitext(filename)[1]
        return filename.replace(suffix, "") + ext

def scan_directory(directory, files):
    """
    This method is to get the list of all files from the directory received in the argument
    : directory -> Directory to list the files
    : files -> List of files
    """
    # Get list of files from the directory given
    LOGGER.info("In buildCythonLambda, getting the list of files in the directory - %s", str(directory))
    for each_dir in os.listdir(directory):
        if directory.split("/")[-1] not in EXCLUDE_DIRS:
            path = os.path.join(directory, each_dir)
            if os.path.isfile(path) and path.endswith(".py") and path.split("/")[-1] not in EXCLUDE_FILES:
                # Remove extension from the file name
                files.append(path)
            elif os.path.isdir(path):
                scan_directory(path, files)
    return files


# generate an Extension object
def make_extension(ext_name):
    """
    This method is to return extension object from the given list of input files
    """
    # Just the name of module is enough, no need to give full path below while bulding the extension
    # Example --> Extension("lambda", ["lambda.py"])
    # To create .so files in their respective folders, we have to specify path in the format of ex:- "api.lambda.send-message-to-queue.sendMessageToQueue"
    return Extension(
                    ext_name.split("/")[-1][:-3],
                    [ext_name]
                    )

def main():
    """
    This main method is to get list of files and prep the extensions to build cython module
    """
    try:
        LOGGER.info("In buildCythonLambda, starting the main method")

        if len(sys.argv) < 2 and sys.argv[5] not in ["api", "infra", "web"]:
            LOGGER.error("In buildCythonLambda, directory param is not passed in the arguments or invalid argumet passed")
            print (sys.argv)
            sys.exit(1)

        # Assign input directory argument to a variable
        directory = sys.argv[5]
        sys.argv.remove(directory) # Removing additional argument is important otherwise build_ext fails with invalid argument

        # Get list of files from the directories
        LOGGER.info("In buildCythonLambda, getting the list of files from the input directory - %s", str(directory))

        # get the list of files in input directory passed
        if directory == "api":
            api_lambda_dir_files = scan_directory(directory + "/lambda", [])
            common_dir_files = scan_directory("api/common-modules", [])
            final_files_list = common_dir_files + api_lambda_dir_files

        if directory == "infra":
            infra_lambda_dir_files = scan_directory(directory + "/lambda", [])
            final_files_list = infra_lambda_dir_files

        # Checking if the input dir passed is infra, if yes then get list of files from web resorces lambda folder
        if directory == "web":
            LOGGER.info("In buildCythonLambda, input directory passed is web so get the list of files from web resources lambda")
            web_lambda_dir_files = scan_directory("infra/web-resources-lambda", [])
            final_files_list = web_lambda_dir_files

        LOGGER.info("In buildCythonLambda, final list of files - %s", str(final_files_list))
        ext_modules = [make_extension(name) for name in final_files_list]

        LOGGER.info("In buildCythonLambda, running setup command with extensions")
        setup(
            name = 'BuildLambdaFunctions',
            cmdclass = {'build_ext': NoSuffixBuilder},
            ext_modules = cythonize(ext_modules,
            nthreads=20,
            quiet=True,
            compiler_directives={'language_level' : "3"})
        )

        # Move .so files from root folder to its respective location
        # All files will be created in the build directory irrespective of their source file location
        LOGGER.info("In buildCythonLambda, copying all .so files from build location to actual folder location")
        for each_file in final_files_list:
            file_name = each_file.rsplit("/", 1)[1]
            file_folder = each_file.rsplit("/", 1)[0]
            # Move ".so" file from build folder to its respective location
            shutil.copy(file_name[:-3] + ".so", file_folder)

        # Remove files from the build location
        LOGGER.info("In buildCythonLambda, removing all .so files from build location")
        for each_file in final_files_list:
            file_name = each_file.rsplit("/", 1)[1][:-3] + ".so" #Remove path and add .so extension to file name
            if os.path.exists(file_name):
                os.remove(file_name)
            else:
                LOGGER.info("In buildCythonLambda, file %s deleted already", str(file_name))

        LOGGER.info("In buildCythonLambda, all operations completed successfully, exiting the code")

    except Exception as ex:
        LOGGER.error("In buildCythonLambda, build failed with error %s", str(ex))
        sys.exit(1)


if __name__ == "__main__":
    main()
