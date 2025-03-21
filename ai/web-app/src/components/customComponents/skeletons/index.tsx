// libraries
import { Skeleton } from "@amorphic/amorphic-ui-core";
import React from "react";

// methods / hooks / constants / styles
import styles from "./styles.module.scss";

export const DetailsCardSkeleton = (): React.ReactElement => {
  return <div className={styles.DetailsCardSkeleton}>
    <div>
      <Skeleton variant="circle" />
      <Skeleton variant="bar" width={50} />
    </div>
    <div>
      <Skeleton variant="bar" width={100} size="xxs" />
      <Skeleton variant="bar" width={25} size="xxs" />
    </div>
    <br/>
    <div>
      <Skeleton variant="bar" width={45} />
      <Skeleton variant="bar" width={45} />
    </div>
    <div>
      <Skeleton variant="bar" width={65} />
    </div>
    <hr/>
    <div>
      <div></div>
      <div className={styles.CTAs}>
        <Skeleton variant="circle" size="xxs" />
        <Skeleton variant="circle" size="xxs" />
        <Skeleton variant="circle" size="xxs" />
      </div>
    </div>
  </div>;
};

