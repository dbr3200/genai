import React, { useEffect, useState } from "react";
import { ADPIcon, Spinner } from "@amorphic/amorphic-ui-core";
import ChatBubble from "./chatBubble";
import PerfectScrollbar from "react-perfect-scrollbar";

import styles from "./chat.module.scss";
import { useAppSelector } from "../../../../../utils/hooks";

interface IMessagesProps {
  localHistory?: any[];
  loadingSendingMessage?: boolean;
  creatingChatSession: boolean;
}

const Messages = ({
  localHistory = [],
  loadingSendingMessage,
  creatingChatSession
}: IMessagesProps ): JSX.Element => {
  const { botWelcomeMessage } = useAppSelector(({ globalConfig }) => globalConfig );
  const [ scrollEl, setScrollEl ] = useState<any>();

  useEffect(() => {
    if ( scrollEl as React.MutableRefObject<HTMLDivElement> ) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  }, [ scrollEl, localHistory.length ]);

  return creatingChatSession
    ? <div className={styles.spinnerContainer}>
      <Spinner size="sm" label="Loading chat..." variant="pulse" />
    </div>
    : localHistory?.length > 0
      ? <PerfectScrollbar id="elems" containerRef={ref => {
        setScrollEl( ref );
      }} component="div" className={styles.conversations}>
        {localHistory.slice().map(( message, index ) =>
          <ChatBubble message={message} key={index} isLastMessage={ index === localHistory.length - 1 } />
        )}
        { loadingSendingMessage && <ChatBubble message={{
          messageId: "loading",
          messageTime: new Date().toISOString(),
          type: "ai",
          data: "Churning data..."
        }} isLoading /> }
      </PerfectScrollbar>
      : <div className={styles.emptyChat}>
        <ADPIcon size="lg" icon="msg" classes="text-primary-300" />
        <span>{botWelcomeMessage ?? "How can I help you today?"}</span>
      </div>;
};

export default Messages;