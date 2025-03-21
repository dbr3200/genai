import { createSlice } from "@reduxjs/toolkit";

import config from "../../config.json";
import { logoutAction } from "../common/actions";
import { authActions } from "./actions";

const initialState = {
  enforceMFA: config.ENFORCE_COGNITO_MFA?.toUpperCase(),
  mfaEnabled: false,
  verifyingCode: false,
  projectShortName: config.PROJECT_SHORT_NAME,
  registrationResendCodeStatus: authActions?.RESEND_INITIAL,
  confirmSignInStatus: authActions?.CONFIRM_SIGN_IN_INITIAL,
  confirmSignUpStatus: authActions?.CONFIRM_SIGN_UP_INITIAL,
  forgotPwdStatus: authActions?.FORGOT_PWD_INITIAL,
  forgotPwdSubmitStatus: authActions?.FORGOT_PWD_SUBMIT_INITIAL,
  forgotPwdResendCodeStatus: authActions?.FORGOT_PWD_RESEND_CODE_INITIAL,
  loginStatus: authActions?.LOGIN_INITIAL,
  signUpStatus: authActions?.SIGN_UP_INITIAL,
  totpSetupStatus: authActions?.TOTP_SETUP_INITIAL,
  verifyTotpSetupStatus: authActions?.VERIFY_TOTP_SETUP_INITIAL
};

const auth = createSlice({
  name: "auth",
  initialState,
  reducers: {
    updateAuth( state, action ) {
      Object.assign( state, action.payload );
    } },
  extraReducers: ( builder ) => {
    builder.addMatcher(
      action => logoutAction.match( action ),
      ( state ) => {
        state = initialState;
        return state;
      }
    );
  }
});

const { reducer } = auth;
export const { updateAuth } = auth.actions;
export default reducer;