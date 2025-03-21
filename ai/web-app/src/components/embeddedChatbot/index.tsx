import React from "react";
import { useParams } from "react-router-dom";
import { Chatbot } from "@amorphic/amorphic-chatbot";
import { useGetEmbeddedChatbotDetailsQuery } from "../../services/embeddedChatbot";
import { PageLoadSpinner } from "../pageLoadSpinner";
import { useAppSelector } from "../../utils/hooks";

export const EmbeddedChatbot = ():JSX.Element => {
  const { chatbotId = "" } = useParams<{ chatbotId?: string}>();
  const { API_gateway, ChatbotWebSocket_URL } = useAppSelector( state => state.globalConfig );
  const { data: { EmbeddedConfig = {} } = {}, isLoading } = useGetEmbeddedChatbotDetailsQuery( chatbotId );
  const { BotName, SaveChatHistory, BotWelcomeMessage, BotAvatar, Suggestions } = EmbeddedConfig;

  return isLoading
    ? <PageLoadSpinner />
    : <div className="adp-v2 adp-h-full"><Chatbot
      chatbotId={chatbotId}
      botName={BotName}
      saveChatHistory={SaveChatHistory}
      botWelcomeMessage={BotWelcomeMessage}
      botAvatar={BotAvatar}
      apiGatewayURL={API_gateway}
      chatbotWebsocketURL={ChatbotWebSocket_URL}
      suggestions={Suggestions}
    />
    </div>;
};