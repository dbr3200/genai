import React from "react";
import { Route, Routes } from "react-router-dom";

import { Page404 } from "../dynamicImports";
import PlaygroundContainer from "./container";
import { routeActions } from "../../constants";

export const PlaygroundRoutes = ():JSX.Element => {
  return (
    <Routes>
      <Route index element={<PlaygroundContainer />} />
      <Route path={`/${routeActions.list}`} element={<PlaygroundContainer />} />
      <Route path={"/sessions/:sessionId"} element={<PlaygroundContainer />} />
      <Route path={"*"} element={<Page404 />} />
    </Routes>
  );
};