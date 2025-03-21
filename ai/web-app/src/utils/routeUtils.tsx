// libraries
import React from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

// components
import { useAppSelector, usePermanentPaths, useRoutePermission } from "./hooks";
import { UnAuthorized } from "../components/errorPages/unAuthorized";
import { RouteObject, PermanentPathObject } from "../types";
import { ErrorBoundary } from "../components/layout/errorBoundary";
import { routeActions } from "../constants";

interface UnProtectedRouteProps {
  children: JSX.Element;
  redirectTo?: string;
}
interface ProtectedRouteProps extends UnProtectedRouteProps {
  hideSidenav?: boolean;
  hideUtilityWizard?: boolean;
  routeObject?: RouteObject;
}

export const Unprotected = ({ children, redirectTo }: UnProtectedRouteProps ): JSX.Element => {
  const { sessionActive } = useAppSelector( state => state.auth );
  const { chat } = usePermanentPaths();
  return sessionActive ? <Navigate to={redirectTo ?? chat.path}/> : <ErrorBoundary>
    {children}
  </ErrorBoundary>;
};

export function Protected({
  children,
  routeObject,
  redirectTo
}: ProtectedRouteProps ): JSX.Element {
  const { sessionActive } = useAppSelector( state => state.auth );
  const permanentPaths = usePermanentPaths();
  const checkRoutePermission = useRoutePermission();
  const hasPermission = typeof routeObject?.permission === "string" ? checkRoutePermission( routeObject ) : true;

  return ( sessionActive ? <>
    { hasPermission
      ? <ErrorBoundary>
        {children}
      </ErrorBoundary>
      : ( redirectTo
        ? <Navigate to={redirectTo} state={{ from: location }} />
        : <UnAuthorized />
      )}
  </>
    : <Navigate to={permanentPaths?.login?.path ?? "/"} state={{ from: location }} />
  );
}

interface BreadcrumbItemProps {
    name: string;
    link?: string;
}

// used mainly
function getRouteFor(
  pathIdentifier: string,
  permanentPaths: PermanentPathObject,
  translate: any,
  currentList: BreadcrumbItemProps[] = []
): BreadcrumbItemProps[] {
  const list = currentList;
  if ( Object.prototype.hasOwnProperty.call( permanentPaths, pathIdentifier )) {
    if ( permanentPaths?.[pathIdentifier]?.path !== "/" ) {
      getRouteFor( permanentPaths[pathIdentifier].parent, permanentPaths, translate, list );
    }
    list.push({
      name: translate( permanentPaths[pathIdentifier].name ),
      link: permanentPaths[pathIdentifier]?.path
    });
  }
  return list;
}

export function GetBreadCrumbsPath(
  pathIdentifier: string,
  onDetailsPage = false
): BreadcrumbItemProps[] {
  const { t } = useTranslation();
  const permanentPaths = useAppSelector(({ globalConfig }) => globalConfig?.permanentPaths ?? {});
  const breadcrumbItems = getRouteFor( pathIdentifier, permanentPaths, t );

  // append `/details` to the last crumb if on details page
  if ( onDetailsPage && breadcrumbItems.length > 0 ){
    const lastCrumb = breadcrumbItems[breadcrumbItems.length - 1];
    lastCrumb.link = `${lastCrumb.link }/${routeActions.list}`;
  }
  return breadcrumbItems;
}