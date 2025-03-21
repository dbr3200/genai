// methods / hooks / constants / styles
import { useAppSelector } from "./storeHooks";
import { UserPreferencesType } from "../../types";
import { ResourcesListingType, ResultsPerPageType,
  SortByType, SortOrderType,
  TimeDisplayType, TimeFormatType } from "../../constants";

export const USER_PREFERENCES_DEFAULTS: UserPreferencesType = {
  sortBy: SortByType[0],
  sortOrder: SortOrderType[0],
  resultsPerPage: ResultsPerPageType[0],
  preferredLanguage: "en",
  timeFormat: TimeFormatType[0],
  timeDisplay: TimeDisplayType[0],
  resourcesListing: ResourcesListingType[0],
  darkMode: false,
  resourceDependencyListing: "compact"
};

/**
 * Returns the user preferences from the store
 *
 * @returns {...UserPreferencesType} User preferences - {@link UserPreferencesType}
 */
export const useUserPreferences = (): UserPreferencesType => {
  const Preferences = useAppSelector(({ account }) => account?.Preferences ?? {});
  return { ...USER_PREFERENCES_DEFAULTS, ...Preferences };
};