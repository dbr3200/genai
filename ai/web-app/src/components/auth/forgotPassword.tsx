import { ReactElement, useCallback, useEffect } from "react";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Button,
  OtpInput,
  PasswordField,
  TextField
} from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import { useForm } from "react-hook-form";

import { useAppSelector, useAppDispatch } from "../../utils/hooks/storeHooks";
import { forgotPassword, confirmPassword,
  resetAuthProps, forgotPasswordResendCode,
  authActions } from "../../modules/auth/actions";
import { ComposeValidators, Validate_Required,
  Validate_Password, ComparePassword,
  Validate_OTP_Length } from "../../utils/formValidationUtils";
import appConfig from "../../config.json";
import { LabelWithTooltip, renderError } from "../../utils/renderUtils";
import { useSuccessNotification } from "../../utils/hooks";
import { CustomImage, CustomLogo, CustomMessageBody } from "../appCustomization/customConfigComponents";
// import { LanguageSelector } from "../customComponents/languageSelector";

import styles from "./auth.module.scss";

const ForgotPassword = (): ReactElement => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [showSuccessNotification] = useSuccessNotification();
  const { handleSubmit, register, watch, reset, setValue, unregister, formState: { errors } } = useForm();

  const { auth, globalConfig } = useAppSelector( state => state );
  const {
    forgotPwdStatus,
    forgotPwdErrorMsg,
    forgotPwdSubmitStatus,
    forgotPwdSubmitErrorMsg,
    forgotPwdResendCodeStatus,
    forgotPwdResendCodeErrorMsg } = auth;
  const { permanentPaths } = globalConfig;
  const otpLength = 6;

  const onSubmit = ( values: any ) => {
    const resetForm = () => reset({});
    const { username, verificationCode, newPassword } = values;
    forgotPwdStatus === authActions.FORGOT_PWD_SUCCESS ?
      dispatch( confirmPassword( username, verificationCode, newPassword, resetForm )) :
      dispatch( forgotPassword( username ));
  };

  const resendCode = ( username: string ) => {
    dispatch( forgotPasswordResendCode( username ));
  };

  const resetForgotPage = useCallback(() => {
    dispatch( resetAuthProps({
      forgotPwdStatus: authActions.FORGOT_PWD_INITIAL,
      forgotPwdSubmitStatus: authActions.FORGOT_PWD_SUBMIT_INITIAL,
      forgotPwdSubmitErrorMsg: undefined
    }));
  }, [dispatch]);

  useEffect(() => dispatch( resetAuthProps({
    forgotPwdStatus: authActions.FORGOT_PWD_INITIAL,
    forgotPwdSubmitStatus: authActions.FORGOT_PWD_SUBMIT_INITIAL,
    forgotPwdSubmitErrorMsg: undefined,
    forgotPwdErrorMsg: undefined
  })), [dispatch]);

  useEffect(() => {
    if ( forgotPwdStatus === authActions.FORGOT_PWD_INITIAL ) {
      unregister( "verificationCode" );
    }
  }
  , [ forgotPwdStatus, unregister ]);

  useEffect(() => {
    if ( forgotPwdResendCodeStatus === authActions.FORGOT_PWD_RESEND_CODE_SUCCESS ) {
      showSuccessNotification({
        content: t( "auth.forgotPwd.verificationCodeSent" )
      });
    }
  }
  , [ forgotPwdResendCodeStatus, showSuccessNotification, t ]);

  return (
    <div className="flex">
      <div className={styles.promotionsSection} role="banner">
        <CustomImage pageName="forgotPwdPage"/>
        <CustomMessageBody pageName="forgotPwdPage" />
      </div>
      <main className={styles.main}>
        <div className={styles.helperSection}>
          <div className="hidden md:block">
            {t( "auth.forgotPwd.rememberYourPwd" )}
            <Link to={permanentPaths.login.path} className={styles.link}>
              {t( "auth.login.loginBtn" )}
            </Link>
          </div>
          {/* <LanguageSelector ctaClasses={styles.languageSelector} /> */}
        </div>
        <div className={clsx( styles.formContainer, styles.forgotPwd )}>
          <CustomLogo />
          <form onSubmit={handleSubmit( onSubmit )}>
            {forgotPwdStatus === authActions.FORGOT_PWD_SUCCESS ?
              <>
                <h1 className={styles.pageHeading}>{t( "auth.forgotPwd.resetPwd" )}</h1>

                {forgotPwdSubmitStatus !== authActions.FORGOT_PWD_SUBMIT_SUCCESS && ( <>
                  <div className="mt-2 mb-10 flex justify-start items-center space-x-2">
                    <p className="pr-2">{t( "auth.forgotPwd.click" )}{"  "}</p>
                    <Button type="button" variant="link" classes={styles.reEnterUsername}
                      onClick={resetForgotPage} >
                      {t( "auth.forgotPwd.here" )}
                    </Button>
                    <p>{" "}{t( "auth.forgotPwd.reenterUsername" )}</p>
                  </div>
                  <div className="min-h-[75px]">
                    <label className="my-11">
                      <LabelWithTooltip tooltip={t( "auth.forgotPwd.verificationCodeMsg" )} label={t( "auth.forgotPwd.verificationCode" )} />
                      <OtpInput otpLength={otpLength} {...register( "verificationCode", {
                        validate: ComposeValidators( Validate_Required( t( "auth.forgotPwd.verificationCode" )), Validate_OTP_Length( 6 ))
                      })} classes="overflow-hidden" onChange={( e ) => setValue( "verificationCode", e )} />
                    </label>
                    {renderError( errors, "verificationCode" )}
                  </div>
                  <div className={styles.fieldContainer}>
                    <PasswordField
                      {...register( "newPassword", {
                        validate: ComposeValidators( Validate_Required( t( "auth.forgotPwd.newPwd" )), Validate_Password )
                      })}
                      autoComplete="new-password"
                      floatingLabel={
                        <LabelWithTooltip label={t( "auth.forgotPwd.newPwd" )} tooltip={t( "auth.forgotPwd.pwdCriteria" )} size="sm" />} />
                    {renderError( errors, "newPassword" )}
                  </div>
                  <div className={styles.fieldContainer}>
                    <PasswordField
                      {...register( "confirmPassword", {
                        validate: ComposeValidators( Validate_Required( t( "auth.forgotPwd.confirmPwd" )), ComparePassword( watch( "newPassword" )))
                      })}
                      hideEyeIcon
                      autoComplete="new-password"
                      floatingLabel={t( "auth.forgotPwd.confirmPwd" )} />
                    {renderError( errors, "confirmPassword" )}
                  </div>
                  <Button
                    type="submit"
                    size="md"
                    classes={styles.resetRequest}
                    loading={forgotPwdSubmitStatus === authActions.FORGOT_PWD_SUBMIT_PROCESSING}
                  >
                    {t( "auth.forgotPwd.submit" )}
                  </Button>
                  <div className="flex space-x-1">
                    <p className="my-3 mx-4">{t( "auth.verify.didntReceiveCode" )}
                    </p>
                    <Button type="button" variant="link"
                      onClick={() => resendCode( watch( "username" ))}
                      classes={styles.resendBtn}
                      label={t( "auth.verify.resend" )}
                      disabled={ forgotPwdResendCodeStatus === authActions.FORGOT_PWD_RESEND_CODE_PROCESSING }
                    />
                  </div>
                </> )}
                {forgotPwdSubmitStatus === authActions.FORGOT_PWD_SUBMIT_SUCCESS && (
                  <>
                    <div className="my-5" role="alert">{t( "auth.forgotPwd.pwdChangeSuccessMsg" )}</div>
                    <Button
                      type="submit"
                      onClick={() => navigate( permanentPaths.login.path )}
                      size="md"
                      classes={styles.continueBtn}
                    >
                      {t( "auth.verify.continue" )}
                    </Button>
                  </>
                )}
                {forgotPwdResendCodeErrorMsg && <div role="alert" className={styles.formSubmitErrorMsg}>{forgotPwdResendCodeErrorMsg}</div>}
                {forgotPwdSubmitErrorMsg && <div role="alert" className={styles.formSubmitErrorMsg}>{forgotPwdSubmitErrorMsg}</div>}
              </>
              : <>
                <h1 className={styles.pageHeading}>{t( "auth.forgotPwd.heading" )}</h1>
                <p className="mt-2 mb-10">{t( "auth.forgotPwd.enterUsername" )}</p>
                <div className={styles.fieldContainer}>
                  <TextField disabled={forgotPwdStatus === authActions.FORGOT_PWD_PROCESSING}
                    autoComplete="username" floatingLabel={t( "auth.login.username" )}
                    {...register( "username" )}
                  />
                  {renderError( errors, "username" )}
                </div>
                <Button
                  type="submit"
                  size="md"
                  classes={styles.resetRequest}
                  disabled={ forgotPwdStatus === authActions.FORGOT_PWD_PROCESSING || watch( "username" ) === ""}
                  loading={forgotPwdStatus === authActions.FORGOT_PWD_PROCESSING}
                >
                  {t( "auth.forgotPwd.requestReset" )}
                </Button>
                {forgotPwdErrorMsg && <div role="alert" className={styles.formSubmitErrorMsg}>{forgotPwdErrorMsg}</div>}
              </>}
            <p className={styles.helperSectionMobile}>
              {t( "auth.forgotPwd.rememberYourPwd" )}
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
        </div>
      </main>
    </div >
  );
};

export default ForgotPassword;
