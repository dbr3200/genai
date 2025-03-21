import { PermanentPathObject, RouteObject } from "../types";
import routePermissions from "./routePermissions.json";

type RouteReqKeys = keyof typeof routePermissions;
type UserRole = {
  RoleConsolidatedPermissions: Array<string>;
  RolePermissions: Array<string>;
}

export const getAllRoutes = ( permanentPaths: PermanentPathObject ): PermanentPathObject => {
  try {
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
    });
    return paths;
  } catch ( _error ) {
    return {};
  }
};

const thisOrFullAccess = ( permission:string, userPermissions:string[]) => {
  try {
    const [resource] = permission?.split( "." );
    return [ `${resource}.fullaccess`, resource, permission ].some( p => userPermissions.includes( p ));
  } catch ( e ) {
    return false;
  }
};

export const hasAccess = ( userRole: UserRole, action = "any", fullMatch = false ):boolean => {
  const userPermissions = userRole?.RoleConsolidatedPermissions ?? userRole?.RolePermissions ?? [];
  if ( action === "any" ) {
    return true;
  } else if ( Object.prototype.hasOwnProperty.call( routePermissions, action )) {
    if ( fullMatch ) {
      return routePermissions[action as RouteReqKeys].every( perm => thisOrFullAccess( perm, userPermissions ));
    } else {
      return routePermissions[action as RouteReqKeys].some( perm => thisOrFullAccess( perm, userPermissions ));
    }
  } else {
    const [ corePerm, ...acts ] = action?.split( "." );
    if ( acts?.length > 0 ) {
      return [ `${corePerm}.fullaccess`, action ].some( x => userPermissions.includes( x ));
    } else {
      return false;
    }
  }
};
