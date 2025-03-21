import { ADPIcon, Tooltip } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import React, { useState, useEffect } from "react";
import PerfectScroll from "react-perfect-scrollbar";
import { useTranslation } from "react-i18next";
import { IServiceDetails } from "./detailsDump.types";
import styles from "./styles.module.scss";
import { removeWhiteSpaces } from "../../../utils";

interface NewDetailsDumpProps {
  data: IServiceDetails[]
}

const NewDetailsDump = ({ data }: NewDetailsDumpProps ): JSX.Element => {
  const { t } = useTranslation();
  const regularPanels = React.useMemo(() => data?.filter(
    x => x.DisplaySize === "regular" && ( x?.DisplayCondition ?? true ) === true
  ) ?? [], [data]);
  const widePanels = React.useMemo(() => data?.filter(
    x => x.DisplaySize === "wide" && ( x?.DisplayCondition ?? true ) === true
  ) ?? [], [data]);

  const [ expandedNodes, setExpandedNodes ] = useState<string[]>([]);

  const toggleNode = ( index: string ) => {
    const expandedSet = new Set( expandedNodes );

    if ( expandedSet.has( index )) {
      expandedSet.delete( index );
    } else {
      expandedSet.add( index );
    }

    setExpandedNodes( Array.from( expandedSet ));
  };

  useEffect(() => {
    const defaultExpandedNodes: string[] = [];
    regularPanels.forEach(( panel, index ) => {
      panel.DefaultExpanded && defaultExpandedNodes.push( `RegularPanel${index}` );
    });

    widePanels.forEach(( panel, index ) => {
      panel.DefaultExpanded && defaultExpandedNodes.push( `WidePanel${index}` );
    });

    setExpandedNodes( defaultExpandedNodes );
  }, [ regularPanels, widePanels ]);

  return <div className="flex flex-col sm:flex-row sm:flex-nowrap sm:items-start gap-4">
    <div className={clsx(
      "flex flex-col w-full grow gap-4",
      { "sm:w-3/4": regularPanels.length > 0 }
    )}>
      {widePanels.map(( panel, index ) =>
        <section id={removeWhiteSpaces( panel?.sectionId )} key={index}>
          <div
            className={"hover:cursor-pointer border border-secondary-200 w-full rounded"}>
            <div className={clsx( "py-4 w-full flex flex-row" )}>
              <div onClick={() => toggleNode( `WidePanel${index}` )} className={clsx( "flex items-center space-x-4 w-full px-4" )}>
                <ADPIcon
                  classes={clsx( "text-gray dark:text-platinum transition-all duration-700",
                    ( expandedNodes?.includes( `WidePanel${index}` ) ?? panel?.DefaultExpanded ) && "rotate-90" )}
                  size="xs"
                  icon={"right-arrow"} />
                <div className="w-full relative flex">
                  <>
                    <div className="flex flex-col">
                      <span className="text-xl"> {t( panel.DisplayName )}</span>
                      <span className="text-xs text-secondary-400">{t( panel?.DisplayDescription ?? "" )}</span>
                    </div>
                  </>
                </div>
              </div>
              {panel?.additionalCTAs ?
                <div className="flex justify-end px-2">
                  {panel.additionalCTAs}
                </div> : <></>}
            </div>
          </div>
          <div className={clsx( styles.content, expandedNodes?.includes( `WidePanel${index}` ) &&
              "dark:text-platinum dark:bg-dark3 p-4 overflow-y-auto border border-secondary-200 shadow-md" )}>
            {( expandedNodes?.includes( `WidePanel${index}` ) ?? panel?.DefaultExpanded ) &&
                <PerfectScroll component="div" className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-8">
                  {panel?.Fields?.filter( x => x?.DisplayCondition ?? true )?.map(( field ) => <div key={field.FieldName}
                    className={clsx(
                      "flex flex-col justify-start space-y-1 sm:col-span-1",
                      { "sm:col-span-2": field.DisplaySize === "wide" },
                      { "sm:col-span-3": field.DisplaySize === "full" }
                    )}
                  >
                    <div className="flex gap-1 items-center">
                      <div className="text-gray dark:text-platinum text-xs break-all">{t( field.FieldName )}</div>
                      {field?.Tooltip && <Tooltip trigger={<ADPIcon icon="info" size="xxs" />}>{field.Tooltip}</Tooltip>}
                    </div>
                    <div className="inline p-0 break-all">{field.FieldValue}</div>
                  </div> )}
                  {panel.CustomComponent ? panel.CustomComponent : <></>}
                </PerfectScroll>}
          </div>
        </section>
      )}
    </div>
    {regularPanels.length > 0 && <div className={clsx(
      "flex flex-col flex-none w-full",
      { "sm:w-1/4": widePanels.length > 0, "sm:w-0": regularPanels.length === 0 }
    )}>
      {regularPanels.map(( panel, index ) =>
        <React.Fragment key={index}>
          <div
            className={"hover:cursor-pointer border border-secondary-200 w-full rounded"}>
            <div className={clsx( "py-4 w-full" )}>
              <div onClick={() => toggleNode( `RegularPanel${index}` )} className={clsx( "flex items-center space-x-4 w-full px-4" )}>
                <ADPIcon
                  classes={clsx( "text-gray dark:text-platinum transition-all duration-700",
                    ( expandedNodes?.includes( `RegularPanel${index}` ) ?? panel?.DefaultExpanded ) && "rotate-90" )}
                  size="xs"
                  icon={"right-arrow"} />
                <div className="w-full relative flex">
                  <>
                    <div className="flex flex-col">
                      <span className="text-xl"> {t( panel.DisplayName )}</span>
                      <span className="text-xs text-secondary-400">{t( panel?.DisplayDescription ?? "" )}</span>
                    </div>
                  </>
                </div>
              </div>
              {panel.additionalCTAs ?
                <div className="flex justify-end px-2">
                  {panel.additionalCTAs}
                </div> : <></>}
            </div>
          </div>
          <div className={clsx( styles.content, expandedNodes?.includes( `RegularPanel${index}` ) &&
             "dark:text-platinum dark:bg-dark3 p-4 border border-secondary-200 shadow-md" )}>
            {( expandedNodes?.includes( `RegularPanel${index}` ) ?? panel?.DefaultExpanded ) &&
               <PerfectScroll component="div" className="grid grid-cols-1 gap-4 sm:gap-8">
                 {panel?.Fields?.filter( x => x?.DisplayCondition ?? true )?.map(( field ) => <div key={field.FieldName}
                   className={clsx(
                     "flex flex-col justify-start space-y-1"
                   )}
                 >
                   <div className="flex gap-1 items-center">
                     <div className="text-gray text-xs break-all">{t( field.FieldName )}</div>
                     {field?.Tooltip && <Tooltip trigger={<ADPIcon icon="info" size="xxs" />}>{field.Tooltip}</Tooltip>}
                   </div>
                   <div className="inline p-0 break-all">{field.FieldValue}</div>
                 </div> )}
               </PerfectScroll>}
          </div>
        </React.Fragment>

      )}
    </div>}
  </div>;
};

export default React.memo( NewDetailsDump );