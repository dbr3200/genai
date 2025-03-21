import React from "react";
import { Route, Routes } from "react-router-dom";

import { Page404 } from "../dynamicImports";
import Settings from ".";

export const ProfileRoutes = ():JSX.Element => {
  return (
    <Routes>
      <Route path="/*" element={<Page404/>} />
      <Route index element={<Settings />} />
    </Routes>
  );
};