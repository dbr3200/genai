import React from "react";
import { ADPIcon, EmptyState, Label, Spinner, Tabs } from "@amorphic/amorphic-ui-core";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Header from "../../../layout/header";
import { Content } from "../../../layout/PageLayout";
import ActionGroupConfiguration from "./configuration";

import { useGetActionGroupDetailsQuery } from "../../../../services/agents/actionGroups";
import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { getErrorMessage } from "../../../../services/helpers";
import { routeActions } from "../../../../constants";

export default function ActionGroupDetails(): JSX.Element {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const { actionGroups: actionGroupsPath } = usePermanentPaths();
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const { data: actionGroup, isError, isFetching, isLoading, error } = useGetActionGroupDetailsQuery( resourceId, {
    skip: !resourceId
  });

  return ( <div className="adp-v2">
    <Header backBtnPath={`${actionGroupsPath.path}/${routeActions.list}`} title={<span className="flex gap-1">
      {actionGroup?.ActionGroupName ?? t( "services.actionGroup" )}
      {actionGroup?.SystemGenerated?.toLowerCase() === "yes" && <Label classes="text-xs font-robotoLight"
        variant="info" rounded>Pre-baked</Label>}</span>} ctas={[]} />
    <Content className="flex flex-col h-full">
      <Tabs defaultActiveIndex={ hash.includes( "configuration" ) ? 1 : 0 }>
        <Tabs.Tab classes="h-full" id="Configuration" title={<div className="flex items-center gap-2">
          <ADPIcon icon="repair" size="xs" />
          <span>{t( "common.words.configuration" )}</span>
        </div>}>
          <div className="flex flex-col h-full bg-white p-4 md:flex-row gap-2 items-start">
            {isFetching || isLoading
              ? <div className="w-full flex flex-row justify-center items-center"> <Spinner /> </div>
              : isError
                ? <EmptyState display="vertical" transparentBG defaultImageVariant="no-auth">
                  <EmptyState.Content title={getErrorMessage( error )} />
                </EmptyState>
                : <ActionGroupConfiguration actionGroupDetails={actionGroup} />
            }
          </div>
        </Tabs.Tab>
      </Tabs>
    </Content>
  </div> );
}