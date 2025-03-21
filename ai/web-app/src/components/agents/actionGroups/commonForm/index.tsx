// libraries
import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { Link, useMatch, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Button, TextField, Textarea, EmptyState, SkeletonBlock, Accordion, ReloadableSelect } from "@amorphic/amorphic-ui-core";

// components
import NotAuthorizedView from "../../../customComponents/notAuthorizedView";
import { Upload } from "../../../customComponents/upload";

// methods / hooks / constants / styles
import { useAppSelector, useErrorNotification, useSuccessNotification } from "../../../../utils/hooks";
import { routeActions } from "../../../../constants";
import {
  ComposeValidators,
  Validate_Required,
  Validate_Alphanumeric_With_Special_Chars,
  Validate_UploadPath_Required,
  Validate_No_Space,
  Validate_Length } from "../../../../utils/formValidationUtils";
import { LabelWithTooltip, getSelectedOptions, renderError } from "../../../../utils/renderUtils";
import { useCreateActionGroupMutation, useGetActionGroupDetailsQuery, useGetActionGroupsPresignedURLQuery,
  useUpdateActionGroupMutation } from "../../../../services/agents/actionGroups";
import { useGetLibrariesQuery } from "../../../../services/agents/libraries";
import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import styles from "./commonForm.module.scss";
import { isErrorWithMessage } from "../../../../services/helpers";
import { Option } from "../../../../types";

interface CommonFormProps {
  routePath: string;
}

interface ActionGroupFormFields {
  ActionGroupId: string;
  ActionGroupName: string;
  Description?: string;
  LambdaS3Path?: {name: string, uploadPath: string };
  LambdaHandler: string;
  ApiDefS3Path?: {name: string, uploadPath: string };
  AttachedLibraries?: string[];
}

const CommonForm = ({ routePath }: CommonFormProps ): JSX.Element => {
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const editMode = Boolean( useMatch( `${routePath}/${resourceId}/${routeActions.edit}` ));
  const { t } = useTranslation();
  const navigate = useNavigate();
  const permanentPaths = usePermanentPaths();
  const { AmorphicIntegrationStatus } = useAppSelector( state => state.account );
  const [ uploadingLambdaToS3, setUploadingLambdaToS3 ] = useState( false );
  const [ uploadingAPIDefToS3, setUploadingAPIDefToS3 ] = useState( false );
  const [showErrorNotification] = useErrorNotification();
  const { formState: { errors, isDirty }, handleSubmit, register, reset, watch, control, setValue } =
   useForm<ActionGroupFormFields>();

  const LambdaS3PathValue = watch( "LambdaS3Path" );
  const ApiDefS3PathValue = watch( "ApiDefS3Path" );

  const [ createActionGroup, { isLoading: creatingActionGroup }] = useCreateActionGroupMutation();
  const [ updateActionGroup, { isLoading: updatingActionGroup }] = useUpdateActionGroupMutation();
  const { data: {
    LambdaPresignedURL = "",
    ApiDefPresignedURL = "",
    ActionGroupId,
    LambdaS3Path = "",
    ApiDefS3Path = "" } = {}
  } = useGetActionGroupsPresignedURLQuery( resourceId, { refetchOnMountOrArgChange: true });
  const { data: actionGroupDetails, isLoading: fetchingActionGroupDetails } = useGetActionGroupDetailsQuery( resourceId, { skip: !editMode });

  const [showSuccessNotification] = useSuccessNotification();
  const { data: { Libraries = [] } = {}, isFetching: fetchingLibraries, refetch: refetchLibraries } =
  useGetLibrariesQuery({ projectionExpression: "LibraryId,LibraryName" });

  const libraryOptions = useMemo(() => Libraries?.map(({ LibraryId, LibraryName }) => ({ label: LibraryName, value: LibraryId })), [Libraries]);

  const onSubmit = async( values: ActionGroupFormFields ) => {
    try {
      if ( editMode ) {
        const requiredPayload = {
          Description: values.Description,
          LambdaS3Path: LambdaS3PathValue?.uploadPath,
          LambdaHandler: values.LambdaHandler,
          ApiDefS3Path: ApiDefS3PathValue?.uploadPath,
          AttachedLibraries: values.AttachedLibraries
        };

        const { Message }: any = await updateActionGroup({ id: resourceId, requestBody: requiredPayload }).unwrap();
        showSuccessNotification({ content: Message });
        reset();
        navigate( -1 );
      } else {
        const requiredPayload: any = { ...values };

        requiredPayload.LambdaS3Path = LambdaS3PathValue?.uploadPath;
        requiredPayload.ApiDefS3Path = ApiDefS3PathValue?.uploadPath;
        requiredPayload.ActionGroupId = ActionGroupId;
        const { Message }: any = await createActionGroup( requiredPayload ).unwrap();
        showSuccessNotification({ content: Message });
        reset();
        navigate( `${routePath}/${ActionGroupId}/${routeActions.details}`, { replace: true });
      }
      // eslint-disable-next-line no-empty
    } catch ( e ){
    }
  };

  const handleLambdaUpload = async ( file: File ) => {
    setUploadingLambdaToS3( true );

    try {
      const config = {
        headers: { "Content-Type": "application/zip" }
      };

      await axios.put( LambdaPresignedURL, file, config );

      setValue( "LambdaS3Path", { name: file.name, uploadPath: LambdaS3Path });
    } catch ( e ){
      isErrorWithMessage( e ) && showErrorNotification({ content: t( "common.words.errorInFileUpload" ) });
    }

    setUploadingLambdaToS3( false );
  };

  const handleAPIDefUpload = async ( file: File ) => {
    setUploadingAPIDefToS3( true );

    try {
      const config = {
        headers: { "Content-Type": "application/json" }
      };

      await axios.put( ApiDefPresignedURL, file, config );

      setValue( "ApiDefS3Path", { name: file.name, uploadPath: ApiDefS3Path });
    } catch ( e ){
      isErrorWithMessage( e ) && showErrorNotification({ content: t( "common.words.errorInFileUpload" ) });
    }

    setUploadingAPIDefToS3( false );
  };

  useEffect(() => {
    register( "ActionGroupId" );
    register( "LambdaS3Path", {
      validate: ( value ) => Validate_UploadPath_Required( t( "services.agents.actionGroups.lambdaS3PathValidationMsg" ))( value?.uploadPath )
    });
    register( "ApiDefS3Path", {
      validate: ( value ) => Validate_UploadPath_Required( t( "services.agents.actionGroups.apiDefS3PathValidationMsg" ))( value?.uploadPath )
    });
  }, [ register, t ]);

  useEffect(() => {
    if ( actionGroupDetails && !isDirty ){
      const { ActionGroupId: extId, ActionGroupName, Description, LambdaHandler, AttachedLibraries, ApiDefS3Uri, LambdaS3Uri } = actionGroupDetails;
      let LambdaS3PathVal = undefined;
      let ApiDefS3PathVal = undefined;
      let AttachedLibrariesVal = undefined;

      if ( LambdaS3Uri ) {
        LambdaS3PathVal = { name: LambdaS3Uri.substring( LambdaS3Uri.lastIndexOf( "/" ) + 1 ), uploadPath: LambdaS3Uri };
      }

      if ( ApiDefS3Uri ) {
        ApiDefS3PathVal = { name: ApiDefS3Uri.substring( ApiDefS3Uri.lastIndexOf( "/" ) + 1 ), uploadPath: ApiDefS3Uri };
      }

      if ( AttachedLibraries ) {
        AttachedLibrariesVal = AttachedLibraries.map(({ LibraryId }) => LibraryId );
      }

      reset({ ActionGroupId: extId, ActionGroupName, Description, LambdaHandler, AttachedLibraries: AttachedLibrariesVal, ApiDefS3Path: ApiDefS3PathVal,
        LambdaS3Path: LambdaS3PathVal });
    }
  }, [ isDirty, actionGroupDetails, reset ]);

  return AmorphicIntegrationStatus === "connected"
    ? fetchingActionGroupDetails
      ? <SkeletonBlock variant="sideBars" />
      : <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
        <p className={styles.required}>* {t( "common.words.required" )}</p>
        <fieldset className={styles.fieldsContainer} disabled={creatingActionGroup || updatingActionGroup}>

          {/* ************************** ActionGroupName Field ************************** */}

          <div className="px-4">
            <TextField
              floatingLabel={<span className="requiredField">{t( "services.agents.actionGroups.ActionGroupName" )}</span>}
              disabled={editMode}
              {...register( "ActionGroupName", {
                validate: ( v:string ) => ComposeValidators( Validate_Required( t( "services.agents.actionGroups.ActionGroupName" )),
                  Validate_Length( 3, 50 )( t( "services.agents.actionGroups.ActionGroupName" )),
                  Validate_Alphanumeric_With_Special_Chars( "-" )( t( "services.agents.actionGroups.ActionGroupName" )))( v )
              })}
            />
            {renderError( errors, "ActionGroupName" )}
          </div>

          {/* ************************** Description Feild ************************** */}
          <div className="px-4">
            <Textarea
              floatingLabel={<span className="requiredField">{t( "services.agents.actionGroups.Description" )}</span>}
              {...register( "Description", { validate: Validate_Required( t( "services.agents.actionGroups.Description" )) })}
            />
            {renderError( errors, "Description" )}
          </div>

          <Accordion expand classes="shadow-md">
            <Accordion.Header classes="bg-secondary-100">
              <h1 className="font-medium text-lg py-2" >
                {t( "services.agents.actionGroups.advanced" )}
                <sup className="text-danger">{" *"}</sup>
              </h1>
            </Accordion.Header>
            <Accordion.Body classes={styles.accordionBody}>

              {/* ************************** Upload Api Definition ************************** */}

              <div className="space-y-2">
                <label className="requiredField">{t( "services.agents.actionGroups.uploadAPIDef" )}</label>
                <Upload uploadedFiles={ApiDefS3PathValue} removeFile={() => setValue( "ApiDefS3Path", undefined )}
                  uploading={uploadingAPIDefToS3} classes="mb-6"
                  handleUpload={ fileInfo => handleAPIDefUpload( fileInfo as File )} acceptedFileType=".json" />
                {renderError( errors, "ApiDefS3Path" )}
              </div>

              {/* ************************** Upload Lambda Data Field ************************** */}

              <div className="space-y-2">
                <label className="requiredField">{t( "services.agents.actionGroups.uploadLambdaCode" )}</label>
                <Upload uploadedFiles={LambdaS3PathValue} removeFile={() => setValue( "LambdaS3Path", undefined )}
                  uploading={uploadingLambdaToS3} classes="mb-6"
                  handleUpload={ fileInfo => handleLambdaUpload( fileInfo as File )} acceptedFileType=".zip" />
                {renderError( errors, "LambdaS3Path" )}
              </div>

              {/* ************************** LambdaHandler Field ************************** */}

              <div >
                <TextField
                  floatingLabel={
                    <LabelWithTooltip
                      required
                      label={t( "services.agents.actionGroups.LambdaHandler" )}
                      tooltip={t( "services.agents.actionGroups.tooltip.LambdaHandler" )}
                    />
                  }
                  {...register( "LambdaHandler", {
                    validate: ( v:string ) => ComposeValidators( Validate_Required( t( "services.agents.actionGroups.LambdaHandler" )),
                      Validate_No_Space( t( "services.agents.actionGroups.LambdaHandler" )))( v )
                  })}
                />
                {renderError( errors, "LambdaHandler" )}
              </div>

              {/* ************************** AttachedLibraries Field ************************** */}

              <div>
                <Controller
                  name="AttachedLibraries"
                  control={control}
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  render={({ field: { ref, value: valueRhf, ...rest } }) => <ReloadableSelect
                    {...rest}
                    multi
                    className="mb-2"
                    value={typeof valueRhf !== "undefined" && getSelectedOptions( valueRhf, libraryOptions, true )}
                    menuPortalTarget={document.body}
                    floatingLabel={<LabelWithTooltip
                      label={t( "services.agents.actionGroups.AttachedLibraries" )}
                      tooltip={t( "services.agents.actionGroups.tooltip.AttachedLibraries" )} />}
                    options={libraryOptions}
                    onReloadClick={refetchLibraries}
                    isReloading={fetchingLibraries}
                    onChange={ options => {
                      options && setValue( "AttachedLibraries", ( options as unknown as Option[]).map( option => option.value ));
                    }}
                  />}
                />
                {renderError( errors, "AttachedLibraries" )}
              </div>
            </Accordion.Body>
          </Accordion>
          <div className="flex justify-end mt-4">
            <Button
              variant="stroked"
              classes="btn-auto-width"
              size="sm"
              aria-label={t( "services.agents.actionGroups.createActionGroup" )}
              loading={creatingActionGroup || updatingActionGroup}
              type="submit">{editMode ? t( "services.agents.actionGroups.updateActionGroup" ) : t( "services.agents.actionGroups.createActionGroup" )}</Button>
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
            action: "create", service: t( "services.agents.actionGroups.thisActionGroup" )
          }}
          showRedirectButton={false}
        />
      </div>;
};

export default CommonForm;