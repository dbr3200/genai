/**
 * Universal key identifiers to resource keys mapping
 */
export const SORT_COLUMN_MAPPINGS = {
  Name: {
    keyValue: "ChatbotName",
    keyDisplayName: "Chatbot Name"
  },
  CreatedBy: {
    keyValue: "CreatedBy",
    keyDisplayName: "Created By"
  },
  AccessType: {
    keyValue: "AccessType",
    keyDisplayName: "Access Type"
  },
  LastModifiedTime: {
    keyValue: "LastModifiedTime",
    keyDisplayName: "Last Modified Time"
  },
  CreationTime: {
    keyValue: "CreationTime",
    keyDisplayName: "Creation Time"
  },
  LastModifiedBy: {
    keyValue: "LastModifiedBy",
    keyDisplayName: "Last Modified By"
  },
  Workspace: {
    keyValue: "Workspace",
    keyDisplayName: "Workspace"
  }
};

/**
 * Array of resources fields and defaultDisplay values
 */
export const DISPLAY_FIELDS = [
  { "FieldName": "ChatbotName", "FieldProps": { defaultDisplay: true, fixed: true } },
  { "FieldName": "ChatbotId", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "Workspace", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "Endpoint", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "Description", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "Keywords", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "CreatedBy", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "CreationTime", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "LastModifiedBy", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "LastModifiedTime", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "AccessType", "FieldProps": { defaultDisplay: false } }
];