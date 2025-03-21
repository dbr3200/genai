/**
 * This file contains the types for the custom config json file
 */

/**
 * Type for the string key value pairs
 */
type TStringKeyValuePairs = Record<string, string>;

interface IUnAuthPageCustomConfig {
    /**
     * Background image for the page
     */
    "backgroundCover": string;
    /**
     * Heading for the page
     */
    "heading": TStringKeyValuePairs,
    /**
     * Sub heading for the page
     */
    "subHeading": TStringKeyValuePairs
}

/**
 * List of valid un-authenticated pages
 */
export type TUnAuthenticatedPages = "loginPage"
 | "registerPage"
 | "forgotPwdPage"
 | "forcePwdResetPage"
 | "setupMfaPage"
 | "verifyOtpPage"

export type ICustomConfig = {
    [key in TUnAuthenticatedPages]?: IUnAuthPageCustomConfig;
} & {
    /**
     * Path to the logo image. Use absolute path.
     * SVG is preferred.
     *
     * This is the large logo that appears in the top left corner
     * when the sidebar is expanded and on all un-authenticated pages
     */
    LOGO_PATH: string;
    /**
     * Path to the logo mark image. Use absolute path.
     * SVG is preferred.
     *
     * This is the small logo mark that appears in the top left corner when the sidebar is collapsed
    */
    LOGOMARK_PATH: string;
    /**
     * Name of the project, overrides the default project name
    */
    PROJECT_NAME: string;
    /**
     * Service name aliases.
     * This is used to override the default service names in the UI.
     *
     * For example, if you want to change the name of the "Tenants" service to "Organizations"
     * you can add an entry like this:
     * "tenants": "organizations"
     *
     * For example, if you want to change the name of the "Datasets" service to "Datastores"
     * you can add an entry like this:
     * "datasets": "datastores"
    */
    aliases: TStringKeyValuePairs;
};

export const DEFAULT_CUSTOM_CONFIG: ICustomConfig = {
  "LOGO_PATH": "",
  "LOGOMARK_PATH": "",
  "PROJECT_NAME": "",
  "aliases": {}
};