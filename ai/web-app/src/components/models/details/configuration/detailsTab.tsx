// libraries
import React from "react";

// components
import NewDetailsDump from "../../../customComponents/detailsDump/newDetailsDump";

// methods / hooks / constants / styles
import { formatDetails } from "./detailsConfig";
import { ModelDetails } from "../../../../services/models";

interface DetailsTabProps {
    modelsDetails: ModelDetails;
    metadataCTAs?:any
}
const DetailsTab = ({
  modelsDetails,
  metadataCTAs
}: DetailsTabProps ): React.ReactElement => {
  const formattedDetails = React.useMemo(() => formatDetails( modelsDetails ), [modelsDetails]);
  return <section id="ModelMetadata" className="flex flex-col gap-4">
    {metadataCTAs && <div className="flex justify-end">{metadataCTAs}</div>}
    <NewDetailsDump data={formattedDetails} />
  </section>;
};

export default React.memo( DetailsTab );