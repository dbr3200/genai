import React, { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { useCustomConfig, useAppSelector } from "../../utils/hooks";

import logoFull from "../../assets/images/AAI_Logo.svg";
import loginCoverImage from "../../assets/images/amorphic-cover-1.webp";

import config from "../../config.json";
import styles from "../auth/auth.module.scss";
import { TUnAuthenticatedPages } from "./customConfig.types";

/**
 * Mapping of unauthenticated pages to their respective cover images
 */
const defaultBackgroundImagesMapping: Record<TUnAuthenticatedPages, string> = {
  "loginPage": loginCoverImage,
  "registerPage": loginCoverImage,
  "forgotPwdPage": loginCoverImage,
  "forcePwdResetPage": loginCoverImage,
  "setupMfaPage": loginCoverImage,
  "verifyOtpPage": loginCoverImage
};

interface IAppCustomConfigComponentProps {
  /**
   * Valid unauthenticated page name
   * valid values {@link TUnAuthenticatedPages}
   */
  pageName: TUnAuthenticatedPages
}

export const CustomImage = ({
  pageName
}: IAppCustomConfigComponentProps ) : ReactElement => {
  const appConfig = useCustomConfig();
  return <img
    className={styles.image}
    src={appConfig?.[pageName]?.backgroundCover || defaultBackgroundImagesMapping?.[pageName]}
    alt="cover image"
  />;
};

export const CustomMessageBody = ({
  pageName
}: IAppCustomConfigComponentProps ) : ReactElement => {
  const { t, i18n: { language } } = useTranslation();
  const appConfig = useCustomConfig();
  return <div className={styles.coverTextBlock}>
    <div className={styles.heading}>{appConfig?.[pageName]?.heading?.[language] || t( `${pageName}.heading` )}</div>
    <div className={styles.subHeading}>{appConfig?.[pageName]?.subHeading?.[language] || t( `${pageName}.subHeading` )}</div>
    <div>
    &copy; {appConfig?.PROJECT_NAME || config.PROJECT_NAME} - V{config.VERSION}
    </div>
  </div>;
};

export const CustomLogo = () : ReactElement => {
  const appConfig = useCustomConfig();
  const { PROJECT_NAME = "Amorphic AI" } = useAppSelector(({ globalConfig }) => globalConfig );
  return <Link to="/">
    <img
      className="h-10"
      src={appConfig?.LOGO_PATH || logoFull}
      alt={appConfig?.PROJECT_NAME || PROJECT_NAME }
    />
  </Link>;
};