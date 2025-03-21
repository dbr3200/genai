import React, { useEffect, useState, useCallback, useRef } from "react";
import { renderToString } from "react-dom/server";
import { ADPIcon, Button, Card, Tabs } from "@amorphic/amorphic-ui-core";
import { nanoid } from "@reduxjs/toolkit";
import PerfectScrollbar from "react-perfect-scrollbar";
import { useParams } from "react-router-dom";
import { Auth } from "aws-amplify";
import clsx from "clsx";
import dayjs from "dayjs";
import jwtDecode, { JwtPayload } from "jwt-decode";

import Messages from "./Messages";
import ChatConfiguration from "./ChatConfiguration";
import FilesContainer from "../fileContainer";
import TabsContainer from "../../customComponents/tabsContainer";

import { useAppDispatch, useAppSelector, useInfoNotification, useErrorNotification } from "../../../utils/hooks";
import { IMessage } from "../../../types";
import { updateAuthReducer } from "../../../modules/auth/actions";
import { msgSVG } from "../../../constants";
import { formatFileName } from "../../../utils";
import styles from "./styles.module.scss";

type ChatWebSocketResponse = {
  AIMessage: string;
  Metadata: {
    modelId: string;
    mode: string;
    modelKwargs: string;
    workspaceId: string;
    IsComplete: boolean,
    MessageId: string;
    Sources?: { Domain: string, Workspace: string, FileName: string, WebsiteURL?: string }[];
  }
};

const ChatContainer = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const { sessionId } = useParams<{ sessionId?: string }>();
  const webSocket = useRef<WebSocket | null>( null );
  const { token } = useAppSelector( state => state.auth );
  const tokenRef = useRef( token );
  const { ChatWebSocket_URL } = useAppSelector( state => state.globalConfig );
  const [ message, setMessage ] = useState<string>( "" );
  const [ localHistory, setLocalHistory ] = useState<IMessage[]>([]);
  const [ selectedModel, setSelectedModel ] = useState<string>();
  const [ selectedWorkSpace, setSelectedWorkSpace ] = useState<string | undefined>();
  const [ selectedFile, setSelectedFile ] = useState<string | undefined>();
  const [ waitingForResponse, setWaitingForResponse ] = useState( false );
  const [ isResponseComplete, setIsResponseComplete ] = useState( true );
  const [ reconnecting, setReconnecting ] = useState( false );
  const [showInfoNotification] = useInfoNotification();
  const [showErrorNotification] = useErrorNotification();

  const handleOnMessage = ( event: { data: string }) => {
    const data: ChatWebSocketResponse = JSON.parse( event.data );

    // Skip messages which don't have "AIMessage" in the message object
    if ( !( "AIMessage" in data )) {
      return;
    }
    setMessage( "" );
    setWaitingForResponse( false );
    setIsResponseComplete( data?.Metadata?.IsComplete ?? true );

    if ( !( data?.Metadata?.IsComplete ?? true ) && data?.Metadata?.Sources ) {
      const sources = `<div class=${styles.msgSection}>
            <details>
              <summary>
              <span>Sources (${data.Metadata.Sources?.length})</span>
              </summary>
              <div class="-my-6 flex flex-col gap-2">
                <p class="text-primary-300">${data?.AIMessage}</p>
                <div class="flex flex-col sm:flex-row items-center justify-start overflow-auto gap-4 w-full">
                </div>
            ${renderToString(
    <div className={styles.sourcesContainer}>{
      data.Metadata.Sources
        ?.map(( source ) =>
          <Card key={source?.FileName} classes={styles.sourceCard}>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-1">
                <ADPIcon icon="app-database" size="xs" fixedWidth classes="text-primary-300 flex-none" />
                <div className="flex flex-col leading-6">
                  <span className="text-primary-300 text-xs">Workspace</span>
                  <span className="font-semibold break-words">{source?.Workspace}</span>
                </div>
              </div>
              <div className="flex items-start gap-1">
                {
                  source?.WebsiteURL
                    ? <>
                      <ADPIcon icon="globe" size="xs" fixedWidth classes="text-primary-300 flex-none" />
                      <div className="flex flex-col leading-6">
                        <span className="text-primary-300 text-xs">Website URL</span>
                        <a href={source?.WebsiteURL} target="_blank" rel="noopener noreferrer" className="font-semibold break-words">{source?.WebsiteURL}</a>
                      </div>
                    </>
                    : <>
                      <ADPIcon icon="file" size="xs" fixedWidth classes="text-primary-300 flex-none" />
                      <div className="flex flex-col leading-6">
                        <span className="text-primary-300 text-xs">Filename</span>
                        <span className="font-semibold break-words">{formatFileName( source?.FileName )}</span>
                      </div>
                    </>
                }
              </div>
            </div>
          </Card> )}
    </div>
  )}
              </div>
            </details>
            </div>
      <div class=${styles.msgSection}>
      <p class=${styles.header}>${msgSVG} Answer</p>
      <div>`;

      setLocalHistory( prevState => [ ...prevState,
        { useTypewriter: false,
          isComplete: false,
          Type: "ai", Data: data?.Metadata?.Sources ? sources : data?.AIMessage,
          MessageTime: new Date().toISOString(),
          MessageId: data?.Metadata?.MessageId || nanoid()
        }]);
    } else {
      setLocalHistory( prevState => {
        const newState = structuredClone( prevState );
        const lastMessage = newState[newState.length - 1];

        if ( typeof lastMessage.isComplete !== "undefined" && !lastMessage.isComplete ) {
          lastMessage.Data = [ lastMessage.Data, data?.AIMessage ].join( "" );
          if ( data?.Metadata?.IsComplete ) {
            lastMessage.Data = `${lastMessage.Data}</div></div>`;
          }
          lastMessage.isComplete = data?.Metadata?.IsComplete ?? true;

          return newState;
        } else {
          newState.push({ useTypewriter: false,
            isComplete: data?.Metadata?.IsComplete ?? true,
            Type: "ai", Data: data?.AIMessage,
            MessageTime: new Date().toISOString(),
            MessageId: data?.Metadata?.MessageId || nanoid()
          });

          return newState;
        }
      });
    }
  };

  const connectWebSocket = useCallback( async() => {

    const showNetworkErrorNotification = () => showErrorNotification({
      content: "There seems to be a network problem. Please trying starting a new session.", autoHideDelay: false });

    if ( webSocket.current !== null && webSocket.current?.readyState === webSocket.current?.OPEN ) {
      return;
    }

    try {
      // Get a new id token if the current token has expired
      const { exp } = tokenRef.current && jwtDecode<JwtPayload>( tokenRef.current ) || {};
      if ( exp && dayjs().isAfter( dayjs.unix( exp ))) {
        try {
          const cognitoUserSession: any = await Auth.currentSession();
          dispatch( updateAuthReducer({
            token: cognitoUserSession?.idToken?.jwtToken,
            sessionActive: true,
            validSession: true
          }));
          tokenRef.current = cognitoUserSession?.idToken?.jwtToken;
        } catch ( error ){
          dispatch( updateAuthReducer({ validSession: false }));
        }
      }

      const socket = new WebSocket( `${ChatWebSocket_URL}?session-id=${sessionId}&Authorization=${tokenRef.current}` );

      socket.onmessage = handleOnMessage;
      socket.onerror = showNetworkErrorNotification;
      socket.onclose = () => {
        setReconnecting( true );
        showInfoNotification({ content: "Please wait while we reconnect.", autoHideDelay: 3000 });
        connectWebSocket();
      };

      webSocket.current = socket;
      setReconnecting( false );
    } catch ( error ) {
      showNetworkErrorNotification();
    }
  }, [ ChatWebSocket_URL, dispatch, sessionId, showErrorNotification, showInfoNotification ]);

  const closeWebSocketConnection = () => {
    if ( webSocket.current !== null && webSocket.current?.readyState === webSocket.current?.OPEN ) {
      webSocket.current.onclose = null;
      webSocket.current?.close();
      webSocket.current = null;
    }
  };

  const sendMessages = useCallback(() => {
    if ( sessionId ){
      setLocalHistory( prevState => [ ...prevState, {
        Type: "human", Data: message,
        MessageTime: new Date().toISOString(),
        MessageId: nanoid(),
        isComplete: true
      }]);

      if ( webSocket.current?.readyState === webSocket.current?.OPEN ) {
        webSocket.current?.send( JSON.stringify({
          MessageId: nanoid(),
          SessionId: sessionId,
          UserMessage: message,
          ModelId: selectedModel,
          ...( selectedWorkSpace && { WorkspaceId: selectedWorkSpace }),
          Route: "sendmessage",
          ...( selectedFile && { AdvancedConfig: { UseOriginalFile: true, FileName: selectedFile } })
        }));

        setWaitingForResponse( true );
        setIsResponseComplete( false );
      } else {
        connectWebSocket();

        showInfoNotification({
          content: "There seems to be a network problem. Please submit the question again"
        });
      }
    }
  }
  , [ connectWebSocket, message, selectedFile, selectedModel, selectedWorkSpace, sessionId, showInfoNotification, webSocket ]);

  const handleKeyDown = ( event:any ) => {
    if ( event.key === "Enter" ) {
      if ( message?.trim()?.length ){
        sendMessages();
      }
    }
  };

  useEffect(() => {
    setWaitingForResponse( false );
    setIsResponseComplete( true );
    // Close exisitng websocket connection. This is important to clear any stale websocket left behind after deleting the current session
    closeWebSocketConnection();
  }, [sessionId]);

  useEffect(() => {
    if ( sessionId && token ) {
      tokenRef.current = token;
      connectWebSocket();
    }
  }, [ connectWebSocket, sessionId, token ]);

  // Clean-up the existing websocket on unmount
  useEffect(() => {
    return () => closeWebSocketConnection();
  }, []);

  return (
    <div className="rounded-md p-3 w-full h-full bg-white flex xl:justify-center border border-secondary-100 shadow">
      <TabsContainer classes="max-w-5xl">
        <Tabs.Tab id="chat" title="Chat" classes="w-full h-full max-h-[calc(100vh-12rem)]">
          <div className="flex flex-col gap-4 items-center justify-between h-full">
            <div className="flex-grow w-full">
              <PerfectScrollbar options={{ suppressScrollX: true }}
                className="max-h-[calc(100vh-20rem)] overscroll-auto" component="div" id="chat-history-container">
                <Messages
                  localHistory={localHistory}
                  setLocalHistory={setLocalHistory}
                  sessionId={sessionId}
                  sendMessages={sendMessages}
                  waitingForResponse={waitingForResponse}
                  key={sessionId} />
              </PerfectScrollbar>
            </div>
            <div className="flex-none flex flex-col gap-2 w-full border-t border-secondary-100 py-2">
              <ChatConfiguration
                sessionId={sessionId}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
                selectedWorkSpace={selectedWorkSpace}
                setSelectedWorkSpace={setSelectedWorkSpace}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
              />
              <div className="w-full relative">
                <textarea
                  value={message}
                  disabled={waitingForResponse || !isResponseComplete || !sessionId || reconnecting}
                  placeholder="Ask Amorphic AI a question"
                  onChange={( e ) => setMessage( e.target.value )}
                  onKeyDown={handleKeyDown}
                  className={clsx(
                    "relative w-full h-max max-h-48 rounded-md ring ring-secondary-100 focus:ring-primary-300 focus:outline-none resize-none",
                    "p-2 pe-14"
                  )}></textarea>
                <Button disabled={!message?.trim()?.length || !sessionId || reconnecting} onClick={sendMessages}
                  loading={waitingForResponse || !isResponseComplete}
                  size="sm" variant="icon" icon={<ADPIcon icon="send" size="sm" fixedWidth classes="text-primary-300" /> }
                  classes={clsx(
                    "absolute px-2 py-3 flex items-center justify-center bottom-3.5 right-2.5 rounded-full",
                    "bg-secondary-200 bg-opacity-10 hover:bg-secondary-200 hover:bg-opacity-20"
                  )}
                />
              </div>
            </div>
          </div>
        </Tabs.Tab>
        <Tabs.Tab id="files" title="Files" classes="w-full h-auto">
          { sessionId && <section id="session-files">
            <FilesContainer {
              ...{
                sessionId
              }
            }
            />
          </section> }
        </Tabs.Tab>
      </TabsContainer>
    </div>
  );
};

export default ChatContainer;
