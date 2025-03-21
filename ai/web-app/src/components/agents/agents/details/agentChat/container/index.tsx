import React from "react";
import ChatContainer from "../chatContainer";
import SessionsContainer from "../sessionsContainer";

const PlaygroundContainer = (): JSX.Element => {
  return (
    <div className="adp-v2 flex items-start justify-start 2xl:justify-center w-full h-[calc(100vh-7rem)]">
      <div className="h-full w-full max-w-full flex flex-row items-center gap-4">
        <div className="flex-grow h-full">
          <ChatContainer />
        </div>
        <div className="flex-none h-full w-max max-w-sm">
          <SessionsContainer />
        </div>
      </div>
    </div>
  );
};

export default PlaygroundContainer;