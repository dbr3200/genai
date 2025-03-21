import React from "react";
import ReactDOM from "react-dom";
import { TextCopy, Toast } from "@amorphic/amorphic-ui-core";

import { useAppDispatch, useAppSelector } from "../../utils/hooks";
import { removeNotification } from "../../modules/notifications/reducer";
import styles from "./notifications.module.scss";

type ToastProps = Omit<React.ComponentProps<typeof Toast>, "autoHideDelay" | "show">

export type NotificationProps = ToastProps & { id: string, autoHideDelay?: number | false };

export const Notifications = (): JSX.Element => {
  const notifications = useAppSelector( state => state.notifications );
  const dispatch = useAppDispatch();

  return ReactDOM.createPortal(
    <div className={styles.notificationContainer} id="amorphic-notification-container">
      {notifications.map(({ id, autoHideDelay, content, ...restProps }: NotificationProps ) =>
        <Toast
          key={id}
          classes={styles.slideIn}
          { ...typeof autoHideDelay === "number" ?
            { autoHideDelay } : { autoHideDelay: 20000 }}
          // eslint-disable-next-line react/jsx-no-bind
          onClose={() => dispatch( removeNotification({ id }))}
          content={(
            typeof content === "string" ? <TextCopy>{content}</TextCopy> : content
          )}
          {...restProps}
        /> )}
    </div>, document.body );
};

export default Notifications;
