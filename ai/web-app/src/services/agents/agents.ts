import { baseApi } from "../baseApi";
import { tagTypes } from "../tagTypes";
import { urlBuilder } from "../../modules/utils/fetchUtils";

export interface Agent {
	AgentName: string;
	Description?: string;
	BaseModel: string;
	Instruction: string;
	QueryFollowUp?: "enabled" | "disabled";
}

interface CreateAgentResponse {
  AgentId: string;
  Message: string;
}

export interface AgentDetails {
	AgentId: string;
	AgentName: string;
	ReferenceId: string;
	AgentArn: string;
	QueryFollowUp: "enabled" | "disabled";
	Description: string;
	BaseModel: string;
	Instruction: string;
	AgentStatus: string;
	CreatedBy: string;
	CreationTime: string;
	LastModifiedBy: string;
	LastModifiedTime: string;
	Message: string;
	AttachedActionGroups: { ActionGroupId: string; ActionGroupName: string; ReferenceId: string }[];
  AttachedWorkspaces: {
    WorkspaceId: string;
    WorkspaceName: string;
  }[];
}

interface ListAgentsResponse {
  Agents: [
  {
		AgentId: string;
		AgentName: string;
		ReferenceId: string;
		Description: string;
		BaseModel: string;
		AgentStatus: string;
		CreatedBy: string;
		CreationTime: string;
		LastModifiedBy: string;
		LastModifiedTime: string
  }];
	next_available: "no" | "yes";
	count: 0;
	total_count: 0;
}

interface ListAgentActionGroupsResponse {
	ActionGroups: [
	{
		ActionGroupId: string;
		ActionGroupName: string;
		ReferenceId: string;
		Description: string;
		LambdaArn: string;
		ApiDefS3Uri: string;
		CreatedBy: string;
		CreationTime: string;
		LastModifiedBy: string;
		LastModifiedTime: string;
		Message: string;
		LambdaHandler: string;
		AttachedLibraries: string[];
		ActionGroupStatus: string;
	}]
}

export const agentsApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getAgents: build.query<ListAgentsResponse, any>({
      query: ( args ) => urlBuilder( "agents", args ),
      providesTags: ( result ) => result ? [{ type: tagTypes.agents, id: "LIST" }] : []
    }),
    createAgent: build.mutation<CreateAgentResponse, Agent>({
      query: ( requestBody ) => ({
        url: urlBuilder( "agents" ),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.agents, id: "LIST" }] : []
    }),
    getAgentDetails: build.query<AgentDetails, string>({
      query: ( id: string ) => urlBuilder([ "agents", id ]),
      providesTags: ( result, error, id ) => result ? [{ type: tagTypes.agents, id }] : []
    }),
    deleteAgent: build.mutation<{ Message: string }, string>({
      query: ( id ) => ({
        url: urlBuilder([ "agents", id ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.agents, id: "LIST" }] : []
    }),
    updateAgent: build.mutation<{ Message: string}, {id: string, requestBody: {
      Description?: string;
			BaseModel?: string;
			Instruction?: string;
    }}>({
      query: ({ id, requestBody }) => ({
        url: urlBuilder([ "agents", id ]),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { id }) => result ? [{ type: tagTypes.agents, id }, { type: tagTypes.agents, id: "LIST" }] : []
    }),
    getAgentActionGroups: build.query<ListAgentActionGroupsResponse, string>({
      query: ( id ) => urlBuilder([ "agents", id, "action-groups" ]),
      providesTags: ( result ) => result ? [{ type: tagTypes.agentsActionGroups, id: "LIST" }] : []
    }),
    updateAgentActionGroups: build.mutation<{ Message: string}, {id: string, requestBody: {
      ActionGroups: string[] }}>({
        query: ({ id, requestBody }) => ({
          url: urlBuilder([ "agents", id, "action-groups" ]),
          method: "PUT",
          body: requestBody
        }),
        invalidatesTags: ( result ) => result ? [{ type: tagTypes.agentsActionGroups, id: "LIST" }] : []
      }),
    syncAgent: build.mutation<{ Message: string}, string>({
      query: ( id ) => ({
        url: urlBuilder([ "agents", id ], { action: "prepare-agent" }),
        method: "PUT",
        body: {}
      }),
      invalidatesTags: ( result, error, id ) => result ? [{ type: tagTypes.agents, id }, { type: tagTypes.agents, id: "LIST" }] : []
    }),
    updateAttachedWorkspaces: build.mutation<{ Message: string}, {id: string, Workspaces: string[] }>({
      query: ({ id, Workspaces }) => ({
        url: urlBuilder([ "agents", id ], { action: "update-workspace" }),
        method: "PUT",
        body: { Workspaces }
      }),
      invalidatesTags: ( result, error, { id }) => result ? [{ type: tagTypes.agents, id }, { type: tagTypes.agents, id: "LIST" }] : []
    }),
    sendMessageToAgent: build.mutation<{
      Message: { User: string, AI: string },
      MessageId: string
    }, {
      id: string,
      requestBody: {
        SessionId: string;
        UserMessage: string;
      }
    }>({
      query: ({ id, requestBody }) => ({
        url: urlBuilder([ "agents", id, "invoke" ]),
        method: "POST",
        body: requestBody
      })
    })
  }),
  overrideExisting: true
});

export const {
  useGetAgentsQuery,
  useDeleteAgentMutation,
  useCreateAgentMutation,
  useGetAgentDetailsQuery,
  useLazyGetAgentDetailsQuery,
  useUpdateAgentMutation,
  useGetAgentActionGroupsQuery,
  useUpdateAgentActionGroupsMutation,
  useSendMessageToAgentMutation,
  useUpdateAttachedWorkspacesMutation,
  useSyncAgentMutation
} = agentsApi;