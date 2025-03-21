import * as React from "react";
import { Spinner } from "@amorphic/amorphic-ui-core";

import styles from "./styles.module.scss";

export const PageLoadSpinner = (): JSX.Element => {
  return <div className={styles.container}>
    <Spinner variant="pulse" size="lg" />
  </div>;
};