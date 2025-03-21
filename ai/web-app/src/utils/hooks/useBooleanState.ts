import { useReducer } from "react";

/**
 * Type to define the return value of the useBooleanState hook
 * @typedef {boolean} TBooleanHookIndex0 - Boolean state
 * @typedef {() => void} TBooleanHookIndex1 - method to set the state to true
 * @typedef {() => void} TBooleanHookIndex2 - method to set the state to false
 * @typedef {() => void} TBooleanHookIndex3 - method to toggle the state
 * @typedef {[TBooleanHookIndex0, TBooleanHookIndex1, TBooleanHookIndex2, TBooleanHookIndex3]} TBooleanHook
 */
interface IBooleanHook {
  /**
   * Current state of the boolean switch
   */
  state: boolean;
  /**
   * Method to set the state to true
  */
  setTrue: () => void;
  /**
   * Method to set the state to false
   */
  setFalse: () => void;
  /**
   * Method to toggle the state
   */
  toggle: () => void
}

/**
 * Reducer to manage boolean state
 * @param state boolean state
 * @param action action to perform on the state, can be "toggle", "setTrue" or "setFalse"
 * @returns boolean
 */
const reducer = ( state: boolean, action: "toggle" | "setTrue" | "setFalse" ): boolean => {
  switch ( action ) {
  case "toggle":
    return !state;
  case "setTrue":
    return true;
  case "setFalse":
    return false;
  default:
    return state;
  }
};

/**
 * Hook to manage a boolean state.
 * @param initialState a boolean value to set the initial state, defaults to false
 * @returns {...TBooleanHook} current state and utility methods to manipulate state- {@link TBooleanHook}
 */
export const useBooleanState = ( initialState = false ): IBooleanHook => {
  const [ state, dispatch ] = useReducer( reducer, initialState );
  const toggle = () => dispatch( "toggle" );
  const setTrue = () => dispatch( "setTrue" );
  const setFalse = () => dispatch( "setFalse" );
  /** @type {boolean, function, function, function} */
  return {
    state,
    setTrue,
    setFalse,
    toggle
  };
};
