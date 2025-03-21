// libraries
import {
  MiddlewareAPI,
  isRejectedWithValue,
  isRejected,
  Middleware,
  nanoid
} from "@reduxjs/toolkit";
import i18n from "../i18n";

// methods / hooks / constants / styles
import { addNotification } from "../modules/notifications/reducer";
import { updateDependencies } from "../modules/dependencies";
import { closeSwal } from "../utils/popupUtils";

export const errorLoggingMiddleware: Middleware = (
  api: MiddlewareAPI
) => ( next ) => ( action ) => {

  if ( action.meta?.arg?.originalArgs?.skipNotification ) {
    return next( action );
  }

  if ( isRejectedWithValue( action ) || isRejected( action )) {
    closeSwal();
    if ( action.payload?.data || action.payload?.error ) {
      if ( action?.meta?.baseQueryMeta?.request?.method === "DELETE" &&
        action?.payload?.data?.DependentResources &&
        Array.isArray( action?.payload?.data?.DependentResources )
      ) {
        const requestParts = action.meta.baseQueryMeta.request.url?.split( "/" );
        const moduleName = requestParts?.length - 2 >= 0 ? requestParts[requestParts?.length - 2] : "resource";
        api.dispatch( updateDependencies({
          ResourceName: moduleName,
          data: action?.payload?.data?.DependentResources,
          Message: action?.payload?.data?.Message
        }));
      } else {
        api.dispatch(
          addNotification({
            id: nanoid(),
            variant: "error",
            title: i18n.t( "common.messages.requestFailed" ),
            content: ( action.payload?.data?.Message ?? action.payload?.data?.message ?? action.payload?.error ?? "Network Error !!" )
          })
        );
      }
    }
  }
  // @susheel - April 7th, 2022
  // TO DO: show reloading message for forceRefetch calls
  // else if ( isPending( action )){
  //   if ( action?.meta?.arg?.forceRefetch ){
  //     api.dispatch( addNotification({
  //       id: nanoid(),
  //       variant: "info",
  //       title: i18n.t( "common.messages.refreshingData" )
  //     }));
  //   }
  // }
  return next( action );
};