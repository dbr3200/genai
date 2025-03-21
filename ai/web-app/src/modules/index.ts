import { persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import auth from "./auth/reducer";
import account from "./account/reducer";
import globalConfig from "./globalConfig/reducer";
import notifications from "./notifications/reducer";
import pagination from "./pagination";
import configurableFields from "./configurableFields";
import dependencies from "./dependencies";
import { baseApi, originApi, unauthApi } from "../services/baseApi";

const authPersistConfig = {
  key: "auth",
  storage: storage,
  blacklist: [
    "loginErrorMsg",
    "forgotPwdSubmitErrorMsg",
    "forgotPwdErrorMsg",
    "forgotPwdResendCodeStatus",
    "forgotPwdResendCodeErrorMsg",
    "registrationErrorMsg",
    "loginStatus",
    "signUpStatus",
    "verifyTotpTokenErrorMsg",
    "confirmSignInStatus",
    "confirmSignUpStatus",
    "forgotPwdStatus",
    "forgotPwdSubmitStatus",
    "confirmSignUpErrorMsg",
    "resendSignUpErrorMsg",
    "registrationResendCodeStatus",
    "totpSetupStatus",
    "totpSetupErrorMsg",
    "verifyTotpSetupStatus",
    "verifyTotpSetupErrorMsg"
  ]
};

const globalConfigPersistConfig = {
  key: "globalConfig",
  storage: storage,
  blacklist: ["helpPanelVisible"]
};

export default {
  auth: persistReducer( authPersistConfig, auth ),
  globalConfig: persistReducer( globalConfigPersistConfig, globalConfig ),
  account,
  notifications,
  pagination,
  configurableFields,
  dependencies,
  [baseApi.reducerPath]: baseApi.reducer,
  [originApi.reducerPath]: originApi.reducer,
  [unauthApi.reducerPath]: unauthApi.reducer
};
