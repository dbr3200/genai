// libraries
import React from "react";
import { useTranslation } from "react-i18next";

// components
//import { TableOfContentV2 } from "../../customComponents/tableOfContent/TableOfContent";
import { RAGEngines } from "./ragEngines";
import { OpenAI } from "./openAI";
import { useGetCommonSystemConfigsQuery, useUpdateSystemLevelConfigMutation } from "../../../services/management";
import { useSuccessNotification } from "../../../utils/hooks";
import { Button } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles

export const AppManagement = (): JSX.Element => {
  const { t } = useTranslation();
  const { data = {}, isFetching: fetchingSystemConfigs, refetch: refetchSystemConfigs } = useGetCommonSystemConfigsQuery( "all" );
  const [ updateSystemLevelConfig, { isLoading: updatingConfig }] = useUpdateSystemLevelConfigMutation();
  const [showSuccessNotification] = useSuccessNotification();

  const updateConfig = async ({ config, value }: {config: "rag-engines" | "default-language" | "openai-key", value: any }) => {
    try {
      const { Message } = await updateSystemLevelConfig({ config, requestBody: value }).unwrap();
      showSuccessNotification({ content: Message });
    // eslint-disable-next-line no-empty
    } catch ( error ) {}
  };

  const sections:{[key: string]: any} = {
    ragEngines: { label: t( "RAG Engines" ), component: <RAGEngines ragEngines={data?.RagEngines} updateConfig={updateConfig}
      updatingConfig={updatingConfig} fetchingSystemConfigs={fetchingSystemConfigs} /> },
    openAI: { label: t( "OpenAI" ), component: <OpenAI openAIKey={data?.OpenAIKey} fetchingSystemConfigs={fetchingSystemConfigs} /> }
  };

  return <div className="flex flex-col gap-4">
    <Button variant="stroked" loading={fetchingSystemConfigs} size="xs" classes="self-end p-4" onClick={refetchSystemConfigs}>Reload</Button>
    <div id="menu" className="flex flex-col md:flex-row gap-2 pt-0">
      {/* Sashank - Commenting the TableOfContentV2 Component for now as there isn't enough content on the page. */}
      {/* <div className="w-[20rem]">
        <TableOfContentV2 sections={sections} />
      </div> */}
      <div className="w-full grid grid-cols-2 gap-4">
        {Object.keys( sections ).map(( sectionKey:string ) => <section key={sectionKey} id={sectionKey}>{sections[sectionKey].component}</section> )}
      </div>
    </div>
  </div>;
};
