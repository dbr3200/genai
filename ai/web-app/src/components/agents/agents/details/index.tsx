import React, { useReducer } from "react";
import { ADPIcon, EmptyState, Spinner, StatusCard, Tabs } from "@amorphic/amorphic-ui-core";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Header from "../../../layout/header";
import { Content } from "../../../layout/PageLayout";
import AgentConfiguration from "./configuration";
import UpdateAgentActionGroupsPanel from "./updateActionGroupsPanel";
import AttachWorkspacePanel from "./attachWorkspacePanel";
import { AgentChatRoutes } from "./agentChat/routes";

import { useGetAgentDetailsQuery, useSyncAgentMutation } from "../../../../services/agents/agents";
import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { getErrorMessage } from "../../../../services/helpers";
import { routeActions } from "../../../../constants";
import { useQuery, useSuccessNotification } from "../../../../utils/hooks";

export default function AgentDetails(): JSX.Element {
  const { t } = useTranslation();
  const query = useQuery();
  const tab = query.get( "tab" );

  const navigate = useNavigate();
  const { agents: agentsPath } = usePermanentPaths();
  const [ showUpdateActionGroupsPanel, toggleShowUpdateActionGroupsPanel ] = useReducer(( state ) => !state, false );
  const [ showWorkspacePanel, toggleShowWorkspacePanel ] = useReducer(( state ) => !state, false );
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const { data: agent, isError, isFetching, isLoading, error } = useGetAgentDetailsQuery( resourceId, {
    skip: !resourceId
  });
  const [ syncAgent, { isLoading: syncingAgent }] = useSyncAgentMutation();
  const [showSuccessNotification] = useSuccessNotification();

  const handleSyncAgentClick = async () => {
    try {
      const { Message } = await syncAgent( resourceId ).unwrap();
      showSuccessNotification({ content: Message });
    } catch ( err ) {
      // do nothing
    }
  };

  return <>
    <div className="adp-v2">
      <Header backBtnPath={`${agentsPath.path}/${routeActions.list}`} title={agent?.AgentName ?? t( "services.agent" )} ctas={[
        {
          callback: handleSyncAgentClick,
          icon: <ADPIcon icon="sync" size="xs" spin={syncingAgent} />,
          label: t( "services.agents.agents.syncAgent" ),
          disabled: syncingAgent
        },
        {
          callback: toggleShowWorkspacePanel,
          icon: <ADPIcon icon="app-database" size="xs" />,
          label: t( "services.agents.agents.updateWorkspacesBtn" )
        },
        {
          callback: toggleShowUpdateActionGroupsPanel,
          icon: <ADPIcon icon="extra-resources" size="xs" />,
          label: t( "services.agents.agents.updateActionGroups" )
        }
      ]} />
      <Content className="flex flex-col h-full">
        {agent?.AttachedActionGroups.length === 0 && <StatusCard filled variant="warning" classes="text-secondary-200 mb-4">
          <h1 className="adp-text-xl">{t( "services.agents.agents.actionPending" )}</h1>
          {t( "services.agents.agents.provideActionGroupMSG" )}
        </StatusCard>}
        <Tabs activeIndex={ tab === "configuration" ? 0 : 1 }
          onSelect={id => navigate( id === 0 ? "?tab=configuration" : "?tab=chat" )}>
          <Tabs.Tab classes="h-full" id="Configuration" title={<div className="flex items-center gap-2">
            <ADPIcon icon="repair" size="xs" />
            <span>{t( "common.words.configuration" )}</span>
          </div>}>
            <div className="flex flex-col h-full bg-white p-4 md:flex-row gap-2 items-start">
              {isFetching || isLoading
                ? <div className="w-full h-full flex flex-row justify-center items-center"> <Spinner /> </div>
                : isError
                  ? <EmptyState display="vertical" transparentBG defaultImageVariant="no-auth">
                    <EmptyState.Content title={getErrorMessage( error )} />
                  </EmptyState>
                  : <AgentConfiguration agentDetails={agent} />
              }
            </div>
          </Tabs.Tab>
          <Tabs.Tab classes="h-full" id="Chat" title={<div className="flex items-center gap-2">
            <ADPIcon icon="msg" size="xs" />
            <span>{t( "services.agents.agents.chat" )}</span>
          </div>}>
            <AgentChatRoutes />
          </Tabs.Tab>
        </Tabs>
      </Content>
    </div>
    <UpdateAgentActionGroupsPanel
      show={showUpdateActionGroupsPanel}
      closePanel={toggleShowUpdateActionGroupsPanel}
      agentId={resourceId}
    />
    <AttachWorkspacePanel
      show={showWorkspacePanel}
      closePanel={toggleShowWorkspacePanel}
      agentId={resourceId}
      attachedWorkspaces={agent?.AttachedWorkspaces}
    />
  </>;
}