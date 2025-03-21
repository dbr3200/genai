import React from "react";
import { Route, Routes } from "react-router-dom";

import { Page404 } from "../dynamicImports";
import ModelsContainer from "./container";
import ModelDetails from "./details";
import { routeActions } from "../../constants";

const ModelRoutes = ():JSX.Element => {
  return (
    <Routes>
      <Route index element={<ModelsContainer />} />
      <Route path={`/${routeActions.list}`} element={<ModelsContainer />} />
      <Route path={`/${routeActions.new}`} element={<ModelsContainer showCommonForm />} />
      <Route path={`/:resourceId/${routeActions.details}`} element={<ModelDetails />} />
      <Route path={"*"} element={<Page404 />} />
    </Routes>
  );
};

export default ModelRoutes;