import React, { useEffect } from "react";
import { ADPIcon, Progressbar, TextCopy } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";

import TypingEffect from "./TypingEffect";

import { useAppSelector } from "../../../utils/hooks";
import { IMessage } from "../../../types";
import styles from "./styles.module.scss";

interface IChatBubbleProps {
    message: IMessage;
    isLoading?: boolean;
    isLastMessage?: boolean;
    scrollToTheBottom: () => void;
}

const ChatBubble = ({
  message,
  isLoading,
  isLastMessage,
  scrollToTheBottom
}: IChatBubbleProps ): JSX.Element => {
  const { FullName } = useAppSelector(({ account }) => account );
  // replace ```multiline_str``` with <code>multiline_str</code> tag in message.Data
  const messageData = convertMarkdownToHtml( message?.Data || "" );

  return ( <div className={clsx(
    "group/chatbubble flex flex-row items-start justify-start gap-2 even:bg-secondary-50 p-4 rounded-md",
    "first:pt-0"
  )}>
    <div className={clsx(
      "px-1 py-2 rounded-full flex items-center justify-center shadow",
      { "bg-primary-300 text-white": message.Type === "ai" },
      { "bg-secondary-100 text-primary-300": message.Type !== "ai" }
    )}>
      <ADPIcon fixedWidth icon={ message.Type === "ai" ? "msg" : "user" } size="xs" />
    </div>
    <div className="flex flex-col items-start justify-start gap-1 w-full min-w-0">
      <h3 className="text-md font-bold">{message.Type === "human" ? FullName : "Amorphic AI"}</h3>
      { ( isLastMessage && message?.useTypewriter )
        ? <TypingEffect message={messageData} type="html" scrollToTheBottom={scrollToTheBottom} />
        : <AIParserComponent message={messageData} scrollToTheBottom={scrollToTheBottom} />
      }
      { isLoading ? <div className="w-1/2 mt-4">
        <Progressbar value={100} variant="info" striped animate showPercentage={false} />
      </div> : <div className="invisible group-hover/chatbubble:visible">
        <TextCopy text={messageData}>
          {"-"}
        </TextCopy>
      </div>}
    </div>
  </div> );
};

function convertMarkdownToHtml( inputString: string ) {
  // Regular expression for detecting specific Markdown content (code blocks, tables, images, and links)
  const markdownRegex = /(`{3})([a-zA-Z]+)?([\s\S]*?[^`])\1|\|(.+?)\||!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]*)\]\(([^)]+)\)|`([^`]+)`/g;

  // Replace Markdown with HTML tags
  const htmlString = inputString.replace( markdownRegex, function( match, p1, p2, p3, p4, p5, p6, p7, p8, p9 ) {
    // Check which capturing group matched
    if ( p1 ) {
      // Code block: ```code```
      const language = p2 ? `class="language-${p2}"` : "";
      return `<code ${language}>${p3?.trim()}</code>`;
    } else if ( p4 ) {
      // Table: | header | header |
      const cells = p4.trim().split( "|" ).map( cell => cell.trim());
      return `<table><tr>${cells.map( cell => `<th>${cell}</th>` ).join( "" )}</tr></table>`;
    } else if ( p5 && p6 ) {
      // Image: ![alt text](url)
      return `<img src="${p6}" alt="${p5}" />`;
    } else if ( p7 && p8 ) {
      // Link: [text](url)
      return `<a href="${p8}" target="_blank">${p7}</a>`;
    } else if ( p9 !== undefined ) {
      // Text between single backticks: 'text'
      return `<span class="highlight">${p9}</span>`;
    }
  });

  return htmlString;
}

// const htmlOutput = convertMarkdownToHtml(inputString);

const AIParserComponent = ({ message, scrollToTheBottom }: { message: string, scrollToTheBottom: () => void }) => {

  useEffect(() => {
    scrollToTheBottom();
  }, [ message.length, scrollToTheBottom ]);

  return ( <>
    {/* <ReactMarkdown className={styles.chatBubble}>
      {message}
    </ReactMarkdown> */}
    <div dangerouslySetInnerHTML={{ __html: message }} className={styles.chatBubble}></div>
  </>
  );
};

export default ChatBubble;