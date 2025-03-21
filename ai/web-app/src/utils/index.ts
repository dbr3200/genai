
export * from "./dateUtils";
export * from "./routeUtils";
export * from "./stringUtils";

export const getObjValue = ( obj: Record<string, any>, path: string ): Record<string, any> | undefined => {
  path = path.replace( /\[(\w+)\]/g, ".$1" ); // convert indexes to properties
  path = path.replace( /^\./, "" ); // strip a leading dot
  const a = path.split( "." );
  for ( let i = 0, n = a.length; i < n; ++i ) {
    const k = a[i];
    if ( obj && k in obj ) {
      obj = obj[k];
    } else {
      return;
    }
  }
  return obj;
};

export const deleteObjKey = ( obj: Record<string, any>, path: string ): Record<string, any> | undefined => {

  if ( !obj || !path || typeof path !== "string" ) {
    return;
  }

  const reqPath = path.split( "." );

  for ( let i = 0; i < reqPath.length - 1; i++ ) {

    obj = obj[reqPath[i]];

    if ( typeof obj === "undefined" ) {
      return;
    }
  }

  delete obj[reqPath.pop() ?? ""];
};

/**
 * @param {JSON} json Object that needs to be downloaded. NOTE - The object shouldn't have a function as a value.
 * @param {string} filename Name for the generated file. NOTE - Don't include the extension in the filename.
 */
export const downloadJSON = ( json: any, filename: string ): void => {
  const json_data = `data:text/json;charset=utf-8,${ encodeURIComponent( JSON.stringify( json ))}`;
  const dlAnchorElem = document.createElement( "a" );
  dlAnchorElem?.setAttribute( "href", json_data );
  dlAnchorElem?.setAttribute( "download", `${filename}.json` );
  dlAnchorElem?.click();
  dlAnchorElem.parentNode &&
  document.removeChild( dlAnchorElem.parentNode );
};

export const copyToClipboard = async ( value:any ) => await navigator.clipboard.writeText( value );

export const downloadWithLink = ( link: string ) => {
  window.open( link, "_self" );
};

export const extractError = ( error:any, fallbackError = "Network Error" ) => {
  try {
    if ( typeof error === "undefined" ){
      return fallbackError;
    } else if ( typeof error === "string" ){
      return error.length > 0 ? error : fallbackError;
    } else if ( Array.isArray( error )) {
      return error.length > 0 ? error?.join( " " ) : fallbackError;
    } else if ( typeof error === "object" ) {
      return error?.response?.data?.Message ||
              error?.response?.data?.message ||
              error?.response?.Message ||
              error?.response?.message ||
              error?.data?.Message ||
              error?.data?.message ||
              error?.Message ||
              error?.message ||
              fallbackError;
    } else {
      return fallbackError;
    }
  } catch ( e ) {
    return fallbackError;
  }
};
