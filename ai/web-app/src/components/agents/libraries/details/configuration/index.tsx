import React from "react";
import { useNavigate } from "react-router-dom";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

import { ConfirmationModal } from "../../../../customComponents/confirmationModal";
import Details from "./detailsTab";
import DeleteConfirmationMessage from "../../../../customComponents/deleteConfirmationMessage";

import { usePermanentPaths } from "../../../../utils/hooks/usePermanentPaths";
import { LibraryDetails, useDeleteLibraryMutation, useLazyGetLibraryDetailsQuery } from "../../../../../services/agents/libraries";
import { useSuccessNotification } from "../../../../../utils/hooks";
import styles from "./styles.module.scss";
import { routeActions } from "../../../../../constants";

const LibraryConfiguration = ({
  libraryDetails
}: { libraryDetails?: LibraryDetails }): JSX.Element => {
  const { libraries } = usePermanentPaths();
  const { t } = useTranslation();
  const [ reloadDetails, { isFetching }] = useLazyGetLibraryDetailsQuery();
  const navigate = useNavigate();

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ deleteLibrary, { isLoading: isDeleting }] = useDeleteLibraryMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const handleDelete = React.useCallback( async( LibraryId ) => {
    try {
      const response = await deleteLibrary( LibraryId ).unwrap();

      showSuccessNotification({ content: response.Message });
      navigate?.( libraries.path );
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ libraries.path, deleteLibrary, navigate, showSuccessNotification ]);

  return <>
    <div className={styles.detailsBody}>
      {libraryDetails && <Details metadataCTAs={<CTAGroup ctaList={
        [
          {
            icon: <ADPIcon icon="sync" size="xs" spin={isFetching} />,
            label: t( "common.button.reload" ),
            callback: () => {
              libraryDetails?.LibraryId && reloadDetails( libraryDetails?.LibraryId );
            }
          },
          {
            icon: <ADPIcon size="xs" icon="edit" />,
            label: t( "common.button.edit" ),
            callback: () => navigate?.( `${libraries?.path}/${libraryDetails.LibraryId}/${routeActions.edit}` )
          },
          {
            icon: <ADPIcon icon="delete" size="xs"/>,
            label: t( "common.button.delete" ),
            callback: () => toggleDeleteModal()
          }
        ]
      } />} libraryDetails={libraryDetails} />}
    </div>
    <ConfirmationModal
      confirmButtonText={`Delete ${t( "services.library" )}`}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async() => {
        handleDelete( libraryDetails?.LibraryId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting }
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <DeleteConfirmationMessage resourceType="services.library" resourceName={libraryDetails?.LibraryName} />
    </ConfirmationModal>
  </>;
};

export default LibraryConfiguration;