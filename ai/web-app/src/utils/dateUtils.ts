import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import customParseFormat from "dayjs/plugin/customParseFormat";
import "dayjs/locale/ar";

dayjs.extend( relativeTime );
dayjs.extend( utc );
dayjs.extend( timezone );
dayjs.extend( customParseFormat );

export const DefaultTimestampFormat = "DD MMM, YYYY hh:mm A";
export const AllMonths = [ "January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December" ];
export const AllDays = [ "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday" ];

// ------------------------------------------------------------------------------------------------------------------------------------------------------
/*  VERY IMP README (5mins read):
    This note is very important while reconciling in-between UTC and local times with clarity and writting helper utils accurately.
    Difference in-between any value passed to dayjs() & dayjs.utc(), i.e. ['foo' as in `dayjs(foo)` OR `dayjs.utc(foo)`] :
*/
/*
    CASE 1:
    IF `foo` has UTC information [Ex.'Z'(ISO format), JS Date format (new Date()), unix-date/epoch (ticks)] is PRESENT :
    `dayjs(foo)` will churn-out an object with time in users browser timezone, BUT THIS IS CALCULATED from the passed UTC offset internally.
    Meaning, all `dayjs(foo).format(<string>)` will display local time only while
    the `dayjs(foo).toISOString()` will be the represent the time of `foo` itself as originally passed.
    And if any value passed to `dayjs.utc(foo)`, it is treated as UTC time by default and `dayjs.utc(foo).format(<string>)`
    will give only UTC values of the passed `foo`. No local values.
    Ex. uncomment and try this snippet below to see the contrast : (with UTC info)
    console.log( dayjs("2020-01-20T08:37:57.000Z").format(DefaultTimestampFormat), dayjs.utc("2020-01-20T08:37:57.000Z").format(DefaultTimestampFormat)  )
*/
/*
    CASE 2:
    IF the UTC information is ABSENT in `foo` [i.e. its a random string in some format] :
    `dayjs(foo)` returns an object whose time is ASSUMED to be local browser time. The corresponding UTC time is calculated internally but not displayed.
    Meaning, The `dayjs(foo).toISOString()` is different from the time instance that `foo` represents.
    And if the value is passed to `dayjs.utc(foo)` it is treated as UTC time by default and `dayjs.utc(foo).format(<string>)`
    will produce the passed value of `foo` itself. To get the local value it has to be put through `.local()`
    Ex. uncomment and try this snippet below to see the contrast : (No UTC info)
    console.log(dayjs("2020-01-20 08:37:57").format(DefaultTimestampFormat), dayjs.utc("2020-01-20 08:37:57").format(DefaultTimestampFormat))
*/
/*
    In short, we can say from documentation :
    -> By default, Day.js parses and displays in local time.
    -> If you want to parse or display in UTC, you can use dayjs.utc() instead of dayjs().
        Methods:
        dayjs.utc dayjs.utc(dateType?: string | number | Date | Dayjs, format? string)
        Returns a Dayjs object in UTC mode.
        Use UTC time .utc()
        Returns a cloned Dayjs object with a flag to use UTC time.
        Use local time .local()
        Returns a cloned Dayjs object with a flag to use local time.
        isUTC mode .isUTC()
        Returns a boolean indicating current Dayjs object is in UTC mode or not.
*/
// ------------------------------------------------------------------------------------------------------------------------------------------------------

const getResponseDatetimeFormat = ( datetime: string ) => {
  switch ( true ) {
  case /\.\d{2,}$/.test( datetime ):
    return "YYYY-MM-DD HH:mm:ss.SSS";
  case /:\d{2}/.test( datetime ):
    return "YYYY-MM-DD HH:mm:ss";
  default:
    return "YYYY-MM-DD HH:mm:ss";
  }
};

// Since this util is mostly used to convert UTC dates incoming from server to local ones ,
// the mode of parsing `dateValue` is defaulted to be UTC.
export const convertToLocalTime = (
  dateValue: string | number | dayjs.Dayjs | Date | null | undefined,
  formatString = DefaultTimestampFormat,
  type = "absolute" ): string => {

  if ( !dateValue ) {
    return "";
  }
  //utc-parsing mode then converting to local object
  const receivedTime = /^\d{10}$/.test( dateValue as string )
    ? dayjs.unix( Number( dateValue ))
    : dayjs.utc( dateValue, getResponseDatetimeFormat( dateValue as string ) || undefined ).local();
  if ( type === "relative" ) {
    return receivedTime.fromNow();
  } else {
    return receivedTime.format( formatString );
  }
};
// Since this util is mostly used to convert local dates to UTC ones and pass to server,
//  the mode of parsing `dateValue` is defaulted to be local.
export const convertToUTCTime = (
  dateValue: string | number | dayjs.Dayjs | Date | null | undefined,
  formatString = DefaultTimestampFormat ): string => {
  if ( !dateValue ) {
    return "";
  }
  //local-parsing mode then converting to utc object
  const receivedTime = dayjs( dateValue ).utc();
  // Since ISO is a standard format to be passed to server, it stands out as a built-in format.
  return formatString === "iso" ? receivedTime.toISOString() : receivedTime.format( formatString );
};
// Coversion to ISO format can happen under any use-case, hence it's important to
// check the `mode` of conversion. It is defaulted to `local` but can be utc on-demand.
// Truncating the Zulu ( `Z` ) from the end of the string must be avoided if passing to server.
export const toISOFormat = (
  datetime: string | number | dayjs.Dayjs | Date | null | undefined,
  mode = "local",
  truncateZ = true ): string | undefined => {
  if ( !validateTimestamp( datetime )) {
    return;
  }
  const parsedDate = ( mode === "utc" ) ? dayjs.utc( datetime ) : dayjs( datetime );
  const parsedISODate = parsedDate.toISOString();
  return truncateZ ? parsedISODate.slice( 0, -1 ) : parsedISODate;
};
export const validateTimestamp = ( dateValue: string | number | dayjs.Dayjs | Date | null | undefined ): boolean => {
  if ( typeof dateValue === "undefined" ) {
    return false;
  }
  try {
    return dayjs( dateValue ).isValid();
  } catch ( ex ) {
    return false;
  }
};
export const sortTimestamps = (
  a: string | number | dayjs.Dayjs | Date | null | undefined,
  b: string | number | dayjs.Dayjs | Date | null | undefined, order = "desc" ): 1 | 0 | -1 => {
  if ( validateTimestamp( a ) && validateTimestamp( b )) {
    return order === "desc" ? (( dayjs( b ).isAfter( dayjs( a ))) ? 1
      : ( dayjs( a ).isAfter( dayjs( b )) ? -1 : 0 ))
      : (( dayjs( a ).isAfter( dayjs( b ))) ? 1
        : ( dayjs( b ).isAfter( dayjs( a )) ? -1 : 0 ));
  } else {
    return 0;
  }
};
export const toMoment = (
  dateValue: string | number | dayjs.Dayjs | Date | null | undefined,
  type: "obj" | "epoch" = "obj",
  formatString = "none" ): string | number | dayjs.Dayjs => {
  const momentObj = dateValue ? dayjs( dateValue ) : dayjs();
  return type === "epoch" ? momentObj.valueOf() : ( formatString === "none" ? momentObj : momentObj.format( formatString ));
};
export const findDuration = (
  from: string | number | dayjs.Dayjs | Date | null | undefined,
  to: string | number | dayjs.Dayjs | Date | null | undefined,
  format = "mins", float = true ): number => {
  if ( validateTimestamp( from ) && validateTimestamp( to )) {
    switch ( format ) {
    case "ms":
      return dayjs( from ).diff( dayjs( to ), "ms", float );
    case "secs":
      return dayjs( from ).diff( dayjs( to ), "s", float );
    case "mins":
      return dayjs( from ).diff( dayjs( to ), "m", float );
    case "hrs":
      return dayjs( from ).diff( dayjs( to ), "h", float );
    case "days":
      return dayjs( from ).diff( dayjs( to ), "d", float );
    case "month":
      return dayjs( from ).diff( dayjs( to ), "M", float );
    default:
      return dayjs( from ).diff( dayjs( to ), "m", float );
    }
  } else {
    return 0;
  }
};
export const monthsAsOptions = AllMonths.map(( month, index ) =>
  ({ value: dayjs().set( "month", index ).format( "MM" ), label: month }));

export const yearsAsOptions = [
  { value: dayjs().subtract( 1, "year" ).format( "YYYY" ), label: dayjs().subtract( 1, "year" ).format( "YYYY" ) },
  { value: dayjs().format( "YYYY" ), label: dayjs().format( "YYYY" ) }
];

export const operateOnTimestamp = (
  dateValue: string | number | dayjs.Dayjs | Date | null | undefined,
  operationType = "add",
  value = 0,
  periodType: dayjs.ManipulateType = "m" ): dayjs.Dayjs | undefined => {
  if ( validateTimestamp( dateValue )) {
    const dateObj = dayjs( dateValue );
    switch ( operationType ) {
    case "add":
      return dateObj.add( value, periodType );
    case "subtract":
      return dateObj.subtract( value, periodType );
    default:
      return dateObj.add( value, periodType );
    }
  } else {
    return undefined;
  }
};
export const convertAmporphicDateToLocalJSDate = ( dateValue: string ): Date | undefined => {
  if ( validateTimestamp( dateValue )){
    return ( new Date( dateValue.replace( " ", "T" ).concat( "Z" )));
  } else {
    return undefined;
  }
};

export const xDaysFromNow = ( x: number ): Date => {
  // Create new Date instance
  const date = new Date();
  // Add x days
  date.setDate( date.getDate() + x );
  return date;
};

export const xDaysBeforeNow = ( x: number ): Date => {
  // Create new Date instance
  const date = new Date();
  // Add x days
  date.setDate( date.getDate() - x );
  return date;
};

export const configureDayJSLocale = ( lang:string ):void => {
  dayjs.locale( lang );
};