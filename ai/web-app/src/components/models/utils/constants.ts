/**
 * Universal key identifiers to resource keys mapping
 */
export const SORT_COLUMN_MAPPINGS = {
  LastModifiedTime: {
    keyValue: "LastModifiedTime",
    keyDisplayName: "Last Modified Time"
  },
  Name: {
    keyValue: "ModelName",
    keyDisplayName: "Model Name"
  },
  ModelType: {
    keyValue: "ModelType",
    keyDisplayName: "Model Type"
  },
  ModelStatusCode: {
    keyValue: "ModelStatusCode",
    keyDisplayName: "Model Status"
  }
};

/**
 * Array of resources fields and defaultDisplay values
 */
export const DISPLAY_FIELDS = [
  { "FieldName": "ModelName", "FieldProps": { defaultDisplay: true, fixed: true } },
  { "FieldName": "ModelType", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "ModelProvider", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "Modalities", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "ModelTraits", "FieldProps": { defaultDisplay: true } },
  { "FieldName": "ModelId", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "LastModifiedTime", "FieldProps": { defaultDisplay: false } },
  { "FieldName": "CustomizationsSupported", "FieldProps": { defaultDisplay: false } }
];

