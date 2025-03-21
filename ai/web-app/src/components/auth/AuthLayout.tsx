import * as React from "react";
import { Outlet } from "react-router-dom";

import { ErrorBoundary } from "../layout/errorBoundary";
import { PageLoadSpinner } from "../pageLoadSpinner";

/**
 * AuthLayout component encompasses the error boundary and main container
 * This wrapper component is to be used only with unauthenticated pages and non-transition pages.
 *
 * Ideally, this component must provide a fixed un-authenticated layout for all the unauthenticated pages.
 * however in the light of the current implementation to incorporate customConfiguration (white-labelling),
 * this component is used to provide only fallback for the error boundary.
 *
 * TODO: This component must be refactored to provide a fixed un-authenticated layout for all the unauthenticated pages.
 * 1. Two column layout with the left column containing the cover images and the right column containing the forms.
 * 2. The cover images must honour corresponding customConfig or a random fallback image.
 * 3. The heading / sub-heading and projectName must honour corresponding customConfig or a pre-defined fallback text.
 */
const AuthLayout = (): JSX.Element => {
  return <ErrorBoundary>
    <React.Suspense fallback={<PageLoadSpinner />}>
      <Outlet />
    </React.Suspense>
  </ErrorBoundary>;
};

export default AuthLayout;