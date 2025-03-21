// methods / hooks / constants / styles
import { ResultsPerPageType, SortByType, SortOrderType } from "../../constants";
import { PaginationState } from "../../types";
import { useUserPreferences } from "./useUserPreferences";

type SORT_COLUMN_MAPPING = Record<string, any>;

/**
 * Method to get the pagination state based on the user preferences
 * @param mapping Universal column name to resource column name mapping - {@link SORT_COLUMN_MAPPING}
 * @param cache (optional) Existing pagination state from cache if any - {@link PaginationState}
 * @returns {...PaginationState} Current pagination state - {@link PaginationState}
 */

export const usePaginationState = ( mapping: SORT_COLUMN_MAPPING, cache?: Partial<PaginationState> ): PaginationState => {
  const {
    sortBy = SortByType[0],
    sortOrder = SortOrderType[0],
    resultsPerPage = ResultsPerPageType[0]
  } = useUserPreferences();
  const {
    offset: cachedOffset = 1,
    limit: cachedLimit = resultsPerPage || 50,
    sortBy: cachedSortBy = "",
    sortOrder: cachedSortOrder = "",
    from_time,
    to_time
  } = cache ?? {};
  // check if mapping has at-least one of the SortBy options
  const sortByMapMatches = Object.keys( mapping ).filter( key => SortByType.includes( key ));
  // if none of the universal sortBy options are part of mappings, pick the first mapping as default
  const fallbackMapKey = Object.keys( mapping )?.[0];
  return {
    offset: parseInt( `${cachedOffset}`, 10 ),
    limit: parseInt( `${cachedLimit}`, 10 ),
    sortBy: cachedSortBy || sortByMapMatches.length > 0
      ? mapping[cachedSortBy]?.keyValue ?? mapping[sortBy] ??
     ( sortBy === "LastModifiedTime" ? mapping["LastModified"] ?? mapping[fallbackMapKey]?.keyValue ?? mapping[fallbackMapKey] :
       mapping[fallbackMapKey]?.keyValue ?? mapping[fallbackMapKey])
      : mapping[fallbackMapKey]?.keyValue ?? mapping[fallbackMapKey],
    sortOrder: cachedSortOrder || sortOrder,
    from_time,
    to_time
  };
};
