import React from "react";
import { Outlet, Link, useMatch } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { routeActions } from "../../constants";
import styles from "./root.module.scss";

const Navigator = () => {
  const { agents, actionGroups, libraries } = usePermanentPaths();
  const { t } = useTranslation();
  // Sashank - Need to figure out a better way to check if it's an Agent route
  const agentsListRouteActive = Boolean( useMatch( `${agents.path}/${routeActions.list}` ));
  const agentsNewRouteActive = Boolean( useMatch( `${agents.path}/${routeActions.new}` ));
  const agentsDetailsRouteActive = Boolean( useMatch( `${agents.path}/:resourceId/${routeActions.details}` ));
  const agentsEditRouteActive = Boolean( useMatch( `${agents.path}/:resourceId/${routeActions.edit}` ));
  const actionGroupsRouteActive = Boolean( useMatch( `${actionGroups.path}/*` ));
  const librariesRouteActive = Boolean( useMatch( `${libraries.path}/*` ));

  return <div className={styles.linkContainer}>
    <Link className={clsx( styles.link, ( agentsListRouteActive || agentsNewRouteActive ||
    agentsDetailsRouteActive || agentsEditRouteActive ) && styles.active )}
    to={`${agents.relativePath}/${routeActions.list}`} >{t( "Agents" )}</Link>
    <Link className={clsx( styles.link, actionGroupsRouteActive && styles.active )}
      to={`${actionGroups.relativePath}/${routeActions.list}`}>{t( "Action Groups" )}</Link>
    <Link className={clsx( styles.link, librariesRouteActive && styles.active )}
      to={`${libraries.relativePath}/${routeActions.list}`}>{t( "Libraries" )}</Link>
  </div>;
};

const AgentsRoot = (): JSX.Element => {

  return <div className="adp-v2">
    <Navigator />
    <Outlet />
  </div>;
};

export default AgentsRoot;