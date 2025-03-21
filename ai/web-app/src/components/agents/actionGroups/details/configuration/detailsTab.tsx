// libraries
import React, { useCallback } from "react";

// components
import NewDetailsDump from "../../../../customComponents/detailsDump/newDetailsDump";

// methods / hooks / constants / styles
import { formatDetails } from "./detailsConfig";
import { ActionGroupDetails, useGetPresignedURLForAPIDefFileDownloadQuery,
  useGetPresignedURLForLambdaFileDownloadQuery } from "../../../../../services/agents/actionGroups";
import { useInfoNotification } from "../../../../../utils/hooks";
import { downloadWithLink } from "../../../../../utils";
import { useTranslation } from "react-i18next";
import { usePermanentPaths } from "../../../../utils/hooks/usePermanentPaths";

interface DetailsTabProps {
    actionGroupDetails: ActionGroupDetails;
    metadataCTAs?:any
}
const DetailsTab = ({
  actionGroupDetails,
  metadataCTAs
}: DetailsTabProps ): React.ReactElement => {
  const { t } = useTranslation();
  const { libraries } = usePermanentPaths();
  const [showInfoNotification] = useInfoNotification();
  const { data: { PresignedURL: ApiDefPresignedURL } = {} } = useGetPresignedURLForAPIDefFileDownloadQuery( actionGroupDetails.ActionGroupId );
  const { data: { PresignedURL: LambdaPresignedURL } = {} } = useGetPresignedURLForLambdaFileDownloadQuery( actionGroupDetails.ActionGroupId );

  const downloadData = useCallback( async ( type: "APIDef" | "lambdaCode" ) => {
    showInfoNotification({
      content: t( "common.messages.initiatingDownload" )
    });
    if ( type === "APIDef" ) {
      ApiDefPresignedURL && downloadWithLink( ApiDefPresignedURL );
    } else {
      LambdaPresignedURL && downloadWithLink( LambdaPresignedURL );
    }
  }, [ ApiDefPresignedURL, LambdaPresignedURL, showInfoNotification, t ]);

  const formattedDetails = React.useMemo(() => formatDetails( actionGroupDetails, libraries, downloadData ), [ actionGroupDetails, libraries, downloadData ]);

  return <section className="flex flex-col gap-4">
    {metadataCTAs && <div className="flex justify-end">{metadataCTAs}</div>}
    <NewDetailsDump data={formattedDetails} />
  </section>;
};

export default React.memo( DetailsTab );