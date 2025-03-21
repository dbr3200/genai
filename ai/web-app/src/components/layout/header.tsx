import React from "react";
import clsx from "clsx";
import { ADPIcon, Button, Skeleton } from "@amorphic/amorphic-ui-core";
import { useLocation, Link } from "react-router-dom";

import { usePermanentPaths } from "../utils/hooks/usePermanentPaths";
import styles from "./layout.module.scss";

interface IHeaderProps {
  backBtnPath?: string;
  title?: string | JSX.Element;
  subtitle?: string;
  ctas?: {
    callback?: () => void;
    icon?: JSX.Element;
    label?: string;
    disabled?: boolean;
  }[];
  children?: JSX.Element;
  loading?: boolean;
}

export default function Header({
  backBtnPath,
  title,
  ctas = [],
  children,
  loading = false
}: IHeaderProps ): JSX.Element {
  const { pathname } = useLocation();
  const permanentPaths = usePermanentPaths();
  const serviceObject = Object.values( permanentPaths )?.findLast(( obj ) =>
    pathname.startsWith( obj?.relativePath || "" )
  );
  return (
    <section className={clsx( styles.header, "adp-v2" )}>
      <div className={styles.title}>
        {backBtnPath && <Link to={backBtnPath}><ADPIcon icon="left-arrow" size="xs" /></Link>}
        <h1 className={styles.welcomeText}>
          {title || serviceObject?.name}
        </h1>
      </div>
      {children}
      <div className={styles.ctaContainer}>
        {loading
          ? <>
            <Skeleton classes={styles.skeleton} variant="bar" size="md" />
            <Skeleton classes={styles.skeleton} variant="bar" size="md" />
            <Skeleton classes={styles.skeleton} variant="bar" size="md" />
          </>
          : ctas.map(( cta, index ) => (
            <Button
              key={`${cta.label}_${index}`}
              onClick={cta.callback}
              disabled={cta.disabled}
              icon={cta.icon}
              size="sm"
              classes={styles.cta}
            >
              {cta.label}
            </Button>
          ))}
      </div>
    </section>
  );
}
