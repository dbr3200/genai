import { Spinner } from "@amorphic/amorphic-ui-core";
import React from "react";

const FileLoadingSpinner = (): JSX.Element => {
  return ( <div className="flex w-full h-auto py-8 justify-between items-center">
    <Spinner size="md" centered label="Loading preview..." />
  </div>
  );
};

export default FileLoadingSpinner;