import React from "react";
import { useMatch, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import SidePanel from "../../../customComponents/sidePanel";
import ResourceListing from "../list";
import ResourceDetails from "../details";
import CommonForm from "../commonForm";

import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import { routeActions } from "../../../../constants";

interface Props {
    showCommonForm?: boolean;
}

const Container = ({
  showCommonForm = false
}: Props ): JSX.Element => {
  const { agents } = usePermanentPaths();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const { resourceId } = useParams<{ resourceId?: string }>();
  const editMode = Boolean( useMatch( `${agents.path}/${resourceId}/${routeActions.edit}` ));
  const closeFormPanel = () => !resourceId ? navigate?.( `${agents.path}/list` ) : navigate?.( -1 );

  return <div className="adp-v2">
    {resourceId ? <ResourceDetails /> : <ResourceListing />}
    <SidePanel
      header={editMode ? t( "services.agents.agents.updateAgent" ) : t( "services.agents.agents.createAgent" )}
      show={showCommonForm} size="sm" onClose={closeFormPanel} backdropClickClose={false}>
      <CommonForm routePath={agents.path} />
    </SidePanel>
  </div>;
};

export default Container;