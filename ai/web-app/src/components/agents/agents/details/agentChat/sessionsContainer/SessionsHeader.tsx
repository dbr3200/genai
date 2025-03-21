import { ADPIcon } from "@amorphic/amorphic-ui-core";
import React from "react";

interface ISessionsHeaderProps {
    toggleSidebar: () => void;
}

const SessionsHeader = ({
  toggleSidebar
}: ISessionsHeaderProps ): JSX.Element => {
  return ( <>
    <div className="flex items-center justify-between border-b border-secondary-100 pb-2">
      <h1 className="text-lg">Sessions</h1>
      <button onClick={toggleSidebar}>
        <ADPIcon icon="menu" size="xs" />
      </button>
    </div>
  </> );
};

export default SessionsHeader;