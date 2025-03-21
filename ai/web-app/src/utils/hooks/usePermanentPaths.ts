// methods / hooks / constants / styles
import { PermanentPathObject } from "../../types";
import { useAppSelector } from "./storeHooks";

/**
 * Method returns the permanent paths from the store
 * @returns {...PermanentPathObject} Permanent paths - {@link PermanentPathObject}
 */

export const usePermanentPaths = (): PermanentPathObject => {
  const permanentPaths: PermanentPathObject = useAppSelector(
    ({ globalConfig = { permanentPaths: {} } }) => globalConfig?.permanentPaths );
  return permanentPaths;
};