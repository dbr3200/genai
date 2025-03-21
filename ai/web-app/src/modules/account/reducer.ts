import { createSlice } from "@reduxjs/toolkit";
import { logoutAction } from "../common/actions";
import { IAccount } from "../types";
import { EUserRoles } from "../../types";

const initialState: IAccount = {
  EmailId: "",
  EmailSubscription: "no",
  AmorphicIntegrationStatus: "disconnected",
  UserId: "",
  UserRole: EUserRoles.Users,
  Name: "",
  Preferences: { darkMode: false }
};

const account = createSlice({
  name: "account",
  initialState,
  reducers: {
    updateAccount( state, action ) {
      Object.assign( state, action.payload );
    },
    toggleDarkMode( state ) {
      if ( !state.Preferences ) {
        state.Preferences = { darkMode: false };
      }
      state.Preferences.darkMode = !state.Preferences.darkMode;
    }
  },
  extraReducers: ( builder ) => {
    builder.addMatcher(
      action => logoutAction.match( action ),
      ( state ) => {
        state = initialState;
        return state;
      }
    );
  }
});

const { reducer } = account;
export const { updateAccount, toggleDarkMode } = account.actions;
export default reducer;