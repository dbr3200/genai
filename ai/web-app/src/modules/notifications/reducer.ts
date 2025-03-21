import { createSlice } from "@reduxjs/toolkit";
import { logoutAction } from "../common/actions";
import { TNotificationProps } from "../../types";

const notifications = createSlice({
  name: "notifications",
  initialState: [] as TNotificationProps[],
  reducers: {
    addNotification( state, action ) {
      state.unshift( action.payload );
    },
    removeNotification( state, action ) {
      return state.filter(( el: { id: string; }) => el.id !== action.payload.id );
    },
    removeAllNotifications(){
      return [];
    }
  },
  extraReducers: ( builder ) => {
    builder.addMatcher(
      action => logoutAction.match( action ),
      ( state ) => {
        state = [];
        return state;
      }
    );
  }
});

const { reducer } = notifications;
export const { addNotification, removeNotification, removeAllNotifications } = notifications.actions;
export default reducer;