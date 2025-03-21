// libraries
import React, { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { Link, useMatch, useNavigate, useParams } from "react-router-dom";

// components
import { Button, TextField, Textarea, Select, SkeletonBlock, Accordion, ReloadableSelect, EmptyState, Toggle } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import { useAppSelector, useSuccessNotification } from "../../../utils/hooks";
import { routeActions } from "../../../constants";
import {
  ComposeValidators,
  Validate_Required, Validate_MaxChars,
  Validate_Alphanumeric_With_Special_Chars } from "../../../utils/formValidationUtils";
import { LabelWithTooltip, getSelectedOptions, renderError } from "../../../utils/renderUtils";
import { useCreateChatbotMutation, useUpdateChatbotMutation, useGetChatbotDetailsQuery } from "../../../services/chatbots";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import { useGetModelsQuery } from "../../../services/models";
import styles from "./commonForm.module.scss";
import { useGetWorkspacesQuery } from "../../../services/workspaces";
import NotAuthorizedView from "../../customComponents/notAuthorizedView";
import { Option } from "../../../types";

interface CreateComponentProps {
  /**
   * List of permissions used to determine to show or hide the form
   */
  onClose: () => void;
  routePath: string;
}

interface FormFields {
  ChatbotName: string,
  Description: string,
  Keywords: Option[],
  Workspace: string
  Model: string,
  EmbeddedConfig: string,
  Instructions?: string,
  KeepActive: boolean,
  EnableRedaction: boolean
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
  const { data: { Models = [] } = {} } = useGetModelsQuery({ "modality": "text" });
  const modelOptions = useMemo(() => {
    return Models.map(( model:any ) => {
      return {
        label: model.ModelName,
        value: model.ModelId
      };
    });
  }, [Models]);

  const { formState: { errors, isDirty }, watch, handleSubmit, control, register, reset, setValue } =
   useForm<FormFields>();

  const [ createChatbot, { isLoading: creatingChatbot }] = useCreateChatbotMutation();
  const [ editChatbot, { isLoading: updatingChatbot }] = useUpdateChatbotMutation();
  const { data: chatbotDetails, isFetching: fetchingChatbotDetails } = useGetChatbotDetailsQuery( resourceId, { skip: !resourceId });
  const { data: { Workspaces = [] } = {}, refetch: refetchWorkspaces, isLoading: fetchingWorkspaces } =
  useGetWorkspacesQuery({ projectionExpression: "WorkspaceName,WorkspaceId" });

  const [showSuccessNotification] = useSuccessNotification();

  const workspaceOptions = useMemo(() => Workspaces.map(( item:any ) => ({
    label: item.WorkspaceName,
    value: item.WorkspaceId
  })), [Workspaces]);

  useEffect(() => {
    if ( chatbotDetails && !isDirty ){
      const extDetails = structuredClone( chatbotDetails );
      if ( extDetails?.Keywords ){
        extDetails.Keywords = extDetails?.Keywords.map(( keyword:string ) => {
          return { label: keyword, value: keyword };
        });
      }

      if ( extDetails?.Workspace ){
        extDetails.Workspace = workspaceOptions.find(( workspace: Option ) => workspace.label === extDetails.Workspace )?.value;
      }

      if ( extDetails?.Model ){
        extDetails.Model = modelOptions.find(( model: Option ) => model.label === extDetails.Model )?.value;
      }

      if ( extDetails?.EmbeddedConfig ){
        extDetails.EmbeddedConfig = JSON.stringify( extDetails?.EmbeddedConfig ?? {}, null, 2 );
      }

      reset( extDetails );
    }
  }, [ chatbotDetails, isDirty, modelOptions, reset, workspaceOptions ]);

  const onSubmit = async ( values: FormFields ) => {

    const dataToSend = {
      ...values,
      KeepActive: values.KeepActive ?? false,
      Description: values.Description || "-",
      Keywords: values?.Keywords?.map(( item: any ) => item.value ) ?? [],
      EmbeddedConfig: values?.EmbeddedConfig ? JSON.parse( values?.EmbeddedConfig ) : {}
    };

    if ( createMode ) {
      const { data: { Message = "", ChatbotId = "" } = {} }: any = await createChatbot( dataToSend );
      if ( Message ) {
        navigate( `${routePath}/${ChatbotId}/${routeActions.details}`, { replace: true });
        showSuccessNotification({
          content: Message
        });
      }
    } else if ( editMode ) {

      const { data: { Message = "" } = {} }: any = await editChatbot({ id: resourceId, requestBody: dataToSend });
      if ( Message ) {
        navigate( `${routePath}/${resourceId}/${routeActions.details}`, { replace: true });
        showSuccessNotification({
          content: Message
        });
      }
    }
    reset();
  };

  const isCreatePermitted = AmorphicIntegrationStatus === "connected" && createMode;
  const isEditPermitted = AmorphicIntegrationStatus === "connected" && editMode && chatbotDetails?.AccessType === "owner";

  return fetchingChatbotDetails
    ? <SkeletonBlock variant="sideBars" />
    : isCreatePermitted || isEditPermitted
      ? <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
        <p className={styles.required}>* {t( "common.words.required" )}</p>
        <fieldset disabled={fetchingChatbotDetails} >
          {fetchingChatbotDetails ? <SkeletonBlock variant="lines" size="4xl" rows={8} /> :
            <div className={"flex flex-col gap-x-14 gap-y-8"}>
              <div className={"flex flex-col justify-center self-start w-full"}>
                <TextField
                  floatingLabel={<span className="requiredField">{t( "Chatbot Name" )}</span>}
                  aria-describedby={t( "Chatbot Name" )}
                  disabled={editMode}
                  {...register( "ChatbotName", {
                    validate: ( v:string ) => ComposeValidators( Validate_Required( t( "Chatbot Name" )),
                      Validate_Alphanumeric_With_Special_Chars( "-_" )( t( "Chatbot Name" )))( v )
                  })}
                />
                {renderError( errors, "ChatbotName" )}
              </div>
              <div className={"grid gap-x-14 gap-y-8 grid-cols-1 md:grid-cols-2"}>
                <Textarea
                  floatingLabel={t( "Description" )}
                  aria-describedby={t( "Description" )}
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
              </div>
              <Accordion expand classes="shadow-md">
                <Accordion.Header classes="bg-secondary-100">
                  <div className="flex items-center gap-2 py-2">
                    <h1 className="font-medium text-lg" >
                      {t( "services.workspaces.Advanced" )}
                    </h1>
                  </div>
                </Accordion.Header>
                <Accordion.Body>
                  <div className="flex flex-col my-8 space-y-8 bg-whitepy-8">

                    {/* ------------------ Workspace Field ------------------  */}
                    <div>
                      <Controller
                        name="Workspace"
                        control={control}
                        rules={{ validate: Validate_Required( "Workspace" ) }}
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        render={({ field: { ref, value: valueRhf, ...rest } }:any ) => (
                          <ReloadableSelect
                            {...rest}
                            isReloading={fetchingWorkspaces}
                            options={workspaceOptions}
                            menuPortalTarget={document.body}
                            value = { getSelectedOptions( valueRhf, workspaceOptions, true ) }
                            onChange={( selectedOption: any ) => typeof selectedOption !== "undefined" && setValue( "Workspace", selectedOption.value )}
                            aria-describedby={t( "Workspace" )}
                            floatingLabel={<span className="requiredField">{t( "Workspace" )}</span>}
                            onReloadClick={refetchWorkspaces} />
                        )}
                      />
                      {renderError( errors, "Workspace" )}
                    </div>

                    {/* ------------------ Model Field ------------------  */}

                    <div>
                      <Controller
                        name="Model"
                        control={control}
                        rules={{ validate: Validate_Required( "Model" ) }}
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        render={({ field: { ref, value: valueRhf, ...rest } }) => <Select
                          {...rest}
                          value={typeof valueRhf !== "undefined" && getSelectedOptions( valueRhf, modelOptions, false )}
                          menuPortalTarget={document.body}
                          floatingLabel={<span className="requiredField">{t( "Model" )}</span>}
                          options={modelOptions}
                          onChange={ selectedOption => selectedOption ? setValue( "Model", selectedOption.value ) : selectedOption}
                        />}
                      />
                      {renderError( errors, "Model" )}
                    </div>

                    {/* ------------------ Instructions Field ------------------  */}

                    <div>
                      <Textarea
                        floatingLabel={t( "Instructions" )}
                        {...register( "Instructions" )}
                      />
                      {renderError( errors, "Instructions" )}
                    </div>

                    <div className="grid grid-cols-2">

                      {/* ------------------ Keep Active Field ------------------  */}

                      <Toggle
                        classes="w-fit"
                        label={<LabelWithTooltip label="Keep Active"
                          // eslint-disable-next-line max-len
                          tooltip="Toogle it to true if you want to use the Chatbot in an external site" />}
                        toggled={watch( "KeepActive" )}
                        onChange={() => setValue( "KeepActive", !watch( "KeepActive" ))} />

                      {/* ------------------ Enable Redaction Field ------------------  */}

                      <Toggle
                        classes="w-fit"
                        label="Enable Redaction"
                        toggled={watch( "EnableRedaction" )}
                        onChange={() => setValue( "EnableRedaction", !watch( "EnableRedaction" ))} />
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
                    ? t( "Update Chatbot" )
                    : t( "Create Chatbot" )}
                  loading={creatingChatbot || updatingChatbot}
                  type="submit">{editMode
                    ? t( "Update Chatbot" )
                    : t( "Create Chatbot" )}</Button>
              </div>
            </div>
          }
        </fieldset>
      </form>
      : AmorphicIntegrationStatus !== "connected"
        ? <EmptyState defaultImageVariant="no-auth" display="vertical">
          <EmptyState.Content title={t( "You have not integrated with Amorphic!" )} />
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
              action: createMode ? "create" : "edit", service: t( "Chatbot" )
            }}
            showRedirectButton={false}
          />
        </div>;
};
