// libraries
import {
  Avatar, AvatarGroup, TextCopy
} from "@amorphic/amorphic-ui-core";
import React from "react";

// components
import TimeStamp from "../../../common/timeStamp";

// methods / hooks / constants / styles
import { getStringOrDefault, FallbackIfEmpty } from "../../../../utils/renderUtils";
import { truncateId } from "../../../../utils";
import { IServiceDetails, DisplaySizes } from "../../../customComponents/detailsDump/detailsDump.types";

/**
 * Function that returns the display logic for details page
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatDetails = ( data: any ): IServiceDetails[] => {

  return ([
    {
      DisplayName: "Workspace Metadata",
      DisplayDescription: "Metadata information for the Workspace",
      DisplaySize: DisplaySizes.Wide,
      DefaultExpanded: true,
      sectionId: "Metadata",
      Fields: [
        {
          FieldName: "Workspace Name",
          FieldValue: <TextCopy text={data?.WorkspaceName}>
            {truncateId( data?.WorkspaceName, 20 )}
          </TextCopy>,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "services.workspaces.WorkspaceId",
          FieldValue: <TextCopy text={data?.WorkspaceId}>
            {data?.WorkspaceId}
          </TextCopy>
        },
        {
          FieldName: "Description",
          FieldValue: data?.Description,
          DisplaySize: DisplaySizes.Wide
        },
        {
          FieldName: "services.workspaces.CreatedBy",
          FieldValue:
          <div className="flex gap-2"> {`${getStringOrDefault({ value: data.CreatedBy, defaultValue: "-" })}`}
            {data?.CreationTime && <TimeStamp rawDate={data?.CreationTime} />}
          </div>
        },
        {
          FieldName: "services.workspaces.Keywords",
          FieldValue: <FallbackIfEmpty data={data?.Keywords}>
            <AvatarGroup size="sm" maxItems={3} grouped>
              {data?.Keywords?.map(( Keyword: string ) => <Avatar label={Keyword} key={Keyword} /> )}
            </AvatarGroup>
          </FallbackIfEmpty>,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "services.workspaces.LastModifiedBy",
          FieldValue:
          <div className="flex gap-2"> {`${getStringOrDefault({ value: data.LastModifiedBy, defaultValue: "-" })}`}
            {data?.LastModifiedTime && <TimeStamp rawDate={data?.LastModifiedTime} />}
          </div>

        },
        {
          FieldName: "Access Type",
          FieldValue: data?.AccessType,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Schedule Expression",
          FieldValue: data?.ScheduleExpression,
          DisplaySize: DisplaySizes.Regular,
          DisplayCondition: data?.ScheduleExpression !== "" && data?.ScheduleExpression !== undefined
        },
        {
          FieldName: "services.workspaces.SourceFileSyncStatus",
          FieldValue: getStringOrDefault({ value: data.SourceFileSyncStatus, defaultValue: "-" })
        },
        {
          FieldName: "services.workspaces.TriggerType",
          FieldValue: getStringOrDefault({ value: data.TriggerType, defaultValue: "-" })
        },
        {
          FieldName: "Embeddings Model",
          FieldValue: getStringOrDefault({ value: typeof data.EmbeddingsModel === "string"
            ? data.EmbeddingsModel
            : data.EmbeddingsModel?.Name, defaultValue: "-" })
        }
      ]
    },
    {
      DisplayName: "Chunking Configuration",
      DisplaySize: DisplaySizes.Wide,
      DefaultExpanded: true,
      sectionId: "ChunkingConfig",
      Fields: [
        {
          FieldName: "Max Tokens",
          FieldValue: data?.ChunkingConfig?.MaxTokens,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Overlap Percentage",
          FieldValue: data?.ChunkingConfig?.OverlapPercentage
        }
      ]
    }
  ]);
};