import React from "react";
import { Route, Routes } from "react-router-dom";

import { Page404 } from "../dynamicImports";
import AgentsRoot from "./root";
import AgentsContainer from "./agents/container";
import LibrariesContainer from "./libraries/container";
import ActionGroupsContainer from "./actionGroups/container";
import { routeActions } from "../../constants";

import { usePermanentPaths } from "../utils/hooks/usePermanentPaths";

const AgentRoutes = ():JSX.Element => {
  const permanentPaths = usePermanentPaths();

  return (
    <Routes>
      <Route path="/" element={<AgentsRoot />} />
      <Route element={<AgentsRoot />}>
        <Route path={`/${routeActions.list}`} element={<AgentsContainer />} />
        <Route path={`/${routeActions.new}`} element={<AgentsContainer showCommonForm />} />
        <Route path={`/:resourceId/${routeActions.details}`} element={<AgentsContainer />} />
        <Route path={`/:resourceId/${routeActions.edit}`} element={<AgentsContainer showCommonForm />} />
        <Route path={`${permanentPaths.actionGroups?.relativePath}/*`} element={
          <Routes>
            <Route path={`/${routeActions.list}`} element={<ActionGroupsContainer />} />
            <Route path={`/${routeActions.new}`} element={<ActionGroupsContainer showCommonForm />} />
            <Route path={`/:resourceId/${routeActions.details}`} element={<ActionGroupsContainer />} />
            <Route path={`/:resourceId/${routeActions.edit}`} element={<ActionGroupsContainer showCommonForm />} />
            <Route path="*" element={<Page404 />} />
          </Routes>} />
        <Route path={`${permanentPaths.libraries?.relativePath}/*`} element={
          <Routes>
            <Route path={`/${routeActions.list}`} element={<LibrariesContainer />} />
            <Route path={`/${routeActions.new}`} element={<LibrariesContainer showCommonForm />} />
            <Route path={`/:resourceId/${routeActions.details}`} element={<LibrariesContainer />} />
            <Route path={`/:resourceId/${routeActions.edit}`} element={<LibrariesContainer showCommonForm />} />
            <Route path="*" element={<Page404 />} />
          </Routes>} />
        <Route path={"*"} element={<Page404 />} />
      </Route>
    </Routes>
  );
};

export default AgentRoutes;
