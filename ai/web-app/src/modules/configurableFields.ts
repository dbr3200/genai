import { createSlice } from "@reduxjs/toolkit";
import { logoutAction } from "./common/actions";

const configurableColumns = createSlice({
  name: "configurableColumns",
  initialState: {},
  reducers: {
    setColumns: ( state: any, action ) => {
      const { key, data } = action.payload;
      state[key] = data;
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

const { reducer } = configurableColumns;
export const { setColumns } = configurableColumns.actions;
export default reducer;