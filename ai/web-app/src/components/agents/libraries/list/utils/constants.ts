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
    keyValue: "LibraryName",
    keyDisplayName: "Library Name"
  }
};

/**
 * Array of resources fields and defaultDisplay values
 */
export const DISPLAY_FIELDS = [
  { "FieldName": "LibraryName", "FieldProps": { defaultDisplay: true, fixed: true } },
  { "FieldName": "CreatedBy", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "LastModifiedBy", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "LastModifiedTime", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "LibraryId", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "Packages", "FieldProps": { defaultDisplay: true } }
];

