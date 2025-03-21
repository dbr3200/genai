import { baseApi } from "./baseApi";
import { tagTypes } from "./tagTypes";
import { urlBuilder } from "../modules/utils/fetchUtils";
import { ModelStatusCode } from "../constants";

export interface CreateModelPayload {
    ModelName: string;
    CustomizationType: string;
    BaseModelId: string;
    Description?: string;
    TrainingDataLocation: string;
    ValidationDataLocation?: string;
    HyperParameters?: Record<string, string>;
}

export interface Model {
  ModelId: string;
  ModelName: string;
  ModelProvider: string;
  ModelStatusCode: ModelStatusCode;
  ModelStatusMessage: string;
  ModelType: "base" | "custom";
  AvailabilityStatus: "Available" | "Unavailable";
  UserAccessible: "yes" | "no";
  LastModifiedTime : string;
  CustomizationsSupported: string[];
  InferenceTypesSupported: string[];
  Modalities: string[];
  Description: string;
}

export interface ModelsList {
  Models: Model[];
 next_available: "no" | "yes";
 count: number;
 total_count: number;
}

export interface ModelRunRequestBody {
    RunType: "all" | "select" | "latest" | "failed";
    Documents: string [];
}

export interface ModelDetails {
  ModelId: string;
  Description: string;
  IsStreamingEnabled: string;
  ModelType: "Base" | "Custom"
  ModelArn: string;
  ModelName: string;
  ModelProvider?: string;
  ModelTraits?: string;
  ModelStatusCode: ModelStatusCode;
  ModelStatusMessage: string;
  AvailabilityStatus: "Available" | "Unavailable"
  UserAccessible: "yes" | "no"
  CreatedBy: string;
  CreationTime: string;
  LastModifiedBy: string;
  LastModifiedTime: string;
  CustomizationsSupported: string[],
  InferenceTypesSupported: string[],
  Modalities: string[],
  AdditionalConfiguration: {
    CustomizationType: string,
    HyperParameters: Record<string, any>,
    ProvisionThroughputConfig?: {
      ModelUnits: number;
      ProvisionedModelArn: string;
    },
    Message: string,
    BaseModelId: string,
    BaseModelName: string,
    OutputDataLocation: string, // S3 path
    TrainingDataLocation: string, // S3 path
    ValidationDataLocation: string, // S3 path
    Status: string,
  }
}

export const modelsApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getModels: build.query<ModelsList, Record<string, any> | undefined>({
      query: ( args ) => urlBuilder( "models", args ),
      providesTags: ( result ) => result ? [{ type: tagTypes.models, id: "LIST" }] : []
    }),
    // Sync models metadata from bedrock to dynamodb
    syncModels: build.query({
      query: () => urlBuilder( "models", { action: "sync_models_metadata" })
    }),
    getModelDetails: build.query<ModelDetails, string>({
      query: ( id: string ) => urlBuilder([ "models", id ]),
      providesTags: ( result, error, id ) => result ? [{ type: tagTypes.models, id }] : []
    }),
    createModel: build.mutation({
      query: ( requestBody: CreateModelPayload ) => ({
        url: urlBuilder( "models" ),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.models, id: "LIST" }] : []
    }),
    getModelPresignedURL: build.mutation({
      query: ( requestBody: { ModelName: string, DataType: "training" | "validation" }) => ({
        url: urlBuilder( "models", { action: "get_presigned_url" }),
        method: "POST",
        body: requestBody
      })
    }),
    updateProvisionThroughput: build.mutation({
      query: ({ id, requestBody }: {id: string, requestBody: { ModelUnits: number}}) => ({
        url: urlBuilder([ "models", id, "throughput" ]),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { id }) => result ? [{ type: tagTypes.models, id }, { type: tagTypes.models, id: "LIST" }] : []
    }),
    updateModelAvailability: build.mutation({
      query: ({ id, action }: {id: string, action: "enable" | "disable"}) => ({
        url: urlBuilder([ "models", id ], { action }),
        method: "PUT"
      }),
      invalidatesTags: ( result, error, { id }) => result ? [{ type: tagTypes.models, id }, { type: tagTypes.models, id: "LIST" }] : []
    }),
    deleteThroughput: build.mutation({
      query: ( id: string ) => ({
        url: urlBuilder([ "models", id, "throughput" ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result, error, id ) => result ? [{ type: tagTypes.models, id }, { type: tagTypes.models, id: "LIST" }] : []
    }),
    deleteModel: build.mutation({
      query: ( id: string ) => ({
        url: urlBuilder([ "models", id ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.models, id: "LIST" }] : []
    }),
    downloadModelData: build.query({
      query: ({ id, type }: { id: string, type: "training" | "validation" | "metrics" }) => urlBuilder([ "models", id, "download" ], { "data-type": type })
    })
  }),
  overrideExisting: true
});

export const {
  useGetModelsQuery,
  useLazySyncModelsQuery,
  useGetModelDetailsQuery,
  useDeleteModelMutation,
  useCreateModelMutation,
  useLazyGetModelDetailsQuery,
  useGetModelPresignedURLMutation,
  useLazyDownloadModelDataQuery,
  useUpdateProvisionThroughputMutation,
  useDeleteThroughputMutation,
  useUpdateModelAvailabilityMutation
} = modelsApi;