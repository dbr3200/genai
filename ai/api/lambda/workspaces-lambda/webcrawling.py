"""Methods relating to crawling websites that are linked to a workspace
"""
import logging
import uuid
import os
import time
import re
from urllib.parse import urlparse
import boto3
import requests
from bs4 import BeautifulSoup

import commonUtil
import dynamodbUtil

AI_DATA_BUCKET = os.environ["aiDataBucket"]
LZ_BUCKET_NAME = os.environ["LZBucketName"]
AWS_REGION = os.environ["awsRegion"]

WORKSPACES_TABLE = dynamodbUtil.WORKSPACES_TABLE
WORKSPACES_DOCUMENTS_TABLE = dynamodbUtil.WORKSPACES_DOCUMENTS_TABLE

DYNAMODB_RESOURCE = boto3.resource('dynamodb', AWS_REGION)
S3_RESOURCE = boto3.resource('s3', AWS_REGION)

# Initialize LOGGER.and set config and log level
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

# Priority queue is used for storing unprocessed websites and is being stored in dynamodb
# Adding a hard limit to queue length in order to avoid exceeding the dynamodb item size limit
MAX_PRIORITY_QUEUE_LENGTH = 300

def parse_url(url: str) -> list:
    """Parsing content from a URL

    Args:
        url (string): URL to parse data from
    """
    root_url_parse = urlparse(url)
    base_url = f"{root_url_parse.scheme}://{root_url_parse.netloc}"

    response = requests.get(url, timeout=20)
    soup = BeautifulSoup(response.content, "html.parser")

    links = set(a["href"] for a in soup.find_all("a", href=True))
    local_links = set()
    local_links_starting_with_base_path = set()

    for link in links:
        current = urlparse(link)
        if not current.netloc:
            local_links_starting_with_base_path.add(f"{base_url}{link}")
        else:
            if current.netloc == root_url_parse.netloc:
                if link.startswith(base_url):
                    local_links_starting_with_base_path.add(link)
                else:
                    local_links.add(link)

    local_links = list(local_links_starting_with_base_path) + list(local_links)

    return local_links


def crawl_urls(event):
    """Crawl through a list of urls and store the data in S3

    Args:
        event (dict): Input event
    """
    LOGGER.info("In webcrawling.crawl_urls, event received: %s", event)
    workspace_id = event['WorkspaceId']
    document_id = event['DocumentId']
    document_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), {'WorkspaceId': workspace_id, 'DocumentId': document_id})
    document_details = document_item["DocumentDetails"]
    processed_urls = document_details.get('NestedURLs', set())
    if processed_urls:
        processed_urls = set(url['URL'] for url in processed_urls)
    priority_queue = document_item.get('PriorityQueue', event['PriorityQueue'])
    follow_links = document_details['FollowLinks']
    limit = event.get('Limit', document_details['PageLimit'])

    current_limit = min(limit, 20)
    idx = 0
    while idx < current_limit:
        if len(priority_queue) == 0:
            break

        priority_queue = sorted(priority_queue, key=lambda val: val["priority"])
        current = priority_queue.pop(0)
        current_url = current["url"]
        current_priority = current["priority"]
        if current_url in processed_urls:
            continue

        idx += 1

        document_sub_id = str(uuid.uuid4())
        processed_urls.add(current_url)
        LOGGER.info("In webcrawling.crawl_urls, processing url  - %s : %s", document_sub_id, current_url)

        try:
            local_links = parse_url(current_url)
        except Exception as ex:
            LOGGER.error("In webcrawling.crawl_urls, Failed to parse url: %s due to error - %s", current_url, ex)
            continue

        if follow_links:
            for link in local_links:
                if link not in processed_urls:
                    priority_queue.append(
                        {"url": link, "priority": current_priority + 1}
                    )

    limit = max(limit - idx, 0)
    done = len(priority_queue) == 0 or limit == 0
    key_condition_expression = {'DocumentId': document_id, 'WorkspaceId': workspace_id}
    update_expression = "SET DocumentDetails.NestedURLs = :val1, LastModifiedTime = :val2"
    nested_urls = [{'URL': url, 'Indexed': False}  for url in processed_urls]
    expression_attributes = {
        ":val1": list(nested_urls),
        ":val2": commonUtil.get_current_time(),
    }
    if done:
        update_expression += ", CrawlStatus = :val3 REMOVE PriorityQueue"
        expression_attributes.update({
            ":val3": commonUtil.RUN_STATUS_COMPLETE
        })
        event.update({
            'Operation': 'Complete'
        })
    else:
        update_expression += ", PriorityQueue = :val3"
        expression_attributes.update({
            ":val3": priority_queue[:min(MAX_PRIORITY_QUEUE_LENGTH, len(priority_queue))]
        })
        event.update({'Limit': limit})
    update_status = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), key_condition_expression, update_expression, expression_attributes)
    if update_status == "error":
        LOGGER.error("In webcrawling.crawl_urls, Failed to add list of processed urls in documents table")
    return event


def process_website(event):
    """Process a website linked to a workspace

    Args:
        event (object): Input event
    """
    workspace_id = event['WorkspaceId']
    document_id = event['DocumentId']
    LOGGER.info("In webcrawling.process_website, processing the website with id: %s for workspace with id: %s", document_id, workspace_id)
    document_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), {'DocumentId': document_id, 'WorkspaceId': workspace_id})

    document_details = document_item["DocumentDetails"]
    base_url = document_details["WebsiteURL"]
    urls_to_crawl = [base_url]

    priority_queue = [{"url": url, "priority": 1} for url in set(urls_to_crawl)]

    commonUtil.update_document_status(document_id, workspace_id, commonUtil.RUN_STATUS_IN_PROGRESS, 'Starting website processing')

    event.update({
        'Operation': 'process_pending_urls',
        'PriorityQueue': priority_queue
    })
    response = crawl_urls(event)
    return response

def store_web_content_in_dataset(event):
    """Store the web content parsed from the given website into the given dataset's LZ bucket

    Args:
        event (dict): Input event object
    """
    LOGGER.info("In webcrawling.store_web_content_in_dataset, storing the content scraped from url in s3 with event: %s", event)
    url = event['URL']
    document_id = str(uuid.uuid4())
    workspace_id = event['WorkspaceId']
    user_id = event['UserId']
    domain = event['Domain']
    dataset_name = event['DatasetName']
    try:
        url_response = requests.get(url, timeout=20)
        soup = BeautifulSoup(url_response.content, "html.parser")
        content = soup.get_text(separator=' ')
        content = re.sub(r"[ \n]+", " ", content)

        if content.strip():
            S3_RESOURCE.Object(LZ_BUCKET_NAME, f"{domain}/{dataset_name}/upload_date={str(int(time.time()))}/{user_id}/txt/website_{document_id}.txt",).put(Body=content)
            LOGGER.info("In webcrawling.store_web_content_in_dataset, successfully uploaded the content scraped from url in lz bucket")
        else:
            LOGGER.info("In webcrawling.store_web_content_in_dataset, no web content was found in the website")

        document_item = {
            "DocumentId": document_id,
            "WorkspaceId": workspace_id,
            "DocumentType": 'website',
            "LastModifiedBy": user_id,
            "LastModifiedTime": commonUtil.get_current_time(),
            "DocumentDetails": {
                'WebsiteURL': url
            },
            "Message": 'File upload initiated' if content.strip() else 'No scraped content was found'
        }
        put_status = dynamodbUtil.put_item(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), document_item)
        if put_status == "error":
            LOGGER.error("In webcrawling.store_web_content_in_dataset, failed to create document item in dynamodb, please check for errors.")
        return url
    except Exception as ex:
        LOGGER.error("In webcrawling.store_web_content_in_dataset, Failed to crawl website due to exception - %s", str(ex))
        return None

def update_crawling_job_metadata(event) -> None:
    """Update the crawling job metadata with the latest index statuses for nested websites

    Args:
        event (dict): Input event

    Returns:
        dict: _description_
    """
    LOGGER.info("In webcrawling.update_crawling_job_metadata, updating metadata for crawl job with input event: %s", str(event))
    workspace_id = event['WorkspaceId']
    web_crawl_id = event['WebCrawlId']
    processed_urls = event['ProcessedURLs']
    key_condition_expression = {'WorkspaceId': workspace_id, 'DocumentId': web_crawl_id}
    crawl_job_item = dynamodbUtil.get_item_with_key(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), key_condition_expression)
    nested_urls = crawl_job_item['DocumentDetails']['NestedURLs']
    for url in nested_urls:
        if url['URL'] in processed_urls:
            url['Indexed'] = True
    update_expression = "SET DocumentDetails.NestedURLs = :nurls, LastModifiedTime = :lmt, LastModifiedBy = :lmb"
    expression_attributes = {
        ":nurls": nested_urls,
        ":lmt": commonUtil.get_current_time(),
        ":lmb": event['UserId']
    }
    update_status = dynamodbUtil.update_item_by_key(DYNAMODB_RESOURCE.Table(WORKSPACES_DOCUMENTS_TABLE), key_condition_expression, update_expression, expression_attributes)
    if update_status == "error":
        LOGGER.error("In webcrawling.update_crawling_job_metadata, Failed to add list of processed urls in documents table")
    LOGGER.info("In webcrawling.update_crawling_job_metadata, successfully updated crawl job metadata")
