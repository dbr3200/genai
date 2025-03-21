// libraries
import React from "react";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";
import { Link } from "react-router-dom";

// components
import TimeStamp from "../../../common/timeStamp";

// methods / hooks / constants / styles
import { routeActions } from "../../../../constants";
import listStyles from "./list.module.scss";
import { urlBuilder } from "../../../../modules/utils";

interface CustomFieldConstructorProps {
  agents: any;
  navigate: any
  setSelectedAgent: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  toggleDeleteModal: any;
}

/**
 * This is a custom component for custom model fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ({
  agents,
  navigate,
  setSelectedAgent,
  toggleDeleteModal
}: CustomFieldConstructorProps ): Record<string, any> => {

  return {
    AgentName: ( data: any ) => (
      <div className="flex flex-col justify-start">
        <Link to={ urlBuilder([ agents?.path, data?.AgentId, routeActions.details ], { tab: "configuration" }) ?? ""}>{data?.AgentName}</Link>
        <p className="text-xs text-secondary-400 truncate">
          {data?.Description}
        </p>
      </div>
    ),
    CreatedBy: ( data:any ) => (
      <div className="flex gap-4">
        {data.CreatedBy ? data?.CreatedBy : "-"}
        <TimeStamp rawDate={data?.CreationTime} />
      </div>
    ),
    LastModifiedBy: ( data:any ) => (
      <div className="flex gap-4">
        {data.LastModifiedBy ? data?.LastModifiedBy : "-"}
        <TimeStamp rawDate={data?.LastModifiedTime} />
      </div>
    ),
    options: ( data: any ) => (
      <CTAGroup shrink={false} ctaList={[
        {
          callback: () => navigate?.( urlBuilder([ agents?.path, data?.AgentId, routeActions.details ], { tab: "configuration" })),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="show-password" /></div>,
          label: "View Agent"
        },
        {
          callback: () => navigate?.( `${agents?.path}/${data.AgentId}/${routeActions.edit}` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="edit" /></div>,
          label: "Edit Agent"
        },
        {
          callback: () => {
            setSelectedAgent( data );
            toggleDeleteModal();
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="delete" /></div >,
          label: "Delete Agent"
        }
      ]} />
    )
  };
};