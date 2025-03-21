import React, { useReducer, useState } from "react";
import { ADPIcon, EmptyState, Spinner, Tabs } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import { useParams, useLocation } from "react-router-dom";

import Header from "../../layout/header";
// import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { Content } from "../../layout/PageLayout";
import { useGetWorkspaceDetailsQuery } from "../../../services/workspaces";
import FilesList from "./files";
import WorkspaceConfiguration from "./configuration";
import { UploadDataPanel } from "./uploadDataPanel";
// import FileDetails from "./files/fileDetails";
import RunsList from "./runs/runs";
import AuthorizationPanel from "../../customComponents/authorizationPanel";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { CrawledWebsitesList } from "./crawledWebsites/list";

export default function WorkspaceDetails(): JSX.Element {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const { workspaces } = usePermanentPaths();
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const { data: workspace, isError, isFetching, isLoading, error } = useGetWorkspaceDetailsQuery( resourceId, {
    skip: !resourceId
  });

  const [ showUploadDataPanel, toggleUploadDataPanel ] = useReducer(( state ) => !state, hash.includes( "upload" ));

  const [ showAuthPanel, setShowAuthPanel ] = useState<boolean>( false );
  // const [ showTriggerPanel, setShowTriggerPanel ] = useState<boolean>( false );

  return ( <div className="space-y-8 adp-v2">
    <Header backBtnPath={workspaces.relativePath} title={workspace?.WorkspaceName} ctas={[
      {
        callback: () => setShowAuthPanel( true ),
        icon: <ADPIcon icon="share" size="xs" />,
        label: "Share",
        disabled: workspace?.AccessType !== "owner"
      },
      {
        callback: toggleUploadDataPanel,
        icon: <ADPIcon icon="upload" size="xs" />,
        label: "Add Data",
        disabled: workspace?.AccessType !== "owner"
      }
    ]}/>
    <Content className="flex flex-col h-full">

      <Tabs defaultActiveIndex={ hash.includes( "configuration" ) ? 1 : 0 }>
        <Tabs.Tab id="Documents" title={<div className="flex items-center gap-2">
          <ADPIcon icon="file" size="xs" />
          <span>Documents</span>
        </div>}>
          <FilesList
            accessType={workspace?.AccessType ?? "read-only"}
            resourceId={resourceId}
          />
        </Tabs.Tab>
        <Tabs.Tab id="Web Crawling" title={<div className="flex items-center gap-2">
          <ADPIcon icon="globe" size="xs" />
          <span>Web Crawling</span>
        </div>}>
          <CrawledWebsitesList resourceId={resourceId} />
        </Tabs.Tab>
        <Tabs.Tab id="Runs" title={<div className="flex items-center gap-2">
          <ADPIcon icon="runs" size="xs" />
          <span>Runs</span>
        </div>}>
          <RunsList
            accessType={workspace?.AccessType ?? "read-only"}
            resourceId={resourceId}
          />
        </Tabs.Tab>
        <Tabs.Tab classes="h-full" id="Configuration" title={<div className="flex items-center gap-2">
          <ADPIcon icon="repair" size="xs" />
          <span>Configuration</span>
        </div>}>
          {isFetching || isLoading ?
            <div className="flex flex-row justify-center"> <Spinner /> </div> :
            isError ?
              <EmptyState display="vertical" transparentBG defaultImageVariant="no-auth">
                <EmptyState.Content title={( error as any )?.data?.Message} />
              </EmptyState>
              : <WorkspaceConfiguration workspaceDetails={workspace} />
          }
        </Tabs.Tab>
      </Tabs>

    </Content>
    <UploadDataPanel
      show={showUploadDataPanel} closePanel={toggleUploadDataPanel}
      workspaceDetails={workspace}
    />
    <AuthorizationPanel
      header={t( "authorization.share", { resourceName: workspace?.WorkspaceName })}
      show={showAuthPanel}
      onClose={() => setShowAuthPanel( false ) }
      serviceName="workspaces"
      resourceId={workspace?.WorkspaceId ?? resourceId}
      resource={workspace}
      messageValues={{
        action: "view", service: t( "services.workspace.thisWorkspace" )
      }}
      size="sm"
    />
  </div> );
}