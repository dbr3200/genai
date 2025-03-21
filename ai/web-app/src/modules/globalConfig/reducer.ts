// libraries
import { createSlice } from "@reduxjs/toolkit";

// methods / hooks / constants / styles
import config from "../../config.json";
import appConfig from "../../constants/appConfig.json";
import permanentPaths from "../../components/utils/routes/permanentPaths.json";
import { getAllRoutes } from "../../routes/routeUtils";
import { logoutAction } from "../common/actions";
import { PermanentPathObject } from "../../types";

const configObj: Record<string, any> = config;

const coreConfigIgnoreKeys = [ "region", "userPool", "identityPool", "clientId", "APP_WEB_DOMAIN" ];
const loginConfigKeys = [ "PROJECT_NAME", "PROJECT_SHORT_NAME", "VERSION", "Domain", "ENFORCE_COGNITO_MFA" ];
const coreConfig = Object.assign({}, ...Object.keys( configObj )
  .filter( k => !coreConfigIgnoreKeys.includes( k )).map( k => ({ [k]: configObj[k] })));
const loginConfig = Object.assign({}, ...Object.keys( configObj )
  .filter( k => loginConfigKeys.includes( k )).map( k => ({ [k]: configObj[k] })));

const checkDWHTargets = () => configObj?.TARGET_LOCATION?.some(( tl: string ) => tl !== "s3" ) || false;

const GlobalConfigInitialState = {
  ...coreConfig,
  ...appConfig,
  ...loginConfig,
  permanentPaths: getAllRoutes( permanentPaths as PermanentPathObject ),
  idpLogin: Boolean( configObj?.ENABLE_IDP === "yes" ),
  hasDWHTarget: checkDWHTargets(),
  TARGET_LOCATION: [...new Set( configObj?.TARGET_LOCATION || [])],
  ENFORCE_COGNITO_MFA: "OPTIONAL",
  sidenavOpen: false,
  helpPanelVisible: false
};

const globalConfig = createSlice({
  name: "globalConfig",
  initialState: () => GlobalConfigInitialState,
  reducers: {
    toggleSidenavVisibility( state ) {
      state.sidenavOpen = !state.sidenavOpen;
    },
    setHelpPanelVisibility( state, action ) {
      state.helpPanelVisible = action.payload.helpPanelVisible;
    },
    setSidenavVisibility( state, action ) {
      state.sidenavOpen = action.payload.sidenavOpen;
    }
  },
  extraReducers: ( builder ) => {
    builder
      .addMatcher(
        action => logoutAction.match( action ),
        ( state ) => {
          state = GlobalConfigInitialState;
          return state;
        }
      );
  }
});

const { reducer } = globalConfig;
export const { toggleSidenavVisibility, setHelpPanelVisibility, setSidenavVisibility } = globalConfig.actions;
export default reducer;