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
    },
    /**
     * Flag to display route as BETA
     */
    beta?: boolean;
    /**
     * Flag to redirect user to externalLink instead of local re-routing
     */
    externalLink?: boolean;
}

export type PermanentPathObject = Record<string, RouteObject>;