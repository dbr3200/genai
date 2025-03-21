// libraries
import React from "react";
import { ResourcesListingType } from "../../constants";

// methods / hooks / constants / styles
import { useUserPreferences } from "./useUserPreferences";

type ListSwitchHookProps = [string, () => void];

/**
 * Hook returns the current list type and the method to switch the list type between "list" and "grid"
 * @returns {...ListSwitchHookProps} List switch hook - {@link ListSwitchHookProps}
 */

export const useListSwitch = (): ListSwitchHookProps => {
  const userPreferences = useUserPreferences();
  const [ list, grid ] = ResourcesListingType;
  const [ listStyle, setListStyle ] = React.useState<string>( userPreferences?.resourcesListing ?? list );
  const toggleListStyle = React.useCallback(() => {
    setListStyle(( style ) => style === list ? grid : list );
  }, [ list, grid ]);
  return [ listStyle, toggleListStyle ];
};