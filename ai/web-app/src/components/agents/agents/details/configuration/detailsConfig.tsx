// libraries
import React from "react";
import { ADPIcon, TextCopy } from "@amorphic/amorphic-ui-core";

// components
import TimeStamp from "../../../../common/timeStamp";

// methods / hooks / constants / styles
import { getStringOrDefault } from "../../../../../utils/renderUtils";
import { maskAwsArn } from "../../../../../utils";
import { AgentDetails } from "../../../../../services/agents/agents";
import { IServiceDetails, DisplaySizes } from "../../../../customComponents/detailsDump/detailsDump.types";
import styles from "./styles.module.scss";
import { Link, RouteObject } from "react-router-dom";
import { routeActions } from "../../../../../constants";

/**
 * Function that returns the display logic for details page
 */
export const formatDetails = ( data: AgentDetails, actionGroups: RouteObject, workspaces: RouteObject ): IServiceDetails[] => {
  return [
    {
      DisplayName: "Agent Metadata",
      DisplayDescription: "Metadata information for the Agent",
      DisplaySize: DisplaySizes.Wide,
      DefaultExpanded: true,
      sectionId: "Metadata",
      Fields: [
        {
          FieldName: "Agent Name",
          FieldValue: <TextCopy text={data?.AgentName}>
            {data?.AgentName}
          </TextCopy>,
          DisplaySize: DisplaySizes.Regular
        },
        {
          FieldName: "Description",
          FieldValue: data?.Description,
          DisplaySize: DisplaySizes.Wide
        },
        {
          FieldName: "Instruction",
          FieldValue: data?.Instruction,
          DisplaySize: DisplaySizes.Wide
        },
        {
          FieldName: "Agent Id",
          FieldValue: <TextCopy text={data?.AgentId}>
            {data?.AgentId}
          </TextCopy>
        },
        {
          FieldName: "Reference Id",
          FieldValue: <TextCopy text={data?.ReferenceId}>
            {data?.ReferenceId}
          </TextCopy>
        },
        {
          FieldName: "Agent Status",
          FieldValue: data?.AgentStatus
        },

        {
          FieldName: "Agent Arn",
          FieldValue: <TextCopy text={data?.AgentArn}>
            {maskAwsArn( data?.AgentArn )}
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
          FieldName: "Message",
          FieldValue: data?.Message
        },
        {
          FieldName: "Base Model",
          FieldValue: data?.BaseModel
        },
        {
          FieldName: "Query Follow Up",
          FieldValue: data?.QueryFollowUp
        },
        {
          FieldName: "Attached Action Groups",
          FieldValue:
          <ul className={styles.list}>
            {data?.AttachedActionGroups?.length > 0
              ? data?.AttachedActionGroups?.map(( actionGroup ) => <li key={actionGroup.ActionGroupId} className={styles.listItem}>
                <Link className="flex gap-2 items-center" to={`${actionGroups.path}/${actionGroup.ActionGroupId}/${routeActions.details}`}>
                  {actionGroup.ActionGroupName} <ADPIcon icon="external-link" size="xxs" /></Link>
              </li> )
              : "-"}
          </ul>
        },
        {
          FieldName: "Attached Workspaces",
          FieldValue: <ul className={styles.list}>
            {data?.AttachedWorkspaces?.length > 0
              ? data?.AttachedWorkspaces?.map(( workspace ) => <li key={workspace.WorkspaceId} className={styles.listItem}>
                <Link className="flex gap-2 items-center" to={`${workspaces.path}/${workspace.WorkspaceId}/${routeActions.details}`}>
                  {workspace.WorkspaceName} <ADPIcon icon="external-link" size="xxs" /></Link>
              </li> )
              : "-"}
          </ul>
        }
      ]
    }
  ];
};