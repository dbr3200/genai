import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, ReloadableSelect } from "@amorphic/amorphic-ui-core";
import { Controller, useForm } from "react-hook-form";

import SidePanel from "../../../customComponents/sidePanel";

import { LabelWithTooltip, getSelectedOptions, renderError } from "../../../../utils/renderUtils";
import { useUpdateAttachedWorkspacesMutation } from "../../../../services/agents/agents";
import { useSuccessNotification } from "../../../../utils/hooks";
import { useGetWorkspacesQuery } from "../../../../services/workspaces";
import { Option } from "../../../../types";
import { Validate_SelectedOptionsCount } from "../../../../utils/formValidationUtils";

interface Props {
  show: boolean;
  closePanel: () => void;
  agentId?: string;
  attachedWorkspaces?: {
    WorkspaceId: string;
    WorkspaceName: string;
  }[]
}

const AttachWorkspacePanel = ({ show, closePanel, agentId = "", attachedWorkspaces }: Props ): JSX.Element => {
  const { t } = useTranslation();

  const {
    data: { Workspaces = [] } = {},
    isFetching: isFetchingWorkspaces,
    refetch: refetchWorkspaces
  } = useGetWorkspacesQuery({ projectionExpression: "WorkspaceId,WorkspaceName" });

  const { handleSubmit, control, setValue, formState: { errors } } = useForm<{ Workspaces: string[]}>();

  const [ updateAttachedWorkspace, { isLoading: updatingAttachedWorkspace }] = useUpdateAttachedWorkspacesMutation();
  const [showSuccessNotification] = useSuccessNotification();
  const workspaceOptions = useMemo(() => Workspaces.map(( workspace: { WorkspaceId: string, WorkspaceName: string }) =>
    ({ value: workspace.WorkspaceId, label: workspace.WorkspaceName })), [Workspaces]);

  const onSubmit = async ({ Workspaces: WorkspacesRhf }: { Workspaces: string[]}) => {
    try {
      const { Message } = await updateAttachedWorkspace({ id: agentId, Workspaces: WorkspacesRhf }).unwrap();
      showSuccessNotification({ content: Message });

      closePanel();
    } catch ( error ) {
      // Do nothing
    }
  };

  useEffect(() => {
    if ( attachedWorkspaces && show ){
      setValue( "Workspaces", attachedWorkspaces.map( workspace => workspace.WorkspaceId ));
    }
  }, [ setValue, show, attachedWorkspaces ]);

  return <SidePanel
    header={t( "services.agents.agents.updateWorkspaces" )}
    onClose={closePanel}
    size="xs" show={show}>
    <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
      <fieldset disabled={updatingAttachedWorkspace} className="py-8 space-y-8">
        <div>
          <Controller
            name="Workspaces"
            control={control}
            rules={{ validate: Validate_SelectedOptionsCount( undefined, 2 )( `${t( "services.workspace" )}s` ) }}
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            render={({ field: { ref, value: valueRhf, ...rest } }) => <ReloadableSelect
              {...rest}
              multi={true}
              value={valueRhf && getSelectedOptions( valueRhf, workspaceOptions, true )}
              menuPortalTarget={document.body}
              floatingLabel={<LabelWithTooltip label={t( "services.agents.agents.attachedWorkspaces" )}
                tooltip={t( "services.agents.agents.tooltip.attachedWorkspaces" )} />}
              options={workspaceOptions}
              onReloadClick={refetchWorkspaces}
              isReloading={isFetchingWorkspaces}
              isClearable
              onChange={ options => {
                options !== null && setValue( "Workspaces", ( options as unknown as Option[]).map( option => option.value ));
              }}
            />}
          />
          {renderError( errors, "Workspaces" )}
        </div>
        <div className="flex justify-end">
          <Button loading={updatingAttachedWorkspace} type="submit">
            {t( "common.button.update" )}
          </Button>
        </div>
      </fieldset>
    </form>
  </SidePanel>;
};

export default AttachWorkspacePanel;
