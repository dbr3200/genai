// libraries
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { Link, useMatch, useNavigate, useParams } from "react-router-dom";
import { Button, TextField, Textarea, EmptyState, SkeletonBlock, Accordion, Select, Toggle } from "@amorphic/amorphic-ui-core";

// components
import NotAuthorizedView from "../../../customComponents/notAuthorizedView";

// methods / hooks / constants / styles
import { useAppSelector, useSuccessNotification } from "../../../../utils/hooks";
import { routeActions } from "../../../../constants";
import {
  ComposeValidators,
  Validate_Required,
  Validate_Alphanumeric_With_Special_Chars,
  Validate_Length } from "../../../../utils/formValidationUtils";
import { LabelWithTooltip, getSelectedOptions, renderError } from "../../../../utils/renderUtils";
import { useCreateAgentMutation, useGetAgentDetailsQuery, useUpdateAgentMutation } from "../../../../services/agents/agents";
import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import styles from "./commonForm.module.scss";
import { useGetModelsQuery } from "../../../../services/models";

interface CommonFormProps {
  routePath: string;
}

interface AgentFormFields {
  AgentName: string;
  Description?: string;
  BaseModel: string;
  Instruction: string;
  QueryFollowUp: boolean;
}

const CommonForm = ({ routePath }: CommonFormProps ): JSX.Element => {
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const editMode = Boolean( useMatch( `${routePath}/${resourceId}/${routeActions.edit}` ));
  const { t } = useTranslation();
  const navigate = useNavigate();
  const permanentPaths = usePermanentPaths();
  const { AmorphicIntegrationStatus } = useAppSelector( state => state.account );

  const { data: { Models = [] } = {} } = useGetModelsQuery({ "model-use": "agent" });
  const { formState: { errors, isDirty }, handleSubmit, register, reset, watch, control, setValue } =
   useForm<AgentFormFields>();

  const [ createAgent, { isLoading: creatingAgent }] = useCreateAgentMutation();
  const [ updateAgent, { isLoading: updatingAgent }] = useUpdateAgentMutation();
  const { data: agentDetails, isLoading: fetchingAgentDetails } = useGetAgentDetailsQuery( resourceId, { skip: !editMode });

  const [showSuccessNotification] = useSuccessNotification();

  const baseModelOptions = useMemo(() => {
    return Models?.map(( model:any ) => {
      return {
        label: model.ModelName,
        value: model.ModelName
      };
    });
  }, [Models]);

  const onSubmit = async( values: AgentFormFields ) => {
    try {
      if ( editMode ) {
        const requiredPayload = {
          Description: values.Description,
          BaseModel: values.BaseModel,
          Instruction: values.Instruction
        };

        const { Message }: any = await updateAgent({ id: resourceId, requestBody: requiredPayload }).unwrap();
        showSuccessNotification({ content: Message });
        reset();
        navigate( -1 );
      } else {
        const requiredPayload: any = { ...values };
        requiredPayload.QueryFollowUp = requiredPayload?.QueryFollowUp ? "enabled" : "disabled";

        const { Message, AgentId }: any = await createAgent( requiredPayload ).unwrap();
        showSuccessNotification({ content: Message });
        reset();
        navigate( `${routePath}/${AgentId}/${routeActions.details}`, { replace: true });
      }
      // eslint-disable-next-line no-empty
    } catch ( e ){
    }
  };

  useEffect(() => {
    if ( agentDetails && !isDirty ){
      const { AgentName, Description, BaseModel, Instruction, QueryFollowUp } = agentDetails;
      reset({ AgentName, Description, BaseModel, Instruction, QueryFollowUp: QueryFollowUp === "enabled" });
    }
  }, [ isDirty, agentDetails, reset ]);

  return AmorphicIntegrationStatus === "connected"
    ? fetchingAgentDetails
      ? <SkeletonBlock variant="sideBars" />
      : <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
        <p className={styles.required}>* {t( "common.words.required" )}</p>
        <fieldset className={styles.fieldsContainer} disabled={creatingAgent || updatingAgent}>

          {/* ************************** AgentName Field ************************** */}

          <div className="px-4">
            <TextField
              floatingLabel={<span className="requiredField">{t( "services.agents.agents.AgentName" )}</span>}
              disabled={editMode}
              {...register( "AgentName", {
                validate: ( v:string ) => ComposeValidators( Validate_Required( t( "services.agents.agents.AgentName" )),
                  Validate_Length( 3, 100 )( t( "services.agents.agents.AgentName" )),
                  Validate_Alphanumeric_With_Special_Chars( "_-" )( t( "services.agents.agents.AgentName" )))( v )
              })}
            />
            {renderError( errors, "AgentName" )}
          </div>

          {/* ************************** Description Feild ************************** */}
          <div className="px-4">
            <Textarea
              floatingLabel={<span className="requiredField">{t( "services.agents.agents.Description" )}</span>}
              {...register( "Description", { validate: ComposeValidators( Validate_Required( t( "services.agents.agents.Description" )),
                Validate_Length( undefined, 200 )( t( "services.agents.agents.Description" ))) })}
            />
            {renderError( errors, "Description" )}
          </div>

          <Accordion expand classes="shadow-md">
            <Accordion.Header classes="bg-secondary-100">
              <h1 className="font-medium text-lg py-2" >
                {t( "services.agents.agents.advanced" )}
              </h1>
            </Accordion.Header>
            <Accordion.Body classes={styles.accordionBody}>

              {/* ************************** BaseModelId Field ************************** */}

              <div>
                <Controller
                  name="BaseModel"
                  control={control}
                  rules={{ validate: Validate_Required( t( "services.agents.agents.BaseModel" )) }}
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  render={({ field: { ref, value: valueRhf, ...rest } }) => <Select
                    {...rest}
                    value={typeof valueRhf !== "undefined" && getSelectedOptions( valueRhf, baseModelOptions, false )}
                    menuPortalTarget={document.body}
                    floatingLabel={<LabelWithTooltip
                      required
                      label={t( "services.agents.agents.BaseModel" )}
                      tooltip={t( "services.agents.agents.tooltip.BaseModel" )} />}
                    options={baseModelOptions}
                    onChange={ option => {
                      option && setValue( "BaseModel", option.value );
                    }}
                  />}
                />
                {renderError( errors, "BaseModel" )}
              </div>

              {/* ************************** Instruction Field ************************** */}

              <div >
                <Textarea
                  {...register( "Instruction", {
                    validate: ( v:string ) => ComposeValidators( Validate_Required( t( "services.agents.agents.Instruction" )),
                      Validate_Length( 40, 1400 )( t( "services.agents.agents.Instruction" )))( v )
                  })}
                  floatingLabel={
                    <LabelWithTooltip
                      required
                      label={t( "services.agents.agents.Instruction" )}
                      tooltip={t( "services.agents.agents.tooltip.Instruction" )}
                    />
                  }
                />
                {renderError( errors, "Instruction" )}
              </div>

              {/* ------------------ QueryFollowUp Field ------------------  */}

              <Toggle
                {...register( "QueryFollowUp" )}
                disabled={editMode}
                label={<LabelWithTooltip label={t( "services.agents.agents.QueryFollowUp" )}
                  // eslint-disable-next-line max-len
                  tooltip={t( "services.agents.agents.tooltip.QueryFollowUp" )} />}
                toggled={watch( "QueryFollowUp" )}
                onChange={() => setValue( "QueryFollowUp", !watch( "QueryFollowUp" ))} />

            </Accordion.Body>
          </Accordion>
          <div className="flex justify-end mt-4">
            <Button
              variant="stroked"
              classes="btn-auto-width"
              size="sm"
              aria-label={t( "services.agents.agents.createAgent" )}
              loading={creatingAgent || updatingAgent}
              type="submit">{editMode ? t( "services.agents.agents.updateAgent" ) : t( "services.agents.agents.createAgent" )}</Button>
          </div>
        </fieldset>
      </form>
    : AmorphicIntegrationStatus !== "connected"
      ? <EmptyState defaultImageVariant="no-auth" display="vertical">
        <EmptyState.Content title={t( "common.messages.notIntegrated" )} />
        <EmptyState.CTA>
          <Link to={permanentPaths?.profileAndSettings?.path}>
            <Button variant="stroked">
              { "Integrate with Amorphic" }
            </Button>
          </Link>
        </EmptyState.CTA>
      </EmptyState>
      : <div className="w-full h-full">
        <NotAuthorizedView
          messageValues={{
            action: "create", service: t( "services.agents.agents.thisAgent" )
          }}
          showRedirectButton={false}
        />
      </div>;
};

export default CommonForm;