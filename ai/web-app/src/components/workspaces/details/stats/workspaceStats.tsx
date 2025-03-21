import { ADPIcon, Accordion, Button, Card } from "@amorphic/amorphic-ui-core";
import React from "react";
import { useGetWorkspaceDetailsQuery,
  useGetWorkspaceDocumentStatsQuery,
  useRunWorkspaceMutation } from "../../../../services/workspaces";
import ReactECharts from "echarts-for-react";
import { IconType } from "../../../../types";
import TimeStamp from "../../../common/timeStamp";
import { splitPascalCase } from "../../../../utils";
import { useSuccessNotification } from "../../../../utils/hooks";

interface IWorkspaceStatsProps {
  accessType?: string;
  resourceId: string;
}

interface IStatusMappings {
  [key: string]: {
    icon: IconType;
    classes: string;
  }
}

const statusMappings: IStatusMappings = {
  "DocumentsDeleted": {
    icon: "delete",
    classes: "text-warning"
  },
  "ModifiedDocumentsIndexed": {
    icon: "file-edit",
    classes: "text-primary-200"
  },
  "DocumentsScanned": {
    icon: "fileload-validate",
    classes: "text-success"
  },
  "DocumentsFailed": {
    icon: "file-warning",
    classes: "text-danger"
  },
  "NewDocumentsIndexed": {
    icon: "file-info",
    classes: "text-primary-400"
  }
};

const initStats = {
  "DocumentsDeleted": 0,
  "DocumentsFailed": 0,
  "DocumentsScanned": 0,
  "ModifiedDocumentsIndexed": 0,
  "NewDocumentsIndexed": 0
};

const WorkspaceStats = ({
  accessType = "read-only",
  resourceId
}: IWorkspaceStatsProps ): JSX.Element => {
  const {
    data: {
      LatestRunInfo: Stats = initStats
    } = {}, isFetching, refetch: refetchStats
  } = useGetWorkspaceDocumentStatsQuery( resourceId, {
    pollingInterval: 1000 * 60 * 3
  });

  const {
    data: WorkspaceDetails
  } = useGetWorkspaceDetailsQuery( resourceId );

  const [showSuccessNotification] = useSuccessNotification();

  const [ triggerRun, { isLoading: triggerRunWorkspace }] = useRunWorkspaceMutation();

  return ( <div className="">
    <Accordion classes="border border-secondary-200 shadow-none">
      <Accordion.Header classes="overflow-hidden">
        <div className="me-2">
          <button onClick={( e ) => {
            e.preventDefault();
            e.stopPropagation();
            refetchStats();
          }}>
            <ADPIcon icon="sync" size="xs" spin={isFetching} />
          </button>
        </div>

        <div className="w-full flex-1 flex flex-col md:flex-row justify-evenly md:divide-x
        divide-secondary-200 overflow-auto">

          {Object.keys( Stats ).map(( key: string ) => (
            <div key={key} className="flex items-center justify-start gap-2 px-8 font-bold">
              <ADPIcon icon={
                statusMappings[key].icon as IconType
              } classes={statusMappings[key].classes} size="xs" />
              <span className="font-arlon">{splitPascalCase( key )}: </span>
              <span>{isFetching ? <ADPIcon icon="spinner" spin size="xxs" /> : Stats[key]}</span>
            </div>
          ))}
        </div>

      </Accordion.Header>
      <Accordion.Body>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:divide-x divide-secondary-200">
          <ReactECharts
            style={{ height: "200px", paddingTop: 5, marginBottom: 5, backgroundColor: "#fff", position: "relative" }}
            notMerge={true}
            lazyUpdate={true}
            showLoading={isFetching}
            option={{
              tooltip: {
                trigger: "item",
                formatter: "{a} <br/><b>{b}</b>: {c}"
              },
              series: [
                {
                  name: "Files",
                  type: "pie",
                  selectedMode: "single",
                  radius: [ 0, "20%" ],
                  itemStyle: {
                    normal: {
                      label: {
                        show: true, position: "center",
                        fontSize: 16,
                        color: "#fff",
                        formatter: function ( params: any ){
                          return params.value;
                        }
                      }
                    }
                  },
                  data: [
                    { value: Stats.DocumentsScanned, name: "Documents Scanned" }
                  ]
                },
                {
                  name: "File Status",
                  type: "pie",
                  radius: [ "35%", "50%" ],
                  labelLine: {
                    length: 30
                  },
                  itemStyle: {
                    borderRadius: 10,
                    borderColor: "#fff",
                    borderWidth: 2
                  },
                  data: Object.entries( Stats )?.map(
                    ([ key, value ]) => ({ value: value, name: key })
                  )?.filter( s => s.name !== "DocumentsScanned" )?.sort(( a, b ) => a.name.localeCompare( b.name ))
                }
              ]
            }} />
          <div className="flex flex-col space-y-1 justify-around px-4 sm:py-0 py-2 text-secondary-400">
            <Card>
              <Card.Body>
                <div className="flex items-center gap-2">
                  <ADPIcon icon="time" size="xs" />
                  <span className="font-arlon">Schedule</span>
                  <div className="flex-grow flex items-center justify-between text-secondary-500">
                    {WorkspaceDetails?.TriggerType === "on-demand" && <>
                      <div className="flex-grow">{"On Demand"}</div>
                      {accessType === "owner" && <Button
                        variant="stroked" size="xs"
                        loading={triggerRunWorkspace}
                        onClick={async() => {
                          const { data: { Message = "" } = {} }: any = await triggerRun( resourceId );
                          if ( Message ) {
                            showSuccessNotification({
                              content: Message
                            });
                          }
                        }}>
                        {"Trigger Job"}
                      </Button>}
                    </>}
                    {WorkspaceDetails?.TriggerType === "file-based" && <div>File Based</div>}
                    {WorkspaceDetails?.TriggerType === "time-based" && <>
                      <div className="flex-grow">{WorkspaceDetails?.ScheduleExpression || "-"}</div>
                    </>}
                  </div>
                </div>
              </Card.Body>
            </Card>
            <Card>
              <Card.Body>
                <div className="flex items-center gap-2">
                  <ADPIcon icon="history" size="xs" />
                  <span className="font-arlon">Last Updated</span>
                  <div className="flex-grow flex items-center justify-between text-secondary-500">
                    {WorkspaceDetails?.LastModifiedTime ?
                      <TimeStamp rawDate={WorkspaceDetails?.LastModifiedTime} /> : "-"}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>
        </div>
      </Accordion.Body>
    </Accordion>
  </div> );
};

export default WorkspaceStats;