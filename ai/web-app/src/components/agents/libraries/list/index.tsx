import React, { useState, useCallback, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ADPIcon } from "@amorphic/amorphic-ui-core";

import Header from "../../../layout/header";
import DeleteConfirmationMessage from "../../../customComponents/deleteConfirmationMessage";
import { DataTable } from "../../../customComponents/dataTable";
import { ConfirmationModal } from "../../../customComponents/confirmationModal";

import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { useDeleteLibraryMutation, useGetLibrariesQuery } from "../../../../services/agents/libraries";
import { useAppSelector, usePaginationState, useSuccessNotification } from "../../../../utils/hooks";
import { CustomFieldConstructor } from "./customFieldConstructor";
import { DISPLAY_FIELDS, SORT_COLUMN_MAPPINGS } from "./utils/constants";

const MODULE_DEFAULT_PAGINATION_SETTING = { limit: 50, sortBy: "LastModifiedTime", sortOrder: "desc" };
const permPathKey = "librariesList";

const List = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { libraries, newLibrary } = usePermanentPaths();
  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );
  const { resourceId } = useParams<{ resourceId?: string }>();
  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );
  const { currentData: { Libraries: cache = [], total_count: cache_total_count = 0 } = {},
    data: { Libraries: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    isSuccess,
    refetch } = useGetLibrariesQuery({ offset, limit, sortby: sortBy, sortorder: sortOrder });
  const { UserRole = "Users" } = useAppSelector(({ account }) => account );

  const [ deleteLibrary, { isLoading: isDeleting }] = useDeleteLibraryMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const [ showDeleteModal, toggleDeleteModal ] = useReducer(( state ) => !state, false );

  const [ selectedLibrary, setSelectedLibrary ] = useState<Record<string, any>>({});

  const handleDeleteModel = useCallback( async ( LibraryId ) => {
    try {
      const response = await deleteLibrary( LibraryId ).unwrap();

      showSuccessNotification({ content: response.Message });
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ deleteLibrary, showSuccessNotification ]);

  const customDisplayFields = CustomFieldConstructor({ libraries, navigate, setSelectedLibrary, toggleDeleteModal });

  return <>
    <Header title={t( libraries.name )} ctas={[
      {
        label: t( newLibrary.name ),
        icon: <ADPIcon icon="add" size="xs" />,
        callback: () => navigate?.( newLibrary.path ),
        disabled: UserRole === "Users"
      }
    ]} />
    <DataTable
      // for identifying, search & display
      dataIdentifiers={{
        permPathKey: permPathKey,
        searchKeys: ["LibraryName"],
        id: "LibraryId",
        name: "LibraryName",
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
      confirmButtonText={t( "common.button.delete" )}
      cancelButtonText={t( "common.button.cancel" )}
      onConfirm={async () => {
        handleDeleteModel( selectedLibrary?.LibraryId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting}
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <DeleteConfirmationMessage resourceType="services.library" resourceName={selectedLibrary.LibraryName} />
    </ConfirmationModal>
  </>;
};

export default List;