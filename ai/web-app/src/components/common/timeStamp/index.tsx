// libraries
import React, { useReducer } from "react";
import { ADPIcon } from "@amorphic/amorphic-ui-core";
import advanced from "dayjs/plugin/advancedFormat";
import { rawTimeZones } from "@vvo/tzdb";
import dayjs from "dayjs";
import clsx from "clsx";

// methods / hooks / constants / styles
import { timeZoneType } from "./types";
import { useUserPreferences } from "../../../utils/hooks";
import styles from "./timeStamp.module.scss";

dayjs.extend( advanced );

interface TimestampProps {
    /**
     *  Date string to be formatted for display
     */
    rawDate: string | number | dayjs.Dayjs | Date | null | undefined;
    /**
     * Time format to display hours in either am/pm or 24 hours
     * @default standard
    */
    timeFormat?: 12 | 24 | "standard" | "military";
    /**
     * Time zone preference
     * @default UTC
     */
    timeZone?: timeZoneType;
    /**
     * Type of time to display either exact date or time difference relative from present
     * @default relative
     */
    timeDisplay?: "relative"|"absolute";
    /**
      * Whether to allow user to toggle between relative and absolute time displays
      * @default true
      */
    toggleDisplay?: boolean;
    /**
      * Display timezone information
      * @default true
      */
     displayTimeZoneInfo?: boolean;
      /**
      * Hide the prefixed icon
      * @default false
      */
     hideIcon?: boolean;
     /**
      * Size of the icon
      * @default xs
      */
     icon?: "xxs" | "xs" | "sm" | "md" | "lg" | "xl";
}

const replaceGMTInfo = ( datetime: string, adjustedTimeZone?: string ): string => {
  if ( datetime.includes( "GMT" )) {
    const abbreviatedTimeZone = rawTimeZones.find(({ name }) => name === adjustedTimeZone )?.abbreviation;
    if ( abbreviatedTimeZone ){
      const stripGMTInfo = datetime.replace( /(GMT).*$/g, "" );
      return `${stripGMTInfo} ${abbreviatedTimeZone}`;
    }
    return datetime;
  }
  return datetime;
};

function TimeStampButton ({
  rawDate,
  timeFormat,
  timeDisplay,
  timeZone,
  toggleDisplay = true,
  displayTimeZoneInfo = true,
  hideIcon = false
}: TimestampProps ): JSX.Element {
  const {
    timeFormat: PreferencesTimeFormat = "standard",
    timeDisplay: PreferencesTimeDisplay = "relative",
    timeZone: PreferencesTimeZone
  } = useUserPreferences();

  const hourPattern = [ 12, "12", "standard" ].includes( timeFormat ?? PreferencesTimeFormat ) ? "hh:mm a" : "HH:mm";
  const adjustedTimeZone = timeZone ?? PreferencesTimeZone;
  const adjustedTime = ( timeZone ?? PreferencesTimeZone ) ? dayjs.utc( rawDate ).tz( timeZone ?? PreferencesTimeZone ) : dayjs.utc( rawDate ).local();

  const [ isRelativeTime, toggleDisplayType ] = useReducer(( s ) => !s, ( timeDisplay ?? PreferencesTimeDisplay ) === "relative" );

  return <button className={clsx(
    styles.timeStampBtn,
    { "cursor-auto": !toggleDisplay },
    "disabled:opacity-[unset]"
  )} onClick={toggleDisplayType} disabled={!toggleDisplay} >
    {!hideIcon && <ADPIcon size="xs" icon={isRelativeTime ? "time" : "scheduled"} />}
    <time dateTime={`${adjustedTime}`}>
      { isRelativeTime
        ? `${dayjs().to( adjustedTime )}`
        : replaceGMTInfo(
          `${adjustedTime.format( `MMM DD, YYYY ${hourPattern} ${displayTimeZoneInfo ? "z" : ""}` )}`,
          adjustedTimeZone
        )}
    </time>
  </button>;
}

export const TimeStampComponent = ( props: TimestampProps ): JSX.Element => {
  if ( !props.rawDate || !dayjs( props.rawDate ).isValid()){
    return <span className="flex items-center gap-2">
      <ADPIcon icon="warning" size="xs" />{" "}Invalid Date
    </span>;
  } else {
    return <TimeStampButton {...props} />;
  }
};

export const TimeStamp = React.memo( TimeStampComponent );

export default TimeStamp;
