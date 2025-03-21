// methods / hooks / constants / styles
import { DEFAULT_CUSTOM_CONFIG,
  ICustomConfig } from "../../components/appCustomization/customConfig.types";
import { appCustomizationApi } from "../../services/appCustomization";

/**
 * Returns the application custom configuration from the store
 *
 * @returns {...ICustomConfig} App Config - {@link ICustomConfig}
 */
export const useCustomConfig = (): ICustomConfig => {
  const {
    currentData: appConfig
  } = appCustomizationApi.endpoints.getAppCustomizationConfig.useQueryState({ skipNotification: true });
  return appConfig || DEFAULT_CUSTOM_CONFIG;
};