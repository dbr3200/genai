import React from "react";
import { useNavigate } from "react-router-dom";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

import { ConfirmationModal } from "../../../customComponents/confirmationModal";
import Details from "./detailsTab";
import DeleteConfirmationMessage from "../../../customComponents/deleteConfirmationMessage";

import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { ModelDetails, useDeleteModelMutation, useLazyGetModelDetailsQuery } from "../../../../services/models";
import { useSuccessNotification } from "../../../../utils/hooks";
import styles from "./styles.module.scss";

const ModelConfiguration = ({
  modelsDetails
}: { modelsDetails?: ModelDetails }): JSX.Element => {
  const { models } = usePermanentPaths();
  const { t } = useTranslation();
  const [ reloadDetails, {
    isFetching
  }] = useLazyGetModelDetailsQuery();
  const navigate = useNavigate();

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ deleteModel, { isLoading: isDeleting }] = useDeleteModelMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const handleDelete = React.useCallback( async( ModelId ) => {
    try {
      const response = await deleteModel( ModelId ).unwrap();

      showSuccessNotification({ content: response.Message });
      navigate?.( models.path );
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ models.path, deleteModel, navigate, showSuccessNotification ]);

  return <>
    <div className={styles.detailsBody}>
      {modelsDetails && <Details metadataCTAs={<CTAGroup ctaList={
        [
          {
            icon: <ADPIcon icon="sync" size="xs" spin={isFetching} />,
            label: "Reload",
            callback: () => {
              modelsDetails?.ModelId && reloadDetails( modelsDetails?.ModelId );
            }
          }
        ].concat( modelsDetails?.ModelType?.toLowerCase() === "base" ? [] : [
          {
            icon: <ADPIcon icon="delete" size="xs"/>,
            label: "Delete",
            callback: () => toggleDeleteModal(),
            disabled: modelsDetails?.AdditionalConfiguration?.Status === "InProgress"
          } as any])
      } />} modelsDetails={modelsDetails} />}
    </div>
    <ConfirmationModal
      confirmButtonText={`Delete ${t( "services.model" )}`}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async() => {
        handleDelete( modelsDetails?.ModelId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting }
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <DeleteConfirmationMessage resourceType="services.model" resourceName={modelsDetails?.ModelName} />
    </ConfirmationModal>
  </>;
};

export default ModelConfiguration;