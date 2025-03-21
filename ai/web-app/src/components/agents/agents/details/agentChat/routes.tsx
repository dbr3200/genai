import React from "react";
import { Route, Routes } from "react-router-dom";

import { Page404 } from "../../../../dynamicImports";
import AgentChatContainer from "./container";
import { routeActions } from "../../../../../constants";

export const AgentChatRoutes = ():JSX.Element => {
  return (
    <Routes>
      <Route index element={<AgentChatContainer />} />
      <Route path={`/${routeActions.list}`} element={<AgentChatContainer />} />
      <Route path={"/sessions/:sessionId"} element={<AgentChatContainer />} />
      <Route path={"*"} element={<Page404 />} />
    </Routes>
  );
};