import { lazy } from "react";
import { lazyRetry } from "../utils/renderUtils";

export const Login = lazyRetry(() => import( "./auth/login" ));
export const Register = lazy(() => import( "./auth/register" ));
export const ForgotPassword = lazy(() => import( "./auth/forgotPassword" ));
export const VerifyOtp = lazy(() => import( "./auth/verifyOtp" ));
export const ForcePwdReset = lazy(() => import( "./auth/forcePwdReset" ));
export const SetupMFA = lazy(() => import( "./auth/setupMFA" ));
export const Page404 = lazy(() => import( "./errorPages/404" ));

