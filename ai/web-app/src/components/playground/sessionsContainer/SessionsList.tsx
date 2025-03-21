import React from "react";
import { useCreateChatSessionMutation,
  useDeleteChatSessionMutation, useGetAllChatSessionsQuery } from "../../../services/chat";
import { Button, EmptyState, Spinner } from "@amorphic/amorphic-ui-core";
import PerfectScrollbar from "react-perfect-scrollbar";
import SessionItem from "./SessionItem";
import { ConfirmationModal } from "../../customComponents/confirmationModal";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { usePermanentPaths, useSuccessNotification } from "../../../utils/hooks";

const SessionsList = (): JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showSuccessNotification] = useSuccessNotification();
  const [ selectedChatSession, setSelectedChatSession ] = React.useState<any>( null );
  const { playground } = usePermanentPaths();
  const {
    data: { ["Sessions"]: sessions = [] } = {},
    isFetching,
    isLoading,
    refetch
  } = useGetAllChatSessionsQuery({ sortorder: "desc", sortby: "LastModifiedTime" }, {
    pollingInterval: 60000
  });
  const [ createChatSession, { isLoading: creatingChatSession }] = useCreateChatSessionMutation();
  const [ deleteChatSession, { isLoading: deletingChatSession }] = useDeleteChatSessionMutation();

  return ( <div className="flex flex-col gap-4 items-start justify-center w-full overflow-auto">
    <div className="flex-none flex justify-end items-center gap-4 w-full">
      <Button size="xs" classes="btn btn-primary btn-auto-width px-2"
        disabled={isFetching || isLoading || creatingChatSession}
        loading={creatingChatSession} onClick={async() => {
          try {
            await createChatSession( undefined )
              .unwrap()
              .then(( response: any ) => {
                if ( !response.error ) {
                  showSuccessNotification({
                    autoHideDelay: 5000,
                    content: response.Message
                  });
                  navigate( `${playground.path}/sessions/${response.SessionId}` );
                }
              })
              .catch();
          // eslint-disable-next-line no-empty
          } catch {}
        }}>
        {"New Session"}
      </Button>
      <Button size="xs"
        variant="stroked"
        classes="btn-auto-width px-2"
        disabled={isFetching || isLoading}
        loading={isFetching} onClick={refetch}>
        {"Reload"}
      </Button>
    </div>
    { isLoading ? <div className="py-8 w-full">
      <Spinner size="sm" variant="pulse" centered label="Loading Sessions" />
    </div> : ( sessions?.length > 0 ? <PerfectScrollbar className="flex-grow h-auto w-full">
      <div id="sessionsListing" className="flex flex-col divide-y divide-secondary-50 overflow-hidden">
        {sessions.map(( session: any ) =>
          <SessionItem session={session} setSelectedChatSession={setSelectedChatSession} key={session.SessionId} />
        )}
      </div>
    </PerfectScrollbar> : <EmptyState transparentBG classes="w-full my-12" display="vertical">
      <EmptyState.Content>{t( "common.messages.noRecordsFound" )}</EmptyState.Content>
    </EmptyState> ) }
    <ConfirmationModal
      confirmButtonText={t( "profile.settings.confirm" )}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm=
        {async() => {
          try {
            await deleteChatSession( selectedChatSession?.SessionId )
              .unwrap()
              .then(( response: any ) => {
                if ( !response.error ) {
                  showSuccessNotification({
                    autoHideDelay: 5000,
                    content: response.Message
                  });
                  setSelectedChatSession( null );
                  navigate( `${playground.path}` );
                }
              })
              .catch();
          // eslint-disable-next-line no-empty
          } catch {}
        }}
      showModal={Boolean( selectedChatSession )}
      loading={deletingChatSession}
      closeModal={() => setSelectedChatSession( null )}
      onCancel={() => setSelectedChatSession( null )}
    >
      <>
        {`Are you sure you want to delete this session (${selectedChatSession?.Title})`}
      </>
    </ConfirmationModal>
  </div> );
};

export default SessionsList;