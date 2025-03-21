import { baseApi } from "../baseApi";
import { tagTypes } from "../tagTypes";
import { urlBuilder } from "../../modules/utils/fetchUtils";

export interface Library {
  LibraryName: string;
  Description?: string;
}
interface CreateLibraryResponse {
  LibraryId: string;
  Message: string;
}

export interface LibraryDetails {
  LibraryName: string;
  Description: string;
  LibraryId: string;
  Packages: string[]; //list of s3 paths
  LastModifiedTime: string;
  LastModifiedBy: string;
  CreationTime: string;
  CreatedBy: string;
}

interface ListLibrariesResponse {
  Libraries: [
  {
    LibraryName: string;
    Description: string;
    LibraryId: string;
    Packages: string[];
    LastModifiedTime: string;
    LastModifiedBy: string;
    CreationTime: string;
    CreatedBy: string;
  }];
  next_available: "yes" | "no";
  count: number;
  total_count: number;
}

export const librariesApi = baseApi.injectEndpoints({
  endpoints: ( build ) => ({
    getLibraries: build.query<ListLibrariesResponse, any>({
      query: ( args ) => urlBuilder([ "agents", "libraries" ], args ),
      providesTags: ( result ) => result ? [{ type: tagTypes.libraries, id: "LIST" }] : []
    }),
    createLibrary: build.mutation<CreateLibraryResponse, Library>({
      query: ( requestBody ) => ({
        url: urlBuilder([ "agents", "libraries" ]),
        method: "POST",
        body: requestBody
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.libraries, id: "LIST" }] : []
    }),
    getLibraryDetails: build.query<LibraryDetails, string>({
      query: ( id: string ) => urlBuilder([ "agents", "libraries", id ]),
      providesTags: ( result, error, id ) => result ? [{ type: tagTypes.libraries, id }] : []
    }),
    getPresignedURLForPackageDownload: build.query<{ Message: string, PresignedURL: string }, { id:string, s3path: string }>({
      query: ({ id, s3path }) => urlBuilder([ "agents", "libraries", id ], { action: "download_package", s3path })
    }),
    getPresignedURLForPackageUpload: build.mutation<{ Message: string, PresignedURL: string, UploadPath: string }, {id: string, fileName: string}>({
      query: ({ id, fileName }) => ({
        url: urlBuilder([ "agents", "libraries", id ], { action: "get_presigned_url" }),
        method: "PUT",
        body: { FileName: fileName }
      }),
      extraOptions: { maxRetries: 0 }
    }),
    deleteLibrary: build.mutation<{ Message: string }, string>({
      query: ( id ) => ({
        url: urlBuilder([ "agents", "libraries", id ]),
        method: "DELETE"
      }),
      invalidatesTags: ( result ) => result ? [{ type: tagTypes.libraries, id: "LIST" }] : []
    }),
    updateLibrary: build.mutation<{ Message: string}, {id: string, requestBody: {
      Description?: string;
      Packages?: [string]; }}>({
        query: ({ id, requestBody }) => ({
          url: urlBuilder([ "agents", "libraries", id ]),
          method: "PUT",
          body: requestBody
        }),
        invalidatesTags: ( result, error, { id }) => result ? [{ type: tagTypes.libraries, id }, { type: tagTypes.libraries, id: "LIST" }] : []
      })
  }),
  overrideExisting: true
});

export const {
  useGetLibrariesQuery,
  useDeleteLibraryMutation,
  useCreateLibraryMutation,
  useGetLibraryDetailsQuery,
  useLazyGetLibraryDetailsQuery,
  useGetPresignedURLForPackageUploadMutation,
  useLazyGetPresignedURLForPackageDownloadQuery,
  useUpdateLibraryMutation
} = librariesApi;