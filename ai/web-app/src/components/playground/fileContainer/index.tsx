import React from "react";
import { chatApi, useDeleteFileFromSessionMutation, useGetChatSessionFilesQuery, useGetPresignedURLMutation } from "../../../services/chat";
import { ADPIcon, Button, EmptyState, SkeletonBlock, StatusCard, TextCopy, Tooltip } from "@amorphic/amorphic-ui-core";
import { UploadFilesForm } from "../../customComponents/uploadFilesForm";
import axios from "axios";
import { useAppDispatch, useSuccessNotification } from "../../../utils/hooks";
import { ConfirmationModal } from "../../customComponents/confirmationModal";
import PersistFileModal from "./PersistFileModal";
import PerfectScrollbar from "react-perfect-scrollbar";

interface IFilesContainerProps {
    sessionId?: string;
}

const FilesContainer = ({
  sessionId
}: IFilesContainerProps ): JSX.Element => {
  const [ fileToBeSaved, setFileToBeSaved ] = React.useState<string | undefined>();
  const [ fileToBeDeleted, setFileToBeDeleted ] = React.useState<string | undefined>();
  const [ fileState, setFilesState ] = React.useState<any>( null );
  const resetUploadState = () => setFilesState( null );

  const dispatch = useAppDispatch();
  const [showSuccessNotification] = useSuccessNotification();
  const [getUploadLink] = useGetPresignedURLMutation();
  const [ deleteFileFromSession, { isLoading: deletingSessionFile }] = useDeleteFileFromSessionMutation();

  const {
    data: { Files = [] } = {},
    isFetching: isFetchingFiles,
    refetch: refetchFiles
  } = useGetChatSessionFilesQuery( sessionId, {
    skip: Boolean( !sessionId ),
    refetchOnMountOrArgChange: 60000
  });

  const uploadFiles = ( files:any[]) => {
    setFilesState( null );
    files.map( async( item:any ) => {
      try {
        setFilesState(( d:any ) => ({ ...d, [item.fileIndex]: { fetchingURL: true } }));
        const { PresignedURL: uploadURL }:{PresignedURL:string} = await getUploadLink(
          { sessionId, requestBody: { FileName: item.fileName } }
        ).unwrap();
        setFilesState(( d:any ) => ({ ...d, [item.fileIndex]: { ...d?.[item.fileIndex], fetchingURL: false, progress: 0 } }));
        const config = {
          headers: {
            "Content-Type": ""
          },
          onUploadProgress: ( progressEvent:any ) =>
            setFilesState(( d:any ) => ({ ...d, [item.fileIndex]:
               { ...d?.[item.fileIndex],
                 progress: Math.round(( progressEvent.loaded * 100 ) / progressEvent.total ) } }))
        };
        await axios.put( uploadURL, item.actualFile, { ...config });
        dispatch( chatApi.util.invalidateTags([{ type: "chatSessionFiles", id: sessionId }]));
        setTimeout(() => {
          refetchFiles();
        }, 5000 );
      } catch ( e ){
        setFilesState(( d:any ) => ({ ...d,
          [item.fileIndex]: { ...d?.[item.fileIndex], fetchingURL: false, uploadingURL: false, uploadError: "Error occured while uploading file" } }));
      }
    });
  };

  return <PerfectScrollbar className="flex flex-col w-full h-full max-h-[calc(100vh-12rem)] items-start justify-start gap-8 px-4 pb-8">

    <div className="h-full w-full">
      <StatusCard classes="border !border-r-1 border-secondary-100" variant="info">
        <ul className="list-[disc] px-4">
          <li>Files uploaded to a chat session will get deleted after 24 hours.
         To keep them for a longer period, save them in a Workspace.</li>
          <li>Session filenames should be unique. Otherwise, the most recent file will overwrite the existing file.</li>
        </ul>
      </StatusCard>
    </div>

    <UploadFilesForm
      fileType="playground"
      uploadFiles={uploadFiles}
      resetUploadState={resetUploadState}
      uploadState={fileState}
    />

    <div className="flex flex-col bg-white">
      <table className="table table-fixed w-full border border-secondary-100 rounded-md">
        <thead className="border-b border-secondary-100">
          <tr className="bg-primary-100">
            <th className="w-3/4 py-2">File Name</th>
            <th className="w-1/4 py-2">Options</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-secondary-100">
          { isFetchingFiles ? <tr>
            <td colSpan={2} className="text-center py-4 w-full">
              <SkeletonBlock variant="table" count={2} rows={3} />
            </td>
          </tr> : ( Files.length > 0
            ? Files.map(( file: any ) => ( <tr key={file}>
              <td className="p-3 flex items-center justify-start gap-2">
                <TextCopy text={file} displayOnHover classes="line-clamp-3">
                  {file}
                </TextCopy>
              </td>
              <td className="p-2">
                <div className="flex items-center justify-center w-full gap-2">
                  <Tooltip
                    onTriggerClick={() => setFileToBeSaved( file )}
                    trigger={<ADPIcon icon="save" size="xs" classes="text-secondary-200" />}
                  >
                      Save this file to Workspace
                  </Tooltip>
                  <Tooltip
                    onTriggerClick={() => setFileToBeDeleted( file )}
                    trigger={<ADPIcon icon="delete" size="xs" classes="text-secondary-200" />}
                  >
                      Delete this file from session
                  </Tooltip>
                </div>
              </td>
            </tr> ))
            : <tr>
              <td colSpan={2} className="text-center py-4">
                <EmptyState transparentBG defaultImageVariant="zero-results" display="vertical">
                  <EmptyState.Content>
                          No files found for this session !!
                  </EmptyState.Content>
                  <EmptyState.CTA>
                    <Button onClick={() => refetchFiles} size="sm">Refresh</Button>
                  </EmptyState.CTA>
                </EmptyState>
              </td>
            </tr> )
          }
        </tbody>
      </table>
      <ConfirmationModal
        confirmButtonText={"Delete"}
        cancelButtonText={"Cancel"}
        onConfirm={async() => {
          try {
            await deleteFileFromSession({ sessionId, requestBody: { FileName: fileToBeDeleted } })
              .unwrap()
              .then(( response: any ) => {
                if ( !response.error ) {
                  showSuccessNotification({
                    autoHideDelay: 5000,
                    content: response.Message
                  });
                  dispatch( chatApi.util.invalidateTags(["chatSessionFiles"]));
                  setFileToBeDeleted( undefined );
                }
              })
              .catch();
            // eslint-disable-next-line no-empty
          } catch {}
        }}
        showModal={Boolean( fileToBeDeleted )}
        loading={deletingSessionFile}
        closeModal={() => setFileToBeDeleted( undefined )}
        onCancel={() => setFileToBeDeleted( undefined )}
      >
        <>
          {"Are you sure you want to delete this file?"}<br/><br/>
          <span className="underline">{fileToBeDeleted}</span>
        </>
      </ConfirmationModal>
      <PersistFileModal
        sessionId={sessionId}
        fileToBeSaved={fileToBeSaved}
        setFileToBeSaved={setFileToBeSaved}
      />
    </div>
  </PerfectScrollbar>;
};

export default FilesContainer;