import React from "react";
import { useNavigate } from "react-router-dom";
import { ADPIcon, CTAGroup } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { ChatbotDetails, useDeleteChatbotMutation, useLazyGetChatbotDetailsQuery } from "../../../../services/chatbots";
import { ConfirmationModal } from "../../../customComponents/confirmationModal";
import { useSuccessNotification } from "../../../../utils/hooks";
import Details from "./detailsTab";

const ChatbotConfiguration = ({
  chatbotDetails
}: { chatbotDetails: ChatbotDetails}): JSX.Element => {
  const { chatbots } = usePermanentPaths();
  const { t } = useTranslation();
  const [ reloadDetails, {
    isFetching
  }] = useLazyGetChatbotDetailsQuery();
  const navigate = useNavigate();

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ deleteChatbot, { isLoading: isDeleting }] = useDeleteChatbotMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const onDelete = React.useCallback( async( selectedItem ) => {
    try {
      await deleteChatbot( selectedItem )
        .unwrap()
        .then(( response ) => {
          if ( !response.error ) {
            showSuccessNotification({
              content: response.Message
            });
            navigate?.( chatbots.path );
          }
        });
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ chatbots.path, deleteChatbot, navigate, showSuccessNotification ]);

  return <>
    <div className="bg-white w-full md:w-auto  flex-grow flex flex-col gap-4 overflow-auto h-full">
      <Details metadataCTAs={<CTAGroup ctaList={
        [
          {
            icon: <ADPIcon icon="sync" size="xs" spin={isFetching} />,
            label: "Reload",
            callback: () => {
              reloadDetails( chatbotDetails.ChatbotId );
            }
          },
          {
            icon: <ADPIcon icon="edit" size="xs"/>,
            label: "Edit",
            callback: () => navigate?.( `${chatbots.path}/${chatbotDetails.ChatbotId}/edit` ),
            disabled: chatbotDetails?.AccessType !== "owner"
          },
          {
            icon: <ADPIcon icon="delete" size="xs"/>,
            label: "Delete",
            callback: () => toggleDeleteModal(),
            disabled: chatbotDetails?.AccessType !== "owner"
          }
        ]
      } />} chatbotDetails={chatbotDetails} />
    </div>
    <ConfirmationModal
      confirmButtonText="Delete Chatbot"
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async() => {
        onDelete( chatbotDetails.ChatbotId );
      }}
      showModal={Boolean( showDeleteModal )}
      loading={isDeleting }
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <>
        {`Are you sure you want to delete this ${t( "chatbot" )}?`}
      </>
    </ConfirmationModal>
  </>;
};

export default ChatbotConfiguration;