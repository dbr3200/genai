import React from "react";
import { Card, Button } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import { clsx } from "clsx";

import styles from "./styles.module.scss";
import { useSuccessNotification } from "../../../../../utils/hooks";
import { closeSwal, showLoading } from "../../../../../utils/popupUtils";
import { useAddWebsitesToWorkspaceMutation } from "../../../../../services/workspaces";

interface Props {
  workspaceId: string;
  selectedFiles: Array<Record<string, any>>;
  setCrawledWebsites: React.Dispatch<React.SetStateAction<Record<string, any>[]>>;
  reloadData: () => void;
  crawlId: string;
}

export const SelectedFilesBlock = (
  { selectedFiles,
    workspaceId,
    setCrawledWebsites,
    reloadData,
    crawlId }:Props ): JSX.Element => {
  const { t } = useTranslation();
  const [showSuccessNotification] = useSuccessNotification();

  const [addWebsites] = useAddWebsitesToWorkspaceMutation();

  const performOperationOnSelectedFiles = async () => {
    const urls = selectedFiles.map(( item ) => item?.URL );
    showLoading();
    try {
      const { data }:any = await addWebsites({ id: workspaceId, requestBody: {
        DocumentType: "website",
        DocumentDetails: {
          WebsiteURLs: urls,
          CrawlId: crawlId
        }
      } });
      if ( data?.Message ) {
        showSuccessNotification({
          content: data.Message
        });
        reloadData();
      }
    } finally {
      setCrawledWebsites(( d:any ) => d.map(( item:any ) => ({ ...item, isSelected: false })));
      closeSwal();
    }
  };

  return ( <div className={styles.selectedFilesBlock}>
    <Card>
      <Card.Body classes="flex justify-between items-center flex-wrap">
        <p className="w-[170px]">{selectedFiles.length} {selectedFiles.length === 1 ? "Record" : "Records"} selected</p>
        <Button onClick={performOperationOnSelectedFiles} classes={clsx( styles.actionButtons, "w-40" )}>
          {t( "services.workspaces.addWebsitesToWorkspaces" )}
        </Button>
      </Card.Body>
    </Card>
  </div>
  );
};