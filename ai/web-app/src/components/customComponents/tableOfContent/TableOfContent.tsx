import { ADPIcon, Card } from "@amorphic/amorphic-ui-core";
import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Link } from "react-router-dom";
import PerfectScrollbar from "react-perfect-scrollbar";

import { useScrollToAnchor } from "../../../utils/hooks/useScrollToAnchor";
import { useHeadsObserver } from "./hooks";
import { ISectionMenu } from "../../../types";

import styles from "./table.module.scss";

interface ITableOfContent {
  sectionMenu: ISectionMenu
}

function TableOfContent({ sectionMenu }: ITableOfContent ): React.ReactElement {
  const [ headings, setHeadings ] = useState<any>([]);
  const { activeId } = useHeadsObserver();
  const hashRoute = useScrollToAnchor( 100, true );

  //Use Effect to fetch all the sections and map it to headings for a list of section ids.
  useEffect(() => {
    //Ensure that the ids and the sectionMenu labels are the same so that it'll reflect in the side menu.
    const menu = document.querySelector( "#menu" );
    const Options = Array.from( menu.children ).filter( child => child.tagName === "SECTION" ).map(( elem ) => ({
      id: elem.id
    }));
    setHeadings( Options );
  }, []);

  return (
    <ul className="list-none flex flex-col gap-4 flex-none w-full sm:w-1/6 divide-y divide-[#f7fafc]">
      {headings?.filter(
        ( heading: Record<string, string> ) => heading?.id?.length > 0
      )?.map(( heading: Record<string, string> ) => {
        return ( <li
          key={heading.id}
          className={clsx(
            "px-2 rounded-md flex items-center gap-2 w-full py-2 hover:bg-[#f7fafc] hover:cursor-pointer",
            { "active:bg-ashGray font-robotoBold text-amorphicBlue": activeId === heading.id },
            `${hashRoute === heading.id ? { "active:bg-ashGray font-robotoBold text-amorphicBlue": activeId === heading.id } : ""}`
          )}
          onClick={() => {
            document.querySelector( `#${heading.id}` )?.scrollIntoView({ block: "start", behavior: "smooth" });
          }}
        >
          <ADPIcon icon={sectionMenu?.[heading.id]?.icon} size="xs" fixedWidth />
          <Link className="w-full h-full" to={`#${heading.id}`}>{sectionMenu?.[heading.id]?.name}</Link>
        </li> );
      })}
    </ul>
  );

}

interface TableOfContentProps {
  sections: { [key: string]: any};
}

export function TableOfContentV2({ sections }: TableOfContentProps ):React.ReactElement {
  const { activeId } = useHeadsObserver();
  const hashRoute = useScrollToAnchor( 100, true );

  return <Card classes={styles.stickyCard}>
    <PerfectScrollbar component="ul" className={styles.list}>
      {Object.keys( sections )?.map(( sectionKey: string ) => <li
        key={sectionKey}
        className={clsx(
          styles.listItem,
          { [styles.active]: activeId === sectionKey },
          `${hashRoute === sectionKey ? { [styles.active]: activeId === sectionKey } : ""}`
        )}
        onClick={() => document.querySelector( `#${sectionKey}` )?.scrollIntoView()}
      >
        <Link className="w-full h-full" reloadDocument to={`#${sectionKey}`}>{sections?.[sectionKey].label}</Link>
      </li>
      )}
    </PerfectScrollbar>
  </Card>;
}

export default TableOfContent;