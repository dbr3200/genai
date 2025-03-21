import "react-perfect-scrollbar/dist/css/styles.css";
import "./app.module.scss";

import * as React from "react";

import { Login, Page404, SetupMFA } from "../dynamicImports";
// libraries
import { ReactElement, Suspense, useEffect, useRef } from "react";
import { Route, Routes } from "react-router-dom";
import {
  useAppDispatch,
  useAppSelector,
  useInfoNotification,
  usePermanentPaths,
  useRTL,
  useTheme
} from "../../utils/hooks";

import AgentRoutes from "../agents/routes";
import AppReset from "../customComponents/appReset";
// layouts
import AuthLayout from "../auth/AuthLayout";
import AuthRoutes from "../auth";
import { Callback } from "../callback";
import { ChatbotRoutes } from "../chatbots/routes";
import ModelRoutes from "../models/routes";
import { EmbeddedChatbot } from "../embeddedChatbot";
// components
import Home from "../home";
import { ManagementRoutes } from "../management/routes";
import { NoAppAccess } from "../errorPages/noAppAccess";
import PageLayout from "../layout/PageLayout";
import { PageLoadSpinner } from "../pageLoadSpinner";
import PerfectScroll from "react-perfect-scrollbar";
import { PlaygroundRoutes } from "../playground/routes";
import { ProfileRoutes } from "../settings/routes";
// methods / hooks / constants / styles
import { Protected } from "../../utils";
import SSOCallback from "../sso/Callback";
import SSOInitiate from "../sso/Initiate";
import Settings from "../settings";
import TransitionLayout from "../layout/transitionLayout";
import UtilityLayout from "../layout/UtilityLayout";
import { WorkspaceRoutes } from "../workspaces/routes";
import { configureDayJSLocale } from "../../utils/dateUtils";
import { useTranslation } from "react-i18next";
import { userResources } from "../../modules/common/actions";

const SessionExpired = React.lazy(() => import( "../errorPages/SessionExpired" ));

export default function App(): ReactElement {
  useTheme();
  const isRTL = useRTL();
  const dispatch = useAppDispatch();
  const { i18n: reactI18n, t } = useTranslation();
  const [showInfoNotification] = useInfoNotification();
  const permanentPaths = usePermanentPaths();
  const {
    globalConfig,
    sessionActive = false,
    validSession = false,
    username,
    mfaEnabled = false,
    UserId = "",
    UserRole = "Users",
    hasAppAccess = false,
    roleDetails = {}
  } = useAppSelector(( state ) => ({
    globalConfig: state.globalConfig,
    sessionActive: state.auth?.sessionActive,
    validSession: state.auth?.validSession,
    username: state.auth?.username,
    mfaEnabled: state.auth?.mfaEnabled,
    hasAppAccess: state.auth?.hasAppAccess,
    UserId: state.account?.UserId,
    UserRole: state.account?.UserRole,
    roleDetails: state.account?.roleDetails,
    AmorphicIntegrationStatus: state.account?.AmorphicIntegrationStatus
  }));
  const prevRole = useRef( UserRole );
  // const [getCommonSystemConfigs] = useLazyGetCommonSystemConfigsQuery();

  useEffect(() => {
    configureDayJSLocale( reactI18n.language );
  }, [reactI18n.language]);

  useEffect(() => {
    if ( isRTL ) {
      document.body.dir = "rtl";
    } else {
      document.body.dir = "ltr";
    }
  }, [isRTL]);

  // Fetch common resources after login -or- Update common resources when the user changes his role
  useEffect(() => {
    if ( sessionActive && UserId && UserRole && UserRole !== prevRole.current ) {
      showInfoNotification({
        content: t( "common.messages.fetchingCommonResources" ),
        autoHideDelay: 2000
      });
      dispatch( userResources());
      // getCommonSystemConfigs( undefined );
    }
    prevRole.current = UserRole;
  }, [ UserRole,
    UserId,
    dispatch,
    globalConfig,
    permanentPaths,
    roleDetails,
    sessionActive,
    showInfoNotification,
    t ]);

  if ( !sessionActive ) {
    /**
     * This is the initial state of the app when the user is not logged in.
     * This is the only state where the user can access the un-authenticated routes.
     * TODO: add component that fetches customConfig.json here
     */
    return (
      <Suspense fallback={<PageLoadSpinner />}>
        <PerfectScroll component="div" className="h-full">
          <Routes>
            <Route path={`${permanentPaths.embeddedChatbot?.path}/:chatbotId`} element={<EmbeddedChatbot />} />
            <Route element={<AuthLayout />}>
              <Route index element={<Login />} />
              <Route
                path={permanentPaths.callback?.path}
                element={<Callback />}
              />
              <Route path={permanentPaths?.ssoInitiate?.path} element={<SSOInitiate />} />
              <Route path={permanentPaths?.ssoCallback?.path} element={<SSOCallback />} />
              <Route
                path={`${permanentPaths?.auth?.path ?? "/auth"}/*`}
                element={
                  <>
                    <AuthRoutes permanentPaths={permanentPaths} />
                  </>
                }
              />
              <Route
                path={permanentPaths?.reset?.path ?? "/reset"}
                element={<AppReset />}
              />
              {/* Implement redirection from the 404 page, just like Amorphic V2 */}
              <Route path="*" element={<SessionExpired />} />
            </Route>
          </Routes>
        </PerfectScroll>
      </Suspense>
    );
  }

  if ( sessionActive && !validSession ) {
    /**
     * This is a special case where the user is logged in but the session is not valid.
     * This can happen in multiple scenarios:
     * when the user is logged in from multiple devices and the session is invalidated on one of the devices
     * or
     * when the user authentication token is expired along with refresh token
     * or
     * when a token from a different cognito is used to access the application.
     *
     *
     * In all these cases, the user must be forced to login again without which the application state
     * cannot be guaranteed to be consistent.
     */
    return (
      <Suspense fallback={<PageLoadSpinner />}>
        <Routes>
          <Route path={`${permanentPaths.embeddedChatbot?.path}/:chatbotId`} element={<EmbeddedChatbot />} />
          <Route path={permanentPaths?.reset?.path ?? "/reset"} element={<AppReset />}/>
          <Route path="*" element={<SessionExpired />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoadSpinner />}>
      { hasAppAccess ? <Routes>
        <Route path={`${permanentPaths.embeddedChatbot?.path}/:chatbotId`} element={<EmbeddedChatbot />} />
        <Route path={permanentPaths?.reset?.path ?? "/reset"} element={<AppReset />} />
        <Route element={<PageLayout />}>
          {( !UserId || !UserRole ) ? (
            <>
              {/**
               * Transition layout is used to show the user agreement page based on the
               * TnCActionPending flag or when UserId & UserRole are not available (user may be logging in for the first time).
               * An edge case is when API calls are in progress and user lands on this page intermittently.
               */}
              <Route
                path="*"
                element={<TransitionLayout username={username} mfaEnabled={mfaEnabled} />}
              />
            </>
          ) : globalConfig?.ENFORCE_COGNITO_MFA?.toLowerCase() ===
              "mandatory" && !mfaEnabled ? (
              <Route path="*" element={<SetupMFA />} />
            ) : (
              <Route element={<UtilityLayout />}>
                <Route index element={<Home />} />
                <Route path={`${permanentPaths.auth.path}/*`} element={<Home />} />
                {/* <Route path={`${permanentPaths.chat?.path }/*`} element={<Protected
                  routeObject={permanentPaths.chat}>
                  <ChatRoutes />
                </Protected>} /> */}
                <Route path={`${permanentPaths.playground?.path }/*`} element={<Protected
                  routeObject={permanentPaths.playground}>
                  <PlaygroundRoutes />
                </Protected>} />
                <Route path={`${permanentPaths.profileAndSettings?.path }/*`} element={<Protected
                  routeObject={permanentPaths.profileAndSettings}>
                  <ProfileRoutes />
                </Protected>} />
                <Route path={`${permanentPaths.models?.path }/*`} element={<Protected
                  routeObject={permanentPaths.models}>
                  <ModelRoutes />
                </Protected>} />
                <Route path={`${permanentPaths.workspaces?.path }/*`} element={<Protected
                  routeObject={permanentPaths.workspaces}>
                  <WorkspaceRoutes />
                </Protected>} />
                <Route path={`${permanentPaths.chatbots?.path }/*`} element={<Protected
                  routeObject={permanentPaths.chatbots}>
                  <ChatbotRoutes />
                </Protected>} />
                <Route path={`${permanentPaths.agents?.path }/*`} element={<Protected
                  routeObject={permanentPaths.agents}>
                  <AgentRoutes />
                </Protected>} />
                <Route path={`${permanentPaths.management?.path }/*`} element={<Protected
                  routeObject={permanentPaths.management}>
                  <ManagementRoutes />
                </Protected>} />
                <Route path="logout" element={<Settings />} />
                <Route path={"*"} element={<Page404 />} />
              </Route>
            )}
        </Route>
      </Routes> : <Routes>
        <Route
          path={permanentPaths?.reset?.path ?? "/reset"}
          element={<AppReset />}
        />
        <Route path="*" element={<NoAppAccess />} />
      </Routes>}
    </Suspense>
  );
}
