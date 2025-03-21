// libraries
import React from "react";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import styles from "../../../assets/css/resources-list-title.module.scss";
import TimeStamp from "../../common/timeStamp";
import { Link } from "react-router-dom";
import { routeActions } from "../../../constants";
import listStyles from "./list.module.scss";
import { nanoid } from "nanoid";

interface CustomFieldConstructorProps {
  chatbots: any;
  navigate: any
  setChatbotId: any;
  toggleDeleteModal: any;
}

/**
 * This is a custom component for schedule fields display
 * @returns {...Record<string, any>} custom field display {@link Record<string, any>}
 */
export const CustomFieldConstructor = ({
  chatbots,
  navigate,
  setChatbotId,
  toggleDeleteModal
}: CustomFieldConstructorProps ): Record<string, any> => {

  return {
    ChatbotName: ( data: any ) => (
      <div className="flex flex-col justify-start">
        <Link to={`${chatbots?.path}/${data?.ChatbotId}/${routeActions.details}` ?? ""}>{data?.ChatbotName}</Link>
        <p className="text-xs text-secondary-400 truncate">
          {data?.Description}
        </p>
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
    CreationTime: ( data: any ) => (
      <div className={styles.subTitle}>
        <TimeStamp rawDate={data.CreationTime} />
      </div>
    ),
    options: ( data: any ) => (
      <CTAGroup shrink={false} ctaList={[
        {
          callback: () => navigate?.( `${chatbots?.path}/${data.ChatbotId}/details` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="show-password" /></div>,
          label: "View Chatbot"
        },
        {
          callback: () => navigate?.( `${chatbots?.path}/${data.ChatbotId}/${routeActions.edit}` ),
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="edit" /></div>,
          label: "Edit Chatbot",
          disabled: data.AccessType !== "owner"
        },
        {
          callback: () => {
            setChatbotId( data?.ChatbotId );
            toggleDeleteModal();
          },
          icon: <div className={listStyles.actionIcon}><ADPIcon size="xs" icon="delete" /></div >,
          label: "Delete Chatbot",
          disabled: data.AccessType !== "owner"
        }
      ]} />
    )
  };
};