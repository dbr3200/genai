// libraries
import React from "react";

// components
import NewDetailsDump from "../../../customComponents/detailsDump/newDetailsDump";

// methods / hooks / constants / styles
import { formatDetails } from "./detailsConfig";
import { ChatbotDetails } from "../../../../services/chatbots";

const DetailsTab = ({
  chatbotDetails,
  metadataCTAs = []
}: { chatbotDetails: ChatbotDetails, metadataCTAs: any}): React.ReactElement => {
  const formattedDetails = React.useMemo(() => formatDetails( chatbotDetails ), [chatbotDetails]);
  return <section className="flex flex-col gap-4">
    <div className="flex justify-end">{metadataCTAs}</div>
    <NewDetailsDump data={formattedDetails} />
  </section>;
};

export default React.memo( DetailsTab );