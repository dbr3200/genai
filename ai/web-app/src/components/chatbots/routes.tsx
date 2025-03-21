import React from "react";
import { Route, Routes } from "react-router-dom";

import { Page404 } from "../dynamicImports";
import ChatbotContainer from "./container";
import ChatbotDetails from "./details";
import { routeActions } from "../../constants";

export const ChatbotRoutes = ():JSX.Element => {
  return (
    <Routes>
      <Route index element={<ChatbotContainer />} />
      <Route path={`/${routeActions.list}`} element={<ChatbotContainer />} />
      <Route path={`/${routeActions.new}`} element={<ChatbotContainer showCommonForm />} />
      <Route path={`/:resourceId/${routeActions.edit}`} element={<ChatbotContainer showCommonForm />} />
      <Route path={`/:resourceId/${routeActions.details}`} element={<ChatbotDetails />} />
      <Route path={"*"} element={<Page404 />} />
    </Routes>
  );
};