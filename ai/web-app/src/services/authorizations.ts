import { baseApi } from "./baseApi";
import { tagTypes } from "./tagTypes";
import { urlBuilder } from "../modules/utils";

export const resourcesApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getAuthorizedUsers: build.query({
      query: ({ serviceName, resourceId }) => urlBuilder([ serviceName, resourceId, "authorizedusers" ]),
      providesTags: ( result, error, { serviceName }) => [{ type: tagTypes.authorizations, id: serviceName }]
    }),
    updateAuthorizedUsers: build.mutation({
      query: ({ serviceName, resourceId, requestBody }) => ({
        url: urlBuilder([ serviceName, resourceId, "grants" ]),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { serviceName }) => result ? [{ type: tagTypes.authorizations, id: serviceName }] : []
    })

  })
});

export const { useGetAuthorizedUsersQuery, useUpdateAuthorizedUsersMutation } = resourcesApi;
