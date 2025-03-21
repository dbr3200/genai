import * as React from "react";
import { ADPIcon, Button, EmptyState } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAppSelector } from "../../utils/hooks";

import styles from "./errorPage.module.scss";
import Header from "../layout/header";

export const UnAuthorized = ():JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const permanentPaths = useAppSelector(({ globalConfig }) => globalConfig?.permanentPaths );

  const navigateToHome = () => navigate( permanentPaths?.home?.path );

  return (
    <>
      <div className="md:hidden">
        <Header />
      </div>
      <div className={styles.errorContainer}>
        <EmptyState defaultImageVariant="no-auth">
          <EmptyState.Content title={t( "error.notAuthorized.heading" )} classes="min-h-[20vh]">
            {t( "error.notAuthorized.noAccess" )}
          </EmptyState.Content>
          <EmptyState.CTA>
            <Button onClick={navigateToHome}
              icon={<ADPIcon size="xxs" classes="rtl:rotate-180" icon="back" />}
            >{t( "error.404.backToDashboard" )}</Button>
          </EmptyState.CTA>
        </EmptyState>
      </div>
    </>
  );
};