// libraries
import React, { useCallback } from "react";

// components
import NewDetailsDump from "../../../../customComponents/detailsDump/newDetailsDump";

// methods / hooks / constants / styles
import { formatDetails } from "./detailsConfig";
import { LibraryDetails, useLazyGetPresignedURLForPackageDownloadQuery } from "../../../../../services/agents/libraries";
import { useInfoNotification } from "../../../../../utils/hooks";
import { downloadWithLink } from "../../../../../utils";
import { useTranslation } from "react-i18next";

interface DetailsTabProps {
    libraryDetails: LibraryDetails;
    metadataCTAs?:any
}
const DetailsTab = ({
  libraryDetails,
  metadataCTAs
}: DetailsTabProps ): React.ReactElement => {
  const { t } = useTranslation();
  const [showInfoNotification] = useInfoNotification();
  const [downloadPackage] = useLazyGetPresignedURLForPackageDownloadQuery();

  const downloadData = useCallback( async ( s3path: string ) => {
    showInfoNotification({
      content: t( "common.messages.initiatingDownload" )
    });
    const { PresignedURL } = await downloadPackage({ id: libraryDetails.LibraryId, s3path }).unwrap();
    downloadWithLink( PresignedURL );
  }, [ downloadPackage, libraryDetails, showInfoNotification, t ]);

  const formattedDetails = React.useMemo(() => formatDetails( libraryDetails, downloadData ), [ libraryDetails, downloadData ]);

  return <section className="flex flex-col gap-4">
    {metadataCTAs && <div className="flex justify-end">{metadataCTAs}</div>}
    <NewDetailsDump data={formattedDetails} />
  </section>;
};

export default React.memo( DetailsTab );