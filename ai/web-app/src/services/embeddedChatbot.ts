import { unauthApi } from "./baseApi";
import { urlBuilder } from "../modules/utils/fetchUtils";

export const embeddedChatbotApi = unauthApi.injectEndpoints({
  endpoints: ( build ) => ({
    getEmbeddedChatbotDetails: build.query({
      query: ( id: string ) => urlBuilder([ "embedded", "chatbot", id ])
    })
  }),
  overrideExisting: true
});

export const {
  useGetEmbeddedChatbotDetailsQuery
} = embeddedChatbotApi;