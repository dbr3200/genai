import React, { useCallback } from "react";
import {
  ADPIcon
} from "@amorphic/amorphic-ui-core";
import { IconType } from "@amorphic/amorphic-ui-core/dist/components/adpIcon";
import { useNavigate } from "react-router-dom";

import styles from "./card.module.scss";

interface CardsProps {
  link: string;
  icon: IconType;
  title: string;
  description: string;
}

export const CustomCard = ({
  link,
  icon,
  title,
  description
}: CardsProps ): JSX.Element => {
  const navigate = useNavigate();
  const handleClick = useCallback(() => {
    navigate( link );
  }, []);
  return (
    <a
      onClick={handleClick}
      className={styles.cardBody}
    >
      <div className={styles.widthBorder}>
        <div className={styles.cardBorder}>
          {icon && <ADPIcon classes={styles.icon} icon={icon} />}
          <h5 className={styles.cardTitle}>
            {title}
          </h5>
        </div>
        <p className={styles.cardDesc}>
          {description}
        </p>
      </div>
    </a>
  );
};
