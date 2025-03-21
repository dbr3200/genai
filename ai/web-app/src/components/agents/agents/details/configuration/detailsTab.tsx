// libraries
import React from "react";

// components
import NewDetailsDump from "../../../../customComponents/detailsDump/newDetailsDump";

// methods / hooks / constants / styles
import { formatDetails } from "./detailsConfig";
import { AgentDetails } from "../../../../../services/agents/agents";
import { usePermanentPaths } from "../../../../utils/hooks/usePermanentPaths";

interface DetailsTabProps {
    agentDetails: AgentDetails;
    metadataCTAs?:any
}
const DetailsTab = ({
  agentDetails,
  metadataCTAs
}: DetailsTabProps ): React.ReactElement => {
  const { actionGroups, workspaces } = usePermanentPaths();
  const formattedDetails = React.useMemo(() => formatDetails( agentDetails, actionGroups, workspaces ), [ agentDetails, actionGroups, workspaces ]);

  return <section className="flex flex-col gap-4">
    {metadataCTAs && <div className="flex justify-end">{metadataCTAs}</div>}
    <NewDetailsDump data={formattedDetails} />
  </section>;
};

export default React.memo( DetailsTab );