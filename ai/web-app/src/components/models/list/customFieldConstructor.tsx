// libraries
import React from "react";
import { ADPIcon, CTAGroup, Label } from "@amorphic/amorphic-ui-core";
import { Link } from "react-router-dom";

// components
import { GenericStatus } from "../../../utils/renderUtils";
import TimeStamp from "../../common/timeStamp";

// methods / hooks / constants / styles
import { ModelStatusCode, routeActions } from "../../../constants";
import styles from "../../../assets/css/resources-list-title.module.scss";
import listStyles from "./list.module.scss";
import { Model } from "../../../services/models";

interface CustomFieldConstructorProps {
  models: any;
  navigate: any
  setSelectedModel: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  toggleDeleteModal: any;
  handleUpdateModelAvailability: ( modelId: string, action: "enable" | "disable" ) => Promise<void>
}

/**
 * This is a custom component for custom model fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ({
  models,
  navigate,
  setSelectedModel,
  toggleDeleteModal,
  handleUpdateModelAvailability
}: CustomFieldConstructorProps ): Record<string, any> => {

  return {
    ModelName: ( data: Model ) => <div className="flex gap-2 items-center truncate">
      <GenericStatus status={data.ModelStatusCode ?? "unknown"} tooltip={data.ModelStatusMessage ?? "Unknown"} />
      <div className="flex flex-col justify-start">
        <Link to={`${models?.path}/${data?.ModelId}/${routeActions.details}` ?? ""}
          className="font-semibold"
        >{data?.ModelName}</Link>
        <p className="text-xs text-secondary-300">
          {data?.Description}
        </p>
      </div>
    </div>,
    LastModifiedTime: ( data: Model ) => (
      <div className={styles.subTitle}>
        <TimeStamp rawDate={data.LastModifiedTime} />
      </div>
    ),
    Modalities: ( data: Model ) => data.Modalities
      ? <div className="flex items-center gap-2">
        {data.Modalities.map(( val: string ) => ( <Label classes="!m-0" variant="info" key={val}>{val.replace( "_", " " )}</Label> ))}
      </div>
      : "-",
    CustomizationsSupported: ( data: Model ) => data.CustomizationsSupported?.length > 0
      ? <div className="flex items-center gap-2">{
        data.CustomizationsSupported.map(( val: string ) =>
          ( <Label classes="!m-0" variant="info" key={val}>{val.replace( "_", " " )}</Label> ))
      }</div>
      : "N/A",
    options: ( data: Model ) => {
      const ctaList = [
        {
          callback: () => navigate?.( `${models?.path}/${data.ModelId}/details` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="show-password" /></div>,
          label: "View Model"
        },
        {
          ...data.ModelStatusCode?.toLowerCase() === ModelStatusCode.AVAILABLE
            ? {
              callback: () => handleUpdateModelAvailability( data.ModelId, "disable" ),
              icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="times-circle" /></div >,
              label: "Disable Model"
            }
            : {
              callback: () => handleUpdateModelAvailability( data.ModelId, "enable" ),
              icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="check-circle" /></div >,
              label: "Enable Model"
            }
        }
      ];

      if ( data?.ModelType?.toLowerCase() === "custom" ) {
        ctaList.push({
          callback: () => {
            setSelectedModel( data );
            toggleDeleteModal();
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="delete" /></div >,
          label: "Delete Model"
        });
      }

      return <CTAGroup shrink={false} ctaList={ctaList} />;
    }
  };
};