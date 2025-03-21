import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { ADPIcon } from "@amorphic/amorphic-ui-core";

import Header from "../../layout/header";

import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { useDeleteChatbotMutation, useGetChatbotsQuery } from "../../../services/chatbots";
import { useAppSelector, usePaginationState, useSuccessNotification } from "../../../utils/hooks";
import { DataTable } from "../../customComponents/dataTable";
import { CustomFieldConstructor } from "./customFieldConstructor";
import { ConfirmationModal } from "../../customComponents/confirmationModal";
import { DISPLAY_FIELDS, SORT_COLUMN_MAPPINGS } from "../utils/constants";

const MODULE_DEFAULT_PAGINATION_SETTING = { limit: 50, sortBy: "LastModifiedTime" };

const List = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { chatbots, newChatbot } = usePermanentPaths();

  const permPathKey = "chatbotList";

  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );

  const { resourceId } = useParams<{ resourceId?: string }>();

  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );

  const { data: { Chatbots: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    refetch } = useGetChatbotsQuery({ offset, limit, sortby: sortBy, sortorder: sortOrder });
  const { UserRole = "Users" } = useAppSelector(({ account }) => account );

  const [ deleteChatbot, { isLoading: isDeleting }] = useDeleteChatbotMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ chatbotId, setChatbotId ] = useState( "" );

  const onDelete = React.useCallback( async ( ChatbotId ) => {
    try {
      await deleteChatbot( ChatbotId )
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
  }, [ deleteChatbot, showSuccessNotification ]);

  const customDisplayFields = CustomFieldConstructor({ chatbots, navigate, setChatbotId, toggleDeleteModal });

  return ( <>
    <Header title={t( chatbots.name )} ctas={[
      {
        label: t( newChatbot.name ),
        icon: <ADPIcon icon="add" size="xs" />,
        callback: () => navigate?.( newChatbot.path ),
        disabled: UserRole === "Users"
      }
    ]} />
    <DataTable
      // for identifying, search & display
      dataIdentifiers={{
        permPathKey: permPathKey,
        searchKeys: ["ChatbotName"],
        id: "ChatbotId",
        name: "ChatbotName",
        currentSelection: resourceId
      }}
      // for pagination actions
      defaultPaginationState={defaultPaginationState}
      totalCount={total_count}
      // loading and data display
      reloadData={refetch}
      compactTable={false}
      loading={isFetching || isLoading || isUninitialized}
      resourcesList={resourcesList}
      customFields={customDisplayFields}
      // for sorting & filtering
      availableFields={DISPLAY_FIELDS}
      sortableFields={SORT_COLUMN_MAPPINGS}
    />
    <ConfirmationModal
      confirmButtonText={"Delete"}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async () => {
        onDelete( chatbotId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting}
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <>
        {"Are you sure you want to delete this chatbot?"}
      </>
    </ConfirmationModal>
  </> );
};

export default List;