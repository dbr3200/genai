import React from "react";
import { ADPIcon, Panel } from "@amorphic/amorphic-ui-core";
import PerfectScrollbar from "react-perfect-scrollbar";
import styles from "./sidePanel.module.scss";
import { useTranslation } from "react-i18next";

interface IAmorphicPanel extends React.ComponentProps<typeof Panel> {
    header: React.ReactNode;
    onClose: () => void;
}
export const SidePanel = ( props: IAmorphicPanel ): JSX.Element => {
  const { t } = useTranslation();
  return <Panel {...props}>
    <div className={styles.amorphicPanel}>
      <div className={styles.header}>
        <div className={styles.title}>{props.header}</div>
        <button type="button" onClick={props.onClose} aria-label={t( "profile.settings.closePanel" )}>
          <ADPIcon icon="times-circle" size="xs" />
        </button>
      </div>
      <PerfectScrollbar component={"div"} className={styles.body}>
        {props.children}
      </PerfectScrollbar>
    </div>
  </Panel>;
};

export default SidePanel;