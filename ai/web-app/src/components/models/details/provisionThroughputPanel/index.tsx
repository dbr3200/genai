import React, { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, TextField } from "@amorphic/amorphic-ui-core";
import { useForm } from "react-hook-form";

import SidePanel from "../../../customComponents/sidePanel";
import { renderError } from "../../../../utils/renderUtils";
import { ConfirmationModal } from "../../../customComponents/confirmationModal";

import { useUpdateProvisionThroughputMutation } from "../../../../services/models";
import { useSuccessNotification } from "../../../../utils/hooks";
import { ComposeValidators, Validate_NumbersWithoutExponent, Validate_OnlyRealNumbers, Validate_Required } from "../../../../utils/formValidationUtils";

interface Props {
  show: boolean;
  closePanel: () => void;
  modelId?: string;
}

const ProvisionThroughputPanel = ({ show, closePanel, modelId }: Props ): JSX.Element => {
  const { t } = useTranslation();
  const [ showConfirmationModal, toggleShowConfirmationModal ] = React.useReducer(( state ) => !state, false );
  const { formState: { errors, isDirty }, handleSubmit, register, getValues, reset } = useForm<{ ModelUnits: string }>();
  const [ updateProvisionThroughput, { isLoading }] = useUpdateProvisionThroughputMutation();
  const [showSuccessNotification] = useSuccessNotification();

  const onSubmit = toggleShowConfirmationModal;

  const handleProvisionThroughput = async () => {
    const values = getValues();
    const requestBody: any = structuredClone( values );
    requestBody.ModelUnits = Number( values.ModelUnits );

    try {
      const { Message } = await updateProvisionThroughput({ id: modelId as string, requestBody }).unwrap();
      showSuccessNotification({ content: Message });
      closePanel();
    // eslint-disable-next-line no-empty
    } catch ( error ) {
    } finally {
      toggleShowConfirmationModal();
    }
  };

  useEffect(() => {
    if ( show ){
      reset();
    }
  }, [ reset, show ]);

  return <>
    <SidePanel
      header={t( "services.models.provisionThroughput" )}
      onClose={closePanel}
      backdropClickClose={false}
      size="xs" show={show}>
      <form className="w-full" onSubmit={handleSubmit( onSubmit )}>
        <fieldset disabled={isLoading} className="py-8 space-y-8">
          <div>
            <TextField
              {...register( "ModelUnits", {
                validate: ComposeValidators( Validate_Required( t( "services.models.modelUnits" )),
                  Validate_OnlyRealNumbers, Validate_NumbersWithoutExponent )
              })}
              floatingLabel={t( "services.models.modelUnits" )}
            />
            {renderError( errors, "ModelUnits" )}
          </div>
          <div className="flex justify-end">
            <Button disabled={!isDirty} type="submit">
              {t( "Provision" )}
            </Button>
          </div>
        </fieldset>
      </form>
    </SidePanel>
    <ConfirmationModal
      confirmButtonText={t( "common.button.confirm" )}
      cancelButtonText={t( "common.button.cancel" )}
      onConfirm={handleProvisionThroughput}
      showModal={showConfirmationModal}
      loading={isLoading}
      closeModal={toggleShowConfirmationModal}
      onCancel={toggleShowConfirmationModal}
    >
      {t( "services.models.modelUnitsMessage" )}
    </ConfirmationModal>
  </>;
};

export default ProvisionThroughputPanel;
