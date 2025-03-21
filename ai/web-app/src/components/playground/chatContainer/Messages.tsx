import React, { useCallback, useEffect, useState } from "react";
import { renderToString } from "react-dom/server";
import { useNavigate } from "react-router-dom";
import { ADPIcon, Button, Card, EmptyState, Spinner } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import PerfectScrollbar from "react-perfect-scrollbar";
import { nanoid } from "nanoid";

import ChatBubble from "./ChatBubble";

import { useCreateChatSessionMutation, useGetChatSessionDetailsQuery } from "../../../services/chat";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { useSuccessNotification } from "../../../utils/hooks";
import { IMessage } from "../../../types";
import { msgSVG } from "../../../constants";
import { formatFileName } from "../../../utils";
import styles from "./styles.module.scss";

interface IMessagesProps {
    sessionId?: string;
    localHistory?: IMessage[];
    setLocalHistory?: React.Dispatch<React.SetStateAction<IMessage[]>>;
    sendMessages: any;
    waitingForResponse: boolean;
    sentMessage?: boolean;
}

const Messages = ({
  sessionId,
  localHistory = [],
  setLocalHistory,
  waitingForResponse }: IMessagesProps ): JSX.Element => {
  const { playground } = usePermanentPaths();
  const navigate = useNavigate();
  const [showSuccessNotification] = useSuccessNotification();
  const {
    currentData: session,
    isLoading: isLoadingSessionDetails,
    isSuccess: isSuccessSessionDetails,
    refetch: refetchSessionDetails
  } = useGetChatSessionDetailsQuery( sessionId, {
    skip: !sessionId,
    refetchOnMountOrArgChange: 60000
  });
  const [ scrollEl, setScrollEl ] = useState<HTMLElement>();

  const [ createChatSession, { isLoading: creatingChatSession }] = useCreateChatSessionMutation();

  const scrollToTheBottom = useCallback(() => {
    if ( scrollEl ) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  }, [scrollEl]);

  useEffect(() => {
    if ( isSuccessSessionDetails ) {

      const formattedHistory: IMessage[] = [];

      session?.History?.map(( history ) => {
        if ( history.Sources ) {
          const sources = `<div class=${styles.msgSection}>
            <details>
              <summary>
              <span>Sources (${history?.Sources?.length})</span>
              </summary>
              <div class="-my-6 flex flex-col gap-2">
                <p class="text-primary-300">${history.Data}</p>
                <div class="flex flex-col sm:flex-row items-center justify-start overflow-auto gap-4 w-full">
                </div>
            ${renderToString(
    <div className={styles.sourcesContainer}>{
      history?.Sources
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
                {source?.WebsiteURL
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

          formattedHistory.push(
            { useTypewriter: false,
              isComplete: false,
              Type: history.Type,
              Data: history?.Sources ? sources : history.Data,
              MessageTime: new Date().toISOString(),
              MessageId: history?.MessageId || nanoid()
            });
        } else {
          const lastMessage = formattedHistory[formattedHistory.length - 1];

          if ( typeof lastMessage?.isComplete !== "undefined" && !lastMessage.isComplete ) {
            lastMessage.Data = [ lastMessage.Data, history?.Data, "</div></div>" ].join( "" );
            lastMessage.isComplete = true;
          } else {
            formattedHistory.push({ useTypewriter: false,
              isComplete: true,
              Type: history.Type,
              Data: history.Data,
              MessageTime: new Date().toISOString(),
              MessageId: history?.MessageId || nanoid()
            });
          }
        }
      });

      setLocalHistory?.( formattedHistory );
      refetchSessionDetails();
    }
    return () => {
      setLocalHistory?.([]);
    };
  }, [ isSuccessSessionDetails, sessionId, session?.History, setLocalHistory, refetchSessionDetails ]);

  useEffect(() => {
    scrollToTheBottom();
  }, [ localHistory.length, scrollToTheBottom ]);

  //Polling logic.
  useEffect(() => {
    let timeout: any;
    if (( typeof session?.QueryStatus === "string" && session?.QueryStatus !== "completed" ) && sessionId ){
      timeout = setTimeout(() => {
        if ( isSuccessSessionDetails ){
          refetchSessionDetails();
        }
      }, 5000 );
    }

    return () => {
      timeout && clearTimeout( timeout );
    };
  }, [ session?.QueryStatus, sessionId, refetchSessionDetails, isSuccessSessionDetails ]);

  if ( !sessionId ) {
    return <EmptyState classes="w-auto h-full flex items-center" transparentBG
      display="vertical"
      img={<ADPIcon icon="help" size="xl" classes="text-primary-300" />}
    >
      <EmptyState.Content title="Select from session history or create a new session to start chatting" />
      <EmptyState.CTA>
        <Button classes="btn btn-primary btn-auto-width"
          disabled={creatingChatSession}
          loading={creatingChatSession} onClick={async() => {
            try {
              await createChatSession( undefined )
                .unwrap()
                .then(( response: any ) => {
                  if ( !response.error ) {
                    showSuccessNotification({
                      autoHideDelay: 5000,
                      content: response.Message
                    });
                    navigate( `${playground.path}/sessions/${response.SessionId}` );
                  }
                })
                .catch();
              // eslint-disable-next-line no-empty
            } catch {}
          }}>
          {"New Session"}
        </Button>
      </EmptyState.CTA>
    </EmptyState>;
  }

  return (( isLoadingSessionDetails ) ? <div className="flex h-full w-full items-center justify-center">
    <Spinner size="sm" label="Loading chat..." variant="pulse" />
  </div> : <>
    {localHistory?.length > 0 ?
      <PerfectScrollbar options={{ suppressScrollX: true }} id="elems" containerRef={ref => {
        setScrollEl( ref );
      }} component="div" className={clsx( "w-full pt-8 space-y-2 overscroll-auto" )}>
        {localHistory.slice()
          ?.sort(( a, b ) => new Date( a.MessageTime ).getTime() - new Date( b.MessageTime ).getTime())
          ?.map(( message, index ) =>
            <ChatBubble message={message} scrollToTheBottom={scrollToTheBottom} key={index} isLastMessage={ index === localHistory.length - 1 }
              isLoading={ !( message.isComplete ?? true )} />
          )}
        { waitingForResponse && <ChatBubble message={{
          MessageId: "loading",
          MessageTime: new Date().toISOString(),
          Type: "ai",
          Data: "Churning data...",
          isComplete: true
        }} isLoading scrollToTheBottom={scrollToTheBottom} /> }
      </PerfectScrollbar> : <div className="flex h-full w-full items-center justify-center gap-2">
        <ADPIcon icon="msg" classes="text-primary-300" />
        <span>{"How can we help you today ?"}</span>
      </div>}
  </>
  );
};

export default Messages;