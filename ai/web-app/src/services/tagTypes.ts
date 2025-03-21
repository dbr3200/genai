
export const tagTypes = {
  workspaces: "Workspaces",
  workspaceRuns: "WorkspaceRuns",
  workspaceDocuments: "WorkspaceDocuments",
  workspaceStats: "WorkspaceStats",
  libraries: "Libraries",
  agents: "Agents",
  agentsActionGroups: "AgentActionGroups",
  actionGroups: "ActionGroups",
  chatbots: "Chatbots",
  chat: "Chat",
  chatSessions: "ChatSessions",
  models: "Models",
  systemConfigs: "SystemConfigs",
  datasets: "Datasets",
  domains: "Domains",
  authorizations: "Authorizations",
  roles: "Roles",
  user: "User",
  commonUsers: "commonUsers",
  commonDatasets: "commonDatasets",
  tenants: "tenants",
  userAlerts: "userAlerts",
  userPreferences: "userPreferences",
  chatSessionFiles: "chatSessionFiles",
  workspaceCrawls: "WorkspaceCrawls"
} as const;

export type TagTypeKeys = keyof typeof tagTypes;
