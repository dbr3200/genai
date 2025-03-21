import { Button, Modal, ReloadableSelect, StatusCard } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import React from "react";
import { useGetWorkspacesQuery, useLazyGetWorkspaceDetailsQuery } from "../../../services/workspaces";
import { chatApi, useAddToDatasetMutation } from "../../../services/chat";
import { useAppDispatch, useSuccessNotification } from "../../../utils/hooks";

interface IPersistFileModalProps {
    sessionId?: string;
    fileToBeSaved?: string;
    setFileToBeSaved?: React.Dispatch<React.SetStateAction<string | undefined>>;
}

const PersistFileModal = ({
  sessionId,
  fileToBeSaved,
  setFileToBeSaved
}: IPersistFileModalProps ): JSX.Element => {
  const [ selectedWorkSpace, setSelectedWorkSpace ] = React.useState<string>( "" );
  const [ datasetId, setDatasetId ] = React.useState<string>( "" );

  const [ moveFilesToWorkspace, { isLoading: movingFilesToWorkspace }] = useAddToDatasetMutation();
  const [showSuccessNotification] = useSuccessNotification();
  const dispatch = useAppDispatch();

  const {
    data: { Workspaces: workspaceList = [] } = {},
    isFetching: isFetchingWorkspaces,
    refetch: refetchWorkspaces
  } = useGetWorkspacesQuery({ projectionExpression: "WorkspaceId,WorkspaceName" });

  const [ getWorkspaceDetails, { data: workspace = {}, isFetching: fetchingWorkspaceDetails }] = useLazyGetWorkspaceDetailsQuery();

  const workspacesOptions = React.useMemo(() => {
    return workspaceList.map(( workspaceResource: any ) => ({ label: workspaceResource.WorkspaceName, value: workspaceResource.WorkspaceId }));
  }, [workspaceList]);

  const datasetOptions = React.useMemo(() => {
    return workspace?.AttachedDatasets?.map(( dataset: any ) => ({ label: dataset.DatasetName, value: dataset.DatasetId }));
  }, [workspace?.AttachedDatasets]);

  React.useEffect(() => {
    if ( selectedWorkSpace ){
      getWorkspaceDetails( selectedWorkSpace );
    }
  }, [ getWorkspaceDetails, selectedWorkSpace ]);

  return ( <>
    <Modal
      size="md"
      onHide={() => setFileToBeSaved?.( undefined )}
      backdropClickClose={true}
      showModal={Boolean( fileToBeSaved )}
      closeButton={true}>
      <Modal.Header>
        <h3 className="text-md font-semibold">Persist File</h3>
      </Modal.Header>
      <Modal.Body classes="flex flex-col gap-10 pb-12">
        <StatusCard variant="info" classes="min-w-max w-96">
            Select Workspace and Dataset to persist the file to.
        </StatusCard>
        <div className="w-full min-w-max">
          <ReloadableSelect
            onChange={( e ) => {
              setDatasetId( "" );
              setSelectedWorkSpace( e?.value ?? "" );
            }}
            options={workspacesOptions}
            variant="outlined"
            floatingLabel={"Select Workspace"}
            menuPortalTarget={document.body}
            onReloadClick={refetchWorkspaces}
            isReloading={isFetchingWorkspaces}
            isDisabled={isFetchingWorkspaces || !sessionId}
            className={clsx( !sessionId && "cursor-not-allowed bg-light-gray" )}
          />
        </div>
        <div className="w-full min-w-max">
          <ReloadableSelect
            onChange={( e ) => {
              setDatasetId( e?.value ?? "" );
            }}
            options={datasetOptions}
            variant="outlined"
            floatingLabel={"Select Dataset"}
            menuPortalTarget={document.body}
            onReloadClick={() => getWorkspaceDetails( selectedWorkSpace )}
            isReloading={fetchingWorkspaceDetails}
            isDisabled={fetchingWorkspaceDetails || !selectedWorkSpace}
            isClearable
            className={clsx( !sessionId && "cursor-not-allowed bg-light-gray" )}
          />
        </div>
      </Modal.Body>
      <Modal.Footer classes="w-full flex justify-end">
        <Button onClick={async() => {
          try {
            if ( fileToBeSaved && datasetId ){
              await moveFilesToWorkspace({ sessionId, requestBody: { DatasetId: datasetId, Files: [fileToBeSaved] } })
                .unwrap()
                .then(( response: any ) => {
                  if ( !response.error ) {
                    showSuccessNotification({
                      autoHideDelay: 5000,
                      content: response.Message
                    });
                    setFileToBeSaved?.( undefined );
                    dispatch( chatApi.util.invalidateTags(["chatSessionFiles"]));
                  }
                })
                .catch();
            }
            // eslint-disable-next-line no-empty
          } catch {}
        }}
        disabled={movingFilesToWorkspace || !datasetId}
        size="sm" variant="stroked"
        loading={movingFilesToWorkspace}
        >Save File</Button>
      </Modal.Footer>
    </Modal>
  </>
  );
};

export default PersistFileModal;