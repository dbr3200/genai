import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ADPIcon } from "@amorphic/amorphic-ui-core";

import Header from "../../layout/header";

import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { useDeleteWorkspaceMutation, useGetWorkspacesQuery } from "../../../services/workspaces";
import { useAppSelector, usePaginationState, useSuccessNotification } from "../../../utils/hooks";
import { DataTable } from "../../customComponents/dataTable";
import { CustomFieldConstructor } from "./customFieldConstructor";
import { ConfirmationModal } from "../../customComponents/confirmationModal";
import { DISPLAY_FIELDS, SORT_COLUMN_MAPPINGS } from "../utils/constants";

const MODULE_DEFAULT_PAGINATION_SETTING = { limit: 50, sortBy: "LastModifiedTime", sortOrder: "desc" };

const List = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { workspaces, newWorkspace } = usePermanentPaths();

  const permPathKey = "workspaceList";

  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );

  const { resourceId } = useParams<{ resourceId?: string }>();

  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );

  const { currentData: { Workspaces: cache = [], total_count: cache_total_count = 0 } = {},
    data: { Workspaces: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    isSuccess,
    refetch } = useGetWorkspacesQuery({ offset, limit, sortby: sortBy, sortorder: sortOrder });
  const { UserRole = "Users" } = useAppSelector(({ account }) => account );

  const [ deleteWorkspace, { isLoading: isDeleting }] = useDeleteWorkspaceMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ workspaceId, setWorkspaceId ] = useState( "" );

  const onDelete = React.useCallback( async ( WorkspaceId ) => {
    try {
      await deleteWorkspace( WorkspaceId )
        .unwrap()
        .then(( response ) => {
          if ( !response.error ) {
            showSuccessNotification({
              content: response.Message
            });
          }
        });
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ deleteWorkspace, showSuccessNotification ]);

  const customDisplayFields = CustomFieldConstructor({ workspaces, navigate, setWorkspaceId, toggleDeleteModal });

  return ( <>
    <Header title={t( workspaces.name )} ctas={[
      {
        label: t( newWorkspace.name ),
        icon: <ADPIcon icon="add" size="xs" />,
        callback: () => navigate?.( newWorkspace.path ),
        disabled: UserRole === "Users"
      }
    ]} />
    <DataTable
      // for identifying, search & display
      dataIdentifiers={{
        permPathKey: permPathKey,
        searchKeys: ["WorkspaceName"],
        id: "WorkspaceId",
        name: "WorkspaceName",
        currentSelection: resourceId
      }}
      // for pagination actions
      defaultPaginationState={defaultPaginationState}
      totalCount={isSuccess ? total_count : cache_total_count}
      // loading and data display
      reloadData={refetch}
      compactTable={false}
      loading={isFetching || isLoading || isUninitialized}
      resourcesList={isSuccess ? resourcesList : cache}
      customFields={customDisplayFields}
      // for sorting & filtering
      availableFields={DISPLAY_FIELDS}
      sortableFields={SORT_COLUMN_MAPPINGS}
    />
    <ConfirmationModal
      confirmButtonText={"Delete"}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async () => {
        onDelete( workspaceId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting}
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <>
        {"Are you sure you want to delete this workspace?"}
      </>
    </ConfirmationModal>
  </> );
};

export default List;