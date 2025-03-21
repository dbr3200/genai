import { useEffect, useState, useMemo } from "react";

export function useOnScreen( ref: any ): boolean {
  const [ isIntersecting, setIntersecting ] = useState<boolean>( false );

  const observer = useMemo(
    () =>
      new IntersectionObserver(([entry]) =>
        setIntersecting( entry.isIntersecting )
      ),
    []
  );

  useEffect(() => {
    try {
      observer.observe( ref.current );
    // eslint-disable-next-line no-empty
    } catch {}

    // Remove the observer as soon as the component is unmounted

    return () => {
      observer.disconnect();
    };
  }, [ ref, observer ]);

  return isIntersecting;
}
