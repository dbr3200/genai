import React from "react";
import { ADPIcon, EmptyState, Spinner, Tabs } from "@amorphic/amorphic-ui-core";
import { useParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import Header from "../../layout/header";
import { Content } from "../../layout/PageLayout";
import ChatbotConfiguration from "./configuration";
import ExportChatbot from "./export";

import { useGetChatbotDetailsQuery } from "../../../services/chatbots";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { getErrorMessage } from "../../../services/helpers";

export default function ChatbotDetails(): JSX.Element {
  const { hash } = useLocation();
  const { t } = useTranslation();
  const { chatbots } = usePermanentPaths();
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const { data: chatbot = undefined, isError, isFetching, isLoading, error } = useGetChatbotDetailsQuery( resourceId, {
    skip: !resourceId
  });

  const CustomSuspense = ( props: { children: React.ReactNode, classes?: string }) => {
    return <div className={clsx( "w-full h-full flex flex-col md:flex-row gap-2 items-start", props.classes )}>
      {isFetching || isLoading
        ? <div className="w-full h-full flex justify-center items-center"> <Spinner /> </div>
        : isError
          ? <EmptyState display="vertical" transparentBG defaultImageVariant="no-auth">
            <EmptyState.Content title={ getErrorMessage( error )} />
          </EmptyState>
          : <>{props.children}</>}
    </div>;
  };

  return ( <div className="space-y-8 h-full adp-v2">
    <Header backBtnPath={chatbots.relativePath} title={chatbot?.ChatbotName ?? t( "services.chatbot" )} />
    <Content className="flex flex-col h-full">
      <Tabs classes="h-full" defaultActiveIndex={ hash.includes( "configuration" ) ? 1 : 0 }>
        <Tabs.Tab classes="h-full" id="Configuration" title={<div className="flex items-center gap-2">
          <ADPIcon icon="repair" size="xs" />
          <span>Configuration</span>
        </div>}>
          <CustomSuspense classes="bg-white p-4">
            <ChatbotConfiguration chatbotDetails={chatbot} />
          </CustomSuspense>
        </Tabs.Tab>
        <Tabs.Tab classes="h-full" id="Export" title={<div className="flex items-center gap-2">
          <ADPIcon icon="external-link" size="xs" />
          <span>Export</span>
        </div>}>
          <CustomSuspense>
            <ExportChatbot chatbotDetails={chatbot} />
          </CustomSuspense>
        </Tabs.Tab>
      </Tabs>
    </Content>
  </div> );
}