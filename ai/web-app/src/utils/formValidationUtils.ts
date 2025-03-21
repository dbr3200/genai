import { TFunctionResult } from "i18next";
import i18n from "../i18n";
import {
  MAX_DESCRIPTION_CHARS,
  REGEX_VALID_FULLNAME,
  REGEX_VALID_EMAIL,
  REGEX_VALID_PASSWORD,
  REGEX_VALID_URL_GENERAL,
  REGEX_VALID_URL_HTTPS,
  REGEX_VALID_URL_WWW,
  REGEX_CRON_PATTERN,
  REGEX_VALID_DOMAIN_NAME
} from "../constants";

export const ComposeValidators = ( ...validators: Array<( ...args: any[]) => any> ) => ( value?: number | string | Date | string[]) =>
  validators.reduce(( error, validator ) => error || validator( value ), undefined );

export const ComparePassword = ( testValue?: string | number ) => ( value?: string | number ): TFunctionResult | undefined =>
  testValue !== value ? i18n.t( "validationMessages.pwdMustBeSame" ) : undefined;

export const Validate_Number = ( val:string, min?:number, max?:number ): boolean => {
  if ( !isNaN( val as any ) || val.length === 0 ) {
    if ( min ){
      if ( parseInt( val, 10 ) < min ) {
        return false;
      }
    }
    if ( max ) {
      if ( parseInt( val, 10 ) > max ) {
        return false;
      }
    }
    return true;
  } else {
    return false;
  }
};

/** Checks a finite string value only. Only for string values */
export const Validate_Required = ( label: string ) => ( value?: unknown ): string | undefined => {
  const returnValue = undefined;
  if ( typeof value === "string" && value?.trim()?.length > 0 ) {
    return returnValue;
  } else if ( typeof value === "boolean" && [ true, false ].includes( value )) {
    return returnValue;
  } else if ( typeof value === "number" && !isNaN( value )) {
    return returnValue;
  } else if ( Array.isArray( value ) && value.length > 0 ) {
    return returnValue;
  } else if ( value instanceof Date ) {
    return returnValue;
  } else {
    return i18n.t( "validationMessages.required", { label });
  }
};

export const Validate_Unique_Columns = ( columnList: string[]) => ( value:string ): string | undefined => {
  const isColumnPresent = columnList.filter(( el: any ) => el === value ).length === 2;
  if ( isColumnPresent ){
    return "Duplicate key Name";
  }
  return undefined;
};

//Added a domain validator function
export const Validate_Domain_Name = ( value?: string | string[] | null ): string | undefined => {
  if ( value && typeof value === "string" && !REGEX_VALID_DOMAIN_NAME.test( value )) {
    return "Invalid domain name";
  } else if ( Array.isArray( value ) && value.length > 0 ) {
    const invalidDomains = value.map(( domain ) => {
      if ( !REGEX_VALID_DOMAIN_NAME.test( domain )) {
        return domain;
      }
    })?.filter( val => val );
    if ( invalidDomains.length > 0 ) {
      return `Invalid domain name(s) - [ ${invalidDomains.join( "," )} ]`;
    }
  }
};

export const Validate_OTP_Length = ( otpLength: number ) => ( value?: string | null ): string | undefined => {
  if ( value?.length !== otpLength ) {
    return i18n.t( "validationMessages.completeOTP" );
  }
};

export const Validate_Length = ( min?: number, max?: number ) => ( label: string ) => ( value?: string ): string | undefined => {
  if ( typeof value !== "undefined" ) {
    if ( typeof min !== "undefined" && typeof max === "undefined" && ( value.length < min )) {
      return i18n.t( "validationMessages.minLength", { min, label });
    } else if ( typeof max !== "undefined" && typeof min === "undefined" && ( value.length > max )) {
      return i18n.t( "validationMessages.maxLength", { max, label });
    } else if ( typeof min !== "undefined" && typeof max !== "undefined" && ( value.length < min || value.length > max )) {
      return i18n.t( "validationMessages.length", { min, max, label });
    }
  }
};

export const Validate_SelectedOptionsCount = ( min?: number, max?: number ) => ( label: string ) => ( value?: any[]): string | undefined => {
  if ( typeof value !== "undefined" && Array.isArray( value )) {
    if ( typeof min !== "undefined" && typeof max === "undefined" && ( value.length < min )) {
      return i18n.t( "validationMessages.minSelection", { min, label });
    } else if ( typeof max !== "undefined" && typeof min === "undefined" && ( value.length > max )) {
      return i18n.t( "validationMessages.maxSelection", { max, label });
    } else if ( typeof min !== "undefined" && typeof max !== "undefined" && ( value.length < min || value.length > max )) {
      return i18n.t( "validationMessages.between", { min, max, label });
    }
  }
};

export const Validate_Starts_With_Alphabet = ( label: string ) => ( value: string ): string | undefined => {
  if ( /^[^a-zA-Z]{1}/.test( value )) {
    return i18n.t( "validationMessages.mustStartWithAlphabet", { label });
  }
};

export const Validate_Alphanumeric_With_Special_Chars = ( specialChars: string ) => ( label: string ) => ( value: string ): string | undefined => {
  const expression = new RegExp( `^[a-zA-Z0-9${specialChars}]+$` );
  if ( !expression.test( value )) {
    return i18n.t( "validationMessages.alphanumericWithSpecialChars", { specialChars, label });
  }
};

export const Validate_No_Space = ( label: string ) => ( value: string ): string | undefined => {
  if ( /[\s]/.test( value )) {
    return i18n.t( "validationMessages.noSpace", { label });
  }
};

export const Validate_MFA_Code = ( codeLength: number ) => ( value: string ): string | undefined => {
  const exp = `^[0-9]{${codeLength}}$`;
  const regex = new RegExp( exp );
  if ( value && !regex.test( value )) {
    return i18n.t( "validationMessages.invalidCode" );
  }
};

/** Check for a Filled Array finiteness only. Only for Array of Strings(or Objects) */
export const Validate_MultiSelect_Required = ( label: string ) =>
  ( value?: string[] | null ): string | undefined => {
    if ([ "null", "undefined" ].includes( typeof value ) || value?.length === 0 ) {
      return i18n.t( "validationMessages.required", { label });
    }
    return undefined;
  };

// TO-DO - change this validation method according to current lib
/** Check for a valid Date-time from Datepicker component only. Input is a date-time string/array (curr. react- library) */
export const Validate_Required_DateTime =
  ( value: any ): string | void =>
    Validate_Required( "Date/Time" )( value );

/** Check for a valid Date-time from Datepicker component only. Input is a date-time string/array. */
export const Validate_Current_DateTime =
( value: any ): string | void => {
  if ( value > Date.now()) {
    return "Date must be lower than the current date and time.";
  }
};

/** Checks for a number to be positive(greater than 0) and real number. Input is a number */
export const Validate_OnlyRealNumbers = ( value: number ): string | undefined => {
  if ( isNaN( Number( value ))) {
    return "Must be a number";
  } else {
    if ( Number( value ) < 0 ) {
      return "Negative values not allowed";
    } else if ( Number( value ) % 1 > 0 ) {
      return "Decimal values not allowed";
    }
  }
};

export const Validate_NumbersWithoutExponent = ( value: number ): string | undefined => {
  if ( isNaN( Number( value ))) {
    return "Must be a number";
  } else if ( value.toString().split( "" ).includes( "e" )) {
    return "Numbers with 'e' (exponent) not allowed";
  }
};

/** Checks for a value in between a number range only
* Both start and stop numbers are included.
* Input ('value'), 'Start' and 'Stop' are strictly Numbers datatype.
* Returns a function (closure) which in turn returns the actual validation result
 */
export const Validate_NumberRange = ( min = 0, max = Number.MAX_SAFE_INTEGER ) => {
  if ( !max || typeof max !== "number" || typeof min !== "number" ) {
    return ( f: any ) => f;
  }

  return ( value?: number | string ) => {
    if ( value !== 0 && !value ) {
      return;
    }
    return ( !isNaN( Number( value )) && Number( value ) >= min && Number( value ) <= max ) ?
      undefined : `value must be between ${min}-${max} only`;
  };

};

export const Validate_OpenNumberRange = ( limit = 0, rangeType: "gte" |"gt" | "lte" | "lt" = "gte" )
: (( value?: number | string ) => string | undefined ) | (() => void ) => {
  if ( !limit || typeof limit !== "number" ) {
    return (() => undefined );
  }

  return ( value?: number | string ) => {
    const emptyEntry = ( value !== 0 && !value );
    if ( emptyEntry ){
      return;
    }
    const invalidEntry = isNaN( Number( value ));
    if ( invalidEntry ) {
      return "Must be a number";
    }

    switch ( rangeType ){
    case "gte": {
      return Number( value ) >= limit ? undefined : `value must be greater or equal to ${limit}`;
    }
    case "gt":{
      return Number( value ) > limit ? undefined : `value must be greater than ${limit}`;
    }
    case "lte":{
      return Number( value ) <= limit ? undefined : `value must be lesser or equal than ${limit}`;
    }
    case "lt": {
      return Number( value ) < limit ? undefined : `value must be lesser than ${limit}`;
    }
    default:{
      return undefined;
    }
    }
  };

};

/** Checks if a string is within limit defined. Input 'value' must be a string */
export const Validate_MaxChars = ( value?: string ): string | undefined => {
  if ( value && value.length > MAX_DESCRIPTION_CHARS ) {
    return "Exceeds allowed max character length of 500";
  }
};

export const Validate_URL = ( value: string ): string | undefined => {
  if ( !value.match( REGEX_VALID_URL_GENERAL )) {
    return "Invalid URL";
  }
};

export const Validate_URL_HttpsOnly = ( value: string ): string | undefined => {
  if ( !value.match( REGEX_VALID_URL_HTTPS )) {
    if ( !/^(https:){1}/.test( value )) {
      return "https Protocol Required";
    } else {
      return "Invalid URL";
    }
  }
};

export const Validate_URL_WwwOnly = ( value: string ): string | undefined => {
  if ( !value.match( REGEX_VALID_URL_WWW )) {
    if ( !/^(www\.){1}/.test( value )) {
      return "URL must start only with www Protocol";
    } else {
      return "Invalid URL";
    }
  }
};

/** Resource Name,Cron & Rate Expression validators, ARN Certificates */
export const Validate_Cron_Pattern = ( value: string ): string | undefined => {
  REGEX_CRON_PATTERN.lastIndex = 0;
  if ( !REGEX_CRON_PATTERN.test( value )) {
    return "Invalid Expression";
  }
};

export const Validate_FullName = ( value: string ): string | undefined => {
  if ( !REGEX_VALID_FULLNAME.test( value )) {
    return i18n.t( "validationMessages.cannotContainSpecialChars" );
  }
};

export const Validate_Email = ( value: string ): string | undefined => {
  if ( !REGEX_VALID_EMAIL.test( value )) {
    return i18n.t( "validationMessages.invalidEmailAddrFormat" );
  }
};

export const Validate_Password = ( value?: string ): string | undefined => {
  if ( value && !REGEX_VALID_PASSWORD.test( value )) {
    return i18n.t( "validationMessages.pwdDoesntMeetReq" );
  }
};

export const Validate_Gen_ResorurceName_Pattern = ( value: string ): string | undefined => {
  if ( !/^[a-zA-Z][a-zA-Z0-9_]{2,49}$/g.test( value )) {
    if ( !/^.{3,50}$/.test( value )) {
      return "Name must be 3-50 characters";
    } else if ( !/^[a-zA-Z]/.test( value )) {
      return "Name must start with an alphabet character";
    } else {
      return "Name can contain underscore (_) & alpha-numeric characters only";
    }
  }
};

export const Validate_UserName_Pattern = ( value: string ): string | undefined => {
  if ( !/^[a-z][a-z0-9]{4,19}$/g.test( value )) {
    if ( !/^.{5,20}$/.test( value )) {
      return i18n.t( "validationMessages.usernameMustBeCharsLong" );
    } else if ( !/^[a-z]/.test( value )) {
      return i18n.t( "validationMessages.usernameMustStartWithLower" );
    } else if ( !/^[A-Z]*$/.test( value )) {
      return i18n.t( "validationMessages.alphanumericLowerChars" );
    }
  }
};

export const Validate_Underscore_Hyphen_Name_Pattern = ( value: string ): string | undefined => {
  if ( !/^[a-zA-Z][a-zA-Z0-9_-]{2,49}$/g.test( value )) {
    if ( !/^.{3,50}$/.test( value )) {
      return "Name must be 3-50 characters";
    } else if ( !/^[a-zA-Z]/.test( value )) {
      return "Name must start with an alphabet character";
    } else {
      return "Name can contain alpha-numeric, Hyphen(-) and underscore(_) characters only";
    }
  }
};

export const Validate_Redshift_ScheduleName_Pattern = ( value: string ): string | undefined => {
  if ( !/^[a-z][a-z0-9-]{2,63}$/g.test( value )) {
    if ( !/^.{3,63}$/.test( value )) {
      return "Schedule name must be 3-63 characters";
    } else if ( !/^[a-z]/.test( value )) {
      return "Schedule name must start with an alphabet character";
    } else {
      return "Schedule name can contain hyphen (-) & lower-case alpha-numeric characters only";
    }
  }
};

/* ResourceName validators */

const RegexValidator = ( regExLiterals: Record<string, any> = {}, value: string ) => {
  if ( Validate_Required( "" )( value ) === i18n.t( "validationMessages.required" )) {
    return "Required";
  } else {
    const { initAlpha = true, allowChars = "", min = 0, max = 100000 } = regExLiterals;
    const initAlphaCheck = new RegExp( /^[a-zA-Z]/ );
    const lengthCheck = new RegExp( `^.{${min},${max}}$`, "g" );
    const regexCheck = new RegExp( `^${initAlpha ? "[a-zA-Z]" : ""}[a-zA-Z0-9${allowChars}]{${initAlpha ? min - 1 : min},${max}}$`, "g" );
    if ( !regexCheck.test( value )) {
      if ( !lengthCheck.test( value )) {
        return "Must be 3-50 characters";
      } else if ( initAlpha && !initAlphaCheck.test( value )) {
        return "Must start with an alphabet character";
      } else {
        return `Must have ${[ "alpha-numeric",
          allowChars.split( "" ).join( ", " )
            .replace( "-", "Hyphen (-)" )
            .replace( "_", "Underscore (_)" )
        ].join( ", " )} characters only`;
      }
    }
  }
  return undefined;
};

export const Alphanumeric_Underscore_3_50 =
  ( value: string ) => RegexValidator({ allowChars: "_", min: 3, max: 50 }, value );
export const Alphanumeric_Hyphen_3_50 =
  ( value: string ) => RegexValidator({ allowChars: "-", min: 3, max: 50 }, value );

/* COLUMN VALIDATIONS */

export const Validate_ColumnType = ( colType: string ): string | undefined => {
  if ( !colType || !colType.trim() || colType.length === 0 ) {
    return "Required";
  }
};

export const Validate_ColumnName = ( colName: string, { DatasetSchema }: any ): string | undefined => {
  const ColumnNames = DatasetSchema.filter(( el: any ) => el.name ).map(( el: any ) => el.name );
  if ( !colName || !colName.trim()) {
    return "Required";
  } else if ( !/^[a-zA-Z0-9_]{1,50}$/.test( colName )) {
    return "Column name must be 1-50 alphanumeric characters, _ is allowed. Must start with an alphabetic character only";
  } else if ( !/^[a-zA-Z]/.test( colName )) {
    return "Column name must start with an alphabetic character";
  } else if ( ColumnNames.filter(( el: any ) => el === colName ).length > 1 ) {
    return "Duplicate Column Name";
  }
};

export const Validate_JDBC_URL_Format = ( value: string ): string | undefined => {
  if ( !( /^(jdbc:)[a-zA-Z0-9_\-.]+(:)([a-zA-Z]+:)?(@)?(?<Slash>\/\/)?[a-zA-Z0-9._\-\\]+(:)[0-9]+((\k<Slash>)(:)|(\/))?((;)?[a-zA-z0-9._\-=]+){0,1}$/g )
    .test( value )) {
    return i18n.t( "validationMessages.invalidJdbcUrlFormat" );
  }
};

export const Validate_S3_Bucket_Name = ( value: string ): string | undefined => {
  if ( !( /(?!^(\d+\.)+\d+$)(^(([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9-]*[a-z0-9])$)/g ).test( value )) {
    return i18n.t( "validationMessages.invalidBucketName" );
  }
};

export const Validate_Access_Key_Format = ( value: string ): string | undefined => {
  if ( !( /^[A-Z0-9]{20}$/g ).test( value )) {
    return i18n.t( "validationMessages.invalidAccessKeyFormat" );
  }
};

export const Validate_Secret_Key_Format = ( value: string ): string | undefined => {
  if ( !( /^[A-Za-z0-9/+=]{40}$/g ).test( value )) {
    return i18n.t( "validationMessages.invalidSecretKeyFormat" );
  }
};

export const Validate_Range = ( min: number, max: number ) => ( label: string ) => ( value?: string ): string | undefined => {
  if ( !value ){
    return;
  }
  const num = !isNaN( parseInt( value, 10 )) ? parseInt( value, 10 ) : NaN;
  const validNum = num === 0 || !isNaN( num );
  if ( !validNum || num < min || num > max ) {
    return i18n.t( "validationMessages.numberRange", { label, min, max });
  }
};

export const Validate_EscapeCars = ( value:string ): string | undefined => {
  if ( value && ( /[/\\]/g ).test( value )){
    return "'/', '\\' chars not allowed";
  }
};

export const Validate_ColumnNameOnly = ( colName:string ): string | undefined => {
  if ( colName ){
    if ( !/^[a-zA-Z0-9_]{1,64}$/.test( colName )) {
      return "Column name must be 1-64 alphanumeric characters, _ is allowed";
    } else if ( !/^[a-zA-Z]/.test( colName )) {
      return "Column name must start with an alphabetic character";
    }
  }
};

export const Validate_JSON = ( value: string ): boolean => {
  try {
    JSON.parse( value );
    return true;
  } catch ( e ) {
    return false;
  }
};

export const Validate_Ascii_Single_Char = ( value: string ): string | undefined => {
  // eslint-disable-next-line no-control-regex
  if ( !( /[\x00-\x7F]/gm ).test( value )) {
    return `${value} is not a valid ascii character`;
  }
};

export const Validate_IP_V4 = ( ip:string[]): string | undefined => {
  let allValuesValid = true;
  let inValidIP = "";
  // eslint-disable-next-line max-len, no-useless-escape
  const pattern = new RegExp( "^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$" );
  ip.forEach(( d ) => {
    allValuesValid = pattern.test( d );
    if ( !pattern.test( d )){
      inValidIP = d;
    }
  });
  if ( !allValuesValid ){
    return `${inValidIP} is invalid IPV4 address`;
  }
};
export const Validate_IP_V6 = ( ip:string[]): string | undefined => {
  let allValuesValid = true;
  let inValidIP = "";
  // eslint-disable-next-line max-len, no-useless-escape
  const pattern = new RegExp( "(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))" );
  ip.forEach(( d ) => {
    allValuesValid = pattern.test( d );
    if ( !pattern.test( d )){
      inValidIP = d;
    }
  });
  if ( !allValuesValid ){
    return `${inValidIP} is invalid IPV6 address`;
  }
};

export const Validate_UploadPath_Required = ( validationMsg: string ) => ( value?: unknown ): string | undefined => {
  const returnValue = undefined;
  if ( typeof value === "string" && value?.trim()?.length > 0 ) {
    return returnValue;
  } else {
    return validationMsg;
  }
};