import React, { useState, useEffect } from "react";
// import ReactMarkdown from "react-markdown";
import styles from "./styles.module.scss";

interface ITypingEffectProps {
  message: string;
  type: string;
  scrollToTheBottom: () => void;
}

const TypingEffect = ({ message, type, scrollToTheBottom }: ITypingEffectProps ): JSX.Element => {
  const [ currentMessage, setCurrentMessage ] = useState( "" );

  useEffect(() => {
    const displayMessage = ( msg: string ) => {
      let charIndex = 0;

      const intervalId = setInterval(() => {
        if ( charIndex <= msg.length ) {
          setCurrentMessage( msg.slice( 0, charIndex ));
          charIndex += 1;
          scrollToTheBottom();
        } else {
          clearInterval( intervalId );
        }
      }, 15 );

      return () => clearInterval( intervalId );
    };

    displayMessage( message );
  }, [ message, scrollToTheBottom ]);

  return <div className="typewriter">
    { type === "markdown"
      ? <div className={styles.chatBubble}>{currentMessage}</div>
      : <div className={styles.chatBubble} dangerouslySetInnerHTML={{ __html: currentMessage }} /> }
  </div>;
};

export default TypingEffect;
