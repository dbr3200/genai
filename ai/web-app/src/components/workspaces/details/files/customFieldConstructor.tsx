// libraries
import React from "react";
import { ADPIcon, CTAGroup, TextCopy } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import TimeStamp from "../../../common/timeStamp";
import { formatFileName, truncateId } from "../../../../utils";
import { OverflowEllipse } from "../../../../utils/renderUtils";
import listStyles from "./files.module.scss";

/**
 * This is a custom component for schedule fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ( setDocumentDetails:React.Dispatch<React.SetStateAction<{
  documentId: string;
  documentName: string;
}>>,
toggleDeleteModal: React.Dispatch<React.SetStateAction<boolean>>,
setShowDocumentDetails: React.Dispatch<React.SetStateAction<boolean>> ): Record<string, any> => {
  return {
    DocumentName: ( data: any ) => {
      const { FileName }: { FileName: string } = data?.DocumentDetails;
      return FileName ? formatFileName( FileName ) : "-";
    },
    WebpageURL: ( data: any ) => <OverflowEllipse text={data?.DocumentDetails.WebsiteURL} length={20} />,
    LastModifiedBy: ( data:any ) => (
      <div className="flex gap-4">
        {data.LastModifiedBy ? data?.LastModifiedBy : "-"}
        <TimeStamp rawDate={data?.LastModifiedTime} />
      </div>
    ),
    Message: ( data:any ) => (
      data?.Message ?
        <div className="w-full break-words line-clamp-2" title={data?.Message}>
          <TextCopy text={data?.Message} displayOnHover
            classes="w-full break-words line-clamp-2"
          >
            { truncateId( data?.Message, 150 ) }
          </TextCopy>
        </div> : "-"
    ),
    options: ( data: any ) => (
      <CTAGroup shrink={false} ctaList={[
        {
          callback: () => {
            setDocumentDetails( data );
            setShowDocumentDetails( true );
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="show-password" /></div>,
          label: data.DocumentType === "website" ? "View webpage details" : "View file"
        },
        {
          callback: () => {
            setDocumentDetails( data );
            toggleDeleteModal( true );
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="delete" /></div >,
          label: data.DocumentType === "website" ? "Delete webpage content" : "Delete File"
        }
      ]} />
    )
  };
};