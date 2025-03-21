// libraries
import React from "react";
import { Card, SkeletonBlock } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import styles from "./styles.module.scss";
import { VerticalMenu } from "../VerticalMenu";
import GenericErrorView, { ErrorType } from "../genericErrorView";
import { routeActions } from "../../../constants";

export type ModeType = {
 createMode:boolean;
 editMode?:boolean;
 cloneMode:boolean;
  };

interface GenericErrorViewProps {
    /**
     * Object that contains permissions
     */
    permissions: Record<string, boolean>;
    /**
     * Mode object which has the types of modes.
     */
    mode:ModeType;
    /**
     * Content of the form to be displayed
     */
    formContent:any;
    /**
     * The boolean to check if the API has an error or not.
     */
    isError:boolean;
    /**
     * Current Step on the vertical menu.
     */
    currentStep:string;
     /**
     * Update the vertical menu.
     */
    setCurrentStep:React.Dispatch<string>;
     /**
     * Options for the vertical menu.
     */
    options:any;
     /**
     * On Submit function.
     */
    onSubmit:React.Dispatch<any>;
     /**
     * Routepath of the current field.
     */
    routePath:string;
     /**
     * Current Resource Details Object.
     */
    resourceDetails:any;
     /**
     * Loading in between transitions
     */
    isLoading:boolean;
     /**
     * Error object of the API that is being called.
     */
    error:ErrorType;
     /**
     * To check if the form fields are to be disabled or not.
     */
    isFormDisabled:boolean;
     /**
     * FormUtils for the form to be rendered.
     */
    formUtils:any;
     /**
     * Current Resource ID to be used for redirecting.
     */
    resourceId:string;
     /**
     * Current Resource Name.
     */
    resourceName:string;
     /**
     * Current Resource Type
     */
    resourceType?:string;
    sticky?:boolean;
}

const GenericFormDisplay = ({
  permissions,
  mode,
  formContent,
  currentStep,
  setCurrentStep,
  options,
  onSubmit,
  routePath,
  isError,
  resourceDetails,
  isLoading,
  error,
  isFormDisabled,
  formUtils,
  resourceId,
  resourceName,
  resourceType,
  sticky = true
}: GenericErrorViewProps ) => {
  const { t } = useTranslation();
  const {
    handleSubmit
  } = formUtils;
  const {
    createPermission,
    updatePermission
  } = permissions;
  const isCreatePermitted = createPermission && mode.createMode;
  const isClonePermitted = createPermission && mode.cloneMode && !isError;
  let isEditPermitted = updatePermission && mode.editMode && !isError && resourceDetails?.AccessType === "owner";
  if ( resourceType === "roles" ) {
    isEditPermitted = updatePermission && mode.editMode && !isError;
  }

  return ( isCreatePermitted || isClonePermitted || isEditPermitted ?
    isLoading ? <div className="m-4"> <SkeletonBlock variant="lines" size="4xl" rows={8} /> </div> :
      <div className={styles.genericFormDisplay}>
        <VerticalMenu
          options={options}
          sticky={sticky}
          isDisabled={isFormDisabled}
          classes={resourceType === "jobs" ? styles.widthTwoByTwelve : styles.widthThreeByTwelve}
          onSelect={( opt ) => setCurrentStep( opt?.value )}
          value={options.find(( item:any ) => item.value === currentStep )}
        />
        <Card classes={styles.card}>
          <Card.Body classes="mb-8">
            <form className={resourceType === "datasets" || resourceType === "views" || resourceType === "dashboards"
              ? styles.formStyling : ""} onSubmit={handleSubmit( onSubmit )}>
              {formContent[currentStep]}
            </form>
          </Card.Body>
        </Card>
      </div>
    : mode.cloneMode || mode.editMode || mode.createMode ?
      <div className="m-4"> <GenericErrorView
        error = {error as ErrorType}
        isLoading={isLoading}
        messageValues={{
          action:
              mode.editMode
                ? t( "common.button.update" ).toLocaleLowerCase()
                : mode.cloneMode
                  ? t( "common.button.clone" ).toLocaleLowerCase()
                  : t( "common.button.create" ).toLocaleLowerCase(),
          resourceName: resourceName || t( "common.messages.resource" )
        }}
        routePath= {resourceId ? `${routePath}/${resourceId}/${routeActions.details}` : `${routePath}/${routeActions.list}` }
      />
      </div> : <div className="m-4"><SkeletonBlock variant="lines" size="4xl" rows={8} /></div>

  );
};

export default React.memo( GenericFormDisplay );