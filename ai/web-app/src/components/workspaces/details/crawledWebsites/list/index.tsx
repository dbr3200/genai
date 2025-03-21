import React, { useEffect, useState } from "react";
import { Spinner, Button } from "@amorphic/amorphic-ui-core";
import PerfectScrollbar from "react-perfect-scrollbar";

import { useAppDispatch, useAppSelector, usePaginationState, useSuccessNotification } from "../../../../../utils/hooks";
import { CustomFieldConstructor } from "./customFieldConstructor";
import { DataTable } from "../../../../customComponents/dataTable";
import SidePanel from "../../../../customComponents/sidePanel";
import { useDeleteWorkspaceCrawlMutation, useGetWorkspaceCrawlListQuery } from "../../../../../services/workspaces";
import { setPagination } from "../../../../../modules/pagination";
import { CrawlWebsite } from "./crawlWebsite";
import { ConfirmationModal } from "../../../../customComponents/confirmationModal";
import DeleteConfirmationMessage from "../../../../customComponents/deleteConfirmationMessage";
import CrawlJobMetaData from "../details/CrawlJobMetaData";
import { useTranslation } from "react-i18next";

interface IFilesProps {
  resourceId: string;
}

const SORT_COLUMN_MAPPINGS = {
  LastModifiedTime: "LastModifiedTime",
  CrawlId: "CrawlId",
  CrawlStatus: "CrawlStatus",
  WebsiteURL: "WebsiteURL",
  LastModifiedBy: "LastModifiedBy"
};

const DISPLAY_FIELDS = [
  { "FieldName": "WebsiteURL", "FieldProps": { defaultDisplay: true, fixed: true } },
  { "FieldName": "CrawlId", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "CrawlStatus", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "IndexStatus", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "LastModifiedTime", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "LastModifiedBy", "FieldProps": { defaultDisplay: false } }
];

const MODULE_DEFAULT_PAGINATION_SETTING = { sortBy: "LastModifiedTime", sortOrder: "desc", limit: 50 };

export const CrawledWebsitesList = ({
  resourceId
}: IFilesProps ): JSX.Element => {
  const { t } = useTranslation();
  const permPathKey = "workspaces";
  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );
  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );

  const dispatch = useAppDispatch();

  const [ crawlId, setCrawlId ] = useState<string>( "" );
  const [ showCrawlMetadata, setShowCrawlMetadata ] = useState<boolean>( false );
  const [ showDeleteModal, setShowDeleteModal ] = useState<boolean>( false );

  const {
    data: { WebCrawlings: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    refetch
  } = useGetWorkspaceCrawlListQuery({ id: resourceId, queryParams: { offset, limit, sortby: sortBy, sortorder: sortOrder } }, {
    refetchOnMountOrArgChange: true,
    skip: !resourceId
  });

  const customDisplayFields = CustomFieldConstructor({ setCrawlId: setCrawlId, setShowCrawlMetadata: setShowCrawlMetadata,
    setShowDeleteModal
  });

  const [ showTriggerPanel, setShowTriggerPanel ] = useState<boolean>( false );
  const [showSuccessNotification] = useSuccessNotification();

  const [ deleteCrawlMetadata, { isLoading: deletingMetadata }] = useDeleteWorkspaceCrawlMutation();

  useEffect(() => {
    dispatch( setPagination({
      key: permPathKey,
      data: defaultPaginationState
    }));
  // Adding more dependencies will cause infinite loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  return (( isLoading ) ? <div className="flex justify-center items-center py-4">
    <Spinner size="sm" />
  </div> : <>
    { <PerfectScrollbar className="flex-grow h-auto w-full">
      <DataTable
        // for identifying, search & display
        dataIdentifiers={{
          permPathKey: permPathKey,
          searchKeys: ["CrawlId"],
          id: "CrawlId",
          name: "CrawlId",
          currentSelection: resourceId
        }}
        // for pagination actions
        defaultPaginationState={defaultPaginationState}
        totalCount={total_count}
        // loading and data display
        reloadData={refetch}
        compactTable={false}
        loading={isFetching || isLoading || isUninitialized}
        resourcesList={resourcesList}
        customFields={customDisplayFields}
        // for sorting & filtering
        availableFields={DISPLAY_FIELDS}
        sortableFields={SORT_COLUMN_MAPPINGS}
        additionalCTAs={[
          <Button key="ctas" classes="mr-0 ml-auto" variant="stroked" size="sm" onClick={() => setShowTriggerPanel( true )}
          >
            {t( "services.workspaces.triggerNewCrawlJob" )}
          </Button>
        ]}
      />
      <SidePanel
        show={showTriggerPanel}
        header={t( "services.workspaces.triggerCrawlJob" )}
        onClose={() => setShowTriggerPanel( false )}
        size="sm"
      >
        <CrawlWebsite closePanel={setShowTriggerPanel} workspaceId={resourceId} />
      </SidePanel>
      <SidePanel
        show={showCrawlMetadata}
        header={
          resourcesList?.find(( ws: any ) => ws.CrawlId === crawlId )?.WebsiteURL ||
          t( "services.workspaces.crawlMetadata" )
        }
        onClose={() => setShowCrawlMetadata( false )}
        size="lg">
        <CrawlJobMetaData resourceId={resourceId} crawlId={crawlId} />
      </SidePanel>
      <ConfirmationModal
        showModal={showDeleteModal}
        loading={deletingMetadata}
        closeModal={() => setShowDeleteModal( false )}
        onConfirm= {async() => {
          try {
            await deleteCrawlMetadata({ id: resourceId, crawlId: crawlId })
              .unwrap()
              .then(( response: any ) => {
                if ( !response.error ) {
                  showSuccessNotification({
                    autoHideDelay: 5000,
                    content: response.Message
                  });
                  setShowDeleteModal( false );
                }
              })
              .catch();
            // eslint-disable-next-line no-empty
          } catch {}
        }}
        onCancel={() => setShowDeleteModal( false )}
      >
        <DeleteConfirmationMessage resourceType={t( "services.workspaces.crawlMetadata" )} resourceName={crawlId} />
      </ConfirmationModal>
    </PerfectScrollbar>
    }
  </> );
};

export default CrawledWebsitesList;