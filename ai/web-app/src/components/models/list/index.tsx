import React, { useState, useCallback, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ADPIcon } from "@amorphic/amorphic-ui-core";

import Header from "../../layout/header";
import DeleteConfirmationMessage from "../../customComponents/deleteConfirmationMessage";
import { DataTable } from "../../customComponents/dataTable";
import { ConfirmationModal } from "../../customComponents/confirmationModal";

import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { useDeleteModelMutation, useGetModelsQuery, useUpdateModelAvailabilityMutation, useLazySyncModelsQuery } from "../../../services/models";
import { useAppSelector, useInfoNotification, usePaginationState, useSuccessNotification } from "../../../utils/hooks";
import { CustomFieldConstructor } from "./customFieldConstructor";
import { DISPLAY_FIELDS, SORT_COLUMN_MAPPINGS } from "../utils/constants";

const MODULE_DEFAULT_PAGINATION_SETTING = { limit: 50, sortBy: "LastModifiedTime", sortOrder: "desc" };
const permPathKey = "modelsList";

const List = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { models, newModel } = usePermanentPaths();
  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );
  const { resourceId } = useParams<{ resourceId?: string }>();
  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );
  const { currentData: { Models: cache = [], total_count: cache_total_count = 0 } = {},
    data: { Models: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    isSuccess,
    refetch: refetchModels } = useGetModelsQuery({ offset, limit, sortby: sortBy, sortorder: sortOrder });
  const { UserRole = "Users" } = useAppSelector(({ account }) => account );

  const [ deleteModel, { isLoading: isDeleting }] = useDeleteModelMutation();
  const [updateModelAvailability] = useUpdateModelAvailabilityMutation();
  const [ syncModels, { isFetching: syncingModels }] = useLazySyncModelsQuery();

  const [ showInfoNotification, hideInfoNotification ] = useInfoNotification();
  const [showSuccessNotification] = useSuccessNotification();

  const [ showDeleteModal, toggleDeleteModal ] = useReducer(( state ) => !state, false );

  const [ selectedModel, setSelectedModel ] = useState<Record<string, any>>({});

  const handleDeleteModel = useCallback( async ( ModelId ) => {
    try {
      const response = await deleteModel( ModelId ).unwrap();

      showSuccessNotification({ content: response.Message });
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ deleteModel, showSuccessNotification ]);

  const handleUpdateModelAvailability = async ( modelId: string, action: "enable" | "disable" ) => {
    const notificationId = showInfoNotification({ content: t( action === "enable"
      ? "services.models.enablingModel"
      : "services.models.disablingModel" ),
    autoHideDelay: false });

    try {
      const response = await updateModelAvailability({ id: modelId, action }).unwrap();
      hideInfoNotification( notificationId );
      showSuccessNotification({ content: response.Message, autoHideDelay: 3000 });
    } catch ( error ) {
      hideInfoNotification( notificationId );
    }
  };

  const handleSyncModels = async () => {
    const notificationId = showInfoNotification({ content: t( "services.models.syncingModels" ),
      autoHideDelay: false });
    const response = await syncModels( undefined ).unwrap();
    hideInfoNotification( notificationId );
    showSuccessNotification({ content: response.Message, autoHideDelay: 3000 });
    refetchModels();
  };

  const customDisplayFields = CustomFieldConstructor({ models, navigate, setSelectedModel, toggleDeleteModal, handleUpdateModelAvailability });

  return ( <>
    <Header title={t( models.name )} ctas={[
      {
        label: t( "services.models.syncModels" ),
        icon: <ADPIcon icon="sync" size="xs" />,
        callback: handleSyncModels,
        disabled: syncingModels
      },
      {
        label: t( newModel.name ),
        icon: <ADPIcon icon="add" size="xs" />,
        callback: () => navigate?.( newModel.path ),
        disabled: UserRole === "Users"
      }
    ]} />
    <DataTable
      // for identifying, search & display
      dataIdentifiers={{
        permPathKey: permPathKey,
        searchKeys: ["ModelName"],
        id: "ModelId",
        name: "ModelName",
        currentSelection: resourceId
      }}
      // for pagination actions
      defaultPaginationState={defaultPaginationState}
      totalCount={isSuccess ? total_count : cache_total_count}
      // loading and data display
      reloadData={refetchModels}
      compactTable={false}
      loading={isFetching || isLoading || isUninitialized}
      resourcesList={isSuccess ? resourcesList : cache}
      customFields={customDisplayFields}
      // for sorting & filtering
      availableFields={DISPLAY_FIELDS}
      sortableFields={SORT_COLUMN_MAPPINGS}
    />
    <ConfirmationModal
      confirmButtonText={t( "common.words.delete" )}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async () => {
        handleDeleteModel( selectedModel?.ModelId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting}
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <DeleteConfirmationMessage resourceType="services.model" resourceName={selectedModel.ModelName} />
    </ConfirmationModal>
  </> );
};

export default List;