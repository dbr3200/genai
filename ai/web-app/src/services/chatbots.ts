import { baseApi } from "./baseApi";
import { tagTypes } from "./tagTypes";
import { urlBuilder } from "../modules/utils/fetchUtils";

export interface CreateChatbotRequestBody {
  ChatbotName: string,
  Description: string,
  Keywords: string[],
  Workspace: string
  Model: string,
  EmbeddedConfig: Record<string, any>,
  Instructions?: string,
  KeepActive: boolean,
  EnableRedaction: boolean
}

interface UpdateChatbotRequestBody {
  Description: string,
  Keywords: string[],
  EmbeddedConfig: Record<string, any>,
  KeepActive: boolean
}

export interface ChatbotDetails {
  ChatbotName: string;
  ChatbotId: string;
  Endpoint: string;
  Description: string;
  Keywords: string[];
  CreatedBy: string;
  CreationTime: string;
  LastModifiedBy: string;
  LastModifiedTime: string;
  AccessType: string;
  Workspace: string;
  Model: string;
  EmbeddedConfig?: {
    BotAvatar?: string;
    BotWelcomeMessage?: string;
    BotName?: string;
    Suggestions?: string[];
    SaveChatHistory: "yes" | "no"
  };
  Instructions?: string,
  KeepActive: boolean,
  EnableRedaction: boolean
}

export const chatbotsApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getChatbots: build.query({
      query: ( queryParams ) => urlBuilder( "chatbots", queryParams ),
      providesTags: ( result ) => result ? [{ type: tagTypes.chatbots, id: "LIST" }] : []
    }),
    createChatbot: build.mutation<any, CreateChatbotRequestBody>({
      query: ( requestBody ) => ({
        url: urlBuilder( "chatbots" ),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.chatbots, id: "LIST" }] : []
    }),
    updateChatbot: build.mutation({
      query: ({ id, requestBody }: {id: string, requestBody: UpdateChatbotRequestBody}) => ({
        url: urlBuilder([ "chatbots", id ]),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { id }) => result ? [{ type: tagTypes.chatbots, id }, { type: tagTypes.chatbots, id: "LIST" }] : []
    }),
    getChatbotDetails: build.query({
      query: ( id: string ) => urlBuilder([ "chatbots", id ]),
      providesTags: ( result, error, id ) => result ? [{ type: tagTypes.chatbots, id }] : []
    }),
    deleteChatbot: build.mutation<any, string>({
      query: ( id ) => ({
        url: urlBuilder([ "chatbots", id ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.chatbots, id: "LIST" }] : []
    })
  }),
  overrideExisting: true
});

export const {
  useGetChatbotsQuery,
  useCreateChatbotMutation,
  useUpdateChatbotMutation,
  useGetChatbotDetailsQuery,
  useLazyGetChatbotDetailsQuery,
  useDeleteChatbotMutation
} = chatbotsApi;