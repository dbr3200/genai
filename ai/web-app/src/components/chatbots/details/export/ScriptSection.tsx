import React from "react";
import { TextCopy } from "@amorphic/amorphic-ui-core";

interface IScriptSectionProps {
    text: string;
}

const ScriptSection = ({
  text
}: IScriptSectionProps ): JSX.Element => {
  return ( <div className="relative bg-black rounded-md p-2 my-2 text-secondary-150">
    <div className="absolute top-1 right-2">
      <TextCopy text={text}>
        {"-"}
      </TextCopy>
    </div>
    <div className="p-2 whitespace-pre-wrap">
      {text}
    </div>
  </div>
  );
};

export default ScriptSection;