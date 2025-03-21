// libraries
import { ADPIcon, Label, Status, Toast } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import {
  ResourcesListingType,
  ResultsPerPageType,
  SortByType,
  SortOrderType,
  TimeDisplayType,
  TimeFormatType,
  routeActions
} from "./constants";

export type LabelVariant = Pick<
  React.ComponentProps<typeof Label>,
  "variant"
>["variant"];
export type StatusVariants = Pick<
  React.ComponentProps<typeof Status>,
  "variant"
>["variant"];
export type IconType = Pick<
  React.ComponentProps<typeof ADPIcon>,
  "icon"
>["icon"];
export interface RouteObject {
  /**
   * Parent route object of the current route object
   */
  parent: string;
  /**
   * Absolute path WRT root (/)
   */
  path: string;
  /**
   * Relative path WRT to parent route
   */
  relativePath?: string;
  /**
   * Name of the route
   */
  name: string;
  /**
   * Permission required to access the route
   */
  permission: string;
  /**
   * Keywords to be used for searching this route
   */
  quickNavSearch?: string[] | null;
  /**
   * Description of the route
   */
  description?: string;
  /**
   * Icon to be used for the route
   */
  icon?: string;
  /**
   * Conditions from the config file to match with
   */
  reqGlobalConfigCondition?: {
    /**
     * Config file key name
     */
    flag: string;
    /**
     * Value to match with the config file [key]: value
     */
    value: string | boolean;
  };
  /**
   * Flag to display route as BETA
   */
  beta?: boolean;
  /**
   * Flag to redirect user to externalLink instead of local re-routing
   */
  externalLink?: boolean;
}
export interface UserPreferencesType {
  /**
   * SortBy types with generic identifiers
   */
  sortBy?: ( typeof SortByType )[number];
  /**
   * SortOrder types - asc, desc
   */
  sortOrder?: ( typeof SortOrderType )[number];
  /**
   * Number of results to fetch per API call
   */
  resultsPerPage?: ( typeof ResultsPerPageType )[number];
  /**
   * User language preference
   */
  preferredLanguage?: string;
  /**
   * Tags/Keywords to be filled in by default
   */
  customTags?: {
    keywordPreferences: string[];
  };
  /**
   * Time format to display in 12hrs or 24hr format
   */
  timeFormat?: ( typeof TimeFormatType )[number];
  /**
   * User timezone preference
   */
  timeZone?: string;
  /**
   * Time format to display in absolute or relative to current time
   */
  timeDisplay?: ( typeof TimeDisplayType )[number];
  /**
   * Global resources list display type - list: tabular, grid: grid-boxes
   */
  resourcesListing?: ( typeof ResourcesListingType )[number];
  /**
   * Custom message to display at bottom of the sidenav
   */
  footerMessage?: string;
  /**
   * User preferences for the app-theme
   */
  darkMode: boolean;
  /**
   * Display preferences for dependencies for each resource:- Compact: countertag with sidepanel,
   * List: Accordions with list of resources
   */
  resourceDependencyListing?: string;
}

// export type SortFilterQueryParams = { offset: number, limit:number, sortby?: string, sortorder?: string };
export type SortFilterQueryParams = {
  offset?: number;
  limit?: number | string;
  sortby?: string;
  sortorder?: string;
  from_time?: string;
  from?: number;
  to_time?: string;
  projectionExpression?: string;
  bulkJdbcDatasets?: boolean;
  task_start_time?: string;
};
export type ProjectionExpressionQueryParams = { projectionExpression: string };

export type PermanentPathObject = Record<string, RouteObject>;

export type SelectOptionType = {
  label: string;
  value: string;
  key?: string | number;
};

export interface PaginationState
  extends Required<Pick<UserPreferencesType, "sortBy" | "sortOrder">> {
  offset: number;
  limit: number;
  from_time?: string;
  to_time?: string;
}

export type KeyValuePair = { key: string; value: string };

export type SizeOptions = Pick<
  React.ComponentProps<typeof ADPIcon>,
  "size"
>["size"];

export interface Option {
  label: string;
  value: any;
  [otherVals: string]: any;
}

export interface IconOption {
  label: string;
  value: any;
  [otherVals: string]: any;
}

export type Options = Option[] | { label: string; options: Option[] }[];

export interface MenuOption {
  label: string;
  value: string;
  isDisabled?: boolean;
  [otherVals: string]: any;
}

export type GroupOptions = Partial<{ [groupName: string]: MenuOption[] }>;

export interface IDisplayField {
  FieldName: string;
  FieldProps: {
    defaultDisplay: boolean;
    fixed?: boolean;
    [k: string]: boolean | string | undefined;
  };
}
export type KeysOfRouteActions = keyof typeof routeActions;
export type ValuesOfRouteActions = ( typeof routeActions )[KeysOfRouteActions];
export interface IResponseMessage {
  Message: string;
}

export interface StandardListingResponseShape {
  count: number;
  next_available: "yes" | "no";
  total_count: number;
}

/**
 * Default Response Type for Dependent Resources across the application
 */
export interface StandardDependentResourcesResponseShape {
  DependentResources: {
    ResourceType: string;
    Resources: any[];
  }[];
}

export type NavItemObj = {
  pathIdentifier: string;
  requiresIDPLogin?: boolean;
  visible: boolean;
  static?: boolean;
  disabled?: boolean;
};

export type NavObj = NavItemObj & { children?: Array<NavItemObj> };
export enum EUserRoles {
  Admins = "Admins",
  Developers = "Developers",
  Users = "Users",
}
export type TUserRole =
  | EUserRoles.Admins
  | EUserRoles.Developers
  | EUserRoles.Users;
export type TTriggerType = "on-demand" | "time-based" | "file-based";
export type TAccessType = "owner" | "read-only";

type ToastProps = Omit<
  React.ComponentProps<typeof Toast>,
  "autoHideDelay" | "show"
>;
export type TNotificationProps = ToastProps & {
  id: string;
  autoHideDelay?: number | false;
};

export interface ISectionMenu {
  [key: string]: {
    name: string;
    icon: string;
  };
}

export type SortableFields = Record<string, string | { keyValue: string, keyDisplayName: string }>;

export interface IMessage {
  MessageId: string;
  MessageTime: string;
  Type: "human" | "ai";
  Data?: any;
  Metadata?: any;
  ResponseTime?: string;
  useTypewriter?: boolean;
  isComplete: boolean;
}
