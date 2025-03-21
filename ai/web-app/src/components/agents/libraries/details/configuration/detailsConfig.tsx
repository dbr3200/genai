// libraries
import React from "react";
import { ADPIcon, Button, TextCopy } from "@amorphic/amorphic-ui-core";

// components
import TimeStamp from "../../../../common/timeStamp";

// methods / hooks / constants / styles
import { getStringOrDefault } from "../../../../../utils/renderUtils";
import { truncateId } from "../../../../../utils";
import { LibraryDetails } from "../../../../../services/agents/libraries";
import { IServiceDetails, DisplaySizes } from "../../../../customComponents/detailsDump/detailsDump.types";
import styles from "./styles.module.scss";

/**
 * Function that returns the display logic for details page
 */
export const formatDetails = ( data: LibraryDetails, downloadData: ( s3Path: string ) => Promise<void> ): IServiceDetails[] => {
  return [
    {
      DisplayName: "Library Metadata",
      DisplayDescription: "Metadata information for the Library",
      DisplaySize: DisplaySizes.Wide,
      DefaultExpanded: true,
      sectionId: "Metadata",
      Fields: [
        {
          FieldName: "Library Name",
          FieldValue: <TextCopy text={data?.LibraryName}>
            {truncateId( data?.LibraryName, 20 )}
          </TextCopy>,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Description",
          FieldValue: data?.Description,
          DisplaySize: DisplaySizes.Wide
        },
        {
          FieldName: "Library Id",
          FieldValue: <TextCopy text={data?.LibraryId}>
            {data?.LibraryId}
          </TextCopy>
        },

        {
          FieldName: "Created By",
          FieldValue:
          <div className="flex gap-4"> {`${getStringOrDefault({ value: data.CreatedBy, defaultValue: "-" })}`}
            {data?.CreationTime && <TimeStamp rawDate={data?.CreationTime} />}
          </div>
        },
        {
          FieldName: "Last Modified By",
          FieldValue:
          <div className="flex gap-4"> {`${getStringOrDefault({ value: data.LastModifiedBy, defaultValue: "-" })}`}
            {data?.LastModifiedTime && <TimeStamp rawDate={data?.LastModifiedTime} />}
          </div>
        },
        {
          FieldName: "Packages",
          FieldValue:
          <ul className={styles.packagesList}>
            {data?.Packages
              ? data?.Packages?.map(( path ) => <li key={path} className={styles.packageListItem}>
                {path.substring( path.lastIndexOf( "/" ) + 1 )}
                <Button variant="icon" icon={<ADPIcon icon="download" size="xs" />} onClick={() => downloadData( path )} />
              </li> )
              : "-"
            }
          </ul>
        }
      ]
    }
  ];
};