import React from "react";
import { ADPIcon } from "@amorphic/amorphic-ui-core";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";

import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { useAppSelector } from "../../../utils/hooks";
import { EUserRoles, IconType, RouteObject } from "../../../types";
import AmorphicIcon from "../../../assets/images/akar-icons_link-chain.svg";
import AmorphicDarkIcon from "../../../assets/images/dark-amorphic-connected.svg";
import styles from "./sideMenu.module.scss";

export type ListOptionProps = {
  text?: string;
  icon: IconType;
  beta?: boolean;
  path?: string;
  description?: string;
  selected: boolean;
};

export function MenuList(): RouteObject[] {
  const permanentPaths = usePermanentPaths();
  const { UserId = "", UserRole = "Users" } = useAppSelector(
    ({ account }) => account
  );
  const menuList = [
    permanentPaths.playground,
    permanentPaths.workspaces,
    permanentPaths.models,
    permanentPaths.chatbots,
    permanentPaths.listAgents
  ];
  if ( !UserId ) {
    return [];
  }
  if ( UserRole === EUserRoles.Admins ) {
    menuList.push( permanentPaths.management );
  }
  return menuList;
}

export default function SideMenu(): JSX.Element {
  const fetchedUpdatedMenu = MenuList();
  const location = useLocation();
  const permanentPaths = usePermanentPaths();
  const { Preferences = {}, AmorphicIntegrationStatus } = useAppSelector(
    ({ account }) => account
  );

  const ListOption = ({
    text,
    icon,
    beta = false,
    path = ""
  }: ListOptionProps ) => {

    return <li
      className={`flex justify-center items-center min-h-fit border-l-[5px]
           ${location.pathname.includes( path ) ? "border-l-[5px] border-primary-200 dark:border-primary-250 text-primary-300 dark:text-primary-250"
    : "border-transparent"
}`}
    >
      <Link to={path}
        className={styles.sideMenuOption}
      >
        <div className="flex justify-center">
          {<ADPIcon classes={location.pathname.includes( path ) ? "text-primary-300 dark:text-primary-250" : ""} icon={icon} />}
        </div>
        <span className={clsx( "flex text-3 justify-center text-center py-2 overflow-hidden",
          location.pathname.includes( path ) ? "text-primary-300 dark:text-primary-250" : ""
        )}>
          {text}
        </span>
        {beta && <sup className="beta-badge">BETA</sup>}
      </Link>
    </li>;
  };

  return <aside
    id="logo-sidebar"
    className={styles.sideMenuBar}
    aria-label="Sidebar"
  >
    <ul className={styles.sideMenuContainer}>
      {fetchedUpdatedMenu?.map(( item ) => (
        <ListOption
          key={item.name}
          text={item.name}
          icon={item.icon}
          description={item.description}
          path={item.path}
        />
      ))}
      <Link to={`${permanentPaths?.profileAndSettings?.path}#Integrations`} className={clsx( styles.bottomIcon, "overflow-x-none" )}>
        {AmorphicIntegrationStatus === "disconnected"
          ? <ADPIcon icon="warning" classes="text-warning" />
          : <img src={Preferences.darkMode ? AmorphicDarkIcon : AmorphicIcon} height={24} width={24} />
        }
        <div>Amorphic</div>
      </Link>
    </ul>
  </aside>;
}
