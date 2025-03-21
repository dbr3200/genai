// libraries
import * as React from "react";
import { Button, EmptyState } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";

// methods / hooks / constants / styles
import styles from "./errorPage.module.scss";
import { usePermanentPaths } from "../utils/hooks/usePermanentPaths";
import { Link } from "react-router-dom";

const Page404 = ():JSX.Element => {
  const { t } = useTranslation();
  const { notFound } = usePermanentPaths();
  return (
    <>
      <div className={styles.errorContainer}>
        <EmptyState transparentBG defaultImageVariant="under-construction" display="vertical">
          <EmptyState.Content title={notFound.name} />
          <EmptyState.CTA>
            <Link to="/">
              <Button variant="stroked">
                {t( "common.button.backToHome" )}
              </Button>
            </Link>
          </EmptyState.CTA>
        </EmptyState>
      </div>
    </>
  );
};

export default Page404;