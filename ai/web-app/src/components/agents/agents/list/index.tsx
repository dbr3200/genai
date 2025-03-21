import React, { useState, useCallback, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ADPIcon } from "@amorphic/amorphic-ui-core";

import Header from "../../../layout/header";
import DeleteConfirmationMessage from "../../../customComponents/deleteConfirmationMessage";
import { DataTable } from "../../../customComponents/dataTable";
import { ConfirmationModal } from "../../../customComponents/confirmationModal";

import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { useDeleteAgentMutation, useGetAgentsQuery } from "../../../../services/agents/agents";
import { useAppSelector, usePaginationState, useSuccessNotification } from "../../../../utils/hooks";
import { CustomFieldConstructor } from "./customFieldConstructor";
import { DISPLAY_FIELDS, SORT_COLUMN_MAPPINGS } from "./utils/constants";

const MODULE_DEFAULT_PAGINATION_SETTING = { limit: 50, sortBy: "LastModifiedTime", sortOrder: "desc" };
const permPathKey = "agentsList";

const List = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agents, newAgent } = usePermanentPaths();
  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );
  const { resourceId } = useParams<{ resourceId?: string }>();
  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );
  const { currentData: { Agents: cache = [], total_count: cache_total_count = 0 } = {},
    data: { Agents: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    isSuccess,
    refetch } = useGetAgentsQuery({ offset, limit, sortby: sortBy, sortorder: sortOrder });
  const { UserRole = "Users" } = useAppSelector(({ account }) => account );

  const [ deleteAgent, { isLoading: isDeleting }] = useDeleteAgentMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const [ showDeleteModal, toggleDeleteModal ] = useReducer(( state ) => !state, false );

  const [ selectedAgent, setSelectedAgent ] = useState<Record<string, any>>({});

  const handleDeleteModel = useCallback( async ( AgentId ) => {
    try {
      const response = await deleteAgent( AgentId ).unwrap();

      showSuccessNotification({ content: response.Message });
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ deleteAgent, showSuccessNotification ]);

  const customDisplayFields = CustomFieldConstructor({ agents, navigate, setSelectedAgent, toggleDeleteModal });

  return <>
    <Header title={t( agents.name )} ctas={[
      {
        label: t( newAgent.name ),
        icon: <ADPIcon icon="add" size="xs" />,
        callback: () => navigate?.( newAgent.path ),
        disabled: UserRole === "Users"
      }
    ]} />
    <DataTable
      // for identifying, search & display
      dataIdentifiers={{
        permPathKey: permPathKey,
        searchKeys: ["AgentName"],
        id: "AgentId",
        name: "AgentName",
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
        handleDeleteModel( selectedAgent?.AgentId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting}
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <DeleteConfirmationMessage resourceType="services.agent" resourceName={selectedAgent.AgentName} />
    </ConfirmationModal>
  </>;
};

export default List;