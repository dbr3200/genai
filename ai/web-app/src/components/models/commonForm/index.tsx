// libraries
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

// components
import { Button, TextField, Textarea, Select, Accordion, EmptyState, ADPIcon } from "@amorphic/amorphic-ui-core";
import { FieldArray } from "../../customComponents/fieldArray";
import { Upload } from "../../customComponents/upload";

// methods / hooks / constants / styles
import { useAppSelector, useErrorNotification, useSuccessNotification } from "../../../utils/hooks";
import { routeActions } from "../../../constants";
import {
  ComposeValidators,
  Validate_Required, Validate_MaxChars,
  Validate_Alphanumeric_With_Special_Chars,
  Validate_UploadPath_Required } from "../../../utils/formValidationUtils";
import { getSelectedOptions, LabelWithTooltip, renderError } from "../../../utils/renderUtils";
import { useCreateModelMutation, useGetModelPresignedURLMutation, CreateModelPayload, useGetModelsQuery } from "../../../services/models";
import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import styles from "./commonForm.module.scss";

interface CommonFormProps {
  routePath: string;
}

interface ModelFormFields {
  ModelName: string;
  CustomizationType: string;
  BaseModelId: string;
  Description?: string;
  TrainingDataLocation: string;
  ValidationDataLocation: string;
  HyperParameters?: Record<string, string>[];
}

const modelTypeOptions = [
  { label: "Fine tuning", value: "FINE_TUNING" }
];

const CommonForm = ({
  routePath
}: CommonFormProps ): React.ReactElement => {
  const { t } = useTranslation();
  const permanentPaths = usePermanentPaths();
  const [getPresignedURL] = useGetModelPresignedURLMutation();
  const { AmorphicIntegrationStatus } = useAppSelector( state => state.account );
  const [ uploadingState, setUploadingState ] = useState({
    training: false,
    validation: false
  });

  const navigate = useNavigate();

  const { formState: { errors, isDirty }, handleSubmit, control, register, watch, reset, setValue, resetField } =
   useForm<ModelFormFields>();

  const ModelName = watch( "ModelName" );
  const TrainingDataLocation = watch( "TrainingDataLocation" );
  const ValidationDataLocation = watch( "ValidationDataLocation" );
  const CustomizationTypeWatcher = watch( "CustomizationType" );

  const [ createModel, { isLoading: creatingModel }] = useCreateModelMutation();

  const [showSuccessNotification] = useSuccessNotification();
  const [showErrorNotification] = useErrorNotification();

  const { data: { Models = [] } = {} } = useGetModelsQuery({
    ["model-use"]: `${CustomizationTypeWatcher}`
  }, {
    skip: !CustomizationTypeWatcher
  });

  const baseModelOptions = Models.map( model => ({
    label: model?.ModelName,
    value: model?.ModelId
  }));

  const onSubmit = async( values: ModelFormFields ) => {
    const payload = structuredClone( values ) as CreateModelPayload;
    if ( values.HyperParameters ) {
      const hyperParameters = values?.HyperParameters?.reduce(( acc, entry ) => {
        acc[entry.key] = entry.value;
        return acc;
      }, {});
      payload.HyperParameters = hyperParameters;
    }

    const { data: { Message = "", ModelId = "" } = {} }: any = await createModel( payload );

    if ( Message ) {
      navigate( `${routePath}/${ModelId}/${routeActions.details}`, { replace: true });
      showSuccessNotification({
        content: Message
      });
      reset();
    }
  };

  const handleUpload = async ( file: File, uploadType: "training" | "validation" ) => {
    if ( file ) {
      setUploadingState({ ...uploadingState, [uploadType]: true });
      try {
        const { PresignedURL: uploadURL, S3Path } : { PresignedURL:string, S3Path: string } = await getPresignedURL(
          { ModelName, DataType: uploadType }
        ).unwrap();
        await axios.put( uploadURL, file );
        setValue( uploadType === "training" ? "TrainingDataLocation" : "ValidationDataLocation", S3Path );
      } catch ( e ){
        showErrorNotification({ content: t( "common.words.errorInFileUpload" ) });
      } finally {
        setUploadingState({ ...uploadingState, [uploadType]: false });
      }
    }
  };

  useEffect(() => {
    register( "TrainingDataLocation", {
      validate: ( value ) => Validate_UploadPath_Required( t( "services.models.trainingDataValidationMsg" ))( value )
    });
    register( "ValidationDataLocation" );
  }, [ register, t ]);

  return AmorphicIntegrationStatus !== "connected"
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
    : <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
      <p className={styles.required}>* {t( "common.words.required" )}</p>
      <fieldset className={styles.fieldsContainer}>

        {/* ************************** ModelName ************************** */}

        <div className="px-4">
          <TextField
            floatingLabel={
              <LabelWithTooltip
                required
                tooltipId="ModelName"
                label={t( "services.models.ModelName" )}
                tooltip={t( "services.models.tooltip.ModelName" )}
              />
            }
            aria-describedby={t( "services.models.ModelName" )}
            {...register( "ModelName", {
              validate: ( v:string ) => ComposeValidators( Validate_Required( t( "services.models.ModelName" )),
                Validate_Alphanumeric_With_Special_Chars( "-_" )( t( "services.models.ModelName" )))( v )
            })}
          />
          {renderError( errors, "ModelName" )}
        </div>

        {/* ************************** Description ************************** */}
        <div className="px-4">
          <Textarea
            floatingLabel={
              <LabelWithTooltip
                tooltipId="Description"
                label={t( "services.models.Description" )}
                tooltip={t( "services.models.tooltip.Description" )}
              />
            }
            aria-describedby={t( "services.models.Description" )}
            {...register( "Description", { validate: Validate_MaxChars })}
          />
          {renderError( errors, "Description" )}
        </div>
        <Accordion expand classes="shadow-md">
          <Accordion.Header classes="bg-secondary-100">
            <h1 className="font-medium text-lg py-2" >
              {t( "services.models.Advanced" )}
            </h1>
          </Accordion.Header>
          <Accordion.Body classes="space-y-12 px-2">

            {/* ************************** CustomizationType ************************** */}

            <div className="mt-6">
              <Controller
                name="CustomizationType"
                control={control}
                rules={{ validate: Validate_Required( t( "services.models.CustomizationType" )) }}
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                render={({ field: { ref, value: valueRhf, ...rest } }) => <Select
                  {...rest}
                  value={typeof valueRhf !== "undefined" && getSelectedOptions( valueRhf, modelTypeOptions, false )}
                  menuPortalTarget={document.body}
                  floatingLabel={<LabelWithTooltip
                    required
                    label={t( "services.models.CustomizationType" )}
                    tooltip={t( "services.models.tooltip.CustomizationType" )} />}
                  options={modelTypeOptions}
                  onChange={ option => {
                    option && setValue( "CustomizationType", option.value );
                  }}
                />}
              />
              {renderError( errors, "CustomizationType" )}
            </div>

            {/* ************************** BaseModelId Field ************************** */}
            {CustomizationTypeWatcher &&
            <div>
              <Controller
                name="BaseModelId"
                control={control}
                rules={{ validate: Validate_Required( t( "services.models.BaseModel" )) }}
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                render={({ field: { ref, value: valueRhf, ...rest } }) => <Select
                  {...rest}
                  value={typeof valueRhf !== "undefined" && getSelectedOptions( valueRhf, baseModelOptions, false )}
                  menuPortalTarget={document.body}
                  floatingLabel={<LabelWithTooltip
                    required
                    label={t( "services.models.BaseModel" )}
                    tooltip={t( "services.models.tooltip.BaseModel" )} />}
                  options={baseModelOptions}
                  onChange={ option => {
                    option && setValue( "BaseModelId", option.value );
                  }}
                />}
              />
              {renderError( errors, "BaseModelId" )}
            </div>
            }
            {/* ************************** Upload Training Data Field ************************** */}

            <div className="space-y-2">
              <label className="requiredField">{t( "services.models.uploadTrainingData" )}</label>
              <Upload uploadedFiles={TrainingDataLocation ? { name: TrainingDataLocation?.substring( TrainingDataLocation.lastIndexOf( "/" ) + 1 ),
                uploadPath: TrainingDataLocation } : null}
              disabled={!ModelName} uploading={uploadingState.training} classes="mb-6"
              handleUpload={ fileInfo => handleUpload( fileInfo as File, "training" )}
              removeFile={() => resetField( "TrainingDataLocation" )}
              acceptedFileType=".jsonl" />
              {renderError( errors, "TrainingDataLocation" )}
            </div>

            {/* ************************** Upload Validation Data Field ************************** */}

            <div className="space-y-2">
              <label>{t( "services.models.uploadValidationData" )}</label>
              <Upload uploadedFiles={ValidationDataLocation ? { name: ValidationDataLocation?.substring( ValidationDataLocation.lastIndexOf( "/" ) + 1 ),
                uploadPath: ValidationDataLocation } : null}
              disabled={!ModelName} uploading={uploadingState.validation} classes="mb-6"
              handleUpload={ fileInfo => handleUpload( fileInfo as File, "validation" )}
              removeFile={() => resetField( "ValidationDataLocation" )}
              acceptedFileType=".jsonl" />
              {renderError( errors, "ValidationDataLocation" )}
            </div>

            {/* ************************** Hyper Parameters Field ************************** */}

            <FieldArray
              tooltip={<span className="flex gap-2">{t( "services.models.tooltip.HyperParameters" )}
                <a href="https://docs.aws.amazon.com/bedrock/latest/userguide/custom-models-hp.html"
                  className="text-primary-250" target="_blank" rel="noopener noreferrer">
                  <ADPIcon icon="external-link" size="xs" />
                </a></span>
              }
              tooltipOptions={{ clickable: true, renderOutSidePortal: true }}
              addLabel={t( "services.models.addHyperParameters" )}
              name="HyperParameters"
              label={t( "services.models.HyperParameters" )}
              register={register}
              control={control}
              errors={errors}
              shouldUnRegister={false}
            />
          </Accordion.Body>
        </Accordion>
        <div className="flex justify-end mt-4">
          <Button
            variant="stroked"
            classes="btn-auto-width"
            size="sm"
            aria-label={t( "services.models.createModel" )}
            disabled={!isDirty}
            loading={creatingModel}
            type="submit">{t( "services.models.createModel" )}</Button>
        </div>

      </fieldset>
    </form>;
};

export default CommonForm;