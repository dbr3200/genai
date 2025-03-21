/* eslint-disable max-len */
import * as React from "react";
import { Button, Card } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../../utils/hooks";

import { useCreateUserMutation } from "../../../services/user";
import { closeSwal, customSwal, showLoading } from "../../../utils/popupUtils";
import { extractMessage } from "../../../utils";
import { loadUserAccount } from "../../../modules/account/actions";
import { logout } from "../../../modules/auth/actions";
import { useState } from "react";
import styles from "./styles.module.scss";
import { useNavigate } from "react-router-dom";

export const UserRegistration = ():JSX.Element => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const { username } = useAppSelector(({ globalConfig, auth }) => ({
    permanentPaths: globalConfig?.permanentPaths,
    username: auth?.username
  }));

  const [ createUser, { isLoading: isUserCreating }] = useCreateUserMutation();

  const navigate = useNavigate();

  const register = () => {
    showLoading( t( "userAgreement.registeringUser" ));
    createUser({}).unwrap().then(( response ) => {
      customSwal.fire({
        title: extractMessage( response ),
        allowOutsideClick: false,
        allowEscapeKey: false,
        icon: "success",
        confirmButtonText: t( "common.button.continue" ),
        showCancelButton: false
      }).then(() => {
        dispatch( loadUserAccount( username, true ));
      });
    }).finally(() => {
      closeSwal();
    });
  };

  const [ agreedToTerms, setAgreedToTerms ] = useState( false );

  return <>
    <div className="w-full h-full p-4 flex items-center justify-center">
      <Card classes="p-4">
        <div className="text-justify">
          <div className="my-4 leading-6">
            <h4 className="text-2xl">Amorphic AI Terms of Use</h4>
            <p className="py-4">By checking the acceptance box or using all or any portion of the software, you are accepting all of the terms and conditions of this agreement as published on
cloudwick&apos;s website at https://cloudwick.com/support-services-and-legal (as may be relocated by cloudwick from time to time). You agree that this agreement is enforceable like any
written agreement signed by you and legally binding between you and cloudwick technologies inc. (cloudwick). If you do not agree to all of these terms and conditions, do not use
the software. If you wish to use the software as an employee, contractor, or agent of a corporation, partnership or similar entity, then you must be authorized to sign for and bind
the entity in order to accept the terms of this agreement and you represent and warrant that you have the right and authority to do so.</p>

            <span className="font-italic font-bold">Note : This page is customizable for your production deployment. Please contact Amorphic support team at amorphic-support@cloudwick.com to customize &apos;Terms of Use&apos;</span>
          </div>
        </div>
        <div className={styles.acceptTermsContainer}>
          <input id="agreeTerms-checkbox" type="checkbox" onChange={() => setAgreedToTerms( !agreedToTerms )} checked={agreedToTerms} />&nbsp;&nbsp;
          <label htmlFor="agreeTerms-checkbox">
            {t( "userAgreement.youCertify" )}</label>
        </div>
        <div className={styles.buttonContainer}>
          <Button
            disabled={isUserCreating}
            classes={styles.declineButton} type="button" onClick={() => dispatch( logout( navigate ))}>{t( "common.button.decline" )}</Button> &nbsp;
          <Button loading={isUserCreating} classes="bg-aquamarine" type="button" onClick={register}
            disabled={!agreedToTerms}>{t( "common.button.agree" )}</Button>
        </div>
      </Card>
    </div>
  </>;
};