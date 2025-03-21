import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import enTranslations from "./assets/locales/en.json";
// import arTranslations from "./assets/locales/ar.json";

// export type LangKeys = "en-US" | "ar";

export const lngs = {
  "en-US": { nativeName: "English" }
} as const;

export type LangKeys = keyof typeof lngs;
// TO DO: update useRTL() hook as well when ar is added to supported langs list
// ar: { nativeName: "عربى" }

i18n
  // detect user language
  // learn more: https://github.com/i18next/i18next-browser-languageDetector
  .use( LanguageDetector )
  // pass the i18n instance to react-i18next.
  .use( initReactI18next )
  // init i18next
  // for all options read: https://www.i18next.com/overview/configuration-options
  .init({
    ns: ["translation"],
    defaultNS: "translation",
    fallbackNS: "translation",
    debug: false,
    fallbackLng: "en-US",
    resources: {
      "en-US": {
        translation: enTranslations.translations
      }
    }
  });

i18n.loadNamespaces( "static" );

export default i18n;