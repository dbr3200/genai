import { baseApi } from "./baseApi";
import { tagTypes } from "./tagTypes";
import { urlBuilder } from "../modules/utils/fetchUtils";
import { Option } from "../types";

export interface Workspace {
    WorkspaceName: string;
    TriggerType: "on-demand" | "time-based" | "file-based";
    ScheduleExpression?: string;
    AttachedDatasets:string[];
    Description?: string;
    Keywords?: string[] | Option[];
    EmbeddingsModel?: string;
    ChunkingConfig?: {
        MaxTokens: number|string;
        OverlapPercentage: number|string;
      }
}

interface UpdateWorkspaceRequestBody {
    TriggerType: "on-demand" | "time-based" | "file-based";
    ScheduleExpression?: string;
    Description: string;
    Keywords: string[];
}

interface AddDocumentRequestBody {
    DocumentType: "file" | "qna" | "text" | "website";
    DocumentDetails: {
      //qna
      Question: string;
      Answer: string; } |
      {
      // website
    WebsiteURL: string;
    FollowLinks: boolean;
    PageLimit: number;
      } |
    {
    // text
    Title: string;
    Content: string;
    } |
    {
    // file
    DocumentName: string;
    SourceDatasetId: string;
  }
}

export interface WorkspaceDetails {
  AccessType: "owner" | "readonly";
  AttachedDatasets:string[];
  WorkspaceName: string;
  WorkspaceId: string;
  SourceFileSyncStatus: "pending" | "running" | "completed" | "failed";
  TriggerType: "on-demand" | "time-based" | "file-based";
  ScheduleExpression?: string;
  DatasetsAttached: {
    DatasetName: string;
    DatasetId: string;
    Domain: string;
    FileType: any;
  }[];
  EmbeddingsModel?: {
    Id: string;
    Name: string;
  };
  ChunkingConfig: {
    MaxTokens: number;
    OverlapPercentage: number;
  };
  Description: string;
  LastModifiedTime: string;
  LastModifiedBy: string
  Keywords: string[];
  CreatedBy: string;
  CreationTime: string;
}

export const workspacesApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getWorkspaces: build.query({
      query: ( args ) => urlBuilder(["workspaces"], args ),
      providesTags: ( result ) => result ? [{ type: tagTypes.workspaces, id: "LIST" }] : []
    }),
    createWorkspace: build.mutation({
      query: ( requestBody: Workspace ) => ({
        url: urlBuilder( "workspaces" ),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.workspaces, id: "LIST" }] : []
    }),
    getWorkspaceDetails: build.query<WorkspaceDetails, string>({
      query: ( id: string ) => urlBuilder([ "workspaces", id ]),
      providesTags: ( result, error, id ) => result ? [{ type: tagTypes.workspaces, id }] : []
    }),
    updateWorkspace: build.mutation({
      query: ({ id, requestBody }: {id: string, requestBody: UpdateWorkspaceRequestBody}) => ({
        url: urlBuilder([ "workspaces", id ]),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { id }) => result ? [{ type: tagTypes.workspaces, id }, { type: tagTypes.workspaces, id: "LIST" }] : []
    }),
    deleteWorkspace: build.mutation({
      query: ( id: string ) => ({
        url: urlBuilder([ "workspaces", id ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.workspaces, id: "LIST" }] : []
    }),
    getWorkspaceRuns: build.query({
      query: ({ id, queryParams } : {id: string, queryParams: any }) => urlBuilder([ "workspaces", id, "runs" ], queryParams ),
      providesTags: ( result ) => result ? [{ type: tagTypes.workspaceRuns, id: "LIST" }] : []
    }),
    runWorkspace: build.mutation({
      query: ( id: string ) => ({
        url: urlBuilder([ "workspaces", id, "runs" ]),
        method: "POST",
        body: {}
      }),
      invalidatesTags: ( result, error, id ) => result ? [{ type: tagTypes.workspaceRuns, id: "LIST" }, { type: tagTypes.workspaceStats, id }] : []
    }),
    getWorkspaceRunDetails: build.query({
      query: ({ workspaceId, runId }: { workspaceId: string, runId: string }) => urlBuilder([ "workspaces", workspaceId, "runs", runId ]),
      providesTags: ( result, error, { runId }) => result ? [{ type: tagTypes.workspaceRuns, runId }] : []
    }),
    getWorkspaceDocuments: build.query({
      query: ({ id, queryParams }: { id: string, queryParams: any }) => urlBuilder([ "workspaces", id, "documents" ], queryParams ),
      providesTags: ( result ) => result ? [{ type: tagTypes.workspaceDocuments, id: "LIST" }] : []
    }),
    getWorkspaceDocumentsDetails: build.query({
      query: ({ id, documentId, queryParams }: { id: string, documentId: string, queryParams:any }) =>
        urlBuilder([ "workspaces", id, "documents", documentId ], queryParams ),
      providesTags: ( result ) => result ? [{ type: tagTypes.workspaceDocuments, id: "LIST" }] : []
    }),
    deleteWorkspaceDocument: build.mutation({
      query: ({ workspaceId, documentId }: { workspaceId: string, documentId: string }) => ({
        url: urlBuilder([ "workspaces", workspaceId, "documents", documentId ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.workspaceDocuments, id: "LIST" }] : []
    }),
    addDocuments: build.mutation({
      query: ({ id, requestBody }: {id: string, requestBody: AddDocumentRequestBody}) => ({
        url: urlBuilder([ "workspaces", id, "documents" ]),
        method: "POST",
        body: requestBody
      })
    }),
    getWorkspacePresignedURL: build.mutation({
      query: ({ id, requestBody }: {id: string, requestBody: { SourceDatasetId: string, FileName: string }}) => ({
        url: urlBuilder([ "workspaces", id, "documents" ], { action: "get_presigned_url" }),
        method: "POST",
        body: requestBody
      })
    }),
    getWorkspaceDocumentStats: build.query({
      query: ( id: string ) => urlBuilder([ "workspaces", id, "stats" ]),
      providesTags: ( result, error, id ) => result ? [{ type: tagTypes.workspaceStats, id }] : []
    }),
    getWorkspaceCrawlList: build.query({
      query: ({ id, queryParams }: { id: string, queryParams: any }) => urlBuilder([ "workspaces", id, "crawl-website" ], queryParams ),
      providesTags: ( result ) => result ? [{ type: tagTypes.workspaceCrawls, id: "LIST" }] : []
    }),
    triggerCrawlJob: build.mutation({
      query: ({ id, requestBody }: {id: string, requestBody: { WebsiteURL: string, FollowLinks: boolean, PageLimit: number }}) => ({
        url: urlBuilder([ "workspaces", id, "crawl-website" ]),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.workspaceCrawls, id: "LIST" }] : []
    }),
    getWorkspaceCrawlDetails: build.query({
      query: ({ id, crawlId, queryParams }: { id: string, crawlId: string, queryParams:any }) => urlBuilder([ "workspaces", id, "crawl-website", crawlId ],
        queryParams ),
      providesTags: ( result, error, { crawlId }) => result ? [{ type: tagTypes.workspaceCrawls, id: crawlId }] : []
    }),
    deleteWorkspaceCrawl: build.mutation({
      query: ({ id, crawlId }: { id: string, crawlId: string }) => ({
        url: urlBuilder([ "workspaces", id, "crawl-website", crawlId ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.workspaceCrawls, id: "LIST" }] : []
    }),
    addWebsitesToWorkspace: build.mutation({
      query: ({ id, requestBody }: {id: string, requestBody: {DocumentType: string, DocumentDetails: {WebsiteURLs: string[], CrawlId?:string }}}) => ({
        url: urlBuilder([ "workspaces", id, "documents" ]),
        method: "POST",
        body: requestBody
      })
    })
  }),
  overrideExisting: true
});

export const {
  useGetWorkspacesQuery,
  useDeleteWorkspaceMutation,
  useCreateWorkspaceMutation,
  useUpdateWorkspaceMutation,
  useGetWorkspaceDetailsQuery,
  useLazyGetWorkspaceDetailsQuery,
  useGetWorkspacePresignedURLMutation,
  useGetWorkspaceDocumentsQuery,
  useGetWorkspaceDocumentStatsQuery,
  useAddDocumentsMutation,
  useGetWorkspaceRunsQuery,
  useGetWorkspaceRunDetailsQuery,
  useRunWorkspaceMutation,
  useDeleteWorkspaceDocumentMutation,
  useGetWorkspaceDocumentsDetailsQuery,
  useGetWorkspaceCrawlListQuery,
  useGetWorkspaceCrawlDetailsQuery,
  useAddWebsitesToWorkspaceMutation,
  useTriggerCrawlJobMutation,
  useDeleteWorkspaceCrawlMutation
} = workspacesApi;