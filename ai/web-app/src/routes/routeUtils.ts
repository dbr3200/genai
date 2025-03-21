import { EUserRoles, PermanentPathObject, RouteObject, TUserRole } from "../types";
import routePermissions from "./routePermissions.json";
import userRoles from "../constants/userRoles.json";
import appConfig from "../config.json";

type RouteReqKeys = keyof typeof routePermissions;

export const getAllRoutes = ( permanentPaths: PermanentPathObject ): PermanentPathObject => {
  try {
    const { VERSION } = appConfig;
    const paths: PermanentPathObject = {};
    Object.entries( permanentPaths ).forEach(([ identifier = "root" as string, obj ]) => {
      const { parent, path, externalLink = false }: Partial<RouteObject> = obj;
      if ( identifier === "root" ) {
        paths[identifier] = { ...obj, relativePath: "/" };
      } else {
        paths[identifier] = {
          ...obj,
          path: parent === "root" ? ( externalLink ? path : `/${path}` ) : `${paths?.[parent]?.path}${path}`,
          relativePath: parent === "root" ? ( externalLink ? path : `/${path}` ) : `${path?.replace( /^\//, "" )}`
        };
      }

      if ( identifier === "userdocs" ) {
        paths[identifier].path = `${path}${VERSION ? `en/v${VERSION}/` : ""}`;
        paths[identifier].relativePath = `${path}${VERSION ? `en/v${VERSION}/` : ""}`;
      }
    });
    return paths;
  } catch ( _error ) {
    return {};
  }
};

export const thisOrFullAccess = ( permission: string, userPermissions: string[]) => {
  try {
    if ( permission ){
      // eslint-disable-next-line no-unsafe-optional-chaining
      const [resource] = permission?.split( "." );
      return [ `${resource}.fullaccess`, resource, permission ].some( p => userPermissions.includes( p ));
    } else {
      return false;
    }
  } catch ( e ) {
    return false;
  }
};

export const hasAccess = ( userRole: TUserRole = EUserRoles.Users, action = "any" ): boolean => {
  const userPermissions: string[] = userRoles?.[ userRole ] ?? userRoles[ "Users" ];
  if ( action === "any" ) {
    return true;
  } else if ( Object.prototype.hasOwnProperty.call( routePermissions, action )) {
    return routePermissions[action as RouteReqKeys].some(( role: string ) => role === userRole );
  } else {
    // eslint-disable-next-line no-unsafe-optional-chaining
    const [ corePerm, ...acts ] = action?.split( "." );
    if ( acts?.length > 0 ) {
      return [ `${corePerm}.fullaccess`, action ].some( x => userPermissions.includes( x ));
    } else {
      return false;
    }
  }
};
