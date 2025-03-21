// @susheel - April 8th, 2022
// TO DO: replace the component with core component when available
// libraries
import React, { ReactElement } from "react";
import { Tabs } from "@amorphic/amorphic-ui-core";
import { nanoid } from "nanoid";

type TabProps = React.ComponentProps<typeof Tabs.Tab>;
type TabsContainerProps = React.ComponentProps<typeof Tabs>;

const filterChildren = (
  tabs: TabsContainerProps["children"]
): Record<string, TabProps> => {
  const filtered: Record<string, TabProps> = {};
  const children = Array.isArray( tabs ) ? tabs : [tabs];
  children.forEach(( child: any ) => {
    if ( typeof child !== "boolean" && child?.type === Tabs.Tab ){
      const { id = nanoid(), children: tabContent }: TabProps = child.props;
      // filter out children that does not have children defined
      if ( tabContent ){
        filtered[ id ] = { ...child.props };
      }
    }
  });
  return filtered;
};

export const TabsContainer = ( props: TabsContainerProps ): ReactElement => {
  const filteredChildren: Record<string, TabProps> = React.useMemo(() => filterChildren( props.children ), [props.children]);
  const tabNames = React.useMemo(() => Object.keys( filteredChildren ), [filteredChildren]);

  return tabNames?.length > 0 ? <Tabs {...props}>
    {Object.entries( filteredChildren ).map(
      ([ tabId, tab ]) => <Tabs.Tab key={tabId} id={tabId}
        onEnter={() => tab?.onEnter?.()}
        onExit={() => tab?.onExit?.()}
        title={tab.title}
        classes={tab.classes}
      >
        {tab.children}
      </Tabs.Tab> )}
  </Tabs> : <></>;
};

export default TabsContainer;