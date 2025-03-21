import React from "react";
import { ADPIcon, AvatarGroup, EmptyState } from "@amorphic/amorphic-ui-core";
import { TTriggerType } from "./types";
import { FallbackIfEmpty } from "../../../utils/renderUtils";

export const triggerTypeItem = ( option: TTriggerType ): JSX.Element => {
  return <div className="flex items-center gap-2">
    {option === "on-demand" ?
      <ADPIcon icon="restart" size="xs" /> :
      option === "file-based" ?
        <ADPIcon icon="file" size="xs" /> : <ADPIcon icon="scheduled" size="xs" />}
    <span>{option}</span>
  </div>;
};

export const keywordsItem = ( keywords: string[] = []): JSX.Element => {
  return <FallbackIfEmpty data={keywords} fallback="-">
    <AvatarGroup maxItems={3} size="sm">
      {keywords?.map(( tag: string ) => <AvatarGroup.Item size="sm" key={`${tag}_tag`} label={tag} /> )}
    </AvatarGroup>
  </FallbackIfEmpty>;
};

export const emptyMessage = ( props: any ) => {
  return <EmptyState defaultImageVariant="zero-results" display="vertical" transparentBG>
    <EmptyState.Content>
      { props?.props?.totalRecords > 0 ? "No records found for the filters!" : "No records found!" }
    </EmptyState.Content>
  </EmptyState>;
};