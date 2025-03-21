import React, { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import clsx from "clsx";
import TimeStamp from "../../common/timeStamp";
import { ADPIcon } from "@amorphic/amorphic-ui-core";

interface ISingleSessionItemProps {
    SessionId: string;
    Title: string;
    UserId: string;
    StartTime: string;
    LastModifiedTime: string;
}

interface ISessionItemProps {
    session: ISingleSessionItemProps;
    setSelectedChatSession: ( session: ISingleSessionItemProps ) => void;
}

const SessionItem = ({
  session,
  setSelectedChatSession
}: ISessionItemProps ): JSX.Element => {
  const { sessionId } = useParams<{ sessionId?: string }>();
  const { playground } = usePermanentPaths();
  const SetChatSession = useCallback(( event: React.MouseEvent<HTMLButtonElement> ) => {
    event.preventDefault();
    setSelectedChatSession( session );
  }, [ session, setSelectedChatSession ]);
  return ( <>
    <Link to={`${playground.path}/sessions/${session.SessionId}`}
      className={clsx(
        " flex flex-col gap-1 items-start justify-center overflow-clip",
        "w-full p-4 rounded-md cursor-pointer hover:bg-primary-50",
        { "bg-primary-100": session.SessionId === sessionId }
      )}>
      <div className="group flex items-start justify-between w-full gap-2">
        <p className="text-md line-clamp-2 flex-grow">
          {session.Title}
        </p>
        <button onClick={SetChatSession}>
          <ADPIcon icon="delete" size="xs" classes="group-hover:text-salsa" />
        </button>
      </div>
      <div className="text-sm text-secondary-150">
        <TimeStamp toggleDisplay={false} rawDate={session?.LastModifiedTime} />
      </div>
    </Link>
  </>
  );
};

export default SessionItem;