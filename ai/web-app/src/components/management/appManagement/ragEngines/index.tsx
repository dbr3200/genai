// libraries
import React from "react";

// components
import { ADPIcon, Button, Card, SkeletonBlock } from "@amorphic/amorphic-ui-core";
import { GenericStatus } from "../../../../utils/renderUtils";

interface DefaultLanguagesProps {
  ragEngines: Record<string, string>;
  updateConfig: ({ config, value }: {config: "rag-engines" | "default-language", value: any }) => void;
  updatingConfig: boolean;
  fetchingSystemConfigs: boolean;
}

export const RAGEngines = ({ ragEngines, updateConfig, updatingConfig, fetchingSystemConfigs } : DefaultLanguagesProps ) : JSX.Element => {

  const RagEngineCards = () => ragEngines ? <>{Object.keys( ragEngines ).map(( engineKey: string ) => (
    <div className="w-full flex items-center" key={engineKey}>
      <div className="flex items-center gap-2">
        <span className="capitalize font-bold text-xl">{engineKey}</span>
        <GenericStatus status={ragEngines[engineKey]} tooltip={ragEngines[engineKey]} />
      </div>

      { ragEngines[engineKey] === "stopped" &&
      <Button variant="filled" classes="px-2 ml-auto mr-0" size="sm" loading={updatingConfig} onClick={() => updateConfig({ config: "rag-engines",
        value: { RagEngines: { [engineKey]: "enable" } }
      })}><ADPIcon icon="video" size="xs" /> START</Button>}
      { ragEngines[engineKey] === "available" &&
      <Button variant="filled" classes="px-2 ml-auto mr-0" size="sm" loading={updatingConfig} onClick={() => updateConfig({ config: "rag-engines",
        value: { RagEngines: { [engineKey]: "disable" } }
      })}><ADPIcon icon="disable" size="xs" /> STOP</Button>}

    </div> )
  )}</> : null;

  return <Card classes="border border-secondary-200 h-full">
    <Card.Header bordered classes="border-secondary-100">
      <Card.Title>
        <div className="flex gap-2 items-center">
        RAG Engines
        </div>
      </Card.Title>
    </Card.Header>
    <Card.Body>
      <div className="mt-4">
        { fetchingSystemConfigs
          ? <SkeletonBlock variant="lines" size="md" count={1}/>
          : <RagEngineCards />}
      </div>
    </Card.Body>
  </Card>;
};