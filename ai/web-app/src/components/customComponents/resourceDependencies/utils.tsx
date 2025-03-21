import { PermanentPathObject } from "../../../types";
import { MappingReturnType } from "./types";

export const getMappings = ( permanentPaths: PermanentPathObject = {}): MappingReturnType => ({
  "Pipelines": {
    name: "PipelineName",
    serviceName: "Process Flows",
    id: "PipelineId",
    path: permanentPaths?.pipelines?.path
  }
});