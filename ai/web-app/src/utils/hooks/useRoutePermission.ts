import { useCallback } from "react";

import { useAppSelector } from ".";
import { hasAccess } from "../../routes/routeUtils";
import { RouteObject } from "../../types";

export const useRoutePermission = ():( routeObj: RouteObject ) => boolean => {
  const {
    globalConfig,
    UserRole
  } = useAppSelector(( state ) => ({
    globalConfig: state.globalConfig,
    sessionActive: state.auth?.sessionActive,
    UserRole: state.account?.UserRole
  }));

  const checkPermissions = useCallback(( routeObj: RouteObject ) => {
    const { reqGlobalConfigCondition } = routeObj ?? {};
    if ( UserRole && !hasAccess( UserRole, routeObj?.permission )) {
      return false;
    } else if ( reqGlobalConfigCondition?.flag !== undefined && globalConfig?.[reqGlobalConfigCondition?.flag] !== reqGlobalConfigCondition.value ) {
      return false;
    } else {
      return true;
    }
  }, [ globalConfig, UserRole ]);

  return checkPermissions;
};
