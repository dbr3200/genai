// libraries
import dayjs from "dayjs";
import { Auth } from "aws-amplify";
import {
  BaseQueryFn,
  FetchArgs,
  fetchBaseQuery,
  FetchBaseQueryError,
  retry,
  createApi
} from "@reduxjs/toolkit/query/react";

// components
import { RootState } from "..";

// methods / hooks / constants / styles
import jwtDecode, { JwtPayload } from "jwt-decode";
import { updateAuthReducer } from "../modules/auth/actions";
import config from "../config.json";
import { tagTypes } from "./tagTypes";

export const baseUrl = config.API_gateway;

const query = fetchBaseQuery({
  baseUrl,
  prepareHeaders: ( headers, { getState }) => {
    // const { globalConfig: { DefaultRole = "" }, auth: { token }, roleDetails: { RoleId } } = getState() as RootState;
    const { auth = {} } = getState() as RootState;

    if ( auth?.token ) {
      headers.set( "authorization", auth.token );
    }

    return headers;
  },
  timeout: 35000
});

export const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = retry( async ( args, api, extraOptions ) => {

  // Query Fire
  let result = await query( args, api, extraOptions );

  try {
    //code to update the token if the token has been expired
    if ( result.error?.status === 401 || result.error?.status === 403 ) {
      const configuredToken = result.meta?.request.headers.get( "Authorization" ) || "";
      const { exp } = configuredToken && jwtDecode<JwtPayload>( configuredToken ) || {};
      if ( exp && dayjs().isAfter( dayjs.unix( exp ))) {
        try {
          const cognitoUserSession: any = await Auth.currentSession();
          api.dispatch( updateAuthReducer({
            token: cognitoUserSession?.idToken?.jwtToken,
            sessionActive: true,
            validSession: true
          }));
          result = await query( args, api, extraOptions );
        } catch ( error: any ){
        // eslint-disable-next-line no-console
          console.log( error );
          api.dispatch( updateAuthReducer({ validSession: false }));
        }
      }
    }
    return result;
  } catch {
    return result;
  }

}, { maxRetries: 2 });

export const baseApi = createApi({
  baseQuery,
  reducerPath: "gptApi",
  tagTypes: Object.values( tagTypes ),
  keepUnusedDataFor: 10 * 60 * 1000,
  endpoints: () => ({})
});

export const originApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: `${window.location.origin}/customization/` }),
  reducerPath: "originApi",
  endpoints: () => ({})
});

export const unauthApi = createApi({
  baseQuery: fetchBaseQuery({
    baseUrl,
    timeout: 35000
  }),
  reducerPath: "unauthApi",
  endpoints: () => ({})
});