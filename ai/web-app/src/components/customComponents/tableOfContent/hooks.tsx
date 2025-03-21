import { useEffect, useState, useRef } from "react";

export function useHeadsObserver():Record<string, string> {

  //Active Id's the current ID that is being set when the scroll passes over the observable section.
  const [ activeId, setActiveId ] = useState( "" );
  const observer = useRef<IntersectionObserver | null>();

  useEffect(() => {

    /**
     * Checks if there are any elements that are present in the observable section of the observer
     * and sets the active id of that element (Which is represented by the highlighted section in the section menu)
     */
    const handleObsever = ( entries:IntersectionObserverEntry[]) => {
      entries.forEach(( entry ) => {
        if ( entry?.isIntersecting ) {
          setActiveId( entry.target.id );
        }
      });
    };

    /**
     * This sets the corresponding square(depends upon rootmargin) to be observable i.e
     * something like a viewBox on the screen where when the element goes thorugh it, the activeId is updated
     */

    if ( observer ) {
      observer.current = new IntersectionObserver( handleObsever, {
        rootMargin: "2% 0% -65% 0px" }
      );

    }

    //Defaults the first section to be active.
    const menu = document.querySelector( "#menu" );
    const elements = menu?.querySelectorAll( "section" );
    setActiveId( elements?.[0]?.id );
    elements?.forEach(( elem ) => observer?.current?.observe( elem ));
    //Clears the observer after its used.
    return () => observer?.current?.disconnect();

  }, []);

  return { activeId };
}