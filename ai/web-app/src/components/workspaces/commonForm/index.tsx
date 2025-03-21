// libraries
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { Link, useMatch, useNavigate, useParams } from "react-router-dom";

// components
import { Button, TextField, Textarea, Select, SkeletonBlock, Accordion, ReloadableSelect, EmptyState,
  ADPIcon, Tooltip, Toggle } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import { useAppSelector, useSuccessNotification } from "../../../utils/hooks";
import { routeActions } from "../../../constants";
import {
  ComposeValidators,
  Validate_Required, Validate_MaxChars, Validate_Cron_Pattern, Validate_OnlyRealNumbers,
  Validate_NumbersWithoutExponent,
  Validate_NumberRange,
  Validate_Alphanumeric_With_Special_Chars } from "../../../utils/formValidationUtils";
import { getSelectedOptions, LabelWithTooltip, renderError } from "../../../utils/renderUtils";
import styles from "./commonForm.module.scss";
import { Option } from "../../../types";
import { useCreateWorkspaceMutation, useUpdateWorkspaceMutation, useGetWorkspaceDetailsQuery } from "../../../services/workspaces";
import { useGetAmorphicDatasetsQuery } from "../../../services/amorphic";
import { triggerTypeOptions } from "../utils/constants";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { useGetModelsQuery } from "../../../services/models";
import NotAuthorizedView from "../../customComponents/notAuthorizedView";

interface CreateComponentProps {
  /**
   * List of permissions used to determine to show or hide the form
   */
  onClose: () => void;
  routePath: string;
}

interface WorkspaceFormState {
  WorkspaceName: string;
  TriggerType: "on-demand" | "time-based" | "file-based";
  ScheduleExpression?: string;
  AttachedDatasets:string[];
  _AutoCreateSourceDataset?: boolean;
  Description?: string;
  Keywords?: Option[];
  EmbeddingsModel?: string;
  ChunkingConfig?: {
      MaxTokens: string;
      OverlapPercentage: string;
    }
}

export const CommonForm = ({
  routePath
}: CreateComponentProps ): React.ReactElement => {
  const { t } = useTranslation();
  const permanentPaths = usePermanentPaths();
  const { resourceId = "" } = useParams<{ resourceId?: string, action?: string }>();
  const createMode = Boolean( useMatch( `${routePath}/${routeActions.new}` ));
  const editMode = Boolean( useMatch( `${routePath}/${resourceId}/${routeActions.edit}` ));

  const { AmorphicIntegrationStatus } = useAppSelector( state => state.account );

  const navigate = useNavigate();
  const { data: { Models = [] } = {} } = useGetModelsQuery({ "modality": "embedding" });
  const embeddingModelOptions = useMemo(() => {
    return Models.map(( model:any ) => {
      return {
        label: model.ModelName,
        value: model.ModelId
      };
    });
  }, [Models]);

  const defaultValues = {
    WorkspaceName: "",
    _AutoCreateSourceDataset: true,
    ChunkingConfig: {
      MaxTokens: "1000",
      OverlapPercentage: "10"
    }
  };

  const { formState: { errors, isDirty }, handleSubmit, control, register, getValues, watch, reset, setValue, resetField } =
   useForm<WorkspaceFormState>({ defaultValues });

  const [ createWorkspace, { isLoading: creatingWorkspace }] = useCreateWorkspaceMutation();
  const [ editWorkspace, { isLoading: updatingWorkspace }] = useUpdateWorkspaceMutation();
  const { data: workspaceDetails, isFetching: fetchingWorkspaceDetails } = useGetWorkspaceDetailsQuery( resourceId, { skip: !resourceId });

  const [showSuccessNotification] = useSuccessNotification();

  const { data: { Datasets: Datasets = [] } = {},
    isFetching: isDatasetsFetching,
    refetch: fetchDatasets } = useGetAmorphicDatasetsQuery( "",
    {
      skip: AmorphicIntegrationStatus !== "connected"
    });

  const datasetOptions = useMemo(() => {
    const datasetOptionsData = Datasets.map(( item:any ) => ({
      label: item.DatasetName,
      value: item.DatasetId
    }));
    return datasetOptionsData;
  }, [Datasets]);

  useEffect(() => {
    if ( workspaceDetails && !isDirty ){
      const extDetails: WorkspaceFormState = structuredClone( workspaceDetails as any );
      if ( extDetails?.Keywords ){
        extDetails.Keywords = workspaceDetails?.Keywords.map(( keyword:string ) => {
          return { label: keyword, value: keyword };
        });
      }

      extDetails.AttachedDatasets = workspaceDetails?.AttachedDatasets.map(( dataset:any ) => dataset.DatasetId );
      extDetails.EmbeddingsModel = workspaceDetails?.EmbeddingsModel?.Id;

      reset( extDetails );
    }
  }, [ workspaceDetails, isDirty, reset ]);

  const onSubmit = async() => {
    const values = getValues();
    delete values["_AutoCreateSourceDataset"];

    const dataToSend = {
      WorkspaceName: values.WorkspaceName,
      Keywords: values?.Keywords?.map(( item: any ) => item.value ) ?? [],
      TriggerType: values.TriggerType,
      Description: values.Description || "-",
      AttachedDatasets: values.AttachedDatasets,
      EmbeddingsModel: values.EmbeddingsModel ?? "amazon.titan-embed-text-v1",
      ...( values?.ScheduleExpression && values.TriggerType === "time-based" && { ScheduleExpression: values.ScheduleExpression }),
      ...(( values?.ChunkingConfig?.MaxTokens?.length ?? 0 ) > 0 && ( values?.ChunkingConfig?.OverlapPercentage?.length ?? 0 ) > 0
        ? { ChunkingConfig: {
          MaxTokens: Number( values?.ChunkingConfig?.MaxTokens ),
          OverlapPercentage: Number( values?.ChunkingConfig?.OverlapPercentage )
        } } : {})
    };

    if ( createMode ) {
      const { data: { Message = "", WorkspaceId = "" } = {} }: any = await createWorkspace( dataToSend );
      if ( Message ) {
        navigate( `${routePath}/${WorkspaceId}/${routeActions.details}`, { replace: true });
        showSuccessNotification({
          content: Message
        });
        reset();
      }
    } else if ( editMode ) {

      const { data: { Message = "" } = {} }: any = await editWorkspace({ id: resourceId, requestBody: dataToSend });
      if ( Message ) {
        navigate( `${routePath}/${resourceId}/${routeActions.details}`, { replace: true });
        showSuccessNotification({
          content: Message
        });
        reset();
      }
    }
  };

  const TriggerTypeWatcher = watch( "TriggerType" );
  const EmbeddingModelWatcher = watch( "EmbeddingsModel" );

  if ( editMode && workspaceDetails?.AccessType !== "owner" ) {
    return <div className="w-full h-full">
      <NotAuthorizedView
        messageValues={{
          action: createMode ? "create" : "edit", service: t( "services.workspace.thisWorkspace" )
        }}
        showRedirectButton={false}
      />
    </div>;
  }

  return AmorphicIntegrationStatus === "connected"
    ? fetchingWorkspaceDetails
      ? <SkeletonBlock variant="sideBars" />
      : <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
        <p className={styles.required}>* {t( "common.words.required" )}</p>
        <fieldset disabled={fetchingWorkspaceDetails} >
          {fetchingWorkspaceDetails ? <SkeletonBlock variant="lines" size="4xl" rows={8} /> :
            <div className={"flex flex-col gap-x-14 gap-y-8"}>
              <div className={"flex flex-col justify-center self-start w-full px-4"}>
                <TextField
                  floatingLabel={
                    <LabelWithTooltip
                      required
                      tooltipId="WorkspaceName"
                      label={t( "services.workspaces.WorkspaceName" )}
                      tooltip={t( "services.workspaces.tooltip.WorkspaceName" )}
                    />
                  }
                  aria-describedby={t( "services.workspaces.WorkspaceName" )}
                  disabled={editMode}
                  {...register( "WorkspaceName", {
                    validate: ( v:string ) => ComposeValidators( Validate_Required( t( "services.workspaces.WorkspaceName" )),
                      Validate_Alphanumeric_With_Special_Chars( "-_" )( t( "services.workspaces.WorkspaceName" )))( v )
                  })}
                />
                {renderError( errors, "WorkspaceName" )}
              </div>
              <div className={"grid gap-x-14 gap-y-8 grid-cols-1 md:grid-cols-2 px-4"}>
                <Textarea
                  floatingLabel={
                    <LabelWithTooltip
                      tooltipId="Description"
                      label={t( "services.workspaces.Description" )}
                      tooltip={t( "services.workspaces.tooltip.Description" )}
                    />
                  }
                  aria-describedby={t( "services.workspaces.Description" )}
                  {...register( "Description", { validate: Validate_MaxChars })}
                />
                {renderError( errors, "Description" )}
                <Controller
                  name="Keywords"
                  control={control}
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  render={({ field: { ref, value: valueRhf, ...rest } }) => <Select
                    {...rest}
                    value={valueRhf}
                    menuPortalTarget={document.body}
                    creatable
                    multi={true}
                    floatingLabel={t( "common.words.keywords" )}
                    options={[]}
                  />}
                />
                {renderError( errors, "Keywords" )}
                <div>
                  <Controller
                    name="TriggerType"
                    control={control}
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    render={({ field: { ref, value: valueRhf, onChange: onChangeRhf, ...rest } }) => <>
                      <Select
                        {...rest}
                        menuPortalTarget={document.body}
                        options={triggerTypeOptions}
                        aria-describedby={t( "services.workspaces.TriggerType" )}
                        value={valueRhf ? getSelectedOptions( valueRhf, triggerTypeOptions, false ) : valueRhf}
                        floatingLabel={<LabelWithTooltip
                          tooltipId="TriggerType"
                          label={t( "services.workspaces.TriggerType" )} tooltip={t( "services.workspaces.tooltip.TriggerType" )} required />}
                        onChange= {( selectedTriggerType:any ) => {
                          if ( selectedTriggerType.value !== "time-based" ) {
                            setValue( "ScheduleExpression", undefined );
                          }
                          onChangeRhf( selectedTriggerType.value );
                        }}
                      />
                    </>}
                    rules={{ validate: option => Validate_Required( t( "services.workspaces.TriggerType" ))( option ) }} />
                  {renderError( errors, "TriggerType" )}
                </div>
                { TriggerTypeWatcher === "time-based" &&
          <div>
            <Textarea {...register( "ScheduleExpression", {
              validate: ( v ) =>
                ComposeValidators(
                  Validate_Cron_Pattern,
                  Validate_Required( "Schedule Expression" ))( v )
            })}
            aria-describedby={t( "services.workspaces.ScheduleExpression" )}
            aria-invalid = {errors?.ScheduleExpression ? "true" : "false"}
            floatingLabel={<LabelWithTooltip
              tooltipId="ScheduleExpression"
              label={t( "services.workspaces.ScheduleExpression" )}
              tooltip={t( "services.workspaces.tooltip.ScheduleExpression" )} required />} />
            {renderError( errors, "ScheduleExpression" )}
            <span className="flex items-center gap-1">
              {<Tooltip classes="p-2 text-sm" trigger={"Every 15 mins, "}>{"cron(0/15 * * * ? *) or rate(15 minutes)"} </Tooltip>}
              {<Tooltip classes="p-2 text-sm" trigger={"Daily"}>{"cron(0 0 * * ? *) or rate(1 day)"} </Tooltip>}
              <a className="hover:text-amorphicBlue ms-1 text-xs"
                href="https://docs.aws.amazon.com/AmazonCloudWatch/latest/events/ScheduledEvents.html#CronExpressions"
                rel="noopener noreferrer" target="_blank">
                <ADPIcon size="xxs" icon="external-link" /></a>
            </span>
          </div>
                }
              </div>
              <Accordion expand classes="shadow-md">
                <Accordion.Header classes="bg-secondary-100">
                  <div className="flex items-center gap-2 py-2">
                    <h1 className="font-medium text-lg" >
                      {t( "services.workspaces.Advanced" )}
                    </h1>
                  </div>
                </Accordion.Header>
                <Accordion.Body classes="bg-white">
                  {/* ------------------ Auto Create Source Dataset ------------------  */}

                  <div className="flex flex-col space-y-12 px-2 py-8">
                    {createMode && <Controller
                      name="_AutoCreateSourceDataset"
                      control={control}
                      render={({ field }) => (
                        <Toggle
                          classes="w-fit"
                          label={t( "Auto Create Source Dataset" )}
                          toggled={field.value}
                          onChange={() => field.onChange( !field.value )} />
                      )} />}

                    {/* ------------------ AttachedDatasets Field ------------------  */}
                    {!watch( "_AutoCreateSourceDataset" ) &&
                    <div>
                      <Controller
                        name="AttachedDatasets"
                        control={control}
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        render={({ field: { ref, value: valueRhf, ...rest } }:any ) => (
                          <ReloadableSelect
                            {...rest}
                            multi={true}
                            isDisabled={editMode}
                            isReloading={isDatasetsFetching}
                            options={datasetOptions}
                            menuPortalTarget={document.body}
                            value = { getSelectedOptions( valueRhf, datasetOptions, true ) }
                            onChange={( selVal: any ) => {
                              setValue( "AttachedDatasets", selVal?.length > 0 ? selVal?.map(( curr: Option ) => curr.value ) : []);
                            }}
                            aria-describedby={t( "services.workspaces.AttachedDatasets" )}
                            floatingLabel={<LabelWithTooltip
                              tooltipId="AttachedDatasets"
                              label={t( "services.workspaces.AttachedDatasets" )}
                              tooltip={t( "Select the datasets to be used as a data source for workspace. Currently only one dataset can be attached" )} />}
                            onReloadClick={fetchDatasets} />
                        )}
                      />
                      {renderError( errors, "AttachedDatasets" )}
                    </div>
                    }
                    {/* ------------------ EmbeddingsModel Field ------------------  */}

                    <div>
                      <Controller
                        name="EmbeddingsModel"
                        control={control}
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        render={({ field: { ref, value: valueRhf, ...rest } }) => <Select
                          {...rest}
                          value={typeof valueRhf !== "undefined" && getSelectedOptions( valueRhf, embeddingModelOptions, false )}
                          menuPortalTarget={document.body}
                          floatingLabel={<LabelWithTooltip required
                            label={t( "services.workspaces.EmbeddingsModel" )}
                            tooltip={t( "services.workspaces.tooltip.EmbeddingsModel" )} />}
                          options={embeddingModelOptions}
                          isDisabled={editMode}
                          onChange={ option => {
                            option && setValue( "EmbeddingsModel", option.value );
                          }}
                        />}
                        rules={{ validate: option => Validate_Required( t( "services.workspaces.EmbeddingsModel" ))( option ) }}
                      />
                      {renderError( errors, "EmbeddingsModel" )}
                    </div>

                    <div className="grid gap-8 grid-cols-1 md:grid-cols-2">
                      <div>
                        <TextField
                          {...register( "ChunkingConfig.MaxTokens", {
                            ...watch( "ChunkingConfig.MaxTokens" ) ? {
                              validate: ComposeValidators( Validate_OnlyRealNumbers, Validate_NumbersWithoutExponent,
                                VALIDATE_MAXTOKENS( getSelectedOptions(( EmbeddingModelWatcher as any ), embeddingModelOptions, false )?.label ))
                            } : {}
                          })}
                          aria-describedby="Max Tokens"
                          disabled={editMode}
                          floatingLabel={
                            <LabelWithTooltip
                              tooltipId="MaxTokens"
                              label={t( "services.workspaces.MaxTokens" )}
                              tooltip={t( "services.workspaces.tooltip.MaxTokens" )}
                            />
                          }
                          onChange={ event => {
                            if ( !event.target.value ) {
                              resetField( "ChunkingConfig.MaxTokens" );
                            } else {
                              setValue( "ChunkingConfig.MaxTokens", event.target.value );
                            }

                            resetField( "ChunkingConfig.OverlapPercentage" );
                          }}
                        />
                        {renderError( errors, "ChunkingConfig.MaxTokens" )}
                      </div>
                      <div>
                        <TextField
                          {...register( "ChunkingConfig.OverlapPercentage", {
                            ...watch( "ChunkingConfig.MaxTokens" ) ? {
                              validate: ComposeValidators( Validate_OnlyRealNumbers, Validate_NumbersWithoutExponent,
                                Validate_NumberRange( 1, 99 )
                              )
                            } : {}
                          })}
                          aria-describedby="Overlap Percentage"
                          disabled={editMode}
                          floatingLabel={
                            <LabelWithTooltip
                              tooltipId="OverlapPercentage"
                              label={t( "services.workspaces.OverlapPercentage" )}
                              tooltip={t( "services.workspaces.tooltip.OverlapPercentage" )}
                            />
                          }
                        />
                        {renderError( errors, "ChunkingConfig.OverlapPercentage" )}
                      </div>
                    </div>
                  </div>
                </Accordion.Body>
              </Accordion>
              <div className="flex justify-end mt-4 md:col-span-2">
                <Button
                  variant="stroked"
                  classes="btn-auto-width"
                  size="sm"
                  aria-label={editMode
                    ? t( "services.workspaces.updateWorkspace" )
                    : t( "services.workspaces.createWorkspace" )}
                  loading={creatingWorkspace || updatingWorkspace}
                  type="submit">{editMode
                    ? t( "services.workspaces.updateWorkspace" )
                    : t( "services.workspaces.createWorkspace" )}</Button>
              </div>
            </div>
          }
        </fieldset>
      </form>
    : <EmptyState defaultImageVariant="no-auth" display="vertical">
      <EmptyState.Content title={t( "services.workspaces.notIntegrated" )} />
      <EmptyState.CTA>
        <Link to={permanentPaths?.profileAndSettings?.path}>
          <Button variant="stroked">
            { "Integrate with Amorphic" }
          </Button>
        </Link>
      </EmptyState.CTA>
    </EmptyState>;
};

const VALIDATE_MAXTOKENS = ( embeddingModel:string ) => ( maxTokens:number ) : string|undefined => {

  const modelLimits:Record<string, number> = {
    "amazon.titan-embed-text-v1": 8192,
    "cohere.embed-english-v3": 512,
    "cohere.embed-multilingual-v3": 512
  };

  if ( maxTokens > modelLimits[embeddingModel]){
    return `Max tokens for ${embeddingModel} is ${modelLimits[embeddingModel]}`;
  }

};