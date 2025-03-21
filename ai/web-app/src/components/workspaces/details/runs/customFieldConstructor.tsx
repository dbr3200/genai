// libraries
import React from "react";
import { ADPIcon, CTAGroup, Tooltip } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import styles from "../../../../assets/css/resources-list-title.module.scss";
// import { UserPreferencesType } from "../../../types";
import TimeStamp from "../../../common/timeStamp";
import clsx from "clsx";
import { GenericStatus } from "../../../../utils/renderUtils";

interface CustomFieldConstructorProps {
setJobId: React.Dispatch<string>;
setShowRunDetails: React.Dispatch<boolean>;
}

/**
 * This is a custom component for schedule fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ({
  setJobId,
  setShowRunDetails
}: CustomFieldConstructorProps ): Record<string, any> => {
  return {
    RunStatus: ( data:any ) => data.RunStatus && <span className="flex gap-2 items-center capitalize">
      <GenericStatus status={data.RunStatus}/> {data.RunStatus}</span>,
    StartTime: ( data:any ) => ( <TimeStamp rawDate={data.StartTime} /> ),
    EndTime: ( data:any ) => (
      <div className={clsx( styles.subTitle )}>
        {data.EndTime ? <TimeStamp rawDate={data.EndTime} /> : "-"}
      </div>
    ),
    TriggerType: ( data:any ) => ( <div className="flex items-center space-x-1">
      <Tooltip trigger={
        data?.TriggerType === "on-demand" ?
          <ADPIcon icon="restart" size="xs" /> :
          data?.TriggerType === "file-based" ?
            <ADPIcon icon="file" size="xs" /> : <ADPIcon icon="scheduled" size="xs" />
      }>
        {data?.TriggerType}
      </Tooltip>
      <div>
        {data?.TriggerType}
      </div>
    </div>
    ),
    LastModifiedTime: ( data:any ) => (
      <div className={styles.subTitle}>
        <TimeStamp rawDate={data.LastModifiedTime} />
      </div>
    ),
    options: ( data: any ) => (
      <CTAGroup shrink={false} ctaList={[
        {
          callback: () => {
            setJobId( data.RunId );
            setShowRunDetails( true );
          },
          icon: <ADPIcon size="xs" icon="show-password" />,
          label: "View Jobs Run Details"
        }
      ]} />
    )
  };
};