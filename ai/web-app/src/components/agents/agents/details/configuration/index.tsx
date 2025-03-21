import React from "react";
import { useNavigate } from "react-router-dom";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

import { ConfirmationModal } from "../../../../customComponents/confirmationModal";
import Details from "./detailsTab";
import DeleteConfirmationMessage from "../../../../customComponents/deleteConfirmationMessage";

import { usePermanentPaths } from "../../../../utils/hooks/usePermanentPaths";
import { AgentDetails, useDeleteAgentMutation, useLazyGetAgentDetailsQuery } from "../../../../../services/agents/agents";
import { useSuccessNotification } from "../../../../../utils/hooks";
import styles from "./styles.module.scss";
import { routeActions } from "../../../../../constants";

const AgentConfiguration = ({
  agentDetails
}: { agentDetails?: AgentDetails }): JSX.Element => {
  const { AgentId = "", AgentName = "" } = agentDetails ?? {};
  const { agents } = usePermanentPaths();
  const { t } = useTranslation();
  const [ reloadDetails, { isFetching }] = useLazyGetAgentDetailsQuery();
  const navigate = useNavigate();

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ deleteAgent, { isLoading: isDeleting }] = useDeleteAgentMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const handleDelete = React.useCallback( async( id ) => {
    try {
      const response = await deleteAgent( id ).unwrap();

      showSuccessNotification({ content: response.Message });
      navigate?.( agents.path );
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ agents.path, deleteAgent, navigate, showSuccessNotification ]);

  return <>
    <div className={styles.detailsBody}>
      {agentDetails && <Details metadataCTAs={<CTAGroup ctaList={
        [
          {
            icon: <ADPIcon icon="sync" size="xs" spin={isFetching} />,
            label: t( "common.button.reload" ),
            callback: () => {
              AgentId && reloadDetails( AgentId );
            }
          },
          {
            icon: <ADPIcon size="xs" icon="edit" />,
            label: t( "common.button.edit" ),
            callback: () => navigate?.( `${agents?.path}/${AgentId}/${routeActions.edit}` )
          },
          {
            icon: <ADPIcon icon="delete" size="xs"/>,
            label: t( "common.button.delete" ),
            callback: () => toggleDeleteModal()
          }
        ]
      } />} agentDetails={agentDetails} />}
    </div>
    <ConfirmationModal
      confirmButtonText={`Delete ${t( "services.agent" )}`}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async() => {
        handleDelete( AgentId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting }
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <DeleteConfirmationMessage resourceType="services.agent" resourceName={AgentName} />
    </ConfirmationModal>
  </>;
};

export default AgentConfiguration;
