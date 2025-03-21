import { Amplify, Auth } from "aws-amplify";
import Swal, { SweetAlertOptions } from "sweetalert2";
import { NavigateFunction } from "react-router-dom";
import { Dispatch } from "redux";
import jwtDecode, { JwtPayload } from "jwt-decode";

import { updateAuth } from "./reducer";
import configurations from "../../config.json";
import { mfaConstants } from "../../constants";
import { AppThunk } from "../../utils/hooks/storeHooks";
import { logoutAction } from "../common/actions";
import { addNotification } from "../notifications/reducer";
import i18n from "../../i18n";
import { nanoid } from "@reduxjs/toolkit";
import { baseApi } from "../../services/baseApi";
import { updateAccount } from "../account/reducer";

const ALLOWED_APP_NAME = "ai";

export enum authActions {
  RESEND_INITIAL = "RESEND_INITIAL",
  RESEND_PROCESSING = "RESEND_PROCESSING",
  RESEND_SUCCESS = "RESEND_SUCCESS",
  RESEND_FAILURE = "RESEND_FAILURE",
  CONFIRM_SIGN_IN_INITIAL = "CONFIRM_SIGN_IN_INITIAL",
  CONFIRM_SIGN_IN_PROCESSING = "CONFIRM_SIGN_IN_PROCESSING",
  CONFIRM_SIGN_IN_SUCCESS = "CONFIRM_SIGN_IN_SUCCESS",
  CONFIRM_SIGN_IN_FAILURE = "CONFIRM_SIGN_IN_FAILURE",
  CONFIRM_SIGN_UP_INITIAL = "CONFIRM_SIGN_UP_INITIAL",
  CONFIRM_SIGN_UP_PROCESSING = "CONFIRM_SIGN_UP_PROCESSING",
  CONFIRM_SIGN_UP_SUCCESS = "CONFIRM_SIGN_UP_SUCCESS",
  CONFIRM_SIGN_UP_FAILURE = "CONFIRM_SIGN_UP_FAILURE",
  FORGOT_PWD_INITIAL = "FORGOT_PWD_INITIAL",
  FORGOT_PWD_PROCESSING = "FORGOT_PWD_PROCESSING",
  FORGOT_PWD_SUCCESS = "FORGOT_PWD_SUCCESS",
  FORGOT_PWD_FAILURE = "FORGOT_PWD_FAILURE",
  FORGOT_PWD_SUBMIT_INITIAL = "FORGOT_PWD_SUBMIT_INITIAL",
  FORGOT_PWD_SUBMIT_PROCESSING = "FORGOT_PWD_SUBMIT_PROCESSING",
  FORGOT_PWD_SUBMIT_SUCCESS = "FORGOT_PWD_SUBMIT_SUCCESS",
  FORGOT_PWD_SUBMIT_FAILURE = "FORGOT_PWD_SUBMIT_FAILURE",
  FORGOT_PWD_RESEND_CODE_INITIAL = "FORGOT_PWD_RESEND_CODE_INITIAL",
  FORGOT_PWD_RESEND_CODE_PROCESSING = "FORGOT_PWD_RESEND_CODE_PROCESSING",
  FORGOT_PWD_RESEND_CODE_SUCCESS = "FORGOT_PWD_RESEND_CODE_SUCCESS",
  FORGOT_PWD_RESEND_CODE_FAILURE = "FORGOT_PWD_RESEND_CODE_FAILURE",
  LOGIN_INITIAL = "LOGIN_INITIAL",
  LOGIN_PROCESSING = "LOGIN_PROCESSING",
  LOGIN_SUCCESS = "LOGIN_SUCCESS",
  LOGIN_FAILURE = "LOGIN_FAILURE",
  SIGN_UP_INITIAL = "SIGN_UP_INITIAL",
  SIGN_UP_PROCESSING = "SIGN_UP_PROCESSING",
  SIGN_UP_SUCCESS = "SIGN_UP_SUCCESS",
  SIGN_UP_FAILURE = "SIGN_UP_FAILURE",
  FORCE_PWD_RESET_INITIAL = "FORCE_PWD_RESET_INITIAL",
  FORCE_PWD_RESET_PROCESSING = "FORCE_PWD_RESET_PROCESSING",
  FORCE_PWD_RESET_SUCCESS = "FORCE_PWD_RESET_SUCCESS",
  FORCE_PWD_RESET_FAILURE = "FORCE_PWD_RESET_FAILURE",
  TOTP_SETUP_INITIAL = "TOTP_SETUP_INITIAL",
  TOTP_SETUP_PROCESSING = "TOTP_SETUP_PROCESSING",
  TOTP_SETUP_SUCCESS = "TOTP_SETUP_SUCCESS",
  TOTP_SETUP_FAILURE = "TOTP_SETUP_FAILURE",
  VERIFY_TOTP_SETUP_INITIAL = "VERIFY_TOTP_SETUP_INITIAL",
  VERIFY_TOTP_SETUP_PROCESSING = "VERIFY_TOTP_SETUP_PROCESSING",
  VERIFY_TOTP_SETUP_SUCCESS = "VERIFY_TOTP_SETUP_SUCCESS",
  VERIFY_TOTP_SETUP_FAILURE = "VERIFY_TOTP_SETUP_FAILURE",
  SET_SESSION = "SET_SESSION",
  DWH_CREDS_RESET_SUCCESS = "DWH_CREDS_RESET_SUCCESS",
}

const config: { [key: string]: any } = configurations;

Amplify.configure({
  Auth: {
    // REQUIRED only for Federated Authentication - Amazon Cognito Identity Pool ID
    identityPoolId: config.identityPool,
    // REQUIRED - Amazon Cognito Region
    region: config.region,
    // OPTIONAL - Amazon Cognito User Pool ID
    userPoolId: config.userPool,
    // OPTIONAL - Amazon Cognito Web Client ID (26-char alphanumeric string)
    userPoolWebClientId: config.clientId,
    oauth: {
      domain: config?.APP_WEB_DOMAIN ?? window.location.origin,
      scope: config?.TOKEN_SCOPES_ARRAY ?? [],
      redirectSignIn: `${window.location.origin}/callback`,
      redirectSignOut: `${window.location.origin}/auth/login`,
      responseType: "code"
    }
  }
});

let unAuthenticatedUser: any = null;

export const validateSession = (): AppThunk =>
  async ( dispatch: Dispatch<any> ): Promise<any> => {
    try {
      const session = await Auth.currentSession();
      dispatch( updateAuth({
        validSession: session.isValid()
      }));
    } catch ( e ) {
      dispatch( updateAuth({
        validSession: false
      }));
    }
  };

export const login = ( navigate: any, username: string, password: string ): AppThunk =>
  async ( dispatch: Dispatch<any>, getState: any ): Promise<any> => {
    const { auth: { enforceMFA, loginErrorMsg }, globalConfig: { permanentPaths } } = getState();
    try {
      dispatch( updateAuth({
        loginStatus: authActions.LOGIN_PROCESSING,
        loginErrorMsg: undefined
      }));
      const user = await Auth.signIn( username, password );

      if ( user.challengeName === "NEW_PASSWORD_REQUIRED" ) {
        dispatch( updateAuth({
          tempPwd: password,
          username: user?.username ?? username
        }));
        navigate( permanentPaths.resetPassword.path );
        return;
      } else if ( user.challengeName === "MFA_SETUP" ) {
        unAuthenticatedUser = user;
        navigate( permanentPaths.setupTOTP.path );
        return;
      } else if ( user.challengeName === "SOFTWARE_TOKEN_MFA" ) {
        unAuthenticatedUser = user;
        dispatch( updateAuth({
          mfaEnabled: true,
          confirmTOTPForSignIn: true,
          username: user?.username ?? username
        }));
        navigate( permanentPaths.verify.path );
        return;
      } else if ( loginErrorMsg === "User is not confirmed." ) {
        navigate( permanentPaths.verify.path );
        return;
      }

      const mfaType = await Auth.getPreferredMFA( user );
      if ( mfaType === "NOMFA" && enforceMFA === mfaConstants.mandatory ) {
        unAuthenticatedUser = user;
        dispatch( updateAuth({ username: user?.username ?? username }));
        navigate( permanentPaths.setupTOTP.path );
        return;
      }
      const { "custom:attr3": allowedApps = "" } =
        user.signInUserSession.idToken.jwtToken &&
        jwtDecode<JwtPayload>( user.signInUserSession.idToken.jwtToken ) || {};
      dispatch( updateAuth({
        token: user?.signInUserSession.idToken.jwtToken,
        refreshToken: user?.signInUserSession.refreshToken.token,
        loginStatus: authActions.LOGIN_SUCCESS,
        hasAppAccess: allowedApps?.includes( ALLOWED_APP_NAME ),
        sessionActive: true,
        validSession: true,
        username: user?.username ?? username
      }));
      dispatch( updateAccount({ username: user?.username ?? username }));
      navigate( permanentPaths.playground.path );
    } catch ( error ) {
      if (( error as Error ).message === "User is not confirmed." ) {
        dispatch( resendRegistrationCode( username ));
        navigate( permanentPaths.verify.path );
      }
      dispatch( updateAuth({
        loginErrorMsg: ( error as Error ).message || JSON.stringify( error ),
        loginStatus: authActions.LOGIN_FAILURE
      }));
    }
  };

export const register = ( navigate: any, username: string, password: string, fullname: string, email: string ): AppThunk =>
  async ( dispatch, getState ) => {
    try {
      dispatch( updateAuth({
        signUpStatus: authActions.SIGN_UP_PROCESSING,
        registrationErrorMsg: undefined,
        destinationEmail: undefined
      }));

      const { user, codeDeliveryDetails }: Record<string, any> = await Auth.signUp({
        username,
        password,
        attributes: {
          email,
          name: fullname
        }
      });

      dispatch( updateAuth({
        destinationUsername: user?.username,
        destinationEmail: codeDeliveryDetails?.Destination,
        signUpStatus: authActions.SIGN_UP_SUCCESS,
        confirmTOTPForSignIn: undefined
      }));

      const { permanentPaths } = getState().globalConfig;
      navigate( permanentPaths.verify.path );

    } catch ( error ) {
      dispatch( updateAuth({
        registrationErrorMsg: ( error as Error ).message || JSON.stringify( error ),
        signUpStatus: authActions.SIGN_UP_FAILURE,
        destinationEmail: undefined
      }));
    }
  };

export const verifyRegistration = ( username: string, code: string, restart: () => void ): AppThunk =>
  async ( dispatch ) => {
    try {
      dispatch( updateAuth({
        confirmSignUpErrorMsg: undefined,
        confirmSignUpStatus: authActions.CONFIRM_SIGN_UP_PROCESSING,
        registrationResendCodeStatus: authActions.RESEND_INITIAL
      }
      ));
      await Auth.confirmSignUp( username, code );
      dispatch( updateAuth({
        destinationUsername: undefined,
        destinationEmail: undefined,
        confirmSignUpStatus: authActions.CONFIRM_SIGN_UP_SUCCESS
      }));
      restart();
    } catch ( error ) {
      dispatch( updateAuth({
        confirmSignUpErrorMsg: ( error as Error ).message || JSON.stringify( error ),
        confirmSignUpStatus: authActions.CONFIRM_SIGN_UP_FAILURE
      }));
    }
  };

export const resendRegistrationCode = ( username: string ): AppThunk =>
  async ( dispatch ) => {
    try {
      dispatch( updateAuth({
        resendSignUpErrorMsg: undefined,
        confirmSignUpErrorMsg: undefined,
        registrationResendCodeStatus: authActions.RESEND_PROCESSING
      }));

      await Auth.resendSignUp( username );

      dispatch( updateAuth({
        registrationResendCodeStatus: authActions.RESEND_SUCCESS
      }));

    } catch ( error ) {
      dispatch( updateAuth({
        resendSignUpErrorMsg: ( error as Error ).message,
        registrationResendCodeStatus: authActions.RESEND_FAILURE
      }));
    }
  };

export const forcePasswordReset = ( newPassword: string, auth: any ): AppThunk =>
  async ( dispatch ) => {
    try {
      dispatch( updateAuth({
        forcePwdResetStatus: authActions.FORCE_PWD_RESET_PROCESSING
      }));
      await Auth.signIn( auth.username, auth.tempPwd ).then(( user ) => {
        Auth.completeNewPassword(
          user,
          newPassword
        ).then(() => {
          dispatch( updateAuth({
            forcePwdResetStatus: authActions.FORCE_PWD_RESET_SUCCESS
          }));
        }).catch( error => {
          dispatch( updateAuth({
            forcePwdResetErrorMsg: ( error as Error ).message,
            forcePwdResetStatus: authActions.FORCE_PWD_RESET_FAILURE
          }));
        });
      });
    } catch ( error ) {
      dispatch( updateAuth({
        forcePwdResetErrorMsg: ( error as Error ).message,
        forcePwdResetStatus: authActions.FORCE_PWD_RESET_FAILURE
      }));
    }
  };

export const forgotPassword = ( username: string ): AppThunk =>
  async ( dispatch ) => {
    try {
      dispatch( updateAuth({
        forgotPwdErrorMsg: undefined,
        forgotPwdStatus: authActions.FORGOT_PWD_PROCESSING
      }));
      // Send confirmation code to user's email
      await Auth.forgotPassword( username );

      dispatch( updateAuth({
        forgotPwdStatus: authActions.FORGOT_PWD_SUCCESS,
        forgotPwdSubmitStatus: undefined,
        forgotPwdSubmitErrorMsg: undefined
      }));
    } catch ( error ) {
      dispatch( updateAuth({
        forgotPwdErrorMsg: ( error as Error ).message,
        forgotPwdStatus: authActions.FORGOT_PWD_FAILURE
      }));
    }
  };

export const forgotPasswordResendCode = ( username: string ): AppThunk =>
  async ( dispatch ) => {
    try {
      dispatch( updateAuth({
        forgotPwdSubmitErrorMsg: undefined,
        forgotPwdResendCodeErrorMsg: undefined,
        forgotPwdResendCodeStatus: authActions.FORGOT_PWD_RESEND_CODE_PROCESSING
      }));
      // Resend confirmation code to user's email
      await Auth.forgotPassword( username );

      dispatch( updateAuth({
        forgotPwdResendCodeStatus: authActions.FORGOT_PWD_RESEND_CODE_SUCCESS
      }));
    } catch ( error ) {
      dispatch( updateAuth({
        forgotPwdResendCodeErrorMsg: ( error as Error ).message,
        forgotPwdResendCodeStatus: authActions.FORGOT_PWD_RESEND_CODE_FAILURE
      }));
    }
  };

export const confirmPassword = ( username: string, verificationCode: string, newPassword: string, restart: () => void ): AppThunk =>
  async ( dispatch ) => {
    try {
      dispatch( updateAuth({
        forgotPwdSubmitErrorMsg: null,
        forgotPwdSubmitStatus: authActions.FORGOT_PWD_SUBMIT_PROCESSING
      }));
      // Collect confirmation code and new password, then
      await Auth.forgotPasswordSubmit( username, verificationCode, newPassword );
      dispatch( updateAuth({ forgotPwdSubmitStatus: authActions.FORGOT_PWD_SUBMIT_SUCCESS }));
      restart();
    } catch ( error: any ) {
      dispatch( updateAuth({
        forgotPwdSubmitErrorMsg: error.message || JSON.stringify( error ),
        forgotPwdSubmitStatus: authActions.FORGOT_PWD_SUBMIT_FAILURE
      }));
    }
  };

export const changePassword = ( oldPassword: string, newPassword: string, navigate: any, callback: () => void ): AppThunk => {
  return async ( dispatch ): Promise<any> => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      const passwordChangeRes = await Auth.changePassword( user, oldPassword, newPassword );
      if ( passwordChangeRes === "SUCCESS" ) {
        dispatch( addNotification({
          title: i18n.t( "changePassword.passwordChanged" ),
          content: i18n.t( "changePassword.loginWithNewPassword" ),
          variant: "success",
          id: nanoid()
        }));
        dispatch( logout( navigate, true ));
      }
      callback();
    } catch ( err: any ) {
      dispatch( addNotification({
        title: i18n.t( "changePassword.passwordChangeFailed" ),
        content: err.message,
        variant: "error",
        id: nanoid()
      }));
      callback();
    }
  };
};

export const logout = ( navigate?: any, globalLogout = false ): AppThunk =>
  async ( dispatch, getState ) => {
    try {
      Auth.signOut({ global: globalLogout });
      const { permanentPaths } = getState().globalConfig;
      dispatch( logoutAction());
      dispatch( baseApi.util.resetApiState());
      // dispatch( originApi.util.resetApiState());
      if ( navigate ) {
        navigate?.( permanentPaths.login.path );
      } else {
        window.location.replace( permanentPaths.login.path );
      }
      unAuthenticatedUser = null;
    } catch ( error ) {
      // eslint-disable-next-line no-console
      console.log( "error signing out: ", error );
    }
  };

/************************************************* IDP Related Methods START *********************************************/

export const idpLogin = (): AppThunk => async () => Auth.federatedSignIn();

export const completeIDPLogin = ( navigate: any ): AppThunk => async ( dispatch ) => {
  try {
    const user = await Auth.currentAuthenticatedUser();
    const { "custom:username": username = "", "custom:attr3": allowedApps = "" } =
      user.signInUserSession.idToken.jwtToken && jwtDecode<JwtPayload>( user.signInUserSession.idToken.jwtToken ) || {};
    dispatch( updateAuth({
      token: user?.signInUserSession.idToken.jwtToken,
      refreshToken: user?.signInUserSession.refreshToken.token,
      hasAppAccess: allowedApps?.includes( ALLOWED_APP_NAME ),
      loginStatus: authActions.LOGIN_SUCCESS,
      sessionActive: true,
      validSession: true,
      username
    }));
    dispatch( updateAccount({ username }));
    if ( navigate ) {
      navigate?.( "/" );
    } else {
      window.location.replace( "/" );
    }
  } catch ( error ) {
    // eslint-disable-next-line no-console
    console.log( "IDP Login error ", error );
  }
};

/************************************************* IDP Related Methods END *********************************************/

/************************************************* MFA Related Methods START *********************************************/

export const setupTOTP = (): AppThunk => async ( dispatch ) => {
  try {
    dispatch( updateAuth({ totpSetupStatus: authActions.TOTP_SETUP_PROCESSING, totpSetupErrorMsg: undefined }));
    const user = await Auth.currentAuthenticatedUser({ bypassCache: false });
    const secretCode = await Auth.setupTOTP( user );
    dispatch( updateAuth({ totpSetupStatus: authActions.TOTP_SETUP_SUCCESS, secretCode }));
  } catch ( error: any ) {
    dispatch( updateAuth({
      totpSetupStatus: authActions.TOTP_SETUP_FAILURE,
      totpSetupErrorMsg: error.message || JSON.stringify( error )
    }));
  }
};

export const disableMFA = (): AppThunk => async ( dispatch ) => {
  try {
    const user = await Auth.currentAuthenticatedUser({ bypassCache: false });
    Swal.fire({
      title: "Updating your MFA preference",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      backdrop: true,
      onOpen: () => {
        Swal.showLoading( null as any );
      }
    } as SweetAlertOptions );
    await Auth.setPreferredMFA( user, "NOMFA" );
    dispatch( updateAuth({ mfaEnabled: false }));
    Swal.close();
  } catch ( error: any ) {
    Swal.hideLoading();
    dispatch( addNotification({
      title: i18n.t( "common.messages.error" ),
      content: error.message || JSON.stringify( error ),
      variant: "error",
      id: nanoid()
    }));
  }
};

export const verifyTOTPSetup = ( challengeAnswer: string ): AppThunk =>
  async ( dispatch ) => {
    dispatch( updateAuth({ verifyTotpSetupStatus: authActions.VERIFY_TOTP_SETUP_PROCESSING, verifyTotpSetupErrorMsg: undefined }));
    try {
      await Auth.verifyTotpToken( unAuthenticatedUser, challengeAnswer );
      await Auth.setPreferredMFA( unAuthenticatedUser, "TOTP" );

      dispatch( updateAuth({
        token: unAuthenticatedUser?.signInUserSession.idToken.jwtToken,
        verifyTotpSetupStatus: authActions.VERIFY_TOTP_SETUP_SUCCESS,
        mfaEnabled: true,
        sessionActive: true,
        validSession: true,
        loginStatus: authActions.LOGIN_SUCCESS,
        username: unAuthenticatedUser.username
      }));
      dispatch( updateAccount({ username: unAuthenticatedUser.username }));
      unAuthenticatedUser = null;
    } catch ( error: any ) {
      dispatch( updateAuth({
        verifyTotpSetupStatus: authActions.VERIFY_TOTP_SETUP_FAILURE,
        verifyTotpSetupErrorMsg: error.message || JSON.stringify( error )
      }));
    }
  };

export const verifyTOTPForSignIn = ( otp: string ): AppThunk => async ( dispatch ) => {
  try {
    dispatch( updateAuth({
      confirmSignInStatus: authActions.CONFIRM_SIGN_IN_PROCESSING,
      verifyTotpTokenErrorMsg: undefined
    }));
    await Auth.confirmSignIn(
      unAuthenticatedUser,
      otp,
      "SOFTWARE_TOKEN_MFA"
    );
    dispatch( updateAuth({
      token: unAuthenticatedUser?.signInUserSession.idToken.jwtToken,
      sessionActive: true,
      validSession: true,
      confirmTOTPForSignIn: undefined,
      confirmSignInStatus: authActions.CONFIRM_SIGN_IN_SUCCESS,
      username: unAuthenticatedUser.username
    }));
    dispatch( updateAccount({ username: unAuthenticatedUser.username }));
    unAuthenticatedUser = null;
  } catch ( error: any ) {
    dispatch( updateAuth({
      confirmSignInStatus: authActions.CONFIRM_SIGN_IN_FAILURE,
      verifyTotpTokenErrorMsg: error?.message === "Cannot read properties of null (reading 'sendMFACode')"
        ? i18n.t( "auth.verify.pleaseLoginAgain" )
        : error.message
          ? error.message
          : JSON.stringify( error )
    }));
  }
};

export const showMfaModal = (): AppThunk => {
  return async ( dispatch ) => {
    const user = await Auth.currentAuthenticatedUser();
    if ( user === null ) {
      dispatch( addNotification({
        title: i18n.t( "profile.settings.authenticationError" ),
        content: i18n.t( "common.messages.pleaseTryAgain" ),
        variant: "error",
        id: nanoid()
      }));
    }
    try {
      const secretCode = await Auth.setupTOTP( user );
      dispatch( updateAuth({ secretCode, mfaError: undefined }));
    } catch ( err: any ) {
      dispatch( addNotification({
        title: i18n.t( "profile.settings.authenticationError" ),
        content: err.message || err,
        variant: "error",
        id: nanoid()
      }));
    }
  };
};

export const verifySoftwareToken = ( challengeAnswer: string, navigate: NavigateFunction ): AppThunk => {
  return async ( dispatch ) => {
    const cognitoUser = await Auth.currentAuthenticatedUser();
    if ( cognitoUser === null ) {
      dispatch( addNotification({
        title: i18n.t( "profile.settings.authenticationError" ),
        content: i18n.t( "common.messages.pleaseTryAgain" ),
        variant: "error",
        id: nanoid()
      }));
    }
    dispatch( updateAuth({ mfaError: undefined, fetchingMfa: true }));
    try {
      await Auth.verifyTotpToken( cognitoUser, challengeAnswer );
      await Auth.setPreferredMFA( cognitoUser, "TOTP" );
      dispatch( updateAuth({ mfaEnabled: true }));
      dispatch( updateAuth({
        secretCode: undefined,
        fetchingMfa: undefined
      }));
      dispatch( addNotification({
        title: i18n.t( "profile.settings.mfaEnabled" ),
        content: i18n.t( "profile.settings.mfaSuccess" ),
        variant: "success",
        id: nanoid()
      }));
      // initiate global-logout when user sets up MFA
      dispatch( logout( navigate, true ));
    } catch ( e: any ) {
      dispatch( updateAuth({
        mfaError: e.message || JSON.stringify( e ),
        fetchingMfa: undefined
      }));
    }
  };
};

/************************************************* MFA Related Methods END *********************************************/

export const updateAuthReducer = ( data: Record<string, any> ): AppThunk => ( dispatch ) => {
  dispatch( updateAuth( data ));
};

export const resetAuthProps = ( propsToReset: Record<string, unknown | never> ): AppThunk => {
  return ( dispatch ) => {
    dispatch( updateAuth( propsToReset ));
  };
};
