/**
 * Universal key identifiers to resource keys mapping
 */
export const SORT_COLUMN_MAPPINGS = {
  CreatedBy: {
    keyValue: "CreatedBy",
    keyDisplayName: "Created By"
  },
  CreationTime: {
    keyValue: "CreationTime",
    keyDisplayName: "Creation Time"
  },
  LastModifiedBy: {
    keyValue: "LastModifiedBy",
    keyDisplayName: "Last Modified By"
  },
  LastModifiedTime: {
    keyValue: "LastModifiedTime",
    keyDisplayName: "Last Modified Time"
  },
  Name: {
    keyValue: "AgentName",
    keyDisplayName: "Agent Name"
  },
  BaseModel: {
    keyValue: "BaseModel",
    keyDisplayName: "Base Model"
  },
  AgentStatus: {
    keyValue: "AgentStatus",
    keyDisplayName: "Agent Status"
  }
};

/**
 * Array of resources fields and defaultDisplay values
 */
export const DISPLAY_FIELDS = [
  { "FieldName": "AgentName", "FieldProps": { defaultDisplay: true, fixed: true } },
  { "FieldName": "BaseModel", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "AgentStatus", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "CreatedBy", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "LastModifiedBy", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "ReferenceId", "FieldProps": { defaultDisplay: false } }

];

