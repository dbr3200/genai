// libraries
import React from "react";
import { Badge, Label, TextCopy } from "@amorphic/amorphic-ui-core";

// components
import TimeStamp from "../../../common/timeStamp";

// methods / hooks / constants / styles
import { GenericStatus, getStringOrDefault } from "../../../../utils/renderUtils";
import { maskAwsArn } from "../../../../utils";
import { ModelDetails } from "../../../../services/models";
import { IServiceDetails, DisplaySizes } from "../../../customComponents/detailsDump/detailsDump.types";

/**
 * Function that returns the display logic for details page
 */
export const formatDetails = ( data: ModelDetails ): IServiceDetails[] => {

  return ([
    {
      DisplayName: "Model Metadata",
      DisplayDescription: "Metadata information for the Custom Model",
      DisplaySize: DisplaySizes.Wide,
      DefaultExpanded: true,
      sectionId: "Metadata",
      Fields: [
        {
          FieldName: "Model Name",
          FieldValue: <TextCopy text={data?.ModelName}>
            {data?.ModelName}
          </TextCopy>,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Model Id",
          FieldValue: <TextCopy text={data?.ModelId}>
            {data?.ModelId}
          </TextCopy>
        },
        {
          FieldName: "Model Status",
          FieldValue: <span className="flex items-center gap-2">
            <GenericStatus status={data.ModelStatusCode ?? "unknown"} /> {data.ModelStatusMessage ?? "Unkown"}
          </span>
        },
        {
          FieldName: "Model Arn",
          FieldValue: <TextCopy text={data?.ModelArn}>
            {maskAwsArn( data?.ModelArn )}
          </TextCopy>
        },
        {
          FieldName: "Model Type",
          FieldValue: data?.ModelType
        },
        {
          FieldName: "Model Provider",
          FieldValue: data?.ModelProvider || maskAwsArn( data?.ModelArn )
        },
        {
          FieldName: "Is streaming enabled",
          FieldValue: data.IsStreamingEnabled
        },
        {
          FieldName: "Description",
          FieldValue: data?.Description,
          DisplaySize: DisplaySizes.Wide
        },
        {
          FieldName: "Model Traits",
          FieldValue: data?.ModelTraits ?? "-",
          DisplaySize: DisplaySizes.Wide
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
          FieldName: "Modalities",
          FieldValue: data.Modalities
            ? <div className="flex items-center gap-2">
              {data.Modalities.map(( val: string ) => ( <Label classes="!m-0" variant="info" key={val}>{val.replace( "_", " " )}</Label> ))}</div>
            : "-"
        },
        {
          FieldName: "Customizations Supported",
          FieldValue: data.CustomizationsSupported?.length > 0
            ? <div className="flex items-center gap-2">
              {data.CustomizationsSupported.map(( val: string ) => ( <Label classes="!m-0" variant="info" key={val}>{val.replace( "_", " " )}</Label> ))}
            </div>
            : "N/A"
        },
        {
          FieldName: "Inference Types Supported",
          FieldValue: data.InferenceTypesSupported
            ? <div className="flex items-center gap-2">{
              data.InferenceTypesSupported.map(( val: string ) => ( <Label classes="!m-0" variant="info" key={val}>{val.replace( "_", " " )}</Label> ))}
            </div>
            : "-"

        }
      ].concat( Object.keys( data.AdditionalConfiguration ).length > 0
        ? [{
          FieldName: "Status",
          FieldValue: data.AdditionalConfiguration.Status
        },
        {
          FieldName: "Base Model Name",
          FieldValue: getStringOrDefault({ value: data.AdditionalConfiguration?.BaseModelName, defaultValue: "-" })
        },
        {
          FieldName: "Base Model Id",
          FieldValue: <TextCopy text={data?.AdditionalConfiguration?.BaseModelId}>{data?.AdditionalConfiguration?.BaseModelId}</TextCopy>
        },
        {
          FieldName: "Message",
          FieldValue: getStringOrDefault({ value: data.AdditionalConfiguration?.Message, defaultValue: "-" })
        },
        {
          FieldName: "Hyper Parameters",
          FieldValue: data?.AdditionalConfiguration?.HyperParameters
            ? <div className="flex gap-4">
              {Object.entries( data?.AdditionalConfiguration?.HyperParameters ).map(([ key, value ]) => <Badge key={key} label={key} value={value} /> )}
            </div>
            : "-",
          DisplaySize: DisplaySizes.Wide
        }]
        : [] as any )
    }
  ]);
};