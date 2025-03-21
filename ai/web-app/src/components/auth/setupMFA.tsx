import { ReactElement, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation, Trans } from "react-i18next";
import { useForm } from "react-hook-form";
import {
  Button,
  Modal,
  OtpInput,
  SkeletonBlock
} from "@amorphic/amorphic-ui-core";
import * as React from "react";

import clsx from "clsx";
import { QRCodeSVG } from "qrcode.react";

import { useAppSelector, useAppDispatch } from "../../utils/hooks/storeHooks";
import { setupTOTP, verifyTOTPSetup, authActions } from "../../modules/auth/actions";
import { ComposeValidators, Validate_Required, Validate_MFA_Code } from "../../utils/formValidationUtils";
import appConfig from "../../config.json";
import styles from "./auth.module.scss";
// import { LanguageSelector } from "../customComponents/languageSelector";
import { renderError } from "../../utils/renderUtils";
import { CustomImage, CustomLogo, CustomMessageBody } from "../appCustomization/customConfigComponents";

const SetupMFA = (): ReactElement => {
  const [ showModal, setShowModal ] = useState( false );
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { auth, globalConfig } = useAppSelector( state => state );
  const { totpSetupStatus, totpSetupErrorMsg, verifyTotpSetupStatus,
    verifyTotpSetupErrorMsg, username, secretCode } = auth;
  const { permanentPaths } = globalConfig;
  const qrValue = encodeURI( `otpauth://totp/${appConfig.PROJECT_SHORT_NAME}:${username}?secret=${secretCode}&issuer=${appConfig.PROJECT_SHORT_NAME}` );
  const codeLength = 6;
  const { handleSubmit, register, setValue, formState: { errors } } = useForm();

  const onSubmit = async ( values: any ) => {
    const { code } = values;
    dispatch( verifyTOTPSetup( code ));
  };

  useEffect(() => dispatch( setupTOTP()), [dispatch]);

  return (
    <div className="flex">
      <div className={styles.promotionsSection} role="banner">
        <CustomImage pageName="setupMfaPage" />
        <CustomMessageBody pageName="setupMfaPage" />
      </div>
      <main className={styles.main}>
        <div className={styles.helperSection}>
          <Link to={permanentPaths.login.path} className={clsx( styles.link, "hidden md:block" )}>
            {t( "auth.login.loginBtn" )}
          </Link>
          {/* <LanguageSelector ctaClasses={styles.languageSelector} /> */}
        </div>
        <div className={clsx( styles.formContainer, styles.forgotPwd )}>
          <CustomLogo />
          <form onSubmit={handleSubmit( onSubmit )}>
            <h1 className={styles.pageHeading}>{t( "auth.setupMFA.heading" )}</h1>

            {totpSetupStatus === authActions.TOTP_SETUP_PROCESSING && <div className="mt-8"><SkeletonBlock variant="card" /></div>}
            {totpSetupStatus === authActions.TOTP_SETUP_SUCCESS && (
              <>
                <p className={styles.resetPwdDescription}>
                  <Trans i18nKey="auth.setupMFA.description">
                    You need to enable Multi-Factor Authentication. Please scan the QR code or enter
                    <Button type="button" variant="link" onClick={() => setShowModal( true )}
                      className="font-robotoBold break-all" label={t( "auth.setupMFA.thisCode" )}
                      aria-label={t( "auth.setupMFA.descriptionSROnly" )} /> in your 2FA app.
                    Enter the 6-digit code generated below to finalize MFA setup.
                  </Trans>
                </p>
                <Modal size="md" backdropClickClose escKeyClose showModal={showModal} onHide={() => setShowModal( false )}>
                  <Modal.Body>{secretCode}</Modal.Body>
                </Modal>
                <QRCodeSVG value={qrValue} level="H" size={256}
                  style={{ marginLeft: "auto", marginRight: "auto" }} aria-label={t( "auth.setupMFA.qrCode" )} />
                <div className="min-h-[70px] mt-10 mb-5">
                  <label className="secondary-text">
                    {t( "auth.setupMFA.MFA" )}
                    <OtpInput
                      {...register( "code", {
                        validate: ComposeValidators( Validate_Required( t( "auth.setupMFA.MFA" )), Validate_MFA_Code( codeLength ))
                      })}
                      otpLength={codeLength}
                      onChange={e => setValue( "code", e )}
                      classes="overflow-hidden"
                    />
                    {renderError( errors, "code" )}
                  </label>
                </div>
                <Button
                  type="submit"
                  size="md"
                  classes={styles.resetRequest}
                  loading={verifyTotpSetupStatus === authActions.VERIFY_TOTP_SETUP_PROCESSING}
                >
                  {t( "auth.setupMFA.verify" )}
                </Button>
                {verifyTotpSetupErrorMsg && <div role="alert" className={styles.formSubmitErrorMsg}>{verifyTotpSetupErrorMsg}</div>}
                <p className={styles.helperSectionMobile}>
                  <Link to={permanentPaths.login.path} className={styles.link}>
                    {t( "auth.login.loginBtn" )}
                  </Link>
                </p>
                <p className={styles.copyrightBlock}>
                  © 2017 - {( new Date()).getFullYear()}, <Link to="#" className={styles.link}>
                    {appConfig.PROJECT_NAME}
                  </Link> - V{appConfig.VERSION}
                </p>
              </> )}
            {totpSetupErrorMsg && <div role="alert" className="text-salsa my-4">{totpSetupErrorMsg}</div>}
          </form>
        </div>
      </main>
    </div >
  );
};

export default SetupMFA;
