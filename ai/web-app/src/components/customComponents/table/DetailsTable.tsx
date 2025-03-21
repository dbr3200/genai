import React from "react";
import styles from "./styles.module.scss";

type VType = string | JSX.Element;
interface Props {
  componentArray: Array<[LabelName: VType, LabelValue: VType, Condition?: boolean] | []>;
  tdClasses?: [string, string];
}

export const DetailsTable = ({ componentArray, tdClasses }: Props ): JSX.Element => (
  <dl className={styles.details}>
    {componentArray.map(( component, idx ) => {
      return ( component?.length > 1 && component?.[2] !== false ) ? <div className={styles.item} key={idx}>
        <dt className={tdClasses?.[0]}>{component[0]}</dt>
        <dd className={tdClasses?.[1]}>{component[1]}</dd>
      </div> : null;
    })}
  </dl>
);
