"""
This file has all the common functions that are used for aurora connections and vector table creation.
"""
import logging
import os
import json
import psycopg2
from psycopg2 import sql
import psycopg2.extras
from pgvector.psycopg2 import register_vector

import commonUtil

RAG_DATABASE = os.environ['RAGDatabase']
RAG_HOST = os.environ['RAGHost']
RAG_PORT = os.environ['RAGPort']

# Initialize LOGGER.and set config and log level
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


class AuroraConnection():
    """Methods for connecting to Aurora
    """
    def __init__(self, service_user_secret_arn, secrets_manager_client, autocommit=True):
        self.autocommit = autocommit

        self.database = RAG_DATABASE
        self.dbhost = RAG_HOST
        self.dbport = RAG_PORT
        service_user_secret_value = json.loads(commonUtil.get_secret_value(secrets_manager_client, service_user_secret_arn))
        self.dbuser = service_user_secret_value['username']
        self.dbpass = service_user_secret_value['password']

        # Added to avoid pylint issue - attribute-defined-outside-init
        self.connection = None
        self.cursor = None

    def __enter__(self):
        connection = psycopg2.connect(
            database = self.database,
            host=self.dbhost,
            user=self.dbuser,
            password=self.dbpass,
            port=self.dbport,
            connect_timeout=10,
        )

        connection.set_session(autocommit=self.autocommit)
        psycopg2.extras.register_uuid()
        register_vector(connection)
        cursor = connection.cursor()
        self.connection = connection
        self.cursor = cursor

        return cursor

    def __exit__(self, *args):
        self.cursor.close()
        self.connection.close()

def create_workspace_table(workspace_item, service_user_secret_arn, secrets_manager_client, embeddings_model_dimensions = 1536):
    """Create a workspace table
    """
    LOGGER.info("In auroraUtil.create_workspace_table, creating a table in aurora for workspace with id - %s", workspace_item["WorkspaceId"])
    workspace_id = workspace_item["WorkspaceId"]

    table_name = sql.Identifier(f"table_{workspace_id.replace('-', '')}")
    with AuroraConnection(service_user_secret_arn, secrets_manager_client) as cursor:
        cursor.execute(
            sql.SQL(
                """CREATE TABLE {table} (
                    chunk_id UUID PRIMARY KEY,
                    chunks TEXT,
                    embeddings vector(%s),
                    metadata JSON
                );"""
            ).format(table=table_name),
            [embeddings_model_dimensions],
        )
    LOGGER.info("In auroraUtil.create_workspace_table, successfully created the table")

def delete_workspace_table(workspace_id, service_user_secret_arn, secrets_manager_client):
    """Delete a workspace table
    """
    LOGGER.info("In auroraUtil.delete_workspace_table, deleting the table in aurora for workspace with id - %s", workspace_id)
    table_name = sql.Identifier(workspace_id.replace("-", ""))
    with AuroraConnection(service_user_secret_arn, secrets_manager_client, autocommit=False) as cursor:
        cursor.execute(
            sql.SQL("DROP TABLE IF EXISTS {table};").format(table=table_name)
        )

        cursor.connection.commit()
    LOGGER.info("In auroraUtil.delete_workspace_table, successfully deleted the table")
