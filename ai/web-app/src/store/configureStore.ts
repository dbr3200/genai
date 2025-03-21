import { configureStore, Store } from "@reduxjs/toolkit";
import { createStateSyncMiddleware } from "redux-state-sync";
import {
  persistStore,
  persistCombineReducers,
  Persistor,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import Reducers from "../modules";
import { baseApi, originApi, unauthApi } from "../services/baseApi";
import { errorLoggingMiddleware } from "./errorLoggingMiddleware";

export interface IConfigureStore {
  persistor: Persistor;
  store: Store;
}

const appReducer = persistCombineReducers(
  { key: "amorphic-ai", storage, blacklist: [ "auth", "globalConfig", "dependencies", baseApi.reducerPath ] },
  Reducers
);

export const configureReduxStore = (): IConfigureStore => {
  const reducer = appReducer;

  const middlewaresList = [
    errorLoggingMiddleware,
    createStateSyncMiddleware({
      // Following actions won't be triggered in other tabs
      blacklist: [ FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER ],
      // This function will selectively sync actions inbetween open browser tabs
      predicate: ( action ) => {
        let isActionPass = false;
        const [ reducerName, actionName ] = typeof action.type === "string" ? action.type.split( "/" ) : "";
        // This condition is to track any RBAC changes that affects user Profile/account info
        if ( actionName === "executeQuery" && [ "loadUserAccount", "setUserAssumedRole" ].includes( action.meta?.arg?.endpointName )) {
          isActionPass = true;
          // This condition is to sync actions in static reducers
        } else if ([ "common", "auth", "account" ].includes( reducerName )) {
          isActionPass = true;
        }
        return isActionPass;

      },
      broadcastChannelOption: { type: "localstorage" }
    }),
    baseApi.middleware,
    originApi.middleware,
    unauthApi.middleware
  ];
  // https://redux-toolkit.js.org/usage/usage-guide#use-with-redux-persist
  const store = configureStore({
    reducer,
    middleware: ( getDefaultMiddleware ) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [ FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER ],
          ignoredActionPaths: [
            "meta.baseQueryMeta.request",
            "meta.baseQueryMeta.response"
          ]
        }
      }).concat( middlewaresList )
  });

  const persistor = persistStore( store );

  if (( module as any ).hot ) {
    ( module as any ).hot.accept( "../modules", () => {
      // eslint-disable-next-line
      const nextReducer = require("../modules").default;
      store.replaceReducer( nextReducer );
    });
  }

  return { persistor, store };
};
