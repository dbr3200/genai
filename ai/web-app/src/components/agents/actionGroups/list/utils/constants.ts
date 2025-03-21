/**
 * Universal key identifiers to resource keys mapping
 */
export const SORT_COLUMN_MAPPINGS = {
  CreatedBy: {
    keyValue: "CreatedBy",
    keyDisplayName: "Created By"
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
    keyValue: "ActionGroupName",
    keyDisplayName: "Action Group Name"
  },
  SystemGenerated: {
    keyValue: "SystemGenerated",
    keyDisplayName: "Pre-baked"
  }
};

/**
 * Array of resources fields and defaultDisplay values
 */
export const DISPLAY_FIELDS = [
  { "FieldName": "ActionGroupName", "FieldProps": { defaultDisplay: true, fixed: true } },
  { "FieldName": "CreatedBy", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "LastModifiedBy", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "LastModifiedTime", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "ActionGroupId", "FieldProps": { defaultDisplay: false } }
];

