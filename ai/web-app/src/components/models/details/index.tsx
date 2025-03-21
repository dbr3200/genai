import React, { useReducer } from "react";
import { ADPIcon, Button, Dropdown, EmptyState, Spinner, Tabs } from "@amorphic/amorphic-ui-core";
import { useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Header from "../../layout/header";
import { Content } from "../../layout/PageLayout";
import ModelConfiguration from "./configuration";
import ProvisionThroughputPanel from "./provisionThroughputPanel";

import { useDeleteThroughputMutation, useGetModelDetailsQuery, useLazyDownloadModelDataQuery,
  useUpdateModelAvailabilityMutation } from "../../../services/models";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { downloadWithLink } from "../../../utils";
import { useInfoNotification, useSuccessNotification } from "../../../utils/hooks";
import { getErrorMessage } from "../../../services/helpers";
import styles from "./styles.module.scss";
import { ModelStatusCode } from "../../../constants";

export default function ModelDetails(): JSX.Element {
  const { t } = useTranslation();
  const { hash } = useLocation();
  const { models: modelsPath } = usePermanentPaths();
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const { data: model, isError, isFetching, isLoading, error } = useGetModelDetailsQuery( resourceId, {
    skip: !resourceId
  });
  const [ deleteThroughput, { isLoading: deletingThroughput }] = useDeleteThroughputMutation();
  const [updateModelAvailability] = useUpdateModelAvailabilityMutation();
  const [downloadModelData] = useLazyDownloadModelDataQuery();
  const [ showInfoNotification, hideInfoNotification ] = useInfoNotification();
  const [showSuccessNotification] = useSuccessNotification();

  const [ showThroughputPanel, toggleThroughputPanel ] = useReducer(( state ) => !state, false );

  const downloadData = async ( type: "training" | "validation" | "metrics" ) => {
    showInfoNotification({
      content: t( "common.messages.initiatingDownload" )
    });
    const { PresignedURL } = await downloadModelData({ id: resourceId, type }).unwrap();
    downloadWithLink( PresignedURL );
  };

  const removeProvisionedThroughput = async () => {
    try {
      const { Message } = await deleteThroughput( resourceId ).unwrap();
      showSuccessNotification({ content: Message });
    // eslint-disable-next-line no-empty
    } catch ( err ) {}
  };

  const handleUpdateModelAvailability = async ( modelId: string, action: "enable" | "disable" ) => {
    const notificationId = showInfoNotification({ content: t( action === "enable"
      ? "services.models.enablingModel"
      : "services.models.disablingModel" ),
    autoHideDelay: false });

    try {
      const response = await updateModelAvailability({ id: modelId, action }).unwrap();
      hideInfoNotification( notificationId );
      showSuccessNotification({ content: response.Message, autoHideDelay: 3000 });
    } catch ( err ) {
      hideInfoNotification( notificationId );
    }
  };

  return ( <div className="space-y-8 adp-v2">
    <Header backBtnPath={modelsPath.relativePath} title={model?.ModelName} loading={isLoading} ctas={[
      model?.ModelStatusCode?.toLowerCase() === ModelStatusCode.AVAILABLE
        ? {
          callback: () => handleUpdateModelAvailability( model.ModelId, "disable" ),
          icon: <ADPIcon size="xs" icon="times-circle" />,
          label: "Disable Model"
        }
        : {
          callback: () => model && handleUpdateModelAvailability( model.ModelId, "enable" ),
          icon: <ADPIcon size="xs" icon="check-circle" />,
          label: "Enable Model"
        },
      ...model?.ModelType?.toLowerCase() === "base" ? [] : [
        typeof model?.AdditionalConfiguration?.ProvisionThroughputConfig?.ModelUnits !== "undefined"
          ? {
            callback: removeProvisionedThroughput,
            icon: <ADPIcon icon="delete" size="xs" />,
            label: t( "services.models.removeThroughput" ),
            disabled: [ "InProgress", "ProvisioningThroughput" ].includes( model?.AdditionalConfiguration.Status ) || deletingThroughput
          }
          : {
            callback: toggleThroughputPanel,
            icon: <ADPIcon icon="extra-resources" size="xs" />,
            label: t( "services.models.provisionThroughput" ),
            disabled: [ "InProgress", "ProvisioningThroughput" ].includes( model?.AdditionalConfiguration.Status ?? "" )
          }
      ] ]}>
      <>{!isLoading && model?.ModelType?.toLowerCase() === "custom" && <Dropdown ctaContent={<Button
        onClick={() => false}
        icon={<ADPIcon icon="download" size="xs" />}
        size="sm"
        classes={styles.ctaButton}
      >
        {t( "services.models.downloads" )}
      </Button>
      }>
        <Dropdown.Item
          onClickHandler={() => downloadData( "training" )}
        >
          {t( "services.models.trainingData" )}
        </Dropdown.Item>
        <Dropdown.Item
          onClickHandler={() => downloadData( "validation" )}
        >
          {t( "services.models.validationData" )}
        </Dropdown.Item>
        <Dropdown.Item
          onClickHandler={() => downloadData( "metrics" )}
        >
          {t( "services.models.metrics" )}
        </Dropdown.Item>
      </Dropdown>}</>
    </Header>
    <Content className="flex flex-col h-full">
      <Tabs defaultActiveIndex={ hash.includes( "configuration" ) ? 1 : 0 }>
        <Tabs.Tab classes="h-full" id="Configuration" title={<div className="flex items-center gap-2">
          <ADPIcon icon="repair" size="xs" />
          <span>{t( "common.words.configuration" )}</span>
        </div>}>
          <div className={styles.detailsContainer}>
            {isFetching || isLoading
              ? <div className="w-full h-full flex justify-center items-center"> <Spinner /> </div>
              : isError
                ? <EmptyState display="vertical" transparentBG defaultImageVariant="no-auth">
                  <EmptyState.Content title={getErrorMessage( error )} />
                </EmptyState>
                : <ModelConfiguration modelsDetails={model} />
            }
          </div>
        </Tabs.Tab>
      </Tabs>
    </Content>
    <ProvisionThroughputPanel
      show={showThroughputPanel} closePanel={toggleThroughputPanel}
      modelId={model?.ModelId}
    />
  </div> );
}