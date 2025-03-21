import { TAccessType, TTriggerType } from "../types";

export interface ICustomMiddlewareArguments {
    skipNotification?: boolean;
}

export interface IPipeline {
    "AccessType": TAccessType;
    "PipelineId": "string";
    "PipelineName": "string";
    "Description"?: string;
    "Keywords"?: string[];
    "Features"?: string[];
    "TriggerType": TTriggerType;
    "ScheduleExpression"?: string;
    "DatastoreFileSyncStatus"?: string;
    "SourceDatastoreId"?: string;
    "SourceFileSyncStatus"?: string;
    "Rules"?: [];
    "LastModifiedTime"?: string;
    "LastModifiedBy"?: string;
    "CreationTime"?: string;
    "CreatedBy"?: string;
    "PipelineStatus"?: string;
}

// GET /pipelines/rules

export interface RulesResponse {
    Rules: Rule[];
}

export interface Rule {
    RuleName: string;
    Description: string;
    AllowMultiple: boolean;
    HasRequiredFields: boolean;
    Configuration: Configuration;
}

export interface Configuration {
    RuleType: RuleType;
    TargetKey: RuleConfiguration;
    RuleConfiguration: RuleConfiguration;
    [key: string]: any;
}

export interface Properties {
    Pattern?: RuleConfiguration;
    Operator?: RuleType;
    Value?: Value;
    StartIndex?: RuleConfiguration;
    EndIndex?: RuleConfiguration;
    Delimiter?: RuleConfiguration;
    Operation?: RuleType;
    NewValue?: NewValue;
    Keys?: RuleConfiguration;
    Text?: RuleConfiguration;
    Pages?: RuleConfiguration;
}

export interface RuleConfiguration {
    Description: string;
    Required: boolean;
    Type: RuleConfigurationType;
    Properties?: Properties;
    DefaultValue?: string[] | string;
    CharacterRange?: string;
}

export interface NewValue {
    Description: string;
    Required: string;
    Type: RuleConfigurationType;
}

export enum RuleConfigurationType {
    Object = "object",
    String = "string",
    TypeString = "string[]",
}

export interface RuleType {
    Description: Description;
    Required: boolean;
    AllowMultiple: boolean;
    Type: RuleTypeType;
    Options: Option[];
    DefaultValue?: string;
}

export enum Description {
    SelectWhetherToValidateExtractValuesUsingTheRule = "Select whether to validate/extract values using the rule",
    TheFilterOperatorToBeUsed = "The filter operator to be used",
    TheOperationThatNeedsToBePerformedOnTheValue = "The operation that needs to be performed on the value",
}

export interface Option {
    label: string;
    value: string;
}

export enum RuleTypeType {
    Select = "select",
}

export interface Value {
    Description: string;
    Required: boolean | string;
    TypeCondition?: boolean;
    Type: string;
}

// Auto-Generated Types for GET /pipelines/:resourceId

export interface PipelineDetails {
    SampleFileOutputLocation: string;
    SourceDatastoreFileType: string;
    LastModifiedBy: string;
    PipelineName: string;
    Keywords: string[];
    Description: string;
    SampleFileInputLocation: string;
    CustomScriptConfig: CustomScriptConfig;
    LastModifiedTime: Date;
    OutputDatasetId: string;
    TriggerType: string;
    PipelineId: string;
    Rules: Rule[];
    CreationTime: Date;
    CreatedBy: string;
    OutputDatasetKeys: string[];
    DatastoreFileSyncStatus: string;
    OutputDatasetDomain: string;
    SourceDatastoreId: string;
    AccessType: string;
    StoreFlaggedResults?: boolean;
}

export interface CustomScriptConfig {
    CustomScriptLocation?: string
}

export interface Rule {
    RuleType: string;
    TargetKey: string;
    RuleConfiguration: RuleConfiguration;
    RuleName: string;
}

export interface RuleConfiguration {
    Value?: string[] | string;
    Operator?: string;
    StartIndex?: string;
    EndIndex?: string;
    Operation?: string;
    Delimiter?: string;
}

  interface Source {
    Domain: string;
    FileName: string;
    WebsiteURL?: string;
    Workspace: string;
  }

  interface History {
    MessageTime: string;
    Data: string;
    Type: "human" | "ai";
    MessageId: string;
    Sources?: Source[];
    ResponseTime?: string;
  }

export interface Sessions {
    ClientId: string
    SessionId: string
    ConnectionStartTime: string
    History: History[]
    LatestMessageId: string
    QueryStatus: string
    ExpirationTime: string
    Title: string
    UserId: string
    LastModifiedTime: string
    ConnectionId: string
    MessageDeliveryStatus: string
    StartTime: string
  }