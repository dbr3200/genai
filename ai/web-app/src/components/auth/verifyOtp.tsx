import { ReactElement, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { Button, OtpInput } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import * as React from "react";

import { useAppSelector, useAppDispatch } from "../../utils/hooks/storeHooks";
import { verifyRegistration, resendRegistrationCode, verifyTOTPForSignIn, resetAuthProps, authActions } from "../../modules/auth/actions";
import { ComposeValidators, Validate_OTP_Length, Validate_Required } from "../../utils/formValidationUtils";
import appConfig from "../../config.json";
import styles from "./auth.module.scss";
// import { LanguageSelector } from "../customComponents/languageSelector";
import { renderError } from "../../utils/renderUtils";
import { CustomImage, CustomLogo, CustomMessageBody } from "../appCustomization/customConfigComponents";

const VerifyOtp = (): ReactElement => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { handleSubmit, register, reset, setValue, formState: { errors }, watch } = useForm();

  const { auth, globalConfig } = useAppSelector( state => state );
  const {
    destinationUsername, destinationEmail, confirmSignUpErrorMsg, resendSignUpErrorMsg,
    confirmTOTPForSignIn, verifyTotpTokenErrorMsg, confirmSignInStatus, confirmSignUpStatus,
    registrationResendCodeStatus
  } = auth;
  const { permanentPaths } = globalConfig;
  const otpLength = 6;

  const resendCode = useCallback(() => dispatch( resendRegistrationCode( destinationUsername )), [ destinationUsername, dispatch ]);
  const onSubmit = ( values: Record<string, string> ) => {
    const resetForm = () => reset();
    return confirmTOTPForSignIn ? dispatch( verifyTOTPForSignIn( values.otp ))
      : dispatch( verifyRegistration( destinationUsername, values.otp, resetForm ));
  };

  useEffect(() => dispatch( resetAuthProps({
    signUpStatus: authActions.SIGN_UP_INITIAL,
    confirmSignUpStatus: authActions.CONFIRM_SIGN_IN_INITIAL,
    confirmSignUpErrorMsg: "",
    resendSignUpErrorMsg: "",
    verifyTotpTokenErrorMsg: ""
  })), [dispatch]);

  return (
    <div className="flex font-robotoRegular">
      <div className={styles.promotionsSection} role="banner">
        <CustomImage pageName="verifyOtpPage"/>
        <CustomMessageBody pageName="verifyOtpPage" />
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
          {confirmSignUpStatus !==
          authActions.CONFIRM_SIGN_UP_SUCCESS && (
            <>
              <h1 className={styles.pageHeading}>{t( "auth.verify.oneMoreStep" )}</h1>
              { confirmTOTPForSignIn ? (
                <p className="mt-4">{t( "auth.verify.pleaseEnterTOTP" )}</p>
              ) : (
                <p>
                  <Trans i18nKey="auth.verify.weHaveSent" values={{ destinationEmail }}>
              We have sent a code on <span className="text-amorphicBlue font-robotoMedium">{{ destinationEmail }}</span>
              . Please check your inbox and insert the code below to verify your email.
                  </Trans>
                </p>
              )}
              <form onSubmit={handleSubmit( onSubmit )}>
                <div className={styles.fieldContainer}>
                  <OtpInput
                    {...register( "otp", {
                      validate: ComposeValidators( Validate_Required( "OTP" ), Validate_OTP_Length( 6 ))
                    })}
                    onChange={e => setValue( "otp", e )}
                    otpLength={otpLength}
                    classes="overflow-hidden"
                  />
                  {renderError( errors, "otp" )}
                </div>
                <Button
                  type="submit"
                  size="md"
                  classes={styles.continueBtn}
                  disabled={ watch( "otp" )?.length !== otpLength ||
                    ( !confirmTOTPForSignIn && !destinationUsername )}
                  loading={confirmSignInStatus === authActions.CONFIRM_SIGN_IN_PROCESSING || confirmSignUpStatus === authActions.CONFIRM_SIGN_UP_PROCESSING}
                >
                  {t( "auth.verify.continue" )}
                </Button>
                {confirmSignUpErrorMsg && <div role="alert" className={styles.formSubmitErrorMsg}>{confirmSignUpErrorMsg}</div>}
                {verifyTotpTokenErrorMsg && <div role="alert" className={styles.formSubmitErrorMsg}>{verifyTotpTokenErrorMsg}</div>}
                { !confirmTOTPForSignIn && (
                  <p className="pt-4">{t( "auth.verify.didntReceiveCode" )}<Button type="button" variant="link"
                    onClick={resendCode}
                    classes={styles.resendBtn}
                    label={t( "auth.verify.resend" )}
                    disabled={registrationResendCodeStatus === authActions.RESEND_PROCESSING}
                  />
                  </p>
                ) }
                {registrationResendCodeStatus === authActions.RESEND_SUCCESS && <div role="alert" className="font-robotoMedium text-emerald-600 mt-2 ">
                  {t( "auth.verify.newVerificationCodeSent", { destinationEmail })}
                </div>}
                {registrationResendCodeStatus === authActions.RESEND_FAILURE && <div role="alert"
                  className={styles.formSubmitErrorMsg}>{resendSignUpErrorMsg}</div>}
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
              </form>
            </>
          )}
          {confirmSignUpStatus === authActions.CONFIRM_SIGN_UP_SUCCESS && (
            <>
              <h1 className={styles.pageHeading}>{t( "auth.verify.congratulations" )}</h1>
              <div className="my-5">{t( "auth.verify.registrationSuccessMsg" )}</div>
              <Button
                type="button"
                onClick={() => navigate( permanentPaths.login.path )}
                size="md"
                classes={styles.continueBtn}
              >
                {t( "auth.verify.continue" )}
              </Button>
            </>
          )}
        </div>
      </main>
    </div >
  );
};

export default VerifyOtp;
