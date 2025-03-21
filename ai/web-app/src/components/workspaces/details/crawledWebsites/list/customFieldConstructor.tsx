// libraries
import React from "react";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import styles from "../../../../../assets/css/resources-list-title.module.scss";
import TimeStamp from "../../../../common/timeStamp";
import { GenericStatus } from "../../../../../utils/renderUtils";

interface CustomFieldConstructorProps {
setCrawlId: React.Dispatch<string>;
setShowCrawlMetadata: React.Dispatch<boolean>;
setShowDeleteModal: React.Dispatch<boolean>;
}

/**
 * This is a custom component for schedule fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ({
  setCrawlId,
  setShowCrawlMetadata,
  setShowDeleteModal
}: CustomFieldConstructorProps ): Record<string, any> => {
  return {
    CrawlStatus: ( data:any ) => data.CrawlStatus && <span className="flex gap-2 items-center capitalize">
      <GenericStatus status={data.CrawlStatus}/> {data.CrawlStatus}</span>,
    IndexStatus: ( data:any ) => ( <div>
      {`${data?.IndexedCount || 0} / ${data?.CrawlCount || 0} webpages indexed`}
    </div> ),
    LastModifiedTime: ( data:any ) => (
      <div className={styles.subTitle}>
        <TimeStamp rawDate={data.LastModifiedTime} />
      </div>
    ),
    options: ( data: any ) => (
      <CTAGroup shrink={false} ctaList={[
        {
          callback: () => {
            setCrawlId( data.CrawlId );
            setShowCrawlMetadata( true );
          },
          icon: <ADPIcon size="xs" icon="show-password" />,
          label: "View Crawl Run Details"
        },
        {
          callback: () => {
            setCrawlId( data.CrawlId );
            setShowDeleteModal( true );
          },
          icon: <ADPIcon size="xs" icon="delete" />,
          label: "Delete Crawl Metadata"
        }
      ]} />
    )
  };
};