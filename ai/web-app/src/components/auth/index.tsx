// libraries
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import * as React from "react";

// components
import { Login } from "../dynamicImports";
import { PageLoadSpinner } from "../pageLoadSpinner";
const ForgotPassword = lazy(() => import( "./forgotPassword" ));
const VerifyOtp = lazy(() => import( "./verifyOtp" ));
const ForcePwdReset = lazy(() => import( "./forcePwdReset" ));
const SetupMFA = lazy(() => import( "./setupMFA" ));

interface IAuthDynamicImports {
  permanentPaths: any;
}

const AuthRoutes = ({ permanentPaths }: IAuthDynamicImports ): JSX.Element => <Suspense fallback={<PageLoadSpinner />}>
  <Routes>
    <Route index element={<Login />}/>
    <Route path={permanentPaths?.login?.relativePath} element={<Login />}/>
    <Route path={permanentPaths?.forgotPassword?.relativePath} element={<ForgotPassword />} />
    <Route path={permanentPaths?.verify?.relativePath} element={<VerifyOtp />} />
    <Route path={permanentPaths?.resetPassword?.relativePath} element={<ForcePwdReset />} />
    <Route path={permanentPaths?.setupTOTP?.relativePath} element={<SetupMFA />} />
    <Route path="*" element={<Login />}/>
  </Routes>
</Suspense>;

export default AuthRoutes;