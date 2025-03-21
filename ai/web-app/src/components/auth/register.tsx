import { ReactElement } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import * as React from "react";

import { useAppSelector, useAppDispatch } from "../../utils/hooks/storeHooks";
import { Button, Tooltip, ADPIcon, TextField, PasswordField } from "@amorphic/amorphic-ui-core";
import { authActions, register } from "../../modules/auth/actions";
import {
  ComposeValidators,
  Validate_Required,
  Validate_UserName_Pattern,
  Validate_FullName,
  Validate_Password,
  Validate_Email,
  ComparePassword
} from "../../utils/formValidationUtils";
import appConfig from "../../config.json";
import styles from "./auth.module.scss";
import { renderError } from "../../utils/renderUtils";
import { CustomImage, CustomLogo, CustomMessageBody } from "../appCustomization/customConfigComponents";
// import { LanguageSelector } from "../customComponents/languageSelector";

const Register = (): ReactElement => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { auth, globalConfig } = useAppSelector( state => state );
  const { signUpStatus, registrationErrorMsg } = auth;
  const { permanentPaths } = globalConfig;
  const signUpProcessing = signUpStatus === authActions.SIGN_UP_PROCESSING;
  const { handleSubmit, formState: { errors, isDirty }, register: registerFormElement, watch } = useForm();

  // const Validate_Domain = ( emailId: string ) => {
  //   const validDomain = Domain.reduce(( valid: boolean, domain: string ) => {
  //     if ( emailId.endsWith( domain )) {
  //       valid = true;
  //     }
  //     return valid;
  //   }, false );

  //   if ( Domain.indexOf( "*" ) < 0 && !validDomain ) {
  //     return t( "validationMessages.validDomains", { domains: Domain.join( ", " ) });
  //   }
  // };

  const onSubmit = ( values: Record<string, string> ) => {
    const { username, password, fullname, email } = values;

    dispatch( register( navigate, username, password, fullname, email ));
  };

  return (
    <div className="flex">
      <div className={styles.promotionsSection} role="banner">
        <CustomImage pageName="registerPage"/>
        <CustomMessageBody pageName="registerPage" />
      </div>
      <main className={styles.main}>
        <div className={styles.helperSection}>
          <div className="hidden md:block">
            {t( "auth.register.alreadyHaveAnAc" )}
            <Link to={permanentPaths.login.path} className={styles.link}>
              {t( "auth.login.loginBtn" )}
            </Link>
          </div>
          {/* <LanguageSelector ctaClasses={styles.languageSelector} /> */}
        </div>
        <div className={styles.formContainer}>
          <CustomLogo />
          <h1 className={styles.pageHeading}>{t( "auth.login.register" )}</h1>
          <form onSubmit={handleSubmit( onSubmit )}>
            <div className={styles.fieldContainer}>
              <TextField
                {...registerFormElement( "email", {
                  validate: ComposeValidators( Validate_Required( t( "auth.register.emailAddr" )), Validate_Email )
                })}
                floatingLabel={t( "auth.register.emailAddr" )}
                autoComplete="email"
                disabled={signUpProcessing}
              />
              {renderError( errors, "email" )}
            </div>
            <div className="min-h-[60px]">
              <TextField
                {...registerFormElement( "username", {
                  validate: ComposeValidators( Validate_Required( t( "auth.login.username" )), Validate_UserName_Pattern )
                })}
                floatingLabel={
                  <>{`${t( "auth.login.username" )}`}&nbsp;
                    <Tooltip trigger={<ADPIcon icon={"info"} size="xxs" />} placement="bottom" size="lg">
                      {t( "auth.register.usernameCriteria" )}</Tooltip>
                  </>}
                disabled={signUpProcessing}
                autoComplete="username"
              />
              {renderError( errors, "username" )}
            </div>
            <div className={styles.fieldContainer}>
              <TextField
                {...registerFormElement( "fullname", {
                  validate: ComposeValidators( Validate_Required( t( "auth.register.fullName" )), Validate_FullName )
                })}
                floatingLabel={t( "auth.register.fullName" )}
                disabled={signUpProcessing}
              />
              {renderError( errors, "fullname" )}
            </div>
            <div className={styles.fieldContainer}>
              <PasswordField
                floatingLabel={
                  <>{`${t( "auth.login.password" )}`}&nbsp;
                    <Tooltip trigger={<ADPIcon icon={"info"} size="xxs" />} placement="bottom" size="lg">
                      {t( "auth.forgotPwd.pwdCriteria" )}</Tooltip></>}
                disabled={signUpProcessing}
                autoComplete="new-password"
                {...registerFormElement( "password", {
                  validate: ComposeValidators( Validate_Required( t( "auth.login.password" )), Validate_Password )
                })}
              />
              {renderError( errors, "password" )}
            </div>
            <div className={styles.fieldContainer}>
              <PasswordField
                floatingLabel={t( "auth.forgotPwd.confirmPwd" )}
                disabled={signUpProcessing}
                autoComplete="new-password"
                hideEyeIcon
                {...registerFormElement( "confirmPassword", {
                  validate: ComposeValidators( Validate_Required( t( "auth.forgotPwd.confirmPwd" )), ComparePassword( watch( "password" )))
                })}
              />
              {renderError( errors, "confirmPassword" )}
            </div>
            <Button
              type="submit"
              size="md"
              disabled={!isDirty}
              classes={styles.registerBtn}
              loading={signUpProcessing}
            >
              {t( "auth.login.register" )}
            </Button>
            {registrationErrorMsg && <div role="alert" className={styles.formSubmitErrorMsg}>{registrationErrorMsg}</div>}
            <p className={styles.helperSectionMobile}>
              {t( "auth.register.alreadyHaveAnAc" )}
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

export default Register;
