// libraries
import React from "react";
import { ADPIcon, CTAGroup, Tooltip } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import styles from "../../../assets/css/resources-list-title.module.scss";
import TimeStamp from "../../common/timeStamp";
import { Link } from "react-router-dom";
import { routeActions } from "../../../constants";
import listStyles from "./list.module.scss";
import { nanoid } from "nanoid";

interface CustomFieldConstructorProps {
  workspaces: any;
  navigate: any
  setWorkspaceId: any;
  toggleDeleteModal: any;
}

/**
 * This is a custom component for schedule fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ({
  workspaces,
  navigate,
  setWorkspaceId,
  toggleDeleteModal
}: CustomFieldConstructorProps ): Record<string, any> => {

  return {
    WorkspaceName: ( data: any ) => (
      <div className="flex flex-col justify-start">
        <Link to={`${workspaces?.path}/${data?.WorkspaceId}/${routeActions.details}` ?? ""}>{data?.WorkspaceName}</Link>
        <p className="text-xs text-secondary-400 truncate">
          {data?.Description}
        </p>
      </div>
    ),
    TriggerType: ( data: any ) => (
      data?.TriggerType && <div className="flex items-center gap-2">
        <Tooltip trigger={
          data?.TriggerType === "on-demand" ?
            <ADPIcon icon="restart" size="xs" /> :
            data?.TriggerType === "file-based" ?
              <ADPIcon icon="file" size="xs" /> : <ADPIcon icon="scheduled" size="xs" />
        }>
          {data?.TriggerType}
        </Tooltip>
        <div>{data?.TriggerType}</div>
      </div>
    ),
    Keywords: ( data: any ) => {
      if ( Array.isArray( data?.Keywords ) && data.Keywords.length > 0 ) {
        return <>
          {data?.Keywords?.slice( 0, 2 )?.map(( tag: string ) => <span key={nanoid()} className={listStyles.avatarIcon}>{tag}</span> )}
          {data?.Keywords?.length > 3 && <span key={nanoid()} className={listStyles.avatarIcon}>{data?.Keywords?.length - 3}+</span>}
        </>;
      }
    },
    LastModifiedTime: ( data: any ) => (
      <div className={styles.subTitle}>
        <TimeStamp rawDate={data.LastModifiedTime} />
      </div>
    ),
    options: ( data: any ) => (
      <CTAGroup shrink={false} ctaList={[
        {
          callback: () => navigate?.( `${workspaces?.path}/${data.WorkspaceId}/details` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="show-password" /></div>,
          label: "View Workspace"
        },
        {
          callback: () => navigate?.( `${workspaces?.path}/${data.WorkspaceId}/${routeActions.edit}` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="edit" /></div>,
          label: "Edit Workspace",
          disabled: data.AccessType !== "owner"
        },
        {
          callback: () => {
            setWorkspaceId( data?.WorkspaceId );
            toggleDeleteModal();
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="delete" /></div >,
          label: "Delete Workspace",
          disabled: data.AccessType !== "owner"
        }
      ]} />
    )
  };
};