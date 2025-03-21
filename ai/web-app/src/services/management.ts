import { baseApi } from "./baseApi";
import { tagTypes } from "./tagTypes";
import { urlBuilder } from "../modules/utils/fetchUtils";

export const managementApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getCommonSystemConfigs: build.query({
      query: ( config: "all" | "rag-engines" | "default-language" ) => urlBuilder( "app-management", { config }),
      providesTags: ( result ) => result ? [{ type: tagTypes.systemConfigs }] : []
    }),
    updateSystemLevelConfig: build.mutation<any,
    { config: "rag-engines" | "default-language" | "openai-key",
      requestBody: {
        RagEngines?: Record<string, string>,
        DefaultLanguage?: string
      }
    }>({
      query: ({ config, requestBody }) => ({
        url: urlBuilder( "app-management", { config }),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.systemConfigs }] : []
    })
  }),
  overrideExisting: true
});

export const {
  useGetCommonSystemConfigsQuery,
  useUpdateSystemLevelConfigMutation
} = managementApi;