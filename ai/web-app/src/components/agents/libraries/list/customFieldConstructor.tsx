// libraries
import React from "react";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";
import { Link } from "react-router-dom";

// components
import TimeStamp from "../../../common/timeStamp";

// methods / hooks / constants / styles
import { routeActions } from "../../../../constants";
import styles from "../../../../assets/css/resources-list-title.module.scss";
import listStyles from "./list.module.scss";

interface CustomFieldConstructorProps {
  libraries: any;
  navigate: any
  setSelectedLibrary: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  toggleDeleteModal: any;
}

/**
 * This is a custom component for custom model fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ({
  libraries,
  navigate,
  setSelectedLibrary,
  toggleDeleteModal
}: CustomFieldConstructorProps ): Record<string, any> => {

  return {
    LibraryName: ( data: any ) => (
      <div className="flex flex-col justify-start">
        <Link to={`${libraries?.path}/${data?.LibraryId}/${routeActions.details}` ?? ""}>{data?.LibraryName}</Link>
        <p className="text-xs text-secondary-400 truncate">
          {data?.Description}
        </p>
      </div>
    ),
    LastModifiedTime: ( data: any ) => (
      <div className={styles.subTitle}>
        <TimeStamp rawDate={data.LastModifiedTime} />
      </div>
    ),
    Packages: ( data: any ) => data.Packages?.length,
    options: ( data: any ) => (
      <CTAGroup shrink={false} ctaList={[
        {
          callback: () => navigate?.( `${libraries?.path}/${data.LibraryId}/${routeActions.details}` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="show-password" /></div>,
          label: "View Library"
        },
        {
          callback: () => navigate?.( `${libraries?.path}/${data.LibraryId}/${routeActions.edit}` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="edit" /></div>,
          label: "Edit Library"
        },
        {
          callback: () => {
            setSelectedLibrary( data );
            toggleDeleteModal();
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="delete" /></div >,
          label: "Delete Library"
        }
      ]} />
    )
  };
};