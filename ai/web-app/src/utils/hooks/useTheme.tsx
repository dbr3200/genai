import { useEffect } from "react";
import { useAppSelector } from "./storeHooks";

export function useTheme(): void {

  // const { auth: { username } } = useAppSelector( state => state );
  const cachedTheme = localStorage.getItem( "theme" ) ?? "light";
  const {
    darkMode = cachedTheme === "dark"
  } = useAppSelector(({ account }) => ({
    darkMode: account?.Preferences?.darkMode
  }));

  /** Update local storage with the selected theme */
  useEffect(() => {
    localStorage.setItem( "theme", darkMode ? "dark" : "light" );
  }, [darkMode]);

  /** Apply the selected theme */
  useEffect(() => {
    if ( darkMode ){
      document.body.classList.add( "dark" );
      document.body.classList.add( "adp-dark" );
    } else {
      document.body.classList.remove( "dark" );
      document.body.classList.remove( "adp-dark" );
    }
  }, [darkMode]);
}