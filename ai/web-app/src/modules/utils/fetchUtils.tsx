import { Dispatch } from "react";

export const encodeQueryParams = ( queryObject: { [key: string]: string | number }): string => {
  const queryParams = [];
  for ( const param in queryObject ) {
    if ( queryObject[param] === null || typeof queryObject[param] === "undefined" ) {
      continue;
    }
    queryParams.push( `${encodeURIComponent( param )}=${encodeURIComponent( queryObject[param])}` );
  }
  return queryParams.join( "&" );
};

export const urlBuilder = ( path:string | string[], queryParam?: Record<string, any> ): string => {
  let url = "";

  if ( Array.isArray( path )){
    url = url.concat( path.join( "/" ));
  } else {
    url = url.concat( path );
  }

  if ( queryParam && Object.keys( queryParam ).length > 0 ) {
    url = url.concat( `?${encodeQueryParams( queryParam )}` );
  }

  return url;
};

export const extractMessage = ( data: any, fallback = "" ): string => {
  try {
    if ([ "undefined", "null" ].includes( typeof data )){
      return fallback;
    } else {
      return data?.Message ?? data?.message ?? ( typeof data === "string" ? data : undefined ) ?? fallback;
    }
  } catch ( e ) {
    return fallback;
  }
};

export const extractError = ( error_obj : any, fallbackError = "Network Error" ): string => {
  try {
    return extractMessage( error_obj?.response?.data, error_obj?.response ) || extractError( error_obj?.data, undefined ) ||
    extractMessage( error_obj, fallbackError );
  } catch ( e ) {
    return fallbackError;
  }
};

export const asyncDispatcher = ( dispatch: Dispatch<any>, dispatchType: string, dispatchProps: Record<string, any> ): Promise<any> => {
  dispatch({ type: dispatchType, data: dispatchProps });
  return Promise.resolve();
};
