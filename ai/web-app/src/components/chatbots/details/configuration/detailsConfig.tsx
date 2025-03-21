// libraries
import { Avatar, AvatarGroup, TextCopy } from "@amorphic/amorphic-ui-core";
import React from "react";

// components
import TimeStamp from "../../../common/timeStamp";

// methods / hooks / constants / styles
import { getStringOrDefault, FallbackIfEmpty } from "../../../../utils/renderUtils";
import { truncateId } from "../../../../utils";
import { IServiceDetails, DisplaySizes } from "../../../customComponents/detailsDump/detailsDump.types";
import { ChatbotDetails } from "../../../../services/chatbots";

/**
 * Function that returns the display logic for details page
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const formatDetails = ( data: ChatbotDetails ): IServiceDetails[] => {

  return ([
    {
      DisplayName: "Chatbot Metadata",
      DisplayDescription: "Metadata information for the Chatbot",
      DisplaySize: DisplaySizes.Wide,
      DefaultExpanded: true,
      sectionId: "Metadata",
      Fields: [
        {
          FieldName: "Chatbot Name",
          FieldValue: <TextCopy text={data?.ChatbotName}>
            {truncateId( data?.ChatbotName, 20 )}
          </TextCopy>,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Description",
          FieldValue: data?.Description,
          DisplaySize: DisplaySizes.Wide
        },
        {
          FieldName: "Chatbot Id",
          FieldValue: <TextCopy text={data?.ChatbotId}>
            {data?.ChatbotId}
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
          FieldName: "Keywords",
          FieldValue: <FallbackIfEmpty data={data?.Keywords}>
            <AvatarGroup size="sm" maxItems={3} grouped>
              {data?.Keywords?.map(( Keyword: string ) => <Avatar label={Keyword} key={Keyword} /> )}
            </AvatarGroup>
          </FallbackIfEmpty>,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Last Modified By",
          FieldValue:
          <div className="flex gap-4"> {`${getStringOrDefault({ value: data.LastModifiedBy, defaultValue: "-" })}`}
            {data?.LastModifiedTime && <TimeStamp rawDate={data?.LastModifiedTime} />}
          </div>

        },
        {
          FieldName: "Access Type",
          FieldValue: data?.AccessType,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Endpoint",
          Tooltip: "REST API endpoint for chatbot. It might take 30 seconds for the URL to be available.",
          FieldValue: data?.Endpoint
            ? <a href={data?.Endpoint} className="text-primary-250" target="_blank" rel="noopener noreferrer">
              {data?.Endpoint}
            </a>
            : "-",
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Workspace",
          FieldValue: data?.Workspace,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Model",
          FieldValue: data?.Model,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Keep Active",
          FieldValue: data?.KeepActive?.toString(),
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Enable Redaction",
          FieldValue: data?.EnableRedaction?.toString(),
          DisplaySize: DisplaySizes.Regular,
          DisplayCondition: Boolean( data?.EnableRedaction )
        },
        {
          FieldName: "Save Chat History",
          FieldValue: data?.EmbeddedConfig?.SaveChatHistory ?? "-",
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Bot Avatar URL",
          FieldValue: data?.EmbeddedConfig?.BotAvatar ?? "-",
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Bot Welcome Message",
          FieldValue: data?.EmbeddedConfig?.BotWelcomeMessage ?? "-",
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Custom Bot Name",
          FieldValue: data?.EmbeddedConfig?.BotName ?? "-",
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Instructions",
          FieldValue: data?.Instructions ?? "-",
          DisplaySize: DisplaySizes.Wide,
          DisplayCondition: Boolean( data?.Instructions )
        }
      ]
    }
  ]);
};