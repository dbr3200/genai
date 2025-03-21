import { Dispatch } from "redux";
import { updateAccount } from "./reducer";
import { AppThunk } from "../../utils/hooks/storeHooks";
import { extractError } from "../utils";
import { baseUrl } from "../../services/baseApi";
import { addNotification, removeNotification } from "../notifications/reducer";
import { nanoid } from "nanoid";
import i18n from "../../i18n";

export enum accountActions {
  FETCHING_USER = "FETCHING_USER",
  FETCHING_USER_SUCCESS = "FETCHING_USER_SUCCESS",
  FETCHING_USER_FAILURE = "FETCHING_USER_FAILURE",
  FETCHING_USER_ROLE = "FETCHING_USER_ROLES",
  FETCHING_USER_ROLE_SUCCESS = "FETCHING_USER_ROLES_SUCCESS",
  FETCHING_USER_ROLE_FAILURE = "FETCHING_USER_ROLES_FAILURE",
}

const getURL = ( params: string[]): string => {
  // add a trailing slash if not present for the base url
  const sanitizedBaseUrl = baseUrl.endsWith( "/" ) ? baseUrl : `${baseUrl}/`;
  // append the params to the base url
  return `${sanitizedBaseUrl}${params.join( "/" )}`;
};

/**
 * Action to fetch the user account details
 * @param username Username of the user to fetch
 * @param initialLoad (optional / default=false) property to indicate if this is the initial load of the user account, it triggers default role fetching if true
 * @param silent (optional / default=false) property to indicate if the user account should be fetched silently,
 * it will not show any notification or role fetching
 * @param retryCount (optional) property to indicate the number of retries to fetch the user account
 */

export const loadUserAccount = ( username: string, initialLoad = false, silent = false, retryCount = 0 ): AppThunk => {
  return ( dispatch: Dispatch<any>, state ): Promise<any> => {
    const notificationId = nanoid();
    dispatch( updateAccount({ fetchingUser: !silent, silentFetchUser: silent, fetchingUserError: undefined }));
    if ( !silent ){
      dispatch( addNotification({
        title: i18n.t( "common.messages.fetchingAccDetails" ),
        variant: "info",
        autoHideDelay: 30000,
        id: notificationId
      }));
    }
    return fetch( getURL([ "users", username ]), {
      method: "GET",
      headers: {
        "Authorization": state().auth.token
      }
    }).then( response => {
      if ( response.status === 200 ) {
        return response.json();
      }
      throw new Error( "Error fetching user data" );
    }).then( response => {
      const userAccount = response ?? {};
      dispatch( updateAccount({
        AmorphicIntegrationStatus: "disconnected",
        UserRole: "Users",
        ...userAccount,
        fetchingUser: false,
        silentFetchUser: false
      }));
    }).catch( error => {
      dispatch( updateAccount({ fetchingUserError: extractError( error ) }));
      if ( retryCount < 2 ) {
        dispatch( loadUserAccount( username, initialLoad, silent, retryCount + 1 ));
      }
    }).finally(() => {
      // if ( initialLoad ){}
      // dispatch( updateUserMFAStatus( username, cognitoMfaStatus ));
      dispatch( updateAccount({ fetchingUser: false, silentFetchUser: false }));
      if ( !silent ){
        dispatch( removeNotification({ id: notificationId }));
      }
    });
  };
};

/**
 * Action to update user MFA status based on initial login
 */
export const updateUserMFAStatus = ( username: string, status = "disabled" ): AppThunk => {
  return ( dispatch: Dispatch<any>, state ): Promise<any> => {
    const accountMFAStatus = state().account?.MfaStatus;
    // eslint-disable-next-line no-console
    console.table( state().account );
    if ( accountMFAStatus === status ){
      return new Promise( resolve => resolve( 1 ));
    } else {
      dispatch( updateAccount({ updatingMFA: true }));
      return fetch( getURL([ "users", username, `preferences?operation=set-mfa&mfaStatus=${status}` ]), {
        method: "PUT",
        headers: {
          "Authorization": state().auth.token,
          "role_id": state().account?.RoleId || state().account?.DefaultRole
        } }).finally(() => {
        dispatch( updateAccount({ updatingMFA: false }));
      });
    }
  };
};

export const updateAccountReducer = ( data: Record<string, any> ):AppThunk => ( dispatch ) => {
  dispatch( updateAccount( data ));
};