// libraries
import * as React from "react";
import { Outlet } from "react-router-dom";

// components
const ResourceDependenciesError = React.lazy(
  () =>
    import( "../customComponents/resourceDependencies/dependencyDeletionError" )
);

/**
 * UtilityLayout component encompasses the utility wizard and the resource dependencies error.
 *
 * This wrapper component is to be used only with authenticated pages and non-transition pages.
 */
const UtilityLayout = (): JSX.Element => {
  return (
    <>
      <Outlet />
      <React.Suspense fallback={<></>}>
        <ResourceDependenciesError />
      </React.Suspense>
    </>
  );
};

export default UtilityLayout;
