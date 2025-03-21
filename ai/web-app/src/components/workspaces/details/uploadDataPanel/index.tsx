import React from "react";
import { useTranslation } from "react-i18next";

import { Tabs } from "@amorphic/amorphic-ui-core";
import SidePanel from "../../../customComponents/sidePanel";

import { UploadFile } from "./uploadFile";
import { AddWebsites } from "./addWebsites";

interface Props {
  show: boolean;
  closePanel: () => void;
  workspaceDetails: any;
}

export const UploadDataPanel = ({ show, closePanel, workspaceDetails }: Props ): JSX.Element => {
  const { t } = useTranslation();

  return (
    <SidePanel
      header={t( "Add Data" )}
      onClose={closePanel}
      backdropClickClose={false}
      size="sm" show={show}>
      <Tabs>
        <Tabs.Tab title="Upload Files">
          <UploadFile workspaceDetails={workspaceDetails} />
        </Tabs.Tab>
        <Tabs.Tab title="Add Websites">
          <AddWebsites closePanel={closePanel} workspaceId={workspaceDetails?.WorkspaceId} />
        </Tabs.Tab>
      </Tabs>
    </SidePanel>
  );
};
