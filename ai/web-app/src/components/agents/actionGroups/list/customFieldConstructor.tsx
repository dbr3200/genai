// libraries
import React from "react";
import { ADPIcon, CTAGroup, Label } from "@amorphic/amorphic-ui-core";
import { Link } from "react-router-dom";

// components
import TimeStamp from "../../../common/timeStamp";

// methods / hooks / constants / styles
import { routeActions } from "../../../../constants";
import listStyles from "./list.module.scss";

interface CustomFieldConstructorProps {
  actionGroups: any;
  navigate: any
  setSelectedActionGroup: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setShowDownloadLogsPanel: React.Dispatch<React.SetStateAction<boolean>>;
  toggleDeleteModal: any;
}

/**
 * This is a custom component for custom model fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ({
  actionGroups,
  navigate,
  setSelectedActionGroup,
  setShowDownloadLogsPanel,
  toggleDeleteModal
}: CustomFieldConstructorProps ): Record<string, any> => {

  return {
    ActionGroupName: ( data: any ) => (
      <div className="flex flex-col justify-start">
        <div className="flex items-center gap-1">
          <Link to={`${actionGroups?.path}/${data?.ActionGroupId}/${routeActions.details}` ?? ""}>{data?.ActionGroupName}</Link>
          {data.SystemGenerated?.toLowerCase() === "yes" && <Label classes="text-xs font-robotoLight" variant="info" rounded>Pre-baked</Label>}
        </div>
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
          callback: () => navigate?.( `${actionGroups?.path}/${data.ActionGroupId}/${routeActions.details}` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="show-password" /></div>,
          label: "View Action Group"
        },
        {
          callback: () => navigate?.( `${actionGroups?.path}/${data.ActionGroupId}/${routeActions.edit}` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="edit" /></div>,
          label: "Edit Action Group",
          disabled: data?.SystemGenerated?.toLowerCase() === "yes"
        },
        {
          callback: () => {
            setSelectedActionGroup( data );
            setShowDownloadLogsPanel( true );
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="download" /></div>,
          label: "Download Logs"
        },
        {
          callback: () => {
            setSelectedActionGroup( data );
            toggleDeleteModal();
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="delete" /></div >,
          label: "Delete Action Group",
          disabled: data?.SystemGenerated?.toLowerCase() === "yes"
        }
      ]} />
    )
  };
};