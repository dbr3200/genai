import React from "react";
import { EmptyState, SkeletonBlock } from "@amorphic/amorphic-ui-core";

import DetailsDump from "../../../customComponents/detailsDump";
import { useGetWorkspaceRunDetailsQuery } from "../../../../services/workspaces";
import { extractError } from "../../../../utils/stringUtils";

interface IRunDetails {
    resourceId: string;
    jobRunId: string;
  }

export default function RunDetailsMetaData({
  resourceId,
  jobRunId
}: IRunDetails ): JSX.Element {

  const {
    data: RunDetails = {},
    isFetching,
    isSuccess,
    isError, error
  } = useGetWorkspaceRunDetailsQuery({ workspaceId: resourceId, runId: jobRunId }, {
    refetchOnMountOrArgChange: true,
    skip: !jobRunId
  });
  return ( <>
    { isFetching
      ? <SkeletonBlock variant="lines" /> : (
        isSuccess ? <div className="flex flex-col gap-4">
          <DetailsDump object={RunDetails} />
        </div> : <EmptyState>
          <EmptyState.Content title="No Job Run Details Found">
            {isError && <span>{extractError({ error_obj: error })}</span>}
          </EmptyState.Content>
        </EmptyState> )}
  </> );
}