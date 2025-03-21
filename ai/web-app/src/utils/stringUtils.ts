/**
 * Method accepts a string and splits it at every capital letter
 * @param str
 * @returns str with first letter capitalized of each word
 * @example <caption>Example usage of unCamelize</caption>
 * unCamelize('helloWorld') // returns 'Hello World'
 * unCamelize('datasetDomainName') // returns 'Dataset Domain Name'
 */
export function unCamelize( str?: string ): string {
  return str?.replace( /([a-z])([A-Z])/g, "$1 $2" )?.replace( /^./, ( s ) => s.toUpperCase()) ?? "";
}

export const splitPascalCase = ( word: string ): string => word.match( /($[a-z])|[A-Z][^A-Z]+/g )?.join( " " ) ?? "";

/**
 * Method accepts a data object and extracts the message from it.
 * @param data object to extract the message from
 * @param {string} fallback fallback message to return if no message is found
 * @returns {string} message from data or fallback
 * @example <caption>Example usage of extractMessage</caption>
 * extractMessage({ message: "hello world" }) // returns 'hello world'
 * extractMessage({ key1: "hello world" }, "fallback message") // returns 'fallback message'
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractMessage({ data, fallback = "" }: { data: any; fallback?: string; }): string {
  try {
    if ([ "undefined", "null" ].includes( typeof data )){
      return fallback;
    } else {
      return ( data?.Message || data?.message || ( typeof data === "string" ? data : undefined ) || fallback ).replace( /\+/g, "" );
    }
  } catch ( e ) {
    return fallback;
  }
}

/**
 * Method accepts a data object and extracts the error from it.
 * @param error_obj object to extract the error message from
 * @param {string} fallbackMessage fallback message to return if no error message is found
 * @returns {string} error message from error_obj or fallback
 * @example <caption>Example usage of extractError</caption>
 * extractMessage({ data: "404 not found" }) // returns '404 not found'
 * extractMessage({ key1: "hello world" }, "fallback error message") // returns 'fallback error message'
 */
export function extractError({
  error_obj,
  fallbackMessage = "Network Error"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}: { error_obj: any; fallbackMessage?: string; }): string {
  try {
    return extractMessage(
      { data: error_obj?.response?.data, fallback: error_obj?.response }) ||
      extractMessage({ data: error_obj?.data, fallback: undefined }) ||
      extractMessage({ data: error_obj, fallback: fallbackMessage });
  } catch ( e ) {
    return fallbackMessage;
  }
}

/**
 * Method that capitalizes the first character of given string
 * @param {string} str - source string
 * @returns {string} - captalized string
 * @example <caption>Example usage of capitalize</caption>
 * capitalize('hello world') // returns 'Hello world'
 */
export function capitalize( str: string ): string {
  return `${str?.charAt( 0 )?.toUpperCase()}${str?.slice( 1 )}`;
}

/**
 * Helper function for camelCasing translation strings
 * @param str - string to be camelCased
 * @returns {string} - camelCased string
*/
export function camelCase ( str:string ): string {
  return str.replace( /(?:^\w|[A-Z]|\b\w|\s+)/g, ( match:string, index:number ) => {
    if ( Number( match ) === 0 ) {
      return "";
    }
    return index === 0 ? match.toLowerCase() : match.toUpperCase();
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function flatter({ c, val }: { c: string; val: any; }): any[] {
  if ([ "boolean", "number" ].includes( typeof val )) {
    return ([[ unCamelize( c ), `${val}` ]]);
  } else if (["string"].includes( typeof val )) {
    return ([[ unCamelize( c ), val.length ? `${val}` : "-" ]]);
  } else if ([ "null", "undefined" ].includes( typeof val ) || val === null ) {
    return ([[ unCamelize( c ), "null" ]]);
  } else if ( Array.isArray( val )) {
    if ( c === "Keywords" ) {
      return ([[ unCamelize( c ), val.length ? val.join( ", " ) : "-" ]]);
    } else {
      const deepVal:any = [];
      val.forEach(( elem ) => {
        for ( const [ key, value ] of Object.entries( elem )) {
          deepVal.push( `${key}: ${value}` );
        }
      });
      return ([[ unCamelize( c ), deepVal.length ? deepVal.join( ", " ) : "-" ]]);
    }
  } else if ( typeof val === "object" ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Object.keys( val ).reduce(( acc: any[], curr: string ) => {
      return [ ...acc, [flatter({ c: curr, val: val[curr] })] ];
    }, [])?.flat()?.flat();
  }
  return [];
}
/**
 * Function to convert file size in bytes to human readable format
 * @param size - size of the file in bytes
 * @returns {string} - human readable file size
 * @example <caption>Example usage of readableFileSize</caption>
 * readableFileSize(1024) // returns '1 kB'
 * readableFileSize(1024 * 1024 * 1024) // returns '1 GB'
 */
export function readableFileSize( size: number ): string {
  const i = size !== 0 ? Math.floor( Math.log( size ) / Math.log( 1024 )) : 0;
  return `${Number(( size / Math.pow( 1024, i )).toFixed( 2 )) } ${ [ "B", "kB", "MB", "GB", "TB" ][i]}`;
}

/**
 * Function to format the file name to a readable format.
 * @param obj - File Name in String format.
 * @returns {string} - Formatted File Name.
 * @example <caption>Example usage of formatFileName</caption>
 * formatFileName("https://example.com/file_name") // returns 'file name'
 * formatFileName("s3://bucketname/dir1/timestamp/username/file_name.pdf") // returns 'file name'
 */
export const formatFileName = ( filename: string ): string => {
  const filenameRegex = /[^/]+_[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}_\d+_(.+)/i;
  try {
    const match = filename.match( filenameRegex );
    if ( match ) {
      return match?.[1] || filename;
    } else {
      return ADCFileFormat( filename );
    }
  } catch {
    return filename;
  }
};

export const ADCFileFormat = ( obj: any ): string => {
  return decodeURI(( /^(.*)[/](.*?)$/.exec( obj ) || [] as any ).pop()) ||
    ( obj?.split( "/" )[3]?.split( "_" )?.slice( 3 )?.join( " " )) || obj || "";
};

const truthyValues = [ "true", "yes", "on", "enable", "enabled", "active", "available", "connected" ];
const falseyValues = [ "false", "no", "off", "disable", "disabled", "inactive", "unavailable", "disconnected" ];

type TTruthyValue = typeof truthyValues[number] | string;
type TFalseyValue = typeof falseyValues[number] | string;
/**
 * Function to validate if given string forms one of app accepted true values
 * @param value - string to test for
 * @returns {boolean} - returns true if value is one of truthy values
 * @example <caption>Example usage of isTruthyValue</caption>
 * isTruthyValue("true") // returns true
 * isTruthyValue("yes") // returns true
 * isTruthyValue("on") // returns true
 * isTruthyValue("enable") // returns true
 */
export function isTruthyValue( value?: TTruthyValue ): boolean {
  if ( !value ) {
    return false;
  }
  return truthyValues.includes( `${value?.toLowerCase()}` );
}

/**
 * Function to validate if given string forms one of app accepted false values
 * @param value - string to test for
 * @returns {boolean} - returns true if value is one of falsey values
 * @example <caption>Example usage of isFalseyValue</caption>
 * isFalseyValue("false") // returns true
 * isFalseyValue("no") // returns true
 * isFalseyValue("off") // returns true
 */
export function isFalseyValue( value?: TFalseyValue ): boolean {
  if ( !value ) {
    return true;
  }
  return falseyValues.includes( `${value?.toLowerCase()}` );
}

/**
 * Function to truncate string to given length and add ellipsis to end
 * @param str - string to truncate (optional)
 * @param length - length to truncate to (optional)
 * @param postfix - ending to add to truncated string (optional)
 * @returns {string} - truncated string
 * @example <caption>Example usage of truncateId</caption>
 * truncateId("1234567890") // returns '12345678...'
 * truncateId("1234567890", 5) // returns '12345...'
 * truncateId("1234567890", 5, "!!") // returns '12345!!'
 */
export function truncateId( str?: string, length = 8, postfix = "..." ): string {
  if ( !str ){
    return "-";
  }
  return str?.length > length ? `${str?.substring( 0, length )}${postfix}` : str;
}

/**
 * Function to convert a Object byString
 * @param object - Object to convert
 * @param key - String to convert
 * @returns {string} - converted string
 */
export function findKeyInObject( object: any, key: string ): string | undefined {
  key = key.replace( /\[(\w+)\]/g, ".$1" ); // convert indexes to properties
  key = key.replace( /^\./, "" ); // strip a leading dot
  const a = key.split( "." );
  for ( let i = 0, n = a.length; i < n; ++i ) {
    const k = a[i];
    if ( isObject( object ) && k in object ) {
      object = object[k];
    } else {
      return;
    }
  }
  return object;
}

/**
 * Function to check if the object is an object
 * @param obj - Object to check
 * @returns {boolean} - Returns true if the object is an object
 * @example <caption>Example usage of isObject</caption>
 * isObject({}) // returns true
*/
function isObject( obj: any ): boolean {
  return obj === Object( obj );
}

/**
 * Function to convert the type of files to be accepted
 * @param fileType - File types to be checked
 * @returns {string} - Required file formats
 * @example <caption>Example usage of fileTypesToAccept</caption>
 * fileTypesToAccept("jpg") // returns ['.jpg', '.jpeg']
 * fileTypesToAccept("csv") // returns ['.csv', '.xlsx']
 */
export const fileTypesToAccept = ( fileType: string ):string[] => {
  const icon = (( ext ) => {
    switch ( ext ) {
    case "jpg":
    case "jpeg":
      return [ ".jpg", ".jpeg" ];
    case "csv":
    case "xlsx":
      return [ ".csv", ".xlsx" ];
    case "others":
      return [""];
    default:
      return [ext];
    }
  })( fileType.toLowerCase());
  return icon;
};

/**
 * Simple Function to remove white spaces from a string
 * @param string - The main string from which to remove the white spaces
 * @returns {string} - Returns string without white spaces.
 * @example <caption>Example usage of removeWhiteSpaces</caption>
 * removeWhiteSpaces("Hello World") // returns 'HelloWorld'
 */
export const removeWhiteSpaces = ( input: string ): string => {
  if ( !input ) {
    return "";
  }
  const data = input.replaceAll( /\s/g, "" );
  return data;
};

/**
 * method to compare two strings with regex case sensitivity
 * @param {string} str1 string to compare with, can be a regex string also
 * @param {string} str2 string to compare
 * @param {boolean} caseSensitive
 * @returns {boolean}
 */
export const regexCompareStrings = ( str1: string, str2: string, caseSensitive = false ): boolean => {
  if ( !str2 ){
    return false;
  }
  const regex = new RegExp( str1, caseSensitive ? "g" : "gi" );
  return regex.test( str2 );
};

/**
 * Function to mask region and accountId values of AWS ARN
 * @param arn - AWS ARN to mask
 * @returns {string} - masked AWS ARN
 */
export const maskAwsArn = ( arn: string ): string => {
  if ( !arn ) {
    return arn;
  }

  const arnParts = arn.split( ":" );
  if ( arnParts.length < 6 ) {
    return arn;
  }
  arnParts[3] = "*****";
  arnParts[4] = "************";
  return arnParts.join( ":" );
};