import { createSlice } from "@reduxjs/toolkit";
import { logoutAction } from "./common/actions";

const dependencies = createSlice({
  name: "dependencies",
  initialState: {},
  reducers: {
    updateDependencies: ( state: any, action ) => {
      state = action.payload;
      return state;
    },
    clearDependencies: ( state: any ) => {
      state = {};
      return state;
    }
  },
  extraReducers: ( builder ) => {
    builder.addMatcher(
      action => logoutAction.match( action ),
      () => {
        return {};
      }
    );
  }
});

const { reducer } = dependencies;
export const { updateDependencies, clearDependencies } = dependencies.actions;
export default reducer;