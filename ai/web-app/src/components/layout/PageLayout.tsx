// libraries
import * as React from "react";
import clsx from "clsx";
// import PerfectScroll from "react-perfect-scrollbar";
import { Outlet } from "react-router-dom";
import { ScrollTop } from "primereact/scrolltop";
import { ADPIcon } from "@amorphic/amorphic-ui-core";

// components
import TopBar from "./topBar";
import DocLoading from "./loading";
import SideMenu from "../customComponents/sideMenu";
import MainContainer from "./mainContainer";
import Notifications from "../notifications";

// methods / hooks / constants / styles

/**
 * Pagelayout component encompasses the topBar, sideNav, scrollToTop and the main container
 */
const PageLayout = (): JSX.Element => {
  return (
    <>
      <Notifications />
      <TopBar />
      <div className="flex flex-row h-[calc(100vh-4rem)] dark:bg-secondary-450">
        <SideMenu />
        <React.Suspense fallback={<DocLoading />}>
          <MainContainer>
            <Outlet />
          </MainContainer>
        </React.Suspense>
        <ScrollTop target="parent" threshold={100} className="w-2rem h-2rem border-round-md bg-primary"
          icon={<ADPIcon icon="up-arrow" classes="text-white" />} />
      </div>
    </>
  );
};

interface IContainerProps {
  as?: React.ElementType;
  className?: string;
  children?: React.ReactNode;
}

export function Container({ as = "section", className, children }: IContainerProps ): JSX.Element {
  const As = as;
  return <As className={clsx( "w-full 3xl:container mx-auto 3xl:px-4", className )}>
    {children}
  </As>;
}

export function Content({ className, children }: IContainerProps ): JSX.Element {
  return <section className={clsx( "bg-primary dark:bg-secondary-500", className )}>
    {children}
  </section>;
}

export default PageLayout;