import React, { useState, useCallback, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ADPIcon } from "@amorphic/amorphic-ui-core";

import Header from "../../../layout/header";
import DeleteConfirmationMessage from "../../../customComponents/deleteConfirmationMessage";
import { DataTable } from "../../../customComponents/dataTable";
import { ConfirmationModal } from "../../../customComponents/confirmationModal";

import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { useDeleteActionGroupMutation, useGetActionGroupsQuery } from "../../../../services/agents/actionGroups";
import { useAppSelector, usePaginationState, useSuccessNotification } from "../../../../utils/hooks";
import { CustomFieldConstructor } from "./customFieldConstructor";
import { DISPLAY_FIELDS, SORT_COLUMN_MAPPINGS } from "./utils/constants";
import { DownloadLogsPanel } from "../downloadLogsPanel";

const MODULE_DEFAULT_PAGINATION_SETTING = { limit: 50, sortBy: "SystemGenerated", sortOrder: "desc" };
const permPathKey = "actionGroupsList";

const List = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { actionGroups, newActionGroup } = usePermanentPaths();
  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );
  const { resourceId } = useParams<{ resourceId?: string }>();
  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );
  const { currentData: { ActionGroups: cache = [], total_count: cache_total_count = 0 } = {},
    data: { ActionGroups: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    isSuccess,
    refetch } = useGetActionGroupsQuery({ offset, limit, sortby: sortBy, sortorder: sortOrder });
  const { UserRole = "Users" } = useAppSelector(({ account }) => account );

  const [ deleteActionGroup, { isLoading: isDeleting }] = useDeleteActionGroupMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const [ showDeleteModal, toggleDeleteModal ] = useReducer(( state ) => !state, false );

  const [ selectedActionGroup, setSelectedActionGroup ] = useState<Record<string, any>>({});

  const [ showDownloadLogsPanel, setShowDownloadLogsPanel ] = useState( false );

  const handleDeleteModel = useCallback( async ( ActionGroupId ) => {
    try {
      const response = await deleteActionGroup( ActionGroupId ).unwrap();

      showSuccessNotification({ content: response.Message });
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ deleteActionGroup, showSuccessNotification ]);

  const customDisplayFields = CustomFieldConstructor({ actionGroups, navigate, setSelectedActionGroup, toggleDeleteModal, setShowDownloadLogsPanel });

  return <>
    <Header title={t( actionGroups.name )} ctas={[
      {
        label: t( newActionGroup.name ),
        icon: <ADPIcon icon="add" size="xs" />,
        callback: () => navigate?.( newActionGroup.path ),
        disabled: UserRole === "Users"
      }
    ]} />
    <DataTable
      // for identifying, search & display
      dataIdentifiers={{
        permPathKey: permPathKey,
        searchKeys: ["ActionGroupName"],
        id: "ActionGroupId",
        name: "ActionGroupName",
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
        handleDeleteModel( selectedActionGroup?.ActionGroupId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting}
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <DeleteConfirmationMessage resourceType="services.actionGroup" resourceName={selectedActionGroup.ActionGroupName} />
    </ConfirmationModal>
    <DownloadLogsPanel
      showDownloadLogsPanel={showDownloadLogsPanel}
      setShowDownloadLogsPanel={setShowDownloadLogsPanel}
      actionGroupId={selectedActionGroup?.ActionGroupId} />
  </>;
};

export default List;