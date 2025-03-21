import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

import { ConfirmationModal } from "../../../../customComponents/confirmationModal";
import Details from "./detailsTab";
import DeleteConfirmationMessage from "../../../../customComponents/deleteConfirmationMessage";

import { usePermanentPaths } from "../../../../utils/hooks/usePermanentPaths";
import { ActionGroupDetails, useDeleteActionGroupMutation,
  useLazyGetActionGroupDetailsQuery } from "../../../../../services/agents/actionGroups";
import { useSuccessNotification } from "../../../../../utils/hooks";
import { routeActions } from "../../../../../constants";
import { DownloadLogsPanel } from "../../downloadLogsPanel";
import styles from "./styles.module.scss";

const ActionGroupConfiguration = ({
  actionGroupDetails
}: { actionGroupDetails?: ActionGroupDetails }): JSX.Element => {
  const { ActionGroupId = "", ActionGroupName = "" } = actionGroupDetails ?? {};
  const [ showDownloadLogsPanel, setShowDownloadLogsPanel ] = useState( false );
  const { actionGroups } = usePermanentPaths();
  const { t } = useTranslation();
  const [ reloadDetails, { isFetching }] = useLazyGetActionGroupDetailsQuery();
  const navigate = useNavigate();

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ deleteActionGroup, { isLoading: isDeleting }] = useDeleteActionGroupMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const handleDelete = React.useCallback( async( id ) => {
    try {
      const response = await deleteActionGroup( id ).unwrap();

      showSuccessNotification({ content: response.Message });
      navigate?.( actionGroups.path );
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ actionGroups.path, deleteActionGroup, navigate, showSuccessNotification ]);

  return <>
    <div className={styles.detailsBody}>
      {actionGroupDetails && <Details metadataCTAs={<CTAGroup ctaList={
        [
          {
            icon: <ADPIcon icon="sync" size="xs" spin={isFetching} />,
            label: t( "common.button.reload" ),
            callback: () => {
              ActionGroupId && reloadDetails( ActionGroupId );
            }
          },
          {
            icon: <ADPIcon size="xs" icon="edit" />,
            label: t( "common.button.edit" ),
            callback: () => navigate?.( `${actionGroups?.path}/${ActionGroupId}/${routeActions.edit}` ),
            disabled: actionGroupDetails?.SystemGenerated?.toLowerCase() === "yes"
          },
          {
            icon: <ADPIcon size="xs" icon="download" />,
            label: t( "services.agents.actionGroups.downloadLogs" ),
            callback: () => setShowDownloadLogsPanel( true )
          },
          {
            icon: <ADPIcon icon="delete" size="xs"/>,
            label: t( "common.button.delete" ),
            callback: () => toggleDeleteModal(),
            disabled: actionGroupDetails?.SystemGenerated?.toLowerCase() === "yes"
          }
        ]
      } />} actionGroupDetails={actionGroupDetails} />}
    </div>
    <ConfirmationModal
      confirmButtonText={`Delete ${t( "services.actionGroup" )}`}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async() => {
        handleDelete( ActionGroupId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting }
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <DeleteConfirmationMessage resourceType="services.actionGroup" resourceName={ActionGroupName} />
    </ConfirmationModal>
    <DownloadLogsPanel
      showDownloadLogsPanel={showDownloadLogsPanel}
      setShowDownloadLogsPanel={setShowDownloadLogsPanel}
      actionGroupId={actionGroupDetails?.ActionGroupId ?? ""} />
  </>;
};

export default ActionGroupConfiguration;
