import React, { useMemo, useRef, useState } from "react";
import { Button, ADPIcon, Select,
  Card, Tooltip, Progressbar } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

import { useErrorNotification } from "../../../utils/hooks/index";
import { fileTypesToAccept, readableFileSize } from "../../../utils";
import styles from "./styles.module.scss";
import { Option } from "../../../types";

interface UploadFileProps {
  /**
   * Type of File Extensions to be accepted.
   */
  acceptedExtensions: string[];
   /**
   * Message to be set for the upload button.
   */
  uploadButtonMessage:React.ReactNode;
  /**
   * File types to be accepted for upload
   */
  fileType:string;
  /**
   * Method to help in uploading a group of files
   * @param files - Array of files
   * @returns - Uploaded Files which is updated to the corresponding job
   */
  uploadFiles:( files:any[])=>void;
  /**
   * Resets the upload state of each file once upload is completed
   */
  resetUploadState: () => void
  /**
   * State of each file upload with their corresponding status(which is set for each individual file)
   */
  uploadState:Record<string, {
    fetchingURL:true;
    progress:number;
    uploadError:string;
  }>|null;
  /**
   * Accepts Partial input of upload paths
   */
  partitionInput?: Record<string, any> | undefined;
  /**
   * Set a custom message to the upload box field if required
   */
  setDropBoxMessage?:string;
}

export const UploadFiles = ({
  acceptedExtensions,
  fileType,
  uploadFiles,
  uploadState,
  resetUploadState,
  partitionInput,
  setDropBoxMessage }: UploadFileProps ): JSX.Element => {
  const { t } = useTranslation();
  const hiddenFileInput = useRef( null );
  const fileSelectOptions = [
    { label: t( "common.words.fileSelectAll" ), value: "All" },
    { label: t( "common.words.fileSelectValid" ), value: "Valid" },
    { label: t( "common.words.fileSelectInvalid" ), value: "Invalid" }
  ];
  const [showErrorNotification] = useErrorNotification();
  const [ files, setFiles ] = useState<File[]>([]);
  const [ fileOptions, setFileOptions ] = useState<Option|null>( fileSelectOptions[0]);

  const handleClick = () => ( hiddenFileInput?.current as any )?.click();

  const handleChange = ( event: React.ChangeEvent<HTMLInputElement> ) => {
    const inputFiles = event.target.files || [];
    const filesArray = [...Object.values( inputFiles )].filter(( item ) => typeof item !== "number" );
    if ( inputFiles.length > 0 ) {
      const totalSize:number = filesArray.reduce(( acc:number, curr:any ) => acc += curr.size, 0 );
      if ( totalSize > ( 500000 * Math.pow( 2, 20 ))) {
        return showErrorNotification({
          content: t( "common.words.excedingTotalSize" )
        });
      } else if ( files.length + filesArray.length > 100 ){
        return showErrorNotification({
          content: t( "common.words.excedingTotalContent" )
        });
      } else {
        filesArray.forEach(( fileStats:any, index:number ) => {
          const file:Record<string, any> =
           { fileName: fileStats.name, fileSize: fileStats.size, uploaded: 0, fileIndex: `file_${Math.floor( Math.random() * 10000 ) + index}` };
          const mimeType = fileStats?.name?.split( "." )?.pop()?.toLowerCase();
          if (( acceptedExtensions.includes( `.${ mimeType}` ) ||
          [ mimeType, "others" ].includes( fileType )) && fileStats.size <= ( 5000 * Math.pow( 2, 20 ))) {
            file["actualFile"] = fileStats;
          } else if (( mimeType === "xlsx" && fileStats.size > ( 100 * Math.pow( 2, 20 ))) || ( fileStats.size > ( 5000 * Math.pow( 2, 20 )))) {
            file["error"] = `File size too large, please select a .${fileType} file <${mimeType === "xlsx" ? "100MB" : "5GB"}`;
          } else if ( !acceptedExtensions.includes( `.${ mimeType}` )) {
            file["error"] = `Invalid File format, only ${acceptedExtensions.join( " / " )} files are allowed`;
          }
          setFiles(( d:any ) => ([ ...d, file ]));
        });
      }
    }
  };

  const removeFiles = ( indexString:string ) => () => {
    resetUploadState();
    setFiles(( d:any ) => d.filter(( item:any ) => item.fileIndex !== indexString ));
  };

  const filteredFiles = useMemo(() => {
    return files.filter(( item:any ) => {
      if ( fileOptions?.value === "All" ){
        return true;
      } else if ( fileOptions?.value === "Valid" ){
        return Boolean( item?.error ) === false;
      } else if ( fileOptions?.value === "Invalid" ){
        return Boolean( item?.error ) === true;
      }
    });
  }, [ files, fileOptions?.value ]);

  return (
    <div className="">
      <div className="panelBody">
        <div className="w-full px-2 mb-16">
          <p className="dark:text-platinum pb-6">
            {typeof partitionInput === "object" && (
              <>
                {t( "common.words.UploadPath" )} :<span className="text-amorphicBlue">
                  {Object.values( partitionInput ).map(( item, idx ) => (
                    <React.Fragment key={item}>{" "}{item} {idx !== partitionInput.length - 1 && "/"}</React.Fragment>
                  ))}
                </span>
              </>
            )}
          </p>
          <div className={styles.headerStyles}>
            <div className="w-full sm:w-1/4">
              {( files?.length > 0 && uploadState === null ) && <Select
                value={fileOptions}
                label={"Show"}
                onChange={setFileOptions} options={fileSelectOptions} />}
            </div>
            <div className="flex flex-col justify-end">
              { uploadState === null ? <div className="flex gap-2">
                <Button size="sm" classes="bg-gray" onClick={handleClick} >Select files to upload</Button>
                {filteredFiles?.length > 0 && <Button size="sm"
                  disabled={files.some(( file:any ) => file?.error )}
                  onClick={() => {
                    uploadFiles( files );
                  }} >{t( "common.words.UploadFiles" )}</Button>}
              </div> : <p className="dark:text-platinum">
                {[...Object.values( uploadState ).filter(( item ) => item?.progress === 100 )].length}/{files.length}{" "}
                {t( "common.words.progressMessage" )}</p> }
            </div>
          </div>
          {files?.length > 0 ? <div className="mb-3">
            {filteredFiles.length === 0 &&
              <Card>
                <Card.Body>
                  {t( "common.words.noFiltersFound" )}
                </Card.Body>
              </Card>}
            <div className="flex flex-col space-y-2 ">
              {filteredFiles.map(( item:any ) => {
                const { progress = null, uploadError = "", fetchingURL = false } = uploadState?.[item.fileIndex] ?? {};
                return (
                  <div
                    key={item.fileIndex}
                    className={styles.filesDiv}
                  >
                    {uploadState === null && (
                      <Button onClick={removeFiles( item.fileIndex )}
                        aria-label={t( "profile.settings.closePanel" )}
                        className={clsx( "group", styles.deleteFilesButton )}
                      >
                        <ADPIcon size="xs" icon="delete" title={t( "common.words.deleteFile" )}/>
                      </Button>
                    )}
                    <div className={clsx( styles.uploadDiv, { "pe-6": uploadState === null })}>
                      <div className={styles.uploadDiv2}>
                        <div className={clsx(
                          styles.uploadDiv3,
                          { "text-salsa": item?.error }
                        )}>
                          <span className="break-all">{item.fileName}</span>
                          { item.error && <Tooltip trigger={<ADPIcon size="xs" icon="alert" />} >
                            {item.error}
                          </Tooltip>}
                        </div>
                        <div className="text-gray text-sm dark:text-platinum">{item.fileSize ? readableFileSize( item.fileSize ) : "0 B"}</div>
                      </div>
                      {uploadState !== null && <div className="progress">
                        <Progressbar
                          variant={
                            ( uploadError || item?.error )
                              ? "error"
                              : ( progress === null ? "secondary" : (
                                fetchingURL ? "info" : "success"
                              ))
                          }
                          value={progress ?? 0}
                          text={
                            uploadError ? t( "common.words.errorInFileUpload" )
                              : ( fetchingURL
                                ? t( "common.words.FetchingUploadURL" )
                                : ( progress
                                  ? t( "common.words.Uploaded" )
                                  : t( "common.words.PendingUpload" )))
                          }
                          striped={progress !== null && progress !== 100}
                          showPercentage={false} />
                      </div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div> : <>
            <div className={styles.selectFileTypes}>
              <div>
                {setDropBoxMessage ?
                  setDropBoxMessage : `Please select upto 100 ${fileTypesToAccept( fileType ).join( " / " )} files (&lt;5GB each) to upload` }
              </div>
            </div>
          </>}
          {uploadState === null && (
            <div className="mt-8">
              {files.length !== 0 && ( <>
                {files.some(( file:any ) => file?.error ) && <p className="text-salsa">
                  {t( "common.words.invalidFile" )}
                </p>}
                <Button classes="ms-auto" size="sm"
                  disabled={files.some(( file:any ) => file?.error )}
                  onClick={() => {
                    uploadFiles( files );
                  }} >{t( "common.words.UploadFiles" )}</Button>
              </>
              )}
              <input
                type="file"
                accept={acceptedExtensions.toString()}
                ref={hiddenFileInput}
                multiple
                onChange={handleChange}
                onClick={( event ) => {
                  ( event.target as HTMLInputElement ).value = "";
                }}
                style={{ display: "none" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
