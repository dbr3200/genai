// libraries
import React from "react";
import { ADPIcon, Button, TextCopy } from "@amorphic/amorphic-ui-core";

// components
import TimeStamp from "../../../../common/timeStamp";

// methods / hooks / constants / styles
import { getStringOrDefault } from "../../../../../utils/renderUtils";
import { maskAwsArn, truncateId } from "../../../../../utils";
import { ActionGroupDetails } from "../../../../../services/agents/actionGroups";
import { DisplaySizes, IServiceDetails } from "../../../../customComponents/detailsDump/detailsDump.types";
import styles from "./styles.module.scss";
import { Link, RouteObject } from "react-router-dom";
import { routeActions } from "../../../../../constants";

/**
 * Function that returns the display logic for details page
 */
export const formatDetails = ( data: ActionGroupDetails, libraries: RouteObject,
  downloadData: ( type: "APIDef" | "lambdaCode" ) => Promise<void> ): IServiceDetails[] => {
  return [
    {
      DisplayName: "Action Group Metadata",
      DisplayDescription: "Metadata information for the ActionGroup",
      DisplaySize: DisplaySizes.Wide,
      DefaultExpanded: true,
      sectionId: "Metadata",
      Fields: [
        {
          FieldName: "Action Group Name",
          FieldValue: <TextCopy text={data?.ActionGroupName}>
            {truncateId( data?.ActionGroupName, 20 )}
          </TextCopy>,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Description",
          FieldValue: data?.Description,
          DisplaySize: DisplaySizes.Wide
        },
        {
          FieldName: "Action Group Id",
          FieldValue: <TextCopy text={data?.ActionGroupId}>
            {data?.ActionGroupId}
          </TextCopy>
        },
        {
          FieldName: "Lambda Arn",
          FieldValue: <TextCopy text={data?.LambdaArn}>
            {maskAwsArn( data?.LambdaArn )}
          </TextCopy>
        },
        {
          FieldName: "Lambda Handler",
          FieldValue: data?.LambdaHandler
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
          FieldName: "Action Group Status",
          FieldValue:
          <div className="flex gap-4"> {`${getStringOrDefault({ value: data.ActionGroupStatus, defaultValue: "-" })}`}</div>
        },
        {
          FieldName: "API Definition File",
          FieldValue: data.ApiDefS3Uri
            ? <div className="flex gap-2 items-center"> {data.ApiDefS3Uri?.substring( data.ApiDefS3Uri.lastIndexOf( "/" ) + 1 )}
              <Button variant="icon" icon={<ADPIcon icon="download" size="xs" />} onClick={() => downloadData( "APIDef" )} />
            </div>
            : "-"
        },
        {
          FieldName: "Lambda code File",
          FieldValue: data.LambdaS3Uri
            ? <div className="flex gap-2 items-center"> {data.LambdaS3Uri?.substring( data.LambdaS3Uri.lastIndexOf( "/" ) + 1 )}
              <Button variant="icon" icon={<ADPIcon icon="download" size="xs" />} onClick={() => downloadData( "lambdaCode" )} />
            </div>
            : "-"
        },
        {
          FieldName: "Message",
          FieldValue: data?.Message
        },
        {
          FieldName: "Attached Libraries",
          FieldValue:
          <ul className={styles.libraryList}>
            {data?.AttachedLibraries?.length > 0 ?
              data.AttachedLibraries.map(({ LibraryId, LibraryName }) => <li key={LibraryId} className={styles.libraryListItem}>
                <Link className="w-full flex gap-2 items-center" to={`${libraries.path}/${LibraryId}/${routeActions.details}`}>
                  {LibraryName}<ADPIcon icon="external-link" size="xxs" /></Link>
              </li> )
              : "-"}
          </ul>
        }
      ]
    }
  ];
};