import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import SidePanel from "../../customComponents/sidePanel";
import ResourceListing from "../list";
import CommonForm from "../commonForm";

import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";

interface Props {
    showCommonForm?: boolean;
}

const Container = ({
  showCommonForm = false
}: Props ): JSX.Element => {
  const { models } = usePermanentPaths();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { resourceId } = useParams<{ resourceId?: string }>();
  const closeFormPanel = () => !resourceId ? navigate?.( `${models.path}/list` ) : navigate?.( -1 );

  return <div className="adp-v2">
    <ResourceListing />
    <SidePanel
      header ={t( "services.models.createModel" )}
      show={showCommonForm} size="md" onClose={closeFormPanel} backdropClickClose={false}>
      <CommonForm routePath={models.path} />
    </SidePanel>
  </div>;
};

export default Container;