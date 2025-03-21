// libraries
import React from "react";

// components
import NewDetailsDump from "../../../customComponents/detailsDump/newDetailsDump";

// methods / hooks / constants / styles
import { formatDetails } from "./detailsConfig";
import { WorkspaceDetails } from "../../../../services/workspaces";

interface DetailsTabProps {
    workspaceDetails: WorkspaceDetails;
    metadataCTAs?:any
}
const DetailsTab = ({
  workspaceDetails,
  metadataCTAs = []
}: DetailsTabProps ): React.ReactElement => {
  const formattedDetails = React.useMemo(() => formatDetails( workspaceDetails ), [workspaceDetails]);
  return <section className="flex flex-col gap-4">
    <div className="flex justify-end">{metadataCTAs}</div>
    <NewDetailsDump data={formattedDetails} />
  </section>;
};

export default React.memo( DetailsTab );