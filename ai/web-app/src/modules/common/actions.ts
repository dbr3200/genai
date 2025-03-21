import { createAction } from "@reduxjs/toolkit";

import { AppThunk } from "../../utils/hooks/storeHooks";

export const logoutAction = createAction<number | undefined>( "common/LOG_OUT" );

export type CommonResource = {
  permission?: string,
  permPathKey?: string,
  endpoint: any,
  searchPath?: string,
  responseMapping: string,
  fields: string[]
};
export type CommonResourcesMapping = {[key: string]: CommonResource};

export const commonResourcesMapping: CommonResourcesMapping = {
};

export const userResources = (): AppThunk => ( dispatch ) => {
  const promises = Object.keys( commonResourcesMapping ).map(( key ) => {
    const { permPathKey = "", fields, endpoint } = commonResourcesMapping[key];
    if ( permPathKey ) {
      const queryParam = { projectionExpression: fields.join( "," ), skipNotification: true };
      return dispatch( endpoint?.initiate( queryParam, { forceRefetch: false })).unwrap();
    }
  });

  return Promise.all( promises );
};
