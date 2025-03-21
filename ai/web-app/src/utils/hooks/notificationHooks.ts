import { nanoid } from "@reduxjs/toolkit";
import { useCallback } from "react";

import { useAppDispatch } from ".";
import { addNotification, removeNotification } from "../../modules/notifications/reducer";
import { TNotificationProps } from "../../types";

type Options = Omit<TNotificationProps, "variant" | "id">;
const defaultDelay = 7000;
const defaultExtendedDelay = 15000;

/**
 * Note -
 *
 * To use the function to hide the notification manually, pass autoHideDelay as false while creating
 *  the notification
 *
 * Example -
 *
 * const [showSuccessNotification, hideSuccessNotification] = useSuccessNotification();
 *
 * const uniqueId = showSuccessNotification({ ...otherOptions, autoHideDelay: false });
 *
 * hideSuccessNotification(uniqueId);
 * @returns [ Function to show a Success Notification, Function to hide a Notification ]
 */
export const useSuccessNotification = (): [( options: Options ) => string, ( id: string ) => void ] => {
  const dispatch = useAppDispatch();

  return [ useCallback(( options: Options ) => {
    const id = nanoid();
    dispatch( addNotification({
      autoHideDelay: defaultDelay,
      ...options,
      variant: "success",
      id
    }));

    return id;
  }, [dispatch]), useCallback(( id ) => dispatch( removeNotification( id )), [dispatch]) ];
};

/**
 * Note -
 *
 * To use the function to hide the notification manually, pass autoHideDelay as false while creating
 *  the notification
 *
 * Example -
 *
 * const [showInfoNotification, hideInfoNotification] = useInfoNotification();
 *
 * const uniqueId = showSuccessNotification({ ...otherOptions, autoHideDelay: false });
 *
 * hideInfoNotification(uniqueId);
 * @returns [ Function to show an Info Notification, Function to hide a notification ]
 */
export const useInfoNotification = (): [( options: Options ) => string, ( id: string ) => void ] => {
  const dispatch = useAppDispatch();

  return [ useCallback(( options: Options ) => {
    const id = nanoid();
    dispatch( addNotification({
      autoHideDelay: defaultDelay,
      ...options,
      variant: "info",
      id
    }));

    return id;
  }, [dispatch]), useCallback(( id ) => dispatch( removeNotification({ id })), [dispatch]) ];
};

/**
 * Note -
 *
 * To use the function to hide the notification manually, pass autoHideDelay as false while creating
 *  the notification
 *
 * Example -
 *
 * const [showWarningNotification, hideWarningNotification] = useWarningNotification();
 *
 * const uniqueId = showWarningNotification({ ...otherOptions, autoHideDelay: false });
 *
 * hideWarningNotification(uniqueId);
 * @returns [ Function to show a Warning Notification, Function to hide a notification ]
 */
export const useWarningNotification = (): [( options: Options ) => string, ( id: string ) => void ] => {
  const dispatch = useAppDispatch();

  return [ useCallback(( options: Options ) => {
    const id = nanoid();
    dispatch( addNotification({
      autoHideDelay: defaultExtendedDelay,
      ...options,
      variant: "warning",
      id
    }));

    return id;
  }, [dispatch]), useCallback(( id ) => dispatch( removeNotification( id )), [dispatch]) ];
};

/**
 * Note -
 *
 * To use the function to hide the notification manually, pass autoHideDelay as false while creating
 *  the notification
 *
 * Example -
 *
 * const [showErrorNotification, hideErrorNotification] = useErrorNotification();
 *
 * const uniqueId = showWErrorNotification({ ...otherOptions, autoHideDelay: false });
 *
 * hideErrorNotification(uniqueId);
 * @returns [ Function to show an Error Notification, Function to hide a notification ]
 */
export const useErrorNotification = (): [( options: Options ) => string, ( id: string ) => void ] => {
  const dispatch = useAppDispatch();

  return [ useCallback(( options: Options ) => {
    const id = nanoid();
    dispatch( addNotification({
      autoHideDelay: defaultExtendedDelay,
      ...options,
      variant: "error",
      id
    }));

    return id;
  }, [dispatch]), useCallback(( id ) => dispatch( removeNotification( id )), [dispatch]) ];
};
