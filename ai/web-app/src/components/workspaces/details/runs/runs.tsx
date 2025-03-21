import React, { useEffect, useState } from "react";
import { Spinner, Button } from "@amorphic/amorphic-ui-core";

import { useAppDispatch, useAppSelector, usePaginationState, useSuccessNotification } from "../../../../utils/hooks";
import { CustomFieldConstructor } from "./customFieldConstructor";
import { DataTable } from "../../../customComponents/dataTable";
import SidePanel from "../../../customComponents/sidePanel";
import RunDetailsMetaData from "./runDetails";
import { useGetWorkspaceRunsQuery, useRunWorkspaceMutation } from "../../../../services/workspaces";
import { setPagination } from "../../../../modules/pagination";

interface IFilesProps {
  accessType?: string;
  resourceId: string;
}

const SORT_COLUMN_MAPPINGS = {
  LastModifiedTime: "LastModifiedTime",
  RunId: "RunId",
  RunStatus: "RunStatus",
  StartTime: "StartTime",
  EndTime: "EndTime",
  TriggerType: "TriggerType",
  TriggeredBy: "TriggeredBy"
};

const DISPLAY_FIELDS = [
  { "FieldName": "RunStatus", "FieldProps": { defaultDisplay: true, fixed: true } },
  { "FieldName": "StartTime", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "EndTime", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "TriggerType", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "TriggeredBy", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "RunId", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "Message", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "LastModifiedTime", "FieldProps": { defaultDisplay: false } }
];

const MODULE_DEFAULT_PAGINATION_SETTING = { sortBy: "StartTime", sortOrder: "desc", limit: 50 };

export const RunsList = ({
  accessType,
  resourceId
}: IFilesProps ): JSX.Element => {
  const permPathKey = "workspacesRuns";
  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );
  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );

  const dispatch = useAppDispatch();

  const [ jobRunId, setJobRunId ] = useState<string>( "" );
  const [ showRunDetails, setShowRunDetails ] = useState<boolean>( false );

  const {
    data: { Runs: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    refetch
  } = useGetWorkspaceRunsQuery({ id: resourceId, queryParams: { offset, limit, sortby: sortBy, sortorder: sortOrder } }, {
    refetchOnMountOrArgChange: true,
    skip: !resourceId
  });

  const customDisplayFields = CustomFieldConstructor({ setJobId: setJobRunId, setShowRunDetails: setShowRunDetails
  });

  const [ triggerRun, { isLoading: triggeringWorkspaceRun }] = useRunWorkspaceMutation();

  const [showSuccessNotification] = useSuccessNotification();

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
    <DataTable
      // for identifying, search & display
      dataIdentifiers={{
        permPathKey: permPathKey,
        searchKeys: ["RunId"],
        id: "StartTime",
        name: "StartTime",
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
      additionalCTAs={ accessType === "owner"
        ? <Button classes="mr-0 ml-auto" loading={triggeringWorkspaceRun} variant="stroked" size="sm" onClick={async() => {
          const { data: { Message = "" } = {} }: any = await triggerRun( resourceId );
          if ( Message ) {
            showSuccessNotification({
              content: Message
            });
          }
        }}
        >
          {"Trigger Run"}
        </Button>
        : null}
    />
    <SidePanel
      size="sm"
      show={showRunDetails}
      header={"Job Run Details"}
      onClose={() => {
        setShowRunDetails( false );
      }}
    >
      <RunDetailsMetaData resourceId={resourceId} jobRunId={jobRunId} />
    </SidePanel>
  </> );
};

export default RunsList;