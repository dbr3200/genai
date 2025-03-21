// libraries
import { ReactElement, useEffect } from "react";
import * as React from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button, TextField, PasswordField, Divider } from "@amorphic/amorphic-ui-core";

// components
// import { LanguageSelector } from "../customComponents/languageSelector";

// methods / hooks / constants / styles
import { isTruthyValue } from "../../utils";
import { Validate_Required } from "../../utils/formValidationUtils";
import { useAppSelector, useAppDispatch } from "../../utils/hooks/storeHooks";
import { authActions, login, resetAuthProps } from "../../modules/auth/actions";
import appConfig from "../../config.json";
import styles from "./auth.module.scss";
import { renderError } from "../../utils/renderUtils";
import { CustomImage, CustomLogo, CustomMessageBody } from "../appCustomization/customConfigComponents";
import clsx from "clsx";

const Login = (): ReactElement => {
  const [ idpLoginInProgress, setIDPLoginProgress ] = React.useState<boolean>( false );
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { auth, globalConfig } = useAppSelector( state => state );
  const { handleSubmit, register, formState: { errors, isValid } } = useForm();

  const { loginStatus, loginErrorMsg } = auth;
  const { permanentPaths, ENABLE_IDP = "no" } = globalConfig;
  const isIDPLogin = isTruthyValue( ENABLE_IDP );
  const signInProcessing = loginStatus === authActions.LOGIN_PROCESSING;

  React.useEffect(() => {
    let timer: string | number | NodeJS.Timeout | undefined;
    if ( idpLoginInProgress ) {
      timer = setTimeout(() => {
        setIDPLoginProgress( false );
      }, 30000 );
    }
    return () => {
      try {
        clearTimeout( timer as NodeJS.Timeout );
      } catch ( error ) {
        // do nothing
      }
    };
  }, [idpLoginInProgress]);

  const IDPLoginDispatcher = () => {
    setIDPLoginProgress( true );
    const idpUrl = `${
      /^((http[s]?))/.test(( appConfig as any ).APP_WEB_DOMAIN ) ? ( appConfig as any ).APP_WEB_DOMAIN : `https://${( appConfig as any ).APP_WEB_DOMAIN}`
    }/oauth2/authorize?identity_provider=${
      ( appConfig as any ).IDENTITY_PROVIDER
    }&redirect_uri=${
      window.location.origin
    }/callback&response_type=CODE&client_id=${
      appConfig.clientId
    }&scope=${( appConfig as any ).TOKEN_SCOPES_ARRAY?.join( " " )}`;
    window.location.replace( idpUrl );
  };

  const onSubmit = ( values: any ) => dispatch( login( navigate, values.username, values.password ));

  useEffect(() => dispatch( resetAuthProps({ loginStatus: authActions.LOGIN_INITIAL, loginErrorMsg: undefined })), [dispatch]);

  return (
    <div className="flex">
      <div className={styles.promotionsSection} role="banner">
        <CustomImage pageName="loginPage"/>
        <CustomMessageBody pageName="loginPage" />
      </div>
      <main className={styles.main}>
        <div className={styles.helperSection}>
          {/* <div className="hidden md:block">
            { !isIDPLogin && <>
              {t( "auth.login.noAccount" )}
              <Link to={permanentPaths?.register?.path} className={clsx( styles.link, "mx-1" )}>
                {t( "auth.login.register" )}
              </Link>
            </>}
          </div> */}
          {/* <LanguageSelector ctaClasses={styles.languageSelector} /> */}
        </div>
        <div className={styles.formContainer}>
          <CustomLogo />
          {isIDPLogin ? (
            <div className={styles.actionButtonsContainer}>
              <Button
                type="button"
                onClick={IDPLoginDispatcher}
                size="md"
                classes={styles.signInButtonIDP}
                disabled={idpLoginInProgress}
                loading={idpLoginInProgress}
              >
                {t( "auth.login.loginBtn" )}
              </Button>
            </div> ) :
            <>
              < form onSubmit={handleSubmit( onSubmit )}>
                <h1 className={styles.pageHeading}>{t( "auth.login.loginBtn" )}</h1>
                {loginErrorMsg && <div role="alert" className={styles.formSubmitErrorMsg}>{loginErrorMsg}</div>}
                <div className="min-h-[60px]">
                  <TextField
                    {...register( "username", {
                      validate: Validate_Required( t( "auth.login.username" ))
                    })}
                    floatingLabel={t( "auth.login.username" )}
                    disabled={signInProcessing}
                    autoComplete="username"
                    autoFocus={true}
                  />
                  {renderError( errors, "username" )}
                </div>
                <div className={styles.fieldContainer}>
                  <PasswordField
                    {...register( "password", {
                      validate: Validate_Required( t( "auth.login.password" ))
                    })}
                    floatingLabel={t( "auth.login.password" )}
                    disabled={signInProcessing}
                    autoComplete="current-password"/>
                  {renderError( errors, "password" )}
                </div>
                <Link to={permanentPaths?.forgotPassword?.path} className={styles.link}>
                  {t( "auth.login.forgotPwd" )}
                </Link>
                <div className={styles.actionButtonsContainer}>
                  <Button
                    type="submit"
                    size="md"
                    classes={styles.signInButton}
                    disabled={!isValid || signInProcessing}
                    loading={signInProcessing}
                  >
                    {t( "auth.login.loginBtn" )}
                  </Button>
                </div>
                <div>
                  <div className="w-full sm:block">
                    <Divider content="Or" />
                  </div>
                  <div className={clsx( styles.actionButtonsContainer )}>
                    <Button
                      type="button"
                      size="md"
                      classes={styles.signInButton}
                      disabled={signInProcessing}
                      onClick={() => {
                        navigate( permanentPaths?.ssoInitiate?.path );
                      }}
                    >
                      {t( "Login with Amorphic" )}
                    </Button>
                  </div>
                </div>
              </form>
            </>}
          <div className={styles.copyrightBlock}>
            &copy; {appConfig.PROJECT_NAME} - V{appConfig.VERSION}
          </div>
        </div>
      </main>
    </div >
  );
};

export default Login;
