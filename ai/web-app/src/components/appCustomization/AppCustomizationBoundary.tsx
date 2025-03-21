// libraries
import React, { Suspense, useEffect } from "react";
import i18n, { lngs } from "../../i18n";

// components
import { PageLoadSpinner } from "../pageLoadSpinner";

// hooks / constants / styles
import { useGetAppCustomizationConfigQuery } from "../../services/appCustomization";
import commonDefaults from "./static.json";
import { DEFAULT_CUSTOM_CONFIG } from "./customConfig.types";

interface AppCustomizationProps {
    children: any;
}

//Wrapper component to compute and set the static Translations
export const AppCustomizationBoundary = ({
  children
}: AppCustomizationProps ): JSX.Element => {
  const { data: appCustomConfig = DEFAULT_CUSTOM_CONFIG, isFetching } = useGetAppCustomizationConfigQuery({ skipNotification: true });
  // Effect to compute the static namespace during app-load.
  // Unless a new appConfig is loaded forcefully by busting cache, this wont re-compute wiz. desirable
  useEffect(() => {
    if ( Object.keys( appCustomConfig ).length > 0 ) {
      const aliases = appCustomConfig?.aliases ?? {};
      const computedCommonDefaults: Record<string, string> = {
        ...commonDefaults,
        ...aliases
      };

      Object.keys( lngs ).forEach( eachLng => {
        i18n.addResourceBundle( eachLng, "static", computedCommonDefaults, false, true );
      });
    }

  }, [appCustomConfig]);

  if ( isFetching ) {
    return <PageLoadSpinner />;
  }

  return <Suspense fallback={<PageLoadSpinner />}>
    {children}
  </Suspense>;
};

