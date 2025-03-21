import { ICustomConfig } from "../components/appCustomization/customConfig.types";
import { originApi } from "./baseApi";
import { ICustomMiddlewareArguments } from "./types";

export const appCustomizationApi = originApi.injectEndpoints({
  endpoints: ( build ) => ({
    getAppCustomizationConfig: build.query<ICustomConfig, ICustomMiddlewareArguments>({
      query: () => ({
        url: "customConfig.json"
      }),
      keepUnusedDataFor: 3600
    })
  }),
  overrideExisting: true
});

export const { useGetAppCustomizationConfigQuery } = appCustomizationApi;
