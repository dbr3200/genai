import React from "react";
import { ADPIcon, EmptyState, SkeletonBlock } from "@amorphic/amorphic-ui-core";

import DetailsDump from "../../../customComponents/detailsDump";
import { useGetWorkspaceDocumentsDetailsQuery } from "../../../../services/workspaces";
import { extractError } from "../../../../utils/stringUtils";

interface IFileDetails {
    resourceId: string;
    documentId: string;
    documentType: string;
  }

export default function DocumentDetailsMetadata({
  resourceId,
  documentId,
  documentType
}: IFileDetails ): JSX.Element {

  const {
    data,
    isFetching,
    isSuccess,
    isError,
    error
  } = useGetWorkspaceDocumentsDetailsQuery({ id: resourceId, documentId: documentId,
    queryParams: { documentType: documentType } }, {
    skip: !resourceId && !documentId
  });

  return ( <>
    { isFetching
      ? <SkeletonBlock variant="lines" /> : (
        isSuccess ? <div className="flex flex-col gap-4">{
          documentType === "website"
            ? <DetailsDump object={data} excludeKeys={[ "DocumentDetails.DatasetId", "DocumentDetails.FileName", "RawFileDownloadURL" ]} />
            : <DetailsDump object={data} excludeKeys={["RawFileDownloadURL"]}
              extraKeys={[
                [ "RawFileDownloadURL", <>
                  <span className="flex gap-2">{"File Download URL"}
                    <a href={data?.RawFileDownloadURL}
                      className="text-primary-250" target="_blank" rel="noopener noreferrer">
                      <ADPIcon icon="external-link" size="xs" />
                    </a></span></> ]]}
            />
        }
        </div> : <EmptyState>
          <EmptyState.Content title="No File Details Found">
            {isError && <span>{extractError({ error_obj: error })}</span>}
          </EmptyState.Content>
        </EmptyState> )}
  </> );
}