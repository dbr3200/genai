import { createSlice } from "@reduxjs/toolkit";
import { logoutAction } from "./common/actions";

const pagination = createSlice({
  name: "Pagination",
  initialState: {},
  reducers: {
    setPagination: ( state: any, action ) => {
      const { key, data } = action.payload;
      state[key] = { ...state?.[key], ...data };
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

const { reducer } = pagination;
export const { setPagination } = pagination.actions;
export default reducer;