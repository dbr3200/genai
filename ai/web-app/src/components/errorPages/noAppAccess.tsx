import * as React from "react";
import { ADPIcon, Button, EmptyState } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../utils/hooks";

import styles from "./errorPage.module.scss";
import { logout } from "../../modules/auth/actions";

export const NoAppAccess = ():JSX.Element => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const navigateToHome = () => {
    dispatch( logout( navigate ));
  };

  return <div className={styles.errorContainer}>
    <EmptyState defaultImageVariant="no-auth" display="vertical">
      <EmptyState.Content title={t( "error.noAppAccess.heading" )} classes="min-h-[20vh]">
        {t( "error.noAppAccess.noAccess" )}
      </EmptyState.Content>
      <EmptyState.CTA>
        <Button onClick={navigateToHome} variant="filled"
          classes="bg-danger hover:bg-danger"
          icon={<ADPIcon size="xxs" icon="sign-out" />}
        >{t( "common.button.logout" )}</Button>
      </EmptyState.CTA>
    </EmptyState>
  </div>;
};