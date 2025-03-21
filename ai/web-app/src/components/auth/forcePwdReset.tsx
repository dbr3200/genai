import { ReactElement } from "react";
import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";

import {
  PasswordField,
  Tooltip,
  ADPIcon,
  Button
} from "@amorphic/amorphic-ui-core";
import clsx from "clsx";

import { useAppSelector, useAppDispatch } from "../../utils/hooks/storeHooks";
import { forcePasswordReset, authActions } from "../../modules/auth/actions";
import {
  ComposeValidators,
  Validate_Required,
  Validate_Password,
  ComparePassword
} from "../../utils/formValidationUtils";
import appConfig from "../../config.json";
import { renderError } from "../../utils/renderUtils";
import styles from "./auth.module.scss";
import { CustomImage, CustomLogo, CustomMessageBody } from "../appCustomization/customConfigComponents";

const ForcePwdReset = (): ReactElement => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { auth, globalConfig } = useAppSelector(( state ) => state );
  const { forcePwdResetStatus, forcePwdResetErrorMsg } = auth;
  const { permanentPaths } = globalConfig;
  const navigate = useNavigate();

  const onSubmit = async ( values: any ) => {
    const { newPassword } = values;
    dispatch( forcePasswordReset( newPassword, auth ));
  };

  const { handleSubmit, register, watch, formState: { errors, isDirty } } = useForm();

  return (
    <div className="flex">
      <div className={styles.promotionsSection} role="banner">
        <CustomImage pageName="forcePwdResetPage"/>
        <CustomMessageBody pageName="forcePwdResetPage" />
      </div>
      <main className={styles.main}>
        <div className={styles.helperSection}>
          <Link
            to={permanentPaths.login.path}
            className={clsx( styles.link, "hidden md:block" )}
          >
            {t( "auth.login.loginBtn" )}
          </Link>
          {/* <LanguageSelector ctaClasses={styles.languageSelector} /> */}
        </div>
        <div className={clsx( styles.formContainer, styles.forgotPwd )}>
          <CustomLogo />
          <form onSubmit={handleSubmit( onSubmit )}>
            <h1 className={styles.pageHeading}>
              {t( "auth.forgotPwd.resetPwd" )}
            </h1>
            <p className={styles.resetPwdDescription}>
              {t( "auth.forcePwdReset.heading" )}
            </p>
            {forcePwdResetStatus !==
                    authActions.FORCE_PWD_RESET_SUCCESS && (
              <>
                <div className={styles.fieldContainer}>
                  <PasswordField {...register( "newPassword", {
                    validate: ComposeValidators(
                      Validate_Required( t( "auth.forgotPwd.newPwd" )),
                      Validate_Password
                    ) })}
                  autoComplete="new-password"
                  floatingLabel={
                    <>
                      {`${t( "auth.forgotPwd.newPwd" )} `}
                      <Tooltip
                        trigger={<ADPIcon icon={"info"} size="xxs" />}
                        placement="bottom"
                        size="lg"
                      >
                        {t( "auth.forgotPwd.pwdCriteria" )}
                      </Tooltip>
                    </>
                  }
                  />
                  {renderError( errors, "newPassword" )}
                </div>
                <div className={styles.fieldContainer}>

                  <PasswordField {...register( "confirmPassword", {
                    validate: ComposeValidators(
                      Validate_Required( t( "auth.forgotPwd.confirmPwd" )),
                      ComparePassword( watch( "newPassword" ))
                    ) })}
                  autoComplete="new-password"
                  floatingLabel={t( "auth.forgotPwd.confirmPwd" )}
                  hideEyeIcon
                  />
                  {renderError( errors, "confirmPassword" )}
                </div>
                <Button
                  type="submit"
                  size="md"
                  classes={styles.resetRequest}
                  disabled={!isDirty}
                  loading={
                    forcePwdResetStatus ===
                          authActions.FORCE_PWD_RESET_PROCESSING
                  }
                >
                  {t( "auth.forgotPwd.submit" )}
                </Button>
              </>
            )}
            {forcePwdResetErrorMsg && (
              <div role="alert" className={styles.formSubmitErrorMsg}>
                {forcePwdResetErrorMsg}
              </div>
            )}
            {forcePwdResetStatus ===
                    authActions.FORCE_PWD_RESET_SUCCESS && (
              <>
                <div className="my-5" role="alert">
                  {t( "auth.forgotPwd.pwdChangeSuccessMsg" )}
                </div>
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
            <p className={styles.helperSectionMobile}>
              <Link
                to={permanentPaths.login.path}
                className={styles.link}
              >
                {t( "auth.login.loginBtn" )}
              </Link>
            </p>
            <p className={styles.copyrightBlock}>
                    © 2017 - {new Date().getFullYear()},{" "}
              <Link to="#" className={styles.link}>
                {appConfig.PROJECT_NAME}
              </Link>{" "}
                    - V{appConfig.VERSION}
            </p>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ForcePwdReset;
