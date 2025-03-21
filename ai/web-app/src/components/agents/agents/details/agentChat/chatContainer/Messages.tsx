import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ADPIcon, Button, EmptyState, Spinner } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import PerfectScrollbar from "react-perfect-scrollbar";

import ChatBubble from "./ChatBubble";

import { useCreateChatSessionMutation, useGetChatSessionDetailsQuery } from "../../../../../../services/chat";
import { useSuccessNotification } from "../../../../../../utils/hooks";
import { IMessage } from "../../../../../../types";

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
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
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
      setLocalHistory?.( session?.History ?? []);
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
  }, [ isSuccessSessionDetails, refetchSessionDetails, session?.QueryStatus, sessionId ]);

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
              await createChatSession({ "client-id": `agent-${resourceId}` })
                .unwrap()
                .then(( response: any ) => {
                  if ( !response.error ) {
                    showSuccessNotification({
                      autoHideDelay: 5000,
                      content: response.Message
                    });
                    navigate( `?tab=chat&sessionId=${response.SessionId}` );
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
      <PerfectScrollbar id="elems" containerRef={ref => {
        setScrollEl( ref );
      }} component="div" className={clsx( "w-full pt-8 space-y-2 overscroll-auto" )}>
        {localHistory.slice()
          ?.sort(( a, b ) => new Date( a.MessageTime ).getTime() - new Date( b.MessageTime ).getTime())
          ?.map(( message, index ) =>
            <ChatBubble message={message} scrollToTheBottom={scrollToTheBottom} key={message?.MessageTime} isLastMessage={ index === localHistory.length - 1 }
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