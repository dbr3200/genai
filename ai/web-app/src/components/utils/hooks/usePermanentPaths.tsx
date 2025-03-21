// methods / hooks / constants / styles
import { getAllRoutes } from "../routes/routeUtils";
import { PermanentPathObject } from "../types";
import pathsConfig from "../routes/permanentPaths.json";

/**
 * Method returns the permanent paths from the store
 * @returns {...PermanentPathObject} Permanent paths - {@link PermanentPathObject}
 */

export const usePermanentPaths = (): PermanentPathObject => {
  const permanentPaths: PermanentPathObject = getAllRoutes( pathsConfig );
  return permanentPaths;
};