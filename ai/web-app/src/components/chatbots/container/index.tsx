import React from "react";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import SidePanel from "../../customComponents/sidePanel";
import ResourceListing from "../list";
import { CommonForm } from "../commonForm";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";

interface Props {
    showCommonForm?: boolean;
}

const Container = ({
  showCommonForm = false
}: Props ): JSX.Element => {
  const { chatbots } = usePermanentPaths();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { resourceId } = useParams<{ resourceId?: string }>();
  const closeFormPanel = () => !resourceId ? navigate?.( `${chatbots.path}/list` ) : navigate?.( -1 );
  const editMode = Boolean( useMatch( `${chatbots.path}/${resourceId}/edit` ));

  return <div className="adp-v2">
    <ResourceListing />
    <SidePanel
      header ={
        editMode
          ? t( "services.chatbots.updateChatbot" )
          : t( "services.chatbots.createChatbot" )}
      show={showCommonForm} size="md" onClose={closeFormPanel} backdropClickClose={false}>
      <CommonForm routePath={chatbots.path} onClose={closeFormPanel} />
    </SidePanel>
  </div>;
};

export default Container;