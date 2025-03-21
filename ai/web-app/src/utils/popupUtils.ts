import React, { ReactElement } from "react";
import Swal, { SweetAlertIcon, SweetAlertPosition, SweetAlertCustomClass } from "sweetalert2";
import withReactContent from "sweetalert2-react-content";

import styles from "./styles.module.scss";

const amorphicSwalClass =
{
  confirmButton: styles.confirmButton,
  cancelButton: styles.cancelButton,
  container: styles.sweetalertContainer,
  popup: styles.popup,
  htmlContainer: styles.htmlContainer,
  title: styles.title
};

export const closeSwal = ():void => {
  Swal.close();
};

export const showLoading = ( message?:string, addBackdrop?:boolean ):void => {
  Swal.fire({
    title: message || "Processing Request...",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    backdrop: addBackdrop ?? true,
    customClass: { ...amorphicSwalClass, title: "text-bolder text-warning dark:text-platinum" }
  });
};

interface showToastProps {
  type?: SweetAlertIcon;
  title: string;
  confirmButtonText?:string,
  cancelButtonText?:string,
  confirmAction?:()=>void,
  position ?:SweetAlertPosition,
  timer?:number
}

export const showToast = ({
  type = "info",
  title = "",
  confirmButtonText = "",
  cancelButtonText = "X",
  confirmAction,
  position = "top-end",
  timer = 8000
}:showToastProps ):void => {
  Swal.fire({
    icon: type,
    title,
    toast: true,
    position,
    timer: timer,
    timerProgressBar: timer > 5000,
    showConfirmButton: confirmButtonText.length > 0,
    confirmButtonText,
    cancelButtonText,
    buttonsStyling: false,
    customClass: amorphicSwalClass
  }).then(( result ) => {
    if ( result.value ){
      if ( typeof confirmAction === "function" ){
        confirmAction();
      }
    } else {
      Swal.close();
    }
  });
};

export const alertAndHide = (
  icon: SweetAlertIcon,
  title: string | HTMLElement,
  message?: string | HTMLElement,
  onCloseCallback?:()=>void,
  hasCancel = false,
  confirmButtonText = "OK",
  allowEscapeKey = true,
  allowOutsideClick = true
): void => {
  const swalWithTailwindClasses = Swal.mixin({
    customClass: amorphicSwalClass,
    buttonsStyling: false
  });
  swalWithTailwindClasses.fire({
    title,
    icon,
    html: `<span>${message ?? ""}</span>`,
    allowEscapeKey,
    allowOutsideClick,
    backdrop: true,
    reverseButtons: true,
    confirmButtonText,
    showCancelButton: hasCancel
  }).finally(() => {
    if ( onCloseCallback && typeof onCloseCallback === "function" ) {
      onCloseCallback();
    }
  });
};

export const accessAlert = ( service:string ):void => {
  Swal.fire({
    title: "Access Denied",
    icon: "warning",
    text: `You do not have enough permissions to perform this action. Please contact your system administrator regarding ${service || "service"} permission(s)`,
    customClass: amorphicSwalClass,
    buttonsStyling: false
  });
};

interface ShowMessageProps {
  title:string;
  text: React.ReactElement;
  customClass?:SweetAlertCustomClass;
  className?:string;
}

export const showMessage = ({
  title = "Message",
  text,
  customClass,
  className
}:ShowMessageProps ):void => {
  const customClassDefault = { ...amorphicSwalClass,
    container: `dark:text-platinum ${className}`,
    content: ""
  };

  customSwal.fire({
    title,
    html: text,
    confirmButtonText: "Close",
    buttonsStyling: false,
    customClass: customClass ? customClass : customClassDefault
  });
};

interface ConfirmationProps {
  title?: string;
  icon?: SweetAlertIcon;
  text?: ReactElement | string;
  showCancelButton?: boolean;
  confirmButtonText?:string;
  cancelButtonText?: string;
  showLoader?: boolean;
  onConfirm?: ()=>void;
  onCancel?: ()=>void;
  onClose?: ()=>void;
}

export const Confirmation = async ({
  title = "Confirmation",
  icon,
  text,
  showCancelButton = true,
  confirmButtonText = "Yes",
  cancelButtonText = "No",
  showLoader = true,
  onConfirm,
  onCancel,
  onClose
}: ConfirmationProps ):Promise<any> => {
  customSwal.fire({
    title,
    html: text,
    icon,
    showCancelButton,
    reverseButtons: true,
    confirmButtonText: `${confirmButtonText?.charAt( 0 )?.toUpperCase()}${confirmButtonText?.slice( 1 )}`,
    cancelButtonText,
    allowOutsideClick: false,
    didClose: () => {
      if ( typeof onClose === "function" ){
        onClose();
      }
    }
  }).then(( result ) => {
    if ( result.value ) {
      if ( typeof onConfirm === "function" ){
        if ( showLoader ){
          showLoading();
        }
        onConfirm();
      }
    } else {
      if ( typeof onCancel === "function" ){
        onCancel();
      }
    }
  });
};

export const customSwal = withReactContent( Swal.mixin({
  customClass: amorphicSwalClass,
  buttonsStyling: false
}));
