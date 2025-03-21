import React, { useState, useEffect, useCallback } from "react";
import { ADPIcon, Button } from "@amorphic/amorphic-ui-core";
import PerfectScrollbar from "react-perfect-scrollbar";
import { useParams } from "react-router-dom";

import Messages from "./messages";

import { useSendMessageToAgentMutation } from "../../../../../services/agents/agents";
import styles from "./chat.module.scss";

interface Props {
  sessionId?: string;
  createChatSession: any;
  creatingChatSession: boolean;
  localHistory: any;
  setLocalHistory: React.Dispatch<React.SetStateAction<any[]>>;
}

const AgentChat = ({ sessionId = "", createChatSession, creatingChatSession = false, localHistory, setLocalHistory }: Props ): JSX.Element => {
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const [ message, setMessage ] = useState<string>( "" );

  const [ sendMessage, { isLoading: loadingSendingMessage }] = useSendMessageToAgentMutation();

  const sendMessages = useCallback(() => {
    setLocalHistory( prevState => [ ...prevState, { type: "human", data: message }]);

    sendMessage({
      id: resourceId,
      requestBody: {
        SessionId: sessionId,
        UserMessage: message
      }
    })?.then(( response ) => {
      setMessage( "" );
      setLocalHistory( prevState => [ ...prevState,
        { useTypewriter: true, type: "ai", data: ( response as { data: any})?.data?.Message?.AI || ( response as { error: any })?.error?.data?.Message }]);
    }).catch(( error ) => {
      setLocalHistory( prevState => [ ...prevState,
        { type: "ai", data: error?.Message }]);
    });
  }
  , [ message, resourceId, sendMessage, sessionId, setLocalHistory ]);

  const handleKeyDown = ( event:any ) => {
    if ( event.key === "Enter" ) {
      if ( message?.trim()?.length ){
        sendMessages();
      }
    }
  };

  useEffect(() => {
    if ( !sessionId ) {
      createChatSession();
    }
  }, [ createChatSession, sessionId ]);

  return (
    <div className={styles.chatContainer}>
      <div className="flex-grow w-full">
        <PerfectScrollbar className="max-h-[calc(100vh-10rem)] overscroll-auto" component="div" id="chat-history-container">
          <Messages
            localHistory={localHistory}
            loadingSendingMessage={loadingSendingMessage}
            creatingChatSession={creatingChatSession}
          />
        </PerfectScrollbar>
      </div>
      <div className={styles.textareaContainer}>
        <textarea
          value={message}
          disabled={loadingSendingMessage}
          placeholder="Ask a question to the Agent"
          onChange={( e ) => setMessage( e.target.value )}
          onKeyDown={handleKeyDown}
          className={styles.chatTextarea} />
        <Button disabled={!message?.trim()?.length} onClick={sendMessages}
          loading={loadingSendingMessage} size="sm" variant="icon" icon={<ADPIcon icon="send" size="sm" fixedWidth classes="text-primary-300" /> }
          classes={styles.sendButton}
        />
      </div>
    </div>
  );
};

export default AgentChat;