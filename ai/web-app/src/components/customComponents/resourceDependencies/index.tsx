// libraries
import React, { useReducer } from "react";
import clsx from "clsx";
import { Button, CounterTag, ADPIcon,
  Accordion, Tooltip, EmptyState, Label } from "@amorphic/amorphic-ui-core";
import PerfectScrollbar from "react-perfect-scrollbar";
import { useTranslation } from "react-i18next";

// components
import SidePanel from "../sidePanel";

// methods / hooks / constants / styles
import { getMappings } from "./utils";
import { truncateId } from "../../../utils";
import { usePermanentPaths, useUserPreferences } from "../../../utils/hooks";
import { DependenciesType, IDependentResourcesProps } from "./types";
import styles from "./styles.module.scss";

const initialState = {
  showPanel: false,
  record: undefined
};

const RDReducer = ( state = initialState, action: any ) => {
  switch ( action.type ) {
  case "SHOW_PANEL":
    return {
      ...state,
      showPanel: true,
      record: action.data
    };
  case "HIDE_PANEL":
    return {
      ...state,
      showPanel: false,
      record: undefined
    };
  default:
    return state;
  }
};

export const ResourceDependencies = ({
  dependencies = []
}: DependenciesType ): JSX.Element => {
  const { t } = useTranslation();
  const [ state, dispatch ] = useReducer( RDReducer, initialState );
  const permanentPaths = usePermanentPaths();
  const entityMapping = getMappings( permanentPaths );
  const { resourceDependencyListing = "compact" } = useUserPreferences();

  const setRecord = ( record: IDependentResourcesProps ) => {
    dispatch({ type: "SHOW_PANEL", data: record });
  };

  const noResourcesFound = ( dependencies?.length === 0 ||
  dependencies?.reduce(( acc, curr ) => acc + ( curr.Resources?.length || 0 ), 0 ) === 0 ) ? true : false;

  return ( <>
    {noResourcesFound ?
      <EmptyState classes="w-full"
        defaultImageVariant="zero-results">
        <EmptyState.Content>{t( "common.messages.noDependenciesFound" )}</EmptyState.Content>
      </EmptyState> :
      <div className={clsx( styles.resourceDependencyListing,
        resourceDependencyListing === "compact" ? styles.compact : styles.nonCompact
      )}>
        { resourceDependencyListing === "compact" ? <>
          <div className="flex flex-wrap gap-4 items-center">
            { dependencies?.filter( dependency => dependency?.Resources?.length > 0 )?.map(
              ( record, index ) => ( <Button key={index}
                aria-label={record?.ResourceType || ""} variant="icon" onClick={() => setRecord( record )}>
                <CounterTag label={record?.ResourceType} value={record?.Resources?.length} />
              </Button> )
            )}
          </div>
          <SidePanel
            header={state?.record?.ResourceType}
            size="sm" show={state.showPanel && Boolean( state.record )}
            onClose={() => dispatch({ type: "HIDE_PANEL" })}
          >
            <ul className="list-none">
              {state?.record?.Resources?.map(( resource: any, index: number ) => {
                const entity = entityMapping?.[state?.record?.ResourceType];
                return <DependentResourceDisplay entity={entity} resource={resource} key={index} />;
              })}
            </ul>
          </SidePanel>
        </> : ( dependencies?.filter( d => d?.Resources?.length > 0 )?.map(
          ( record ) => {
            const entity = ( entityMapping )?.[record.ResourceType];
            return ( <Accordion key={record.ResourceType} expand classes={styles.accordion}>
              <Accordion.Header classes={styles.header}>
                <div className="flex items-center justify-start gap-2">
                  <Tooltip trigger={<span>
                    {truncateId( t( entity.serviceName ), 20 )}
                  </span>}>
                    <span>{t( entity.serviceName )}</span>
                  </Tooltip>
                  <span>({record?.Resources?.length})</span>
                </div>
              </Accordion.Header>
              <Accordion.Body classes={styles.body}>
                <PerfectScrollbar>
                  <ul className="list-disc px-4 text-amorphicBlue">
                    {record?.Resources?.map(( resource: any, index: number ) => {
                      return <DependentResourceDisplay entity={entity} resource={resource} showAsLabel={false} key={index} />;
                    })}
                  </ul>
                </PerfectScrollbar>
              </Accordion.Body>
            </Accordion> );
          }
        ))}
      </div>
    }
  </>
  );
};

interface IDependentResourceDisplayProps {
  entity: any;
  resource: any;
  showAsLabel?: boolean;
}

export const DependentResourceDisplay = ({
  entity,
  resource,
  showAsLabel = true
}: IDependentResourceDisplayProps ): JSX.Element => {

  const permanentPaths = usePermanentPaths();

  if ( resource?.StoreType === "omics-annotation" || resource?.StoreType === "omics-variant" ) {
    entity.path = permanentPaths?.omicsAnalytics.path;
  }
  const link = <a
    href={`${entity?.path ?? `/${entity.name}`}/${resource[entity.id]}/${entity?.postFixPath ?? "details"}`}
    target="_blank"
    rel="noopener noreferrer" >
    <span className="flex gap-1 items-center">
      <span>{resource[entity.name]}</span>
      <ADPIcon fixedWidth size="xxs" icon="external-link" />
    </span>
  </a>;
  return ( <li className="break-all max-w-full">
    {showAsLabel ? <Label classes="break-all" variant="primary">{link}</Label> : link}
  </li>
  );
};

