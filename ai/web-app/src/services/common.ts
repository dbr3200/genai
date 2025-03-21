import { baseApi } from "./baseApi";
import { urlBuilder } from "../modules/utils";
import { tagTypes } from "./tagTypes";

const sortResponse = ( data: {[key: string]: string}[], id: string, name?: string ) => data?.sort(( a, b ) => {
  if ( typeof name !== "undefined" ){
    return a?.[name]?.toLowerCase()?.localeCompare( b?.[name]?.toLowerCase());
  } else {
    return a?.[id]?.toLowerCase()?.localeCompare( b?.[id]?.toLowerCase());
  }
});

const transform = ( response: any, searchPath: string, id:string, name?: string ) => {
  const resource = response[searchPath];
  response.count = response["total_count"] || resource?.length || 0;
  response[searchPath] = sortResponse( resource, id, name );

  return response;
};

type QueryArgs = { projectionExpression?: string } | undefined;
const keepUnusedDataFor = 3600;

export const commonApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getCommonDatasets: build.query<any, QueryArgs>({
      query: ( queryArgs ) => urlBuilder( "datasets", { projectionExpression: queryArgs?.projectionExpression, ...queryArgs }),
      keepUnusedDataFor: keepUnusedDataFor,
      transformResponse: ( response:any ) => transform( response, "datasets", "DatasetId", "DatasetName" ),
      providesTags: ( result ) => result ? [{ type: tagTypes.commonDatasets }] : []
    }),
    getCommonUsers: build.query<any, QueryArgs>({
      query: ( queryArgs ) => urlBuilder( "users", { projectionExpression: queryArgs?.projectionExpression, ...queryArgs }),
      keepUnusedDataFor: keepUnusedDataFor,
      transformResponse: ( response:any ) => transform( response, "Users", "UserId", "FullName" ),
      providesTags: ( result ) => result ? [{ type: tagTypes.commonUsers }] : []
    })
  }),
  overrideExisting: true
});

export const {
  useGetCommonUsersQuery,
  useGetCommonDatasetsQuery
} = commonApi;
