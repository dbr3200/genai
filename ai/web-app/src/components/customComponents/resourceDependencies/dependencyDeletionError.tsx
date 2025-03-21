//libraries
import React from "react";
import clsx from "clsx";
import { Accordion, Tooltip } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import PerfectScrollbar from "react-perfect-scrollbar";

// components
import SidePanel from "../sidePanel";
import { DependentResourceDisplay } from ".";

// methods / hooks / constants / styles
import { getMappings } from "./utils";
import { truncateId } from "../../../utils";
import { useAppSelector, usePermanentPaths } from "../../../utils/hooks";
import { clearDependencies } from "../../../modules/dependencies";
import { IDependentResourcesProps } from "./types";
import styles from "./styles.module.scss";

export const ResourceDependenciesError = (): JSX.Element => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const permanentPaths = usePermanentPaths();
  const [ showPanel, setPanelState ] = React.useState<boolean>( false );
  const entityMapping = getMappings( permanentPaths );
  const { dependencies = [] } = useAppSelector(( state ) => ({ dependencies: state?.dependencies }));

  React.useEffect(() => {
    if ( dependencies?.data?.length > 0 ) {
      setPanelState( true );
    }
    return () => {
      setPanelState( false );
    };
  }, [dependencies]);

  const closePanel = () => {
    setPanelState( false );
    dispatch( clearDependencies());
  };

  return (
    <SidePanel
      header={t( "common.button.deleteFailed" )}
      size="sm" show={showPanel} onClose={closePanel}
    >
      <div className={clsx( "w-full", styles.resourceDependencyListing, styles.deletionPanel )}>
        <p className="dark:text-platinum">
          { dependencies?.Message || `${t( "common.messages.deleteFailedMessage" )}${dependencies.ResourceName}`}
        </p>
        <div className="grid grid-flow-cols-auto grid-cols-1 gap-4 my-4">
          { dependencies?.data?.filter(
            ( d: IDependentResourcesProps ) => d?.Resources?.length > 0
          )?.map(( record: IDependentResourcesProps ) => {
            const entity = ( entityMapping )?.[record.ResourceType];
            return entity ? <Accordion key={record.ResourceType} expand classes={styles.accordion}>
              <Accordion.Header classes={styles.header}>
                <div className="flex items-center justify-start gap-2">
                  <Tooltip trigger={<span>
                    {truncateId( t( entity?.serviceName ), 20 )}
                  </span>}>
                    <span>{t( entity?.serviceName )}</span>
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
            </Accordion> : <div>
                Delete linked {record?.ResourceType ?? ""} resources before deleting this resource
            </div>;
          }) }
        </div>
      </div>
    </SidePanel>
  );
};

export default ResourceDependenciesError;
