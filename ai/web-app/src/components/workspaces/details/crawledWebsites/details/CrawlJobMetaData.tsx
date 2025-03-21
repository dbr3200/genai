import React, { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, SkeletonBlock } from "@amorphic/amorphic-ui-core";

import { useGetWorkspaceCrawlDetailsQuery } from "../../../../../services/workspaces";
import { extractError } from "../../../../../utils/stringUtils";
import { DataTable } from "../../../../customComponents/dataTable";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector, usePaginationState } from "../../../../../utils/hooks";
import { DISPLAY_FIELDS, SORT_COLUMN_MAPPINGS } from "./fields";
import { CustomFieldConstructor } from "./customDisplayFields";
import { SelectedFilesBlock } from "./selectedFilesBlock";
import { setPagination } from "../../../../../modules/pagination";

interface ICrawlJobDetails {
    resourceId: string;
    crawlId: string;
  }

export default function CrawlJobMetaData({
  resourceId,
  crawlId
}: ICrawlJobDetails ): JSX.Element {

  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const [ crawledWebsites, setCrawledWebsites ] = useState<Record<string, any>[]>([]);
  const permPathKey = "crawledWebsites";
  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, { limit: 1000 });
  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );

  const changeSelectedFiles = useCallback(( value:boolean, fileName:number ) => {
    const allWebsites = [...crawledWebsites];
    const indexOfFile = allWebsites.findIndex(( item ) => item.URL === fileName );
    allWebsites[indexOfFile] = { ...allWebsites[indexOfFile], isSelected: !value };
    setCrawledWebsites( allWebsites );
  }, [crawledWebsites]);

  const {
    data: { Websites: resourcesList = [], total_count = 0, CrawlStatus } = {},
    isFetching,
    isSuccess,
    isError, error,
    isUninitialized,
    refetch
  } = useGetWorkspaceCrawlDetailsQuery({ id: resourceId, crawlId: crawlId,
    queryParams: { offset, limit, sortby: sortBy, sortorder: sortOrder } }, {
    refetchOnMountOrArgChange: true,
    skip: !crawlId
  });

  const customDisplayFields = CustomFieldConstructor({ changeSelectedFiles });

  const selectedFiles = crawledWebsites.filter(( item:any ) => item.isSelected );

  useEffect(() => {
    if ( isSuccess ){
      setCrawledWebsites( resourcesList.map(( item:any ) => ({ ...item, isSelected: false })));
    }
  }, [ isSuccess, resourcesList ]);

  useEffect(() => {
    dispatch( setPagination({
      key: permPathKey,
      data: defaultPaginationState
    }));
  // Adding more dependencies will cause infinite loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  return ( <>
    { isFetching
      ? <SkeletonBlock variant="lines" /> : (
        isSuccess ?
          CrawlStatus === "COMPLETE" ?
            <div className="flex flex-col gap-4">
              <>
                <div className="mt-2 mb-8">
                  <DataTable
                    // for identifying, search & display
                    dataIdentifiers={{
                      permPathKey: permPathKey,
                      searchKeys: ["URL"],
                      id: "URL",
                      name: "URL"
                    }}
                    // for pagination actions
                    defaultPaginationState={defaultPaginationState}
                    totalCount={ total_count }
                    loading={isFetching || isUninitialized}
                    resourcesList={crawledWebsites}
                    // for sorting & filtering
                    availableFields={DISPLAY_FIELDS}
                    sortableFields={SORT_COLUMN_MAPPINGS}
                    compactTable={false}
                    reloadData={refetch}
                    customFields={customDisplayFields}
                    hideOptionsField
                    additionalCTAs={[
                      <div key="ctas" className="flex-grow w-auto flex flex-row justify-end gap-x-4">
                        <Button size="sm" onClick={() => setCrawledWebsites(( d:any ) => d.map(( item:any ) => ({ ...item, isSelected: true })))}>
                          {t( "services.workspaces.selectAll" )} </Button>
                        <Button size="sm" onClick={() => setCrawledWebsites(( d:any ) => d.map(( item:any ) => ({ ...item, isSelected: false })))}>
                          {t( "services.workspaces.deselectAll" )} </Button>
                      </div>
                    ]}
                  />
                  {selectedFiles.length !== 0 && (
                    <SelectedFilesBlock reloadData={refetch}
                      workspaceId={resourceId}
                      crawlId={crawlId}
                      setCrawledWebsites={setCrawledWebsites}
                      selectedFiles={selectedFiles}/>
                  )}
                </div>
              </>
            </div> : <EmptyState>
              <EmptyState.Content title={t( "services.workspaces.crawlJobInProgress" )}>
                <div className="flex flex-col">
                  <Button onClick={refetch}>{t( "common.button.refresh" )}</Button>
                </div>
              </EmptyState.Content>
            </EmptyState> : <EmptyState>
            <EmptyState.Content title="No Job Run Details Found">
              {isError && <span>{extractError({ error_obj: error })}</span>}
            </EmptyState.Content>
          </EmptyState> )}
  </> );
}