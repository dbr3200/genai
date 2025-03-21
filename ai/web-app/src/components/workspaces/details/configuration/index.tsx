import React from "react";
import { useNavigate } from "react-router-dom";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { WorkspaceDetails, useDeleteWorkspaceMutation, useLazyGetWorkspaceDetailsQuery } from "../../../../services/workspaces";
import { ConfirmationModal } from "../../../customComponents/confirmationModal";
import { useSuccessNotification } from "../../../../utils/hooks";
import Details from "./detailsTab";

const WorkspaceConfiguration = ({
  workspaceDetails
}: { workspaceDetails: WorkspaceDetails }): JSX.Element => {
  const { workspaces } = usePermanentPaths();
  const { t } = useTranslation();
  const [ reloadDetails, {
    isFetching
  }] = useLazyGetWorkspaceDetailsQuery();
  const navigate = useNavigate();

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ deleteWorkspace, { isLoading: isDeleting }] = useDeleteWorkspaceMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const onDelete = React.useCallback( async( selectedItem ) => {
    try {
      await deleteWorkspace( selectedItem )
        .unwrap()
        .then(( response ) => {
          if ( !response.error ) {
            showSuccessNotification({
              content: response.Message
            });
            navigate?.( workspaces.path );
          }
        });
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ workspaces.path, deleteWorkspace, navigate, showSuccessNotification ]);

  return ( <div className="bg-white p-4 h-full w-full md:w-auto  flex-grow flex flex-col gap-4 overflow-auto">
    <Details metadataCTAs={<CTAGroup ctaList={
      [
        {
          icon: <ADPIcon icon="sync" size="xs" spin={isFetching} />,
          label: "Reload",
          callback: () => {
            reloadDetails( workspaceDetails.WorkspaceId );
          }
        },
        {
          icon: <ADPIcon icon="edit" size="xs"/>,
          label: "Edit",
          callback: () => navigate?.( `${workspaces.path}/${workspaceDetails.WorkspaceId}/edit` ),
          disabled: workspaceDetails?.AccessType !== "owner"
        },
        {
          icon: <ADPIcon icon="delete" size="xs"/>,
          label: "Delete",
          callback: () => toggleDeleteModal(),
          disabled: workspaceDetails?.AccessType !== "owner"
        }
      ]
    } />} workspaceDetails={workspaceDetails} />
    <ConfirmationModal
      confirmButtonText={`Delete ${t( "Workspace" )}`}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async() => {
        onDelete( workspaceDetails.WorkspaceId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting }
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <>
        {`Are you sure you want to delete this ${t( "services.workspace" )}?`}
      </>
    </ConfirmationModal>
  </div>
  );
};

export default WorkspaceConfiguration;