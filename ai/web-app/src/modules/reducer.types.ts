export interface IActionProps {
    type: string,
    payload?: {[name: string]: any },
    data?: {[name: string]: any }
}

/* Auth */
export interface IAuthState {
    token?: string;
    refreshToken?: string;
    loginTime?: number;
    lastActivity?: number;
    email?: string;
    username?: string;
    enforceMFA: string;
    mfaEnabled?: boolean;
    verifyingCode: boolean;
    projectShortName: string;
    registrationResendCodeStatus: string,
    confirmSignInStatus: string,
    confirmSignUpStatus: string,
    forgotPwdStatus: string,
    forgotPwdSubmitStatus: string,
    forgotPwdResendCodeStatus: string,
    loginStatus: string,
    signUpStatus: string,
    totpSetupStatus: string,
    verifyTotpSetupStatus: string
}