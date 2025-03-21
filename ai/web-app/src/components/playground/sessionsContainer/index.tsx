import { ADPIcon } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import React from "react";
import SessionsHeader from "./SessionsHeader";
import SessionsList from "./SessionsList";

const SessionsContainer = () => {
  const [ sidebarOpen, setSidebarOpen ] = React.useState( true );
  const toggleSidebar = React.useCallback(() => {
    setSidebarOpen( !sidebarOpen );
  }, [sidebarOpen]);
  return (
    <div className={clsx(
      "flex flex-col p-4 bg-white w-auto max-w-sm group shadow border border-secondary-100",
      { "h-full rounded-md": sidebarOpen }, { "h-auto shadow-md rounded-full": !sidebarOpen },
      { "bg-primary-200": !sidebarOpen }
    )}>
      {sidebarOpen ? <div className="flex flex-col gap-4 h-full w-72">
        <SessionsHeader toggleSidebar={toggleSidebar} />
        <SessionsList />
      </div> : <div className="flex items-center">
        <button onClick={toggleSidebar}>
          <ADPIcon icon="menu" size="xs" />
        </button>
      </div>}
    </div>
  );
};

export default SessionsContainer;