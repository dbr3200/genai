// import { useTranslation } from "react-i18next";
// import { LangKeys } from "../../i18n";

/** Returns a boolean value to indicate if RTL needs to be used depending on the current selected language */
export function useRTL(): boolean {
  // TO DO: uncomment the following line when language support is fully enabled: @susheel 2022-11-17
  // const { i18n: { language } } = useTranslation();
  // const availableRTLLanguage: LangKeys = "ar"; // We can add other languages whenever required.
  // return language === availableRTLLanguage;
  return false;
}