import React from "react";
import { Route, Routes } from "react-router-dom";

import { Page404 } from "../dynamicImports";
import Management from ".";

export const ManagementRoutes = ():JSX.Element => {
  return (
    <Routes>
      <Route path="*" element={<Page404/>} />
      <Route index element={<Management />} />
    </Routes>
  );
};