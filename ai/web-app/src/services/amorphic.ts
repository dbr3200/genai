import { baseApi } from "./baseApi";
import { tagTypes } from "./tagTypes";
import { urlBuilder } from "../modules/utils/fetchUtils";

export const amorphicApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getAmorphicDatasets: build.query({
      query: () => urlBuilder([ "amorphic", "datasets" ]),
      providesTags: ( result ) => result ? [{ type: tagTypes.datasets }] : []
    }),
    getAmorphicTenants: build.query({
      query: () => urlBuilder([ "amorphic", "tenants" ]),
      providesTags: ( result ) => result ? [{ type: tagTypes.tenants }] : []
    }),
    getAmorphicDomains: build.query({
      query: () => urlBuilder([ "amorphic", "domains" ]),
      providesTags: ( result ) => result ? [{ type: tagTypes.domains }] : []
    }),
    getAmorphicRoles: build.query({
      query: () => urlBuilder([ "amorphic", "roles" ]),
      providesTags: ( result ) => result ? [{ type: tagTypes.roles }] : []
    })
  }),
  overrideExisting: true
});

export const {
  useGetAmorphicDatasetsQuery,
  useGetAmorphicDomainsQuery,
  useLazyGetAmorphicDomainsQuery,
  useGetAmorphicRolesQuery,
  useLazyGetAmorphicRolesQuery,
  useGetAmorphicTenantsQuery,
  useLazyGetAmorphicTenantsQuery
} = amorphicApi;