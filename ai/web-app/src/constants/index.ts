export const mfaConstants = {
  mandatory: "MANDATORY",
  optional: "OPTIONAL",
  off: "OFF"
} as const;

/* eslint-disable */
  export const REGEX_VALID_BUCKET = new RegExp(/(?!^(\d+\.)+\d+$)(^(([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])\.)*([a-z0-9]|[a-z0-9][a-z0-9\-]*[a-z0-9])$)/g);
  export const REGEX_VALID_ACCESS_KEY = new RegExp(/^[A-Z0-9]{20}$/g);
  export const REGEX_VALID_SECRET_KEY = new RegExp(/^[A-Za-z0-9\/+=]{40}$/g);
  export const REGEX_VALID_URL_GENERAL =
    new RegExp(/^(http:\/\/www\.|https:\/\/www\.|http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/);
  export const REGEX_VALID_URL_HTTPS = new RegExp(/^(https:\/\/www\.|https:\/\/)[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/);
  export const REGEX_VALID_URL_WWW = new RegExp(/^(www\.){1}[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/);
  //domain/subdomain limit has been set to 1000. Can be increased if needed.
  export const REGEX_VALID_DOMAIN_NAME = new RegExp(/^((http|https):\/\/)?[a-zA-Z0-9]{1}[a-zA-Z0-9-.]{1,1000}[a-zA-z0-9]\.[a-zA-Z]{2,}$/)
  export const REGEX_CRON_PATTERN = new RegExp (/^((cron\(\s*($|#|\w+\s*=|(\*|(?:[0-5]?\d)(?:(?:-|\/|\,)(?:[0-5]?\d))?(?:,(?:[0-5]?\d)(?:(?:-|\/|\,)(?:[0-5]?\d))?)*)\s(\*|(?:[01]?\d|2[0-3])(?:(?:-|\/|\,)(?:[01]?\d|2[0-3]))?(?:,(?:[01]?\d|2[0-3])(?:(?:-|\/|\,)(?:[01]?\d|2[0-3]))?)*)\s(\?|\*|(?:L)?|(?:0?[1-9]|[12]\d|3[01])(?:(?:-|\/|\,)(?:0?[1-9]|[12]\d|3[01]))?(?:W)?(?:,(?:0?[1-9]|[12]\d|3[01])(?:(?:-|\/|\,)(?:0?[1-9]|[12]\d|3[01]))?(?:W)?)*)\s(\*|(?:[1-9]|1[012])(?:(?:-|\/|\,)(?:[1-9]|1[012]))?(?:,(?:[1-9]|1[012])(?:(?:-|\/|\,)(?:[1-9]|1[012]))?)*|\*|(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(?:-)(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))?(?:,(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:(?:-)(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC))?)*)\s(\?|\*|(?:[1-7])?(?:L)?|(?:[1-7])(?:((?:-|\,)(?:[1-7])|(?:#)(?:[1-5])))?(?:,(?:[1-7])(?:((?:-|\,)(?:[1-7])))?)*|\?|\*|(?:MON|TUE|WED|THU|FRI|SAT|SUN)(?:(?:-)(?:MON|TUE|WED|THU|FRI|SAT|SUN))?(?:,(?:MON|TUE|WED|THU|FRI|SAT|SUN)(?:(?:-)(?:MON|TUE|WED|THU|FRI|SAT|SUN))?)*)\s(\*|(?:2019|(20[2-9]|21[0-9])[0-9])(?:(?:-|\/|\,)(?:2019|(20[2-9]|21[0-9])[0-9]))?(?:,(?:2019|(20[2-9]|21[0-9])[0-9])(?:(?:-|\/|\,)(?:2019|(20[2-9]|21[0-9])[0-9]))?)*))\){0,1})|((rate\((?:1)\s(minute|hour|day)\)){0,1}(rate\((?:[^0-1]{1}|[1-9][0-9]{1,})\s(minutes|hours|days)\)){0,1}))$/g);
  export const REGEX_START_ALPHABET = new RegExp(/^[a-zA-Z]/);
  export const REGEX_WHITE_SPACE = new RegExp(/[=,\s]/g);
  export const REGEX_VALID_FULLNAME = new RegExp(/^[a-zA-Z0-9.\s]*$/);
  export const REGEX_VALID_EMAIL = new RegExp(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
  export const REGEX_VALID_PASSWORD = new RegExp(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[\^$*.\[\]\{\}\(\)\?\-!@#%&/\\><':;|_~`])(?=.{12,99})/);
  export const REGEX_MIN_MAX = (min: number, max: number): RegExp => new RegExp(`/^.{${min},${max}}$/`, "i");
  export const REGEX_FULL_NAME = (fullName: string)=>fullName?.length > 0 && /^[\w\s]+$/.test( fullName );

  export const WHITE_SPACE_MSG = "whitespace , = not allowed ";
  export const MAX_DESCRIPTION_CHARS = 500;
  export const DEFAULT_CURRENCY = "USD";

  export const keyboardKeys = {
    enter: "Enter",
    ctrl: "Control"
  }

  /**
   * SortBy universal identifiers
   */
   export const SortByType = [ "Name", "LastModifiedTime", "CreatedBy", "CreationTime", "Status" ];
   /**
    * SortOrder types - asc: ascending, desc: descending
    */
   export const SortOrderType = [ "asc", "desc" ];
   /**
    * Number of results to fetch per API call
    */
   export const ResultsPerPageType = [ 50, 100, 200, 500 ];
   /**
    * Time format to display in 12hrs or 24hr format
    */
   export const TimeFormatType = [ "12", "24", "standard", "military" ];
   /**
    * Time format to display in absolute or relative to current time
    */
   export const TimeDisplayType = [ "relative", "absolute" ] as const;
   /**
    * Global resources list display type - list: tabular, grid: grid-boxes
    */
   export const ResourcesListingType = [ "list", "grid" ];

  //  export const FeedbackLink = "https://docs.google.com/forms/d/e/1FAIpQLSfpWxJtd5L6IkX8cIyFhwfrcULNxdbVuZ9gaXRIcPt-HBxvag/viewform";
   export const FeedbackLink = "https://cloudwick.zendesk.com/hc/en-us/requests/new";
   export const DocsLink = "https://docs.amorphicdata.io";
  /* eslint-enable */

export const routeActions = {
  new: "new",
  edit: "edit",
  list: "list",
  clone: "clone",
  details: "details"
} as const;

  /**
   * Array of 50 unique colors to be used for graphs.
   */
  interface IColorPalette {
    name: string;
    hexCode: string;
    rgbaCode: string;
    sentiment: "positive" | "negative" | "neutral";
    category: "info" | "success" | "warning" | "danger";
    textColorOverride?: string;
  }

export const colorPalette: IColorPalette[] = [
  {
    "name": "amorphicBlue",
    "hexCode": "#0074e0",
    "rgbaCode": "rgba(0, 116, 224, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "darkOliveGreen",
    "hexCode": "#556b2f",
    "rgbaCode": "rgba(85, 107, 47, 1)",
    "sentiment": "positive",
    "category": "success",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "darkOrange",
    "hexCode": "#ff8c00",
    "rgbaCode": "rgba(255, 140, 0, 1)",
    "sentiment": "negative",
    "category": "warning",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "mediumSeaGreen",
    "hexCode": "#3cb371",
    "rgbaCode": "rgba(60, 179, 113, 1)",
    "sentiment": "positive",
    "category": "success",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "mediumPurple",
    "hexCode": "#9370db",
    "rgbaCode": "rgba(147, 112, 219, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "tan",
    "hexCode": "#d2b48c",
    "rgbaCode": "rgba(210, 180, 140, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#000000"
  },
  {
    "name": "maize",
    "hexCode": "#f2c94c",
    "rgbaCode": "rgba(242, 201, 76, 1)",
    "sentiment": "negative",
    "category": "warning",
    "textColorOverride": "#000000"
  },
  {
    "name": "carolinaBlue",
    "hexCode": "#23a5e7",
    "rgbaCode": "rgba(35, 165, 231, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "green",
    "hexCode": "#008000",
    "rgbaCode": "rgba(0, 128, 0, 1)",
    "sentiment": "positive",
    "category": "success",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "orangeRed",
    "hexCode": "#ff4500",
    "rgbaCode": "rgba(255, 69, 0, 1)",
    "sentiment": "negative",
    "category": "warning",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "indianRed",
    "hexCode": "#cd5c5c",
    "rgbaCode": "rgba(205, 92, 92, 1)",
    "sentiment": "neutral",
    "category": "warning",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "lightSeaGreen",
    "hexCode": "#20b2aa",
    "rgbaCode": "rgba(32, 178, 170, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "crimson",
    "hexCode": "#dc143c",
    "rgbaCode": "rgba(220, 20, 60, 1)",
    "sentiment": "negative",
    "category": "danger",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "darkSlateBlue",
    "hexCode": "#483d8b",
    "rgbaCode": "rgba(72, 61, 139, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "aquamarine",
    "hexCode": "#6fcf97",
    "rgbaCode": "rgba(111, 207, 151, 1)",
    "sentiment": "positive",
    "category": "success",
    "textColorOverride": "#000000"
  },
  {
    "name": "yellowGreen",
    "hexCode": "#9acd32",
    "rgbaCode": "rgba(154, 205, 50, 1)",
    "sentiment": "positive",
    "category": "success",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "lightSteelBlue",
    "hexCode": "#b0c4de",
    "rgbaCode": "rgba(176, 196, 222, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#000000"
  },
  {
    "name": "goldenRod",
    "hexCode": "#daa520",
    "rgbaCode": "rgba(218, 165, 32, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "darkSeaGreen",
    "hexCode": "#8fbc8f",
    "rgbaCode": "rgba(143, 188, 143, 1)",
    "sentiment": "positive",
    "category": "success",
    "textColorOverride": "#000000"
  },
  {
    "name": "regalBlue",
    "hexCode": "#002c59",
    "rgbaCode": "rgba(0, 44, 89, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "chocolate",
    "hexCode": "#d2691e",
    "rgbaCode": "rgba(210, 105, 30, 1)",
    "sentiment": "neutral",
    "category": "warning",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "limeGreen",
    "hexCode": "#32cd32",
    "rgbaCode": "rgba(50, 205, 50, 1)",
    "sentiment": "positive",
    "category": "success",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "skyBlue",
    "hexCode": "#87ceeb",
    "rgbaCode": "rgba(135, 206, 235, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#000000"
  },
  {
    "name": "pink",
    "hexCode": "#ffc0cb",
    "rgbaCode": "rgba(255, 192, 203, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#000000"
  },
  {
    "name": "dodgerBlue",
    "hexCode": "#1e90ff",
    "rgbaCode": "rgba(30, 144, 255, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "darkOrchid",
    "hexCode": "#9932cc",
    "rgbaCode": "rgba(153, 50, 204, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "mediumVioletRed",
    "hexCode": "#c71585",
    "rgbaCode": "rgba(199, 21, 133, 1)",
    "sentiment": "neutral",
    "category": "warning",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "silver",
    "hexCode": "#afafaf",
    "rgbaCode": "rgba(175, 175, 175, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "darkSlateGray",
    "hexCode": "#2f4f4f",
    "rgbaCode": "rgba(47, 79, 79, 1)",
    "sentiment": "neutral",
    "category": "success",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "aqua",
    "hexCode": "#00ffff",
    "rgbaCode": "rgba(0, 255, 255, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#000000"
  },
  {
    "name": "tomato",
    "hexCode": "#ff6347",
    "rgbaCode": "rgba(255, 99, 71, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "gold",
    "hexCode": "#ffd700",
    "rgbaCode": "rgba(255, 215, 0, 1)",
    "sentiment": "neutral",
    "category": "warning",
    "textColorOverride": "#000000"
  },
  {
    "name": "orchid",
    "hexCode": "#da70d6",
    "rgbaCode": "rgba(218, 112, 214, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "sandyBrown",
    "hexCode": "#f4a460",
    "rgbaCode": "rgba(244, 164, 96, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "teal",
    "hexCode": "#008080",
    "rgbaCode": "rgba(0, 128, 128, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "darkOrange",
    "hexCode": "#ff8c00",
    "rgbaCode": "rgba(255, 140, 0, 1)",
    "sentiment": "neutral",
    "category": "warning",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "plum",
    "hexCode": "#dda0dd",
    "rgbaCode": "rgba(221, 160, 221, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#000000"
  },
  {
    "name": "sienna",
    "hexCode": "#a0522d",
    "rgbaCode": "rgba(160, 82, 45, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "salsa",
    "hexCode": "#cd1818",
    "rgbaCode": "rgba(205, 24, 24, 1)",
    "sentiment": "negative",
    "category": "danger",
    "textColorOverride": "#ffffff"
  },
  {
    "name": "navajoWhite",
    "hexCode": "#ffdead",
    "rgbaCode": "rgba(255, 222, 173, 1)",
    "sentiment": "neutral",
    "category": "info",
    "textColorOverride": "#000000"
  }
];

export const extraOptionParams = { maxRetries: 0 };

// eslint-disable-next-line max-len
export const fileInfoSVG = "<svg class='fill-current' width='24' height='22' viewBox='0 0 24 22' fill='none' data-adp-icon='file-info' xmlns='http://www.w3.org/2000/svg'><path d='M2.667 20h9.675a7.51 7.51 0 0 0 1.396 1.304 2.58 2.58 0 0 1-.404.029H2.667A2.67 2.67 0 0 1 0 18.666V2.667A2.67 2.67 0 0 1 2.667 0h6.504c.529 0 1.037.212 1.412.587l4.829 4.825c.375.375.587.883.587 1.412V8.27a7.218 7.218 0 0 0-1.333.525V8H10a2 2 0 0 1-2-2V1.333H2.667c-.737 0-1.333.596-1.333 1.333v16c0 .737.596 1.333 1.333 1.333zM14.646 6.667a.627.627 0 0 0-.175-.308l-4.829-4.83a.658.658 0 0 0-.308-.175V6c0 .367.3.667.667.667h4.646zm8.021 8.666a4.667 4.667 0 1 0-9.333 0 4.667 4.667 0 1 0 9.333 0zm-10.667 0a6 6 0 1 1 12 0 6 6 0 1 1-12 0zM18 14a1 1 0 1 1 0-2 1 1 0 1 1 0 2zm-1.333 4c0-.367.3-.667.667-.667V16c-.367 0-.667-.3-.667-.667s.3-.667.667-.667h.667c.367 0 .667.3.667.667v2c.367 0 .667.3.667.667s-.3.667-.667.667h-1.333a.669.669 0 0 1-.667-.667z'></path></svg>";
// eslint-disable-next-line max-len
export const msgSVG = "<svg class='fill-current' width='24' height='24' viewBox='0 0 24 24' fill='none' data-adp-icon='msg' xmlns='http://www.w3.org/2000/svg'><path d='M6 9.75C6 9.33579 6.33579 9 6.75 9H14.25C14.6642 9 15 9.33579 15 9.75C15 10.1642 14.6642 10.5 14.25 10.5H6.75C6.33579 10.5 6 10.1642 6 9.75Z'></path><path d='M6.75 13C6.33579 13 6 13.3358 6 13.75C6 14.1642 6.33579 14.5 6.75 14.5H18.25C18.6642 14.5 19 14.1642 19 13.75C19 13.3358 18.6642 13 18.25 13H6.75Z'></path><path fill-rule='evenodd' clip-rule='evenodd' d='M12.0556 0C12.0491 0.00643031 12.036 0.00643031 12.0164 0.00643031C5.38935 0.00643031 0 5.29858 0 11.806C0 14.4618 0.923328 17.0403 2.61282 19.1173L0.864392 23.1041C0.720327 23.432 0.877489 23.8114 1.20491 23.9465C1.32278 23.9979 1.45375 24.0108 1.57817 23.9915L7.98908 22.8855C9.27257 23.342 10.6215 23.5735 11.9836 23.5671C18.6106 23.5671 24 18.2749 24 11.7675C24.0131 5.27928 18.663 0.00643031 12.0556 0ZM11.9902 22.2875C10.7263 22.2875 9.47557 22.0624 8.29031 21.6251C8.17898 21.5801 8.06111 21.5737 7.94324 21.593L2.54734 22.5189L3.97489 19.2588C4.07312 19.0337 4.03383 18.7701 3.87012 18.5836C3.0974 17.7026 2.48185 16.6995 2.04966 15.6128C1.56507 14.3975 1.31623 13.105 1.31623 11.7996C1.31623 5.99948 6.12278 1.28606 12.0229 1.28606C17.9099 1.2732 22.6903 5.94804 22.6968 11.7289V11.7675C22.6968 17.574 17.8903 22.2875 11.9902 22.2875Z'></path></svg>";

export enum ModelStatusCode {
  AVAILABLE = "available",
  READY = "ready",
  UNAVAILABLE = "unavailable"
}
