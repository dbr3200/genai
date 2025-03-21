import { baseApi } from "../baseApi";
import { tagTypes } from "../tagTypes";
import { urlBuilder } from "../../modules/utils/fetchUtils";

export interface ActionGroup {
  ActionGroupId: string;
  ActionGroupName: string;
  Description?: string;
  LambdaS3Path: string;
  LambdaHandler: string;
  ApiDefS3Path: string;
  AttachedLibraries?: string[];
}
interface CreateActionGroupResponse {
  ActionGroupId: string;
  Message: string;
}

export interface ActionGroupDetails {
  ActionGroupId: string;
  ActionGroupName: string;
  Description: string;
  LambdaArn: string;
  ApiDefS3Uri: string;
  LambdaS3Uri: string;
  CreatedBy: string;
  CreationTime: string;
  LastModifiedBy: string;
  LastModifiedTime: string;
  ActionGroupStatus: string;
  Message: string;
  LambdaHandler: string;
  AttachedLibraries: {LibraryId: string, LibraryName:string}[];
  SystemGenerated?: "yes" | "no";
}

interface ListActionGroupsResponse {
  ActionGroups: [
  {
    ActionGroupId: string;
    ActionGroupName: string;
    Description: string;
    LambdaArn: string;
    ApiDefS3Uri: string;
    CreatedBy: string;
    CreationTime: string;
    LastModifiedBy: string;
    LastModifiedTime: string;
    SystemGenerated?: "yes" | "no";
  }
  ];
  next_available: "no" | "yes";
  count: number;
  total_count: number;
}

interface GetActionGroupsPresignedURLResponse {
  Message: string;
  LambdaPresignedURL: string;
  ApiDefPresignedURL: string;
  ActionGroupId: string;
  LambdaS3Path: string;
  ApiDefS3Path: string;
}

interface GetActionGroupPresignedURLResponse {
  Message: string,
  ActionGroupId: string,
  LambdaPresignedURL: string,
  ApiDefPresignedURL: string,
  LambdaS3Path: string,
  ApiDefS3Path: string
}

interface UpdateActionGroup {
  Description?: string;
  LambdaS3Path?: string;
  LambdaHandler?: string;
  ApiDefS3Path?: string;
  AttachedLibraries?: string[];
}

export const actionGroupsApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getActionGroups: build.query<ListActionGroupsResponse, any>({
      query: ( args ) => urlBuilder([ "agents", "action-groups" ], args ),
      providesTags: ( result ) => result ? [{ type: tagTypes.actionGroups, id: "LIST" }] : []
    }),
    getActionGroupsPresignedURL: build.query<GetActionGroupsPresignedURLResponse, string>({
      query: ( id?: string ) => {
        return urlBuilder([ "agents", "action-groups" ].concat( id ? [`${id}`] : []), { action: "get_presigned_url" });
      }
    }),
    createActionGroup: build.mutation<CreateActionGroupResponse, ActionGroup>({
      query: ( requestBody ) => ({
        url: urlBuilder([ "agents", "action-groups" ]),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.actionGroups, id: "LIST" }] : []
    }),
    getActionGroupDetails: build.query<ActionGroupDetails, string>({
      query: ( id: string ) => urlBuilder([ "agents", "action-groups", id ]),
      providesTags: ( result, error, id ) => result ? [{ type: tagTypes.actionGroups, id }] : []
    }),
    getActionGroupPresignedURL: build.query<GetActionGroupPresignedURLResponse, string>({
      query: ( id ) => urlBuilder([ "agents", "action-groups", id ], { action: "get_presigned_url" })
    }),
    deleteActionGroup: build.mutation<{ Message: string }, string>({
      query: ( id ) => ({
        url: urlBuilder([ "agents", "action-groups", id ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.actionGroups, id: "LIST" }] : []
    }),
    getPresignedURLForLambdaFileDownload: build.query<{ Message: string, PresignedURL: string }, string >({
      query: ( id ) => urlBuilder([ "agents", "action-groups", id ], { action: "download_lambda_file" })
    }),
    getPresignedURLForAPIDefFileDownload: build.query<{ Message: string, PresignedURL: string }, string >({
      query: ( id ) => urlBuilder([ "agents", "action-groups", id ], { action: "download_apidef_file" })
    }),
    updateActionGroup: build.mutation<{ Message: string}, {id: string, requestBody: UpdateActionGroup}>({
      query: ({ id, requestBody }) => ({
        url: urlBuilder([ "agents", "action-groups", id ]),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { id }) => result ? [{ type: tagTypes.actionGroups, id }, { type: tagTypes.actionGroups, id: "LIST" }] : []
    }),
    downloadActionGroupLogs: build.query<{ Message: string, PresignedURL: string }, { actionGroupId: string, startTime: string, endTime: string } >({
      query: ({ actionGroupId, startTime, endTime }) => urlBuilder([ "agents", "action-groups", actionGroupId, "logs" ],
        { "start-time": startTime, "end-time": endTime })
    })
  }),
  overrideExisting: true
});

export const {
  useGetActionGroupsQuery,
  useDeleteActionGroupMutation,
  useCreateActionGroupMutation,
  useGetActionGroupDetailsQuery,
  useLazyGetActionGroupDetailsQuery,
  useGetActionGroupsPresignedURLQuery,
  useGetActionGroupPresignedURLQuery,
  useUpdateActionGroupMutation,
  useGetPresignedURLForLambdaFileDownloadQuery,
  useGetPresignedURLForAPIDefFileDownloadQuery,
  useLazyDownloadActionGroupLogsQuery
} = actionGroupsApi;