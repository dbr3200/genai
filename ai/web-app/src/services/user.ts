import { baseApi } from "./baseApi";
import { tagTypes } from "./tagTypes";
import { urlBuilder } from "../modules/utils/fetchUtils";
import { loadUserAccount } from "../modules/account/actions";

export const userApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    createUser: build.mutation({
      query: () => ({
        url: urlBuilder( "users" ),
        method: "POST"
      })
    }),
    updateAmorphicIntegration: build.mutation<any, { action:string, requestBody?:any, userId:string }>({
      query: ({ action, requestBody }) => ({
        url: urlBuilder([ "users", "integrate-amorphic" ], { "action": action }),
        method: "POST",
        body: requestBody
      }),
      async onQueryStarted({ userId }, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          dispatch( loadUserAccount( userId, false, true ));
        }
      }
    }),
    getUsers: build.query<any, any>({
      query: () => urlBuilder( "users" ),
      providesTags: result => result ? [{ type: tagTypes.user, id: "LIST" }] : []
    }),
    getUserDetails: build.query<any, any>({
      query: ( userId ) => urlBuilder([ "users", userId ]),
      providesTags: ( result, error, userId ) => [{ type: tagTypes.user, id: userId }]
    }),
    updateUserRole: build.mutation({
      query: ({ userId, requestBody }) => ({
        url: urlBuilder([ "users", userId ]),
        method: "PUT",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { userId }) => result ? [{ type: tagTypes.user, id: userId }, { type: tagTypes.user, id: "LIST" }] : []
    }),
    getUserAlertPreferences: build.query<any, any>({
      query: ({ userId }) => urlBuilder([ "users", userId, "alert-preferences" ]),
      providesTags: ( result, error, userId ) => [{ type: tagTypes.userAlerts, id: userId }]
    }),
    updateUserAlertPreferences: build.mutation({
      query: ({ userId }) => ({
        url: urlBuilder([ "users", userId, "alert-preferences" ]),
        method: "POST"
      }),
      invalidatesTags: ( result, error, { userId }) => result ? [{ type: tagTypes.userAlerts, id: userId }] : []
    }),
    unsubscribeUserAlertsPreferences: build.mutation({
      query: ({ userId }) => ({
        url: urlBuilder([ "users", userId, "alert-preferences" ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result, error, { userId }) => result ? [{ type: tagTypes.userAlerts, id: userId }] : []
    }),
    updateUserPreferences: build.mutation({
      query: ({ userId, requestBody }) => ({
        url: urlBuilder([ "users", userId, "preferences" ]),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result, error, { userId }) => result ? [{ type: tagTypes.userPreferences, id: userId }, { type: tagTypes.user, id: userId },
        { type: tagTypes.domains }] : []
    })
  }),
  overrideExisting: true
});

export const {
  useUpdateUserPreferencesMutation,
  useCreateUserMutation,
  useUpdateUserRoleMutation,
  useGetUserDetailsQuery,
  useGetUsersQuery,
  useGetUserAlertPreferencesQuery,
  useUpdateUserAlertPreferencesMutation,
  useUnsubscribeUserAlertsPreferencesMutation,
  useUpdateAmorphicIntegrationMutation,
  useLazyGetUserDetailsQuery
} = userApi;