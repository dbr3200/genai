// libraries
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Link, useMatch, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Button, TextField, Textarea, EmptyState, SkeletonBlock } from "@amorphic/amorphic-ui-core";

// components
import NotAuthorizedView from "../../../customComponents/notAuthorizedView";
import { Upload } from "../../../customComponents/upload";

// methods / hooks / constants / styles
import { useAppSelector, useErrorNotification, useInfoNotification, useSuccessNotification } from "../../../../utils/hooks";
import { routeActions } from "../../../../constants";
import {
  ComposeValidators,
  Validate_Required, Validate_MaxChars,
  Validate_Alphanumeric_With_Special_Chars } from "../../../../utils/formValidationUtils";
import { LabelWithTooltip, renderError } from "../../../../utils/renderUtils";
import { useCreateLibraryMutation, useGetLibraryDetailsQuery, useGetPresignedURLForPackageUploadMutation,
  useUpdateLibraryMutation } from "../../../../services/agents/libraries";
import { usePermanentPaths } from "../../../utils/hooks/usePermanentPaths";
import styles from "./commonForm.module.scss";
import { isErrorWithMessage } from "../../../../services/helpers";

interface CommonFormProps {
  routePath: string;
}

interface LibraryFormFields {
  LibraryName: string;
  Description?: string;
}

const CreateLibraryForm = ({ setLibraryId
}: {setLibraryId: React.Dispatch<React.SetStateAction<string | null>> }): React.ReactElement => {
  const { t } = useTranslation();
  const permanentPaths = usePermanentPaths();
  const { AmorphicIntegrationStatus } = useAppSelector( state => state.account );

  const { formState: { errors }, handleSubmit, register, reset } =
   useForm<LibraryFormFields>();

  const [ createLibrary, { isLoading: creatingLibrary }] = useCreateLibraryMutation();

  const [showSuccessNotification] = useSuccessNotification();

  const onSubmit = async( values: LibraryFormFields ) => {

    const { data: { Message = "", LibraryId = "" } = {} }: any = await createLibrary( values );

    if ( Message ) {
      setLibraryId( LibraryId );
      showSuccessNotification({
        content: Message
      });
      reset();
    }
  };

  const isCreatePermitted = AmorphicIntegrationStatus === "connected";

  return isCreatePermitted
    ? <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
      <p className={styles.required}>* {t( "common.words.required" )}</p>
      <fieldset className={styles.fieldsContainer} disabled={creatingLibrary}>

        {/* ************************** LibraryName ************************** */}

        <div className="px-4">
          <TextField
            floatingLabel={
              <LabelWithTooltip
                required
                tooltipId="LibraryName"
                label={t( "services.agents.libraries.LibraryName" )}
                tooltip={t( "services.agents.libraries.tooltip.LibraryName" )}
              />
            }
            aria-describedby={t( "services.agents.libraries.LibraryName" )}
            {...register( "LibraryName", {
              validate: ( v:string ) => ComposeValidators( Validate_Required( t( "services.agents.libraries.LibraryName" )),
                Validate_Alphanumeric_With_Special_Chars( "-_" )( t( "services.agents.libraries.LibraryName" )))( v )
            })}
          />
          {renderError( errors, "LibraryName" )}
        </div>

        {/* ************************** Description ************************** */}
        <div className="px-4">
          <Textarea
            floatingLabel={t( "services.agents.libraries.Description" )}
            {...register( "Description", { validate: Validate_MaxChars })}
          />
          {renderError( errors, "Description" )}
        </div>
        <div className="flex justify-end mt-4">
          <Button
            variant="stroked"
            classes="btn-auto-width"
            size="sm"
            aria-label={t( "services.agents.libraries.createLibrary" )}
            loading={creatingLibrary}
            type="submit">{t( "services.agents.libraries.createLibrary" )}</Button>
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
            action: "create", service: t( "services.agents.libraries.thisLibrary" )
          }}
          showRedirectButton={false}
        />
      </div>;
};

interface UploadPackageFormFields {
  Description?: string;
  Packages: {name: string, uploadPath: string }[]
}

const UploadPackageForm = ({ libraryId, routePath, editMode }: {libraryId: string, routePath: string; editMode: boolean; }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { AmorphicIntegrationStatus } = useAppSelector( state => state.account );
  const isEditPermitted = AmorphicIntegrationStatus === "connected" && editMode;

  const { data: libraryDetails, isLoading: fetchingLibraryDetails } = useGetLibraryDetailsQuery( libraryId, { skip: !isEditPermitted });

  const [ uploadingToS3, setUploadingToS3 ] = useState( false );
  const [getPresignedURL] = useGetPresignedURLForPackageUploadMutation();
  const [ updateLibrary, { isLoading: updatingLibrary }] = useUpdateLibraryMutation();
  const { formState: { errors, isDirty }, handleSubmit, reset, watch, setValue, register } =
   useForm<UploadPackageFormFields>();

  const [showSuccessNotification] = useSuccessNotification();
  const [showErrorNotification] = useErrorNotification();
  const [showInfoNotification] = useInfoNotification();
  const Packages = watch().Packages ?? [];

  const onSubmit = async( values: UploadPackageFormFields ) => {

    const formattedValues: any = structuredClone( values );

    formattedValues.Packages = formattedValues.Packages.map(( packageInfo: {fileName: string, uploadPath: string }) => packageInfo.uploadPath );

    try {
      const { Message }: any = await updateLibrary({ id: libraryId, requestBody: formattedValues }).unwrap();

      showSuccessNotification({ content: Message });
      reset();
      editMode ? navigate( -1 ) : navigate( `${routePath}/${libraryId}/${routeActions.details}`, { replace: true });
    // eslint-disable-next-line no-empty
    } catch ( e ){
    }
  };

  const handleUpload = async ( files: File[]) => {
    setUploadingToS3( true );
    const fileUploadPromises: Promise<void>[] = [];
    files.forEach( async ( file: File ) => {

      const uploadFile = async () => {
        try {
          // Check if file name is already present
          if (( watch( "Packages" ) ?? []).find(( fileInfo ) => fileInfo.name === file.name )) {
            showInfoNotification({ content: t( "services.agents.libraries.fileNameAlreadyPresent" ) });
            return;
          }

          const { PresignedURL, UploadPath } = await getPresignedURL(
            { id: libraryId, fileName: file.name }).unwrap();

          const config = {
            headers: {
              "Content-Type": "application/zip"
            }
          };

          await axios.put( PresignedURL, file, config );

          setValue( "Packages", [ ...( watch( "Packages" ) ?? []), { name: file.name, uploadPath: UploadPath }]);
        } catch ( e ){
          isErrorWithMessage( e ) && showErrorNotification({ content: t( "common.words.errorInFileUpload" ) });
        }
      };
      fileUploadPromises.push( uploadFile());
    });
    await Promise.all( fileUploadPromises ).then(() => {
      setUploadingToS3( false );
    });
  };

  const removeFile = ( fileName: string ) => {

    const filteredPackages = Packages.filter(( packageInfo ) => packageInfo.name !== fileName ) ?? [];
    setValue( "Packages", filteredPackages );
  };

  useEffect(() => {
    if ( libraryDetails && !isDirty ){
      const { Description, Packages: existingPackages } = libraryDetails;
      const formattedPackages = existingPackages?.map(( s3Path: string ) => ({
        name: s3Path.substring( s3Path.lastIndexOf( "/" ) + 1 ), uploadPath: s3Path
      })) ?? [];
      reset({ Description, Packages: formattedPackages });
    }
  }, [ isDirty, libraryDetails, reset ]);

  return fetchingLibraryDetails
    ? <SkeletonBlock variant="sideBars" />
    : <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
      <p className={styles.required}>* {t( "common.words.required" )}</p>
      <fieldset className={styles.fieldsContainer} disabled={updatingLibrary}>
        {/* ************************** Description ************************** */}
        {editMode &&
          <div>
            <Textarea
              floatingLabel={t( "services.agents.libraries.Description" )}
              {...register( "Description", { validate: Validate_MaxChars })}
            />
            {renderError( errors, "Description" )}
          </div>
        }

        {/* ************************** Upload Packages Field ************************** */}

        <div className="space-y-2">
          <label>{t( "services.agents.libraries.uploadPackages" )}</label>
          <Upload uploadedFiles={Packages} removeFile={removeFile} uploading={uploadingToS3} classes="mb-6"
            handleUpload={ fileInfo => handleUpload( fileInfo as File[])} multipleFiles acceptedFileType=".zip" />
          {renderError( errors, "TrainingDataLocation" )}
        </div>

        <div className="flex justify-end mt-4">
          <Button
            variant="stroked"
            classes="btn-auto-width"
            size="sm"
            aria-label={t( "services.agents.libraries.uploadPackages" )}
            disabled={uploadingToS3}
            loading={updatingLibrary}
            type="submit">{editMode ? t( "common.button.update" ) : t( "services.agents.libraries.uploadPackages" )}</Button>
        </div>

      </fieldset>
    </form>;
};

const CommonForm = ({ routePath }: CommonFormProps ): JSX.Element => {
  const [ libraryId, setLibraryId ] = useState<string | null>( null );
  const { resourceId = "" } = useParams<{ resourceId?: string }>();
  const editMode = Boolean( useMatch( `${routePath}/${resourceId}/${routeActions.edit}` ));

  return libraryId || editMode
    ? <UploadPackageForm libraryId={libraryId ?? resourceId} routePath={routePath} editMode={editMode} />
    : <CreateLibraryForm setLibraryId={setLibraryId} />;
};

export default CommonForm;