import { TypedUseSelectorHook, useDispatch, useSelector, shallowEqual } from "react-redux";
import type { RootState } from "../../index";
import { AnyAction } from "redux";
import { ThunkAction, ThunkDispatch } from "redux-thunk";

export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  AnyAction
>

export type AppThunkDispatch = ThunkDispatch<
  RootState,
  unknown,
  AnyAction
>

export const useAppDispatch = (): AppThunkDispatch => useDispatch<AppThunkDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = ( selectorFn ) => useSelector( selectorFn, shallowEqual );