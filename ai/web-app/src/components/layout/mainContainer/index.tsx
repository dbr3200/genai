import * as React from "react";
import clsx from "clsx";
import styles from "./mainContainer.module.scss";

interface IMainContainerProps {
  children: React.ReactNode;
  classes?: string;
  noPadding?: boolean;
}

export default function MainContainer({ children, classes, noPadding }: IMainContainerProps ): JSX.Element {

  return (
    <main className={clsx(
      classes,
      styles.container,
      noPadding && styles.noPadding
    )}>
      {children}
    </main>
  );
}