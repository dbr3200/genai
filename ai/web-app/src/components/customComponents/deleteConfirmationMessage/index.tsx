import React from "react";
import { Trans } from "react-i18next";

import styles from "./styles.module.scss";

interface DeleteConfirmationMessageProps {
  resourceType?: string;
  resourceName?: string;
  translationKey?: string;
}

const DeleteConfirmationMessage: React.FC<DeleteConfirmationMessageProps> = ({ resourceType, resourceName, translationKey }) => {

  return <Trans i18nKey={translationKey ?? "common.messages.deleteConfirmation"} values={{ resourceType, resourceName }}
    tOptions={{ interpolation: { escapeValue: false } }}
    components={[<code className={styles.codeStyles} key="translation" />]} />;
};

export default DeleteConfirmationMessage;
