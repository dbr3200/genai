import React from "react";
import { ADPIcon, Button, Modal, ReloadableSelect, TextCopy, Tooltip } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";

import { useGetModelsQuery } from "../../../services/models";
import { useGetWorkspacesQuery } from "../../../services/workspaces";
import { LabelWithTooltip, getSelectedOptions } from "../../../utils/renderUtils";
import { useGetChatSessionFilesQuery, useLazyGetChatSessionDetailsQuery } from "../../../services/chat";
import { ModelStatusCode } from "../../../constants";

interface IChatConfigurationProps {
  sessionId?: string;
  selectedModel?: string;
  selectedWorkSpace?: string;
  selectedFile?: string;
  setSelectedModel: React.Dispatch<React.SetStateAction<string | undefined>>;
  setSelectedWorkSpace: React.Dispatch<React.SetStateAction<string | undefined>>;
  setSelectedFile?: React.Dispatch<React.SetStateAction<string | undefined>>;
}

const ChatConfiguration = ({
  sessionId,
  selectedModel,
  selectedWorkSpace,
  selectedFile,
  setSelectedModel,
  setSelectedWorkSpace,
  setSelectedFile
}: IChatConfigurationProps ): JSX.Element => {
  const [ showModal, setShowModal ] = React.useState<boolean>( false );

  const openModal = () => {
    if ( sessionId ){
      setShowModal( true );
    }
  };

  const closeModal = () => {
    setShowModal( false );
  };

  const {
    data: { Models = [] } = {},
    isFetching: isFetchingModels,
    refetch: refetchModels
  } = useGetModelsQuery({ modality: "text" });

  const {
    data: { Workspaces: workspaceList = [] } = {},
    isFetching: isFetchingWorkspaces,
    refetch: refetchWorkspaces
  } = useGetWorkspacesQuery({ projectionExpression: "WorkspaceId,WorkspaceName" });

  const {
    data: { Files = [] } = {},
    isFetching: isFetchingFiles,
    refetch: refetchFiles
  } = useGetChatSessionFilesQuery( sessionId, {
    skip: Boolean( !sessionId ),
    refetchOnMountOrArgChange: 60000
  });

  const [ reloadChatSession, { isFetching }] = useLazyGetChatSessionDetailsQuery();

  const modelOptions = React.useMemo(() => {
    const uniqueModelProviders = Models?.reduce(( acc: any, modelResource: any ) => {
      return acc.includes( modelResource.ModelProvider ) ? acc : [ ...acc, modelResource.ModelProvider ];
    }, []);
    const groupedModels = uniqueModelProviders?.reduce(( acc: any, modelProvider: string ) => {
      return ([
        ...acc,
        {
          label: modelProvider,
          options: Models?.filter(
            ( modelResource: any ) => modelResource.ModelProvider === modelProvider &&
             modelResource.ModelStatusCode?.toLowerCase() === ModelStatusCode.AVAILABLE )
            ?.map(( modelResource: any ) => ({
              label: modelDisplayName( modelResource.ModelName ), value: modelResource.ModelId
            }))
        }
      ]);
    }, []);
    return groupedModels;
  }, [Models]);

  const workspacesOptions = React.useMemo(() => {
    return workspaceList.map(( workspaceResource: any ) => ({ label: workspaceResource.WorkspaceName, value: workspaceResource.WorkspaceId }));
  }, [workspaceList]);

  const filesOptions = React.useMemo(() => {
    return Files.map(( file: any ) => ({ label: file, value: file }));
  }, [Files]);

  React.useEffect(() => {
    if ( !selectedModel && Models?.length > 0 ) {
      const availableModels = Models.filter( model => model.ModelStatusCode?.toLowerCase() === ModelStatusCode.AVAILABLE );
      const defaultModel = availableModels.find( model => model.ModelName === "anthropic.claude-v2" )?.ModelId ?? availableModels[0].ModelId;

      setSelectedModel( defaultModel );
    }
  }, [ Models, selectedModel, setSelectedModel ]);

  return ( <>
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2 divide-x divide-secondary-100 text-xs">
        <Tooltip
          disabled={Boolean( !sessionId )}
          placement="top-end"
          onTriggerClick={openModal}
          trigger={<div className="flex items-center gap-2 pe-4">
            <ADPIcon icon="ml" size="xs" />
            <span className="capitalize hover:underline">{modelDisplayName(
              getSelectedOptions( selectedModel, modelOptions, false, true )?.label
            )}</span>
          </div>}
        >
          { selectedModel
            ? <span>
              <u>{modelDisplayName(
                getSelectedOptions( selectedModel, modelOptions, false, true )?.label || "No model selected"
              )}</u> LLM Selected
            </span> : "Select Model" }
        </Tooltip>
        <Tooltip
          disabled={Boolean( !sessionId )}
          placement="top-end"
          onTriggerClick={openModal}
          trigger={<div className={clsx( "flex items-center gap-2 px-4", { "text-secondary-150": !selectedWorkSpace })}>
            <ADPIcon icon="app-database" size="xs" />
            <span className="hover:underline capitalize">
              {getSelectedOptions( selectedWorkSpace, workspacesOptions, false )?.label || "No workspace selected"}
            </span>
          </div>}
        >
          { selectedWorkSpace
            ? <span>
              <u>{getSelectedOptions( selectedWorkSpace, workspacesOptions, false )?.label}</u> Workspace Selected
            </span> : "Select Workspace" }
        </Tooltip>
        <Tooltip
          disabled={Boolean( !sessionId )}
          placement="top-end"
          onTriggerClick={openModal}
          trigger={<div className={clsx( "flex items-center gap-2 px-4", { "text-secondary-150": !selectedFile })}>
            <ADPIcon icon="file" size="xs" />
            <span className="hover:underline capitalize">{selectedFile ? "File Selected" : "No file selected"}</span>
          </div>}
        >
          { selectedFile
            ? <TextCopy text={selectedFile || ""}>
              {selectedFile || "Select File to query"}
            </TextCopy> : "Select a file to query" }
        </Tooltip>
      </div>
      { sessionId && <Button size="xs" variant="stroked"
        classes="px-2 border-secondary-100 font-light"
        loading={isFetching}
        onClick={() => reloadChatSession( sessionId )}>Reload chat</Button>}
    </div>
    <Modal
      size="md"
      onHide={closeModal}
      backdropClickClose={true}
      showModal={showModal}
      closeButton={true}>
      <Modal.Header>
        <h3 className="text-md font-semibold">Chat Configuration</h3>
      </Modal.Header>
      <Modal.Body classes="flex flex-col gap-10 pb-12">
        <div className="w-96"></div>
        <div className="w-full min-w-max">
          <ReloadableSelect
            onChange={( e ) => {
              setSelectedModel( e?.value ?? "" );
            }}
            variant="outlined"
            options={modelOptions}
            floatingLabel={<LabelWithTooltip label={"Select Model"} tooltip={"Select the foundation model to be used for the chat."} />}
            value={getSelectedOptions( selectedModel, modelOptions, false, true )}
            menuPortalTarget={document.body}
            onReloadClick={refetchModels}
            isReloading={isFetchingModels}
            isDisabled={isFetchingModels || !sessionId}
            className={clsx( !sessionId && "cursor-not-allowed bg-light-gray" )}
          />
        </div>
        <div className="w-full min-w-max">
          <ReloadableSelect
            onChange={( e ) => {
              setSelectedWorkSpace( e?.value ?? "" );
            }}
            options={workspacesOptions}
            variant="outlined"
            value={getSelectedOptions( selectedWorkSpace, workspacesOptions, false )}
            floatingLabel={<LabelWithTooltip label={"Select Workspace"} tooltip={"Select the workspace where your data resides."} />}
            menuPortalTarget={document.body}
            onReloadClick={refetchWorkspaces}
            isReloading={isFetchingWorkspaces}
            isDisabled={isFetchingWorkspaces || !sessionId}
            isClearable
            className={clsx( !sessionId && "cursor-not-allowed bg-light-gray" )}
          />
        </div>
        <div className="w-full min-w-max">
          <ReloadableSelect
            onChange={( e ) => {
              setSelectedFile( e?.value ?? "" );
            }}
            options={filesOptions}
            variant="outlined"
            value={getSelectedOptions( selectedFile, filesOptions, false )}
            floatingLabel={<LabelWithTooltip label={"Select Session File"} tooltip={"Select a file from uploaded session files you would like to query on."} />}
            menuPortalTarget={document.body}
            onReloadClick={refetchFiles}
            isReloading={isFetchingFiles}
            isDisabled={isFetchingFiles || !sessionId}
            isClearable
            className={clsx( !sessionId && "cursor-not-allowed bg-light-gray" )}
          />
        </div>
      </Modal.Body>
      <Modal.Footer classes="w-full flex justify-end">
        <Button onClick={closeModal} size="sm" variant="stroked">Save & Close</Button>
      </Modal.Footer>
    </Modal>
  </>
  );
};

/**
 * Function to replace all special characters with space
 */
function modelDisplayName ( str?: string ) {
  return str?.replace( /[^a-zA-Z0-9.]/g, " " );
}

export default ChatConfiguration;