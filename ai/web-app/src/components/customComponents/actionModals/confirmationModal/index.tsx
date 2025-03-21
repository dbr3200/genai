// libraries
import React from "react";
import { Modal, Button } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

import styles from "./confirmationModal.module.scss";

interface Props {
  /**
   * Show the confirmation modal
   */
  showModal: boolean;
  /**
   * Callback to close the confirmation modal.
   */
  closeModal: () => void;
  /**
   * Pass a title for the confirmation modal(Default:- Confirmation)
   */
  title?:string;
  /**
   * Pass any JSX element children to be shown in the confirmation modal.
   */
  children:JSX.Element;
   /**
   * The React Node Label to be shown on the confirm button (Default:- Yes)
   */
  confirmButtonText?:React.ReactNode;
  /**
   * The text to be shown on the cancel button (Default:- No)
   */
  cancelButtonText?:string;
  /**
   * Action to be performed after clicking on the confirmation button.
   */
  onConfirm:any;
   /**
   * Action to be performed after clicking on the cancel button.
   */
  onCancel:any;
   /**
   * To be passed a boolean to indicate if the API call is active after clicking on the confirmation button.
   */
  loading?:boolean;
   /**
   * Additional Styles to be used for the title.
   */
  headerClasses?:string,
   /**
   * Additional Styles to be used for the children of the confirmation modal.
   */
  bodyClasses?:string,
  /**
   * Can be used to control the state of the confirm button.
   */
  disabledConfirmButton?:boolean,
  /**
   * Can be used to add additional actions/buttons to the confirmation modal.
   */
  additionalActions?:React.ReactNode
}

export const ConfirmationModal = ({
  showModal,
  closeModal,
  title,
  confirmButtonText,
  cancelButtonText,
  onConfirm,
  onCancel,
  loading,
  children,
  headerClasses,
  bodyClasses,
  disabledConfirmButton = false,
  additionalActions
}: Props ): JSX.Element => {
  const { t } = useTranslation();
  return (
    <Modal
      size="lg"
      onHide={closeModal}
      backdropClickClose={false}
      showModal={showModal}
      closeButton={false}
      classes={styles.confirmationModal}
    >
      <Modal.Header classes={clsx( "block text-3xl border-b-0 text-center dark:text-platinum", headerClasses )}>
        {title ? title : t( "common.messages.confirmation" ) }
      </Modal.Header>
      <Modal.Body classes={clsx( styles.htmlContainer, bodyClasses, "dark:bg-dark2 dark:text-platinum flex flex-col max-w-2xl" )}>
        <div className="text-center m-4">
          {children}
        </div>
        <div className={styles.buttonContainerStyles}>
          <Button disabled={disabledConfirmButton} classes={styles.confirmButton} onClick={onConfirm} loading={loading}>
            {confirmButtonText ? confirmButtonText : t( "profile.settings.yes" )}
          </Button>
          <Button disabled={loading} classes={clsx( styles.cancelButton )} onClick={onCancel}>
            {cancelButtonText ? cancelButtonText : t( "profile.settings.no" ) }
          </Button>
          {additionalActions ?
            additionalActions : <></>}
        </div>
      </Modal.Body>
    </Modal>
  );
};
