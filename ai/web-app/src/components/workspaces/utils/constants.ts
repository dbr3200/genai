/**
 * Universal key identifiers to resource keys mapping
 */
export const SORT_COLUMN_MAPPINGS = {
  Name: {
    keyValue: "WorkspaceName",
    keyDisplayName: "Workspace Name"
  },
  AccessType: {
    keyValue: "AccessType",
    keyDisplayName: "Access Type"
  },
  TriggerType: {
    keyValue: "TriggerType",
    keyDisplayName: "Trigger Type"
  },
  LastModifiedTime: {
    keyValue: "LastModifiedTime",
    keyDisplayName: "Last Modified Time"
  }
};

/**
 * Array of resources fields and defaultDisplay values
 */
export const DISPLAY_FIELDS = [
  { "FieldName": "WorkspaceName", "FieldProps": { defaultDisplay: true, fixed: true } },
  { "FieldName": "WorkspaceId", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "AccessType", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "TriggerType", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "LastModifiedTime", "FieldProps": { defaultDisplay: true } }
];

export const triggerTypeOptions = [
  { label: "On-Demand", value: "on-demand" },
  { label: "Time-Based", value: "time-based" },
  { label: "File-Based", value: "file-based" }
];