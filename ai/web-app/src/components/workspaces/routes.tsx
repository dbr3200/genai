import React from "react";
import { Route, Routes } from "react-router-dom";

import { Page404 } from "../dynamicImports";
import WorkspaceContainer from "./container";
import WorkspaceDetails from "./details";
import { routeActions } from "../../constants";

export const WorkspaceRoutes = ():JSX.Element => {
  return (
    <Routes>
      <Route index element={<WorkspaceContainer />} />
      <Route path={`/${routeActions.list}`} element={<WorkspaceContainer />} />
      <Route path={`/${routeActions.new}`} element={<WorkspaceContainer showCommonForm />} />
      <Route path={`/:resourceId/${routeActions.edit}`} element={<WorkspaceContainer showCommonForm />} />
      <Route path={`/:resourceId/${routeActions.details}`} element={<WorkspaceDetails />} />
      <Route path={"*"} element={<Page404 />} />
    </Routes>
  );
};