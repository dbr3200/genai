import React from "react";

/**
 * hook to scroll to anchor position for vertical menu hash based navigation
 * @param {number} offset - offset value to be subtracted from the scroll position
 * @param {boolean} [useScrollIntoView=false] - Use ScrollInto View for the element. Use in case scroll to doesn't work for hash sections.
 * @returns {string} current hash value
 */
export const useScrollToAnchor = ( offset?: number, useScrollIntoView = false ): string => {
  const [ hashValue, setHashValue ] = React.useState<string>( "" );

  const updateScrollPosition = () => {
    // if more than one hash is found in path, remove all except the first hash value
    const hash = decodeURIComponent( window.location.hash )?.split( "#" )?.slice( 1 )?.[0];
    if ( hash && hash !== "top" ) {
      const element = document.getElementById( hash );
      if ( element ) {
        useScrollIntoView ? element.scrollIntoView() :
          element.scrollTo({
            top: ( element.offsetTop - ( offset || 80 )),
            behavior: "smooth"
          });
      }
    } else {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
    setHashValue( hash );
  };

  React.useEffect(() => {
    updateScrollPosition();
    window.addEventListener( "hashchange", updateScrollPosition, false );
    return () => {
      window.removeEventListener( "hashchange", updateScrollPosition, false );
    };
  }, []);
  return hashValue;
};