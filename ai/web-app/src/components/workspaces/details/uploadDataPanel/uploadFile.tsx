import React, { useState } from "react";
import { UploadFilesForm } from "../../../customComponents/uploadFilesForm";
import { useGetWorkspacePresignedURLMutation, workspacesApi } from "../../../../services/workspaces";
import axios from "axios";
import { useAppDispatch } from "../../../../utils/hooks";
import { Select } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import { getSelectedOptions } from "../../../../utils/renderUtils";

export const UploadFile = ({ workspaceDetails }: { workspaceDetails: any}): JSX.Element => {
  const { AttachedDatasets, WorkspaceId } = workspaceDetails;
  const [getUploadLink] = useGetWorkspacePresignedURLMutation();
  const dispatch = useAppDispatch();
  const { t } = useTranslation();
  const [ selectedDatasetId, setSelectedDatasetId ] = useState<string>();
  const selectedDatasetDetails = AttachedDatasets.find(( dataset: any ) => dataset.DatasetId === selectedDatasetId );

  const attachedDatasetOptions = AttachedDatasets.map(( dataset: any ) => (
    { label: dataset.DatasetName, value: dataset.DatasetId }));

  const uploadFiles = ( files:any[]) => {
    setFilesState( null );
    files.map( async( item:any ) => {
      try {
        setFilesState(( d:any ) => ({ ...d, [item.fileIndex]: { fetchingURL: true } }));
        const { PresignedURL: uploadURL }:{PresignedURL:string} = await getUploadLink(
          { id: WorkspaceId, requestBody: { SourceDatasetId: AttachedDatasets[0].DatasetId, FileName: item.fileName } }
        ).unwrap();
        setFilesState(( d:any ) => ({ ...d, [item.fileIndex]: { ...d?.[item.fileIndex], fetchingURL: false, progress: 0 } }));
        const config = {
          headers: {
            "Content-Type": ""
          },
          onUploadProgress: ( progressEvent:any ) =>
            setFilesState(( d:any ) => ({ ...d, [item.fileIndex]:
               { ...d?.[item.fileIndex],
                 progress: Math.round(( progressEvent.loaded * 100 ) / progressEvent.total ) } }))
        };
        await axios.put( uploadURL, item.actualFile, { ...config });
        dispatch( workspacesApi.util.invalidateTags(["WorkspaceDocuments"]));
      } catch ( e ){
        setFilesState(( d:any ) => ({ ...d,
          [item.fileIndex]: { ...d?.[item.fileIndex], fetchingURL: false, uploadingURL: false, uploadError: "Error occured while uploading file" } }));
      }
    });
  };

  const [ fileState, setFilesState ] = useState<any>( null );

  const resetUploadState = () => setFilesState( null );

  return <div className="mt-8 space-y-8">
    <Select
      onChange={( datasetOption ) => datasetOption !== null && setSelectedDatasetId( datasetOption.value )}
      options={attachedDatasetOptions}
      value={ selectedDatasetId && getSelectedOptions( selectedDatasetId, attachedDatasetOptions, false )}
      floatingLabel={t( "Source Dataset" )}
      menuPortalTarget={document.body}
    />
    {selectedDatasetId && <UploadFilesForm
      fileType={selectedDatasetDetails?.FileType}
      uploadFiles={uploadFiles}
      resetUploadState={resetUploadState}
      uploadState={fileState}
    />}
  </div>;

};