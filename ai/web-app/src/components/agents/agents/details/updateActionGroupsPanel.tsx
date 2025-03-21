import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, ReloadableSelect } from "@amorphic/amorphic-ui-core";
import { Controller, useForm } from "react-hook-form";

import SidePanel from "../../../customComponents/sidePanel";
import { LabelWithTooltip, getSelectedOptions, renderError } from "../../../../utils/renderUtils";

import { useGetActionGroupsQuery } from "../../../../services/agents/actionGroups";
import { useGetAgentActionGroupsQuery, useUpdateAgentActionGroupsMutation } from "../../../../services/agents/agents";
import { useSuccessNotification } from "../../../../utils/hooks";
import { Option } from "../../../../types";

interface Props {
  show: boolean;
  closePanel: () => void;
  agentId?: string;
}

const UpdateAgentActionGroupsPanel = ({ show, closePanel, agentId = "" }: Props ): JSX.Element => {
  const { t } = useTranslation();
  const { formState: { errors }, handleSubmit, control, setValue } = useForm<{ ActionGroups: string[] }>();
  const { data: { ActionGroups: existingActionGroups = [] } = {}, isFetching: fetchingExistingActionGroups, isSuccess: existingActionGroupsLoaded,
    refetch: refetchExistingActionGroups } =
  useGetAgentActionGroupsQuery( agentId, { skip: !agentId });
  const { data: { ActionGroups = [] } = {},
    isFetching: fetchingActionGroups, refetch: refetchActionGroups } = useGetActionGroupsQuery( null );
  const [ updateAgentActionGroups, { isLoading: updatingAgentActionGroups }] = useUpdateAgentActionGroupsMutation();
  const [showSuccessNotification] = useSuccessNotification();
  const actionGroupOptions = useMemo(() => ActionGroups.map( actionGroup =>
    ({ value: actionGroup.ActionGroupId, label: actionGroup.ActionGroupName })), [ActionGroups]);

  const onSubmit = async ( values: { ActionGroups: string[] }) => {

    try {
      const { Message } = await updateAgentActionGroups({ id: agentId as string, requestBody: values }).unwrap();
      showSuccessNotification({ content: Message });
      closePanel();
    // eslint-disable-next-line no-empty
    } catch ( error ) {
    }
  };

  useEffect(() => {
    if ( show ){
      refetchExistingActionGroups();
    }
  }, [ refetchExistingActionGroups, show ]);

  useEffect(() => {
    if ( existingActionGroupsLoaded && existingActionGroups ){
      setValue( "ActionGroups", existingActionGroups?.map(( actionGroup ) => actionGroup.ActionGroupId ));
    }
  }, [ existingActionGroups, existingActionGroupsLoaded, setValue ]);

  return <SidePanel
    header={t( "services.agents.agents.updateActionGroups" )}
    onClose={closePanel}
    size="xs" show={show}>
    <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
      <fieldset disabled={updatingAgentActionGroups} className="py-8 space-y-8">
        {/* ************************** Action Groups Field ************************** */}

        <div>
          <Controller
            name="ActionGroups"
            control={control}
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            render={({ field: { ref, value: valueRhf, ...rest } }) => <ReloadableSelect
              {...rest}
              multi
              className="mb-2"
              value={typeof valueRhf !== "undefined" && getSelectedOptions( valueRhf, actionGroupOptions, true )}
              menuPortalTarget={document.body}
              floatingLabel={<LabelWithTooltip
                label={t( "services.agents.agents.ActionGroups" )}
                tooltip={t( "services.agents.agents.tooltip.ActionGroups" )} />}
              options={actionGroupOptions}
              onReloadClick={refetchActionGroups}
              isReloading={fetchingExistingActionGroups || fetchingActionGroups}
              onChange={ options => {
                options && setValue( "ActionGroups", ( options as unknown as Option[]).map( option => option.value ));
              }}
            />}
          />
          {renderError( errors, "ActionGroups" )}
        </div>
        <div className="flex justify-end">
          <Button loading={updatingAgentActionGroups} type="submit">
            {t( "services.agents.agents.updateActionGroups" )}
          </Button>
        </div>
      </fieldset>
    </form>
  </SidePanel>;
};

export default UpdateAgentActionGroupsPanel;
