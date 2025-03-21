import { baseApi } from "./baseApi";
import { tagTypes } from "./tagTypes";
import { urlBuilder } from "../modules/utils/fetchUtils";
import { extraOptionParams } from "../constants";
import { Sessions } from "./types";

export const chatApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    sendMessage: build.mutation<any, {
        SessionId: string;
        UserMessage: string;
        ModelId: string;
        WorkspaceId: string;
    }>({
      query: ( requestBody ) => ({
        url: urlBuilder( "chat" ),
        method: "POST",
        body: requestBody,
        extraOptions: extraOptionParams
      })
    }),
    getReply: build.query({
      query: ( sessionId: string ) => urlBuilder( "chat", { "session-id": sessionId })
    }),
    getAllChatSessions: build.query({
      query: ( args ) => urlBuilder([ "chat", "sessions" ], args ),
      providesTags: ( result ) => result ? [{ type: tagTypes.chatSessions, id: "LIST" }] : []
    }),
    getChatSessionDetails: build.query<Sessions, string>({
      query: ( id ) => urlBuilder([ "chat", "sessions", id ]),
      providesTags: ( result, error, id ) => result ? [{ type: tagTypes.chatSessions, id }] : []
    }),
    createChatSession: build.mutation<any, Record<string, string> | undefined>({
      query: ( args ) => ({
        url: urlBuilder([ "chat", "sessions" ], args ),
        method: "POST"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.chatSessions, id: "LIST" }] : []
    }),
    deleteChatSession: build.mutation<any, string>({
      query: ( id ) => ({
        url: urlBuilder([ "chat", "sessions", id ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.chatSessions, id: "LIST" }] : []
    }),
    getChatSessionFiles: build.query({
      query: ( sessionId ) => urlBuilder([ "chat", "sessions", sessionId, "files" ]),
      providesTags: ( result, error, sessionId ) => result ? [{ type: tagTypes.chatSessionFiles, id: sessionId }] : []
    }),
    getPresignedURL: build.mutation({
      query: ({ sessionId, requestBody } : { sessionId: string, requestBody: { FileName: string } }) => ({
        url: urlBuilder([ "chat", "sessions", sessionId, "files" ]),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { sessionId }) => result ? [{ type: tagTypes.chatSessionFiles, id: sessionId }] : []
    }),
    deleteFileFromSession: build.mutation<any, { sessionId: string, requestBody: { FileName: string }}>({
      query: ({ sessionId, requestBody }) => ({
        url: urlBuilder([ "chat", "sessions", sessionId, "files" ]),
        method: "DELETE",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { sessionId }) => result ? [{ type: tagTypes.chatSessionFiles, id: sessionId }] : []
    }),
    addToDataset: build.mutation<any, { sessionId: string, requestBody: { DatasetId: string; Files: string[]; }} >({
      query: ({ sessionId, requestBody }) => ({
        url: urlBuilder([ "chat", "sessions", sessionId, "files", "dataset-upload" ]),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { sessionId }) => result ? [{ type: tagTypes.chatSessionFiles, id: sessionId }] : []
    })
  }),
  overrideExisting: true
});

export const {
  useSendMessageMutation,
  useAddToDatasetMutation,
  useCreateChatSessionMutation,
  useDeleteChatSessionMutation,
  useDeleteFileFromSessionMutation,
  useGetAllChatSessionsQuery,
  useGetChatSessionDetailsQuery,
  useLazyGetChatSessionDetailsQuery,
  useGetPresignedURLMutation,
  useGetReplyQuery,
  useGetChatSessionFilesQuery
} = chatApi;