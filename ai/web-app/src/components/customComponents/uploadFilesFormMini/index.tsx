import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, ADPIcon, Tooltip, Progressbar } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";

import { useErrorNotification } from "../../../utils/hooks/index";
import { readableFileSize } from "../../../utils";
import styles from "./styles.module.scss";

interface Props {
  acceptedExtensions: string;
  uploadButtonMessage:React.ReactNode;
  fileType:string;
  uploadFiles:( files:any[])=>void;
  resetUploadState: () => void
  uploadState:Record<string, {
    fetchingURL:true;
    progress:number;
    uploadError:string;
  }>|null;
  partitionInput?: Record<string, any> | undefined;
  disabled?: boolean;
}

export const fileTypesToAccept = ( fileType:string ):string[] => {
  const icon = (( ext ) => {
    switch ( ext ) {
    case "jpg":
    case "jpeg":
      return [ ".jpg", ".jpeg" ];
    case "csv":
    case "xlsx":
      return [ ".csv", ".xlsx" ];
    case "others":
      return [""];
    default:
      return [ext];
    }
  })( fileType?.toLowerCase());
  return icon;
};

export const UploadFilesFormMini = ({ acceptedExtensions, fileType, uploadFiles, uploadState, resetUploadState, disabled = false }: Props ): JSX.Element => {
  const hiddenFileInput = useRef( null );
  const [showErrorNotification] = useErrorNotification();
  const [ files, setFiles ] = useState<any>([]);

  useEffect(() => {
    setFiles([]);
  }, []);

  const handleClick = () => ( hiddenFileInput?.current as any )?.click();

  const handleChange = ( event:any, dropFiles?:any ) => {
    const { files: inputFiles } = event.target;
    const actualFiles = dropFiles || inputFiles;
    const filesArray = [...Object.values( actualFiles )].filter(( item ) => typeof item !== "number" );
    if ( actualFiles.length > 0 ) {
      const totalSize:number = filesArray.reduce(( acc:number, curr:any ) => acc += curr.size, 0 );
      if ( totalSize > ( 500000 * Math.pow( 2, 20 ))) {
        return showErrorNotification({
          content: "Exceeding total size of files allowed"
        });
      } else if ( files.length + filesArray.length > 100 ){
        return showErrorNotification({
          content: "Exceeding total number of files allowed"
        });
      } else {
        filesArray.forEach(( fileStats:any, index:number ) => {
          const file:Record<string, any> =
           { fileName: fileStats.name, fileSize: fileStats.size, uploaded: 0, fileIndex: `file_${Math.floor( Math.random() * 10000 ) + index}` };
          const mimeType = fileStats?.name?.split( "." )?.pop()?.toLowerCase();
          if (( acceptedExtensions === mimeType ||
          [ mimeType, "others" ].includes( fileType )) && fileStats.size <= ( 5000 * Math.pow( 2, 20 ))) {
            file["actualFile"] = fileStats;
          } else if (( mimeType === "xlsx" && fileStats.size > ( 100 * Math.pow( 2, 20 ))) || ( fileStats.size > ( 5000 * Math.pow( 2, 20 )))) {
            file["error"] = `File size too large, please select a .${fileType} file <${mimeType === "xlsx" ? "100MB" : "5GB"}`;
          } else if ( acceptedExtensions !== mimeType ) {
            file["error"] = `Invalid File format, only ${acceptedExtensions} files are allowed`;
          }
          setFiles(( d:any ) => ([ ...d, file ]));
          event.currentTarget.value = "";
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

  const [ dragCounter, setDragCounter ] = useState( 0 );

  //Drag Funcs

  useEffect(() => {
    if ( dragCounter === 0 ) {
      setDrag( false );
    }
  }, [dragCounter]);

  const handleDrag = ( event: DragEvent<HTMLDivElement> ) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragIn = ( event: DragEvent<HTMLDivElement> ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragCounter( dragCounter + 1 );
    if ( event.dataTransfer.items && event.dataTransfer.items.length > 0 ) {
      setDrag( true );
    }
  };

  const handleDragOut = ( event: DragEvent<HTMLDivElement> ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragCounter( dragCounter - 1 );
  };

  const handleDrop = ( event: DragEvent<HTMLDivElement> ) => {
    event.preventDefault();
    event.stopPropagation();
    setDrag( false );

    const acceptedFiles: File[] = [];
    if ( event.dataTransfer.files ){

      const acceptedTypesArr = acceptedExtensions;

      Array.from( event.dataTransfer.files ).forEach( file => {
        if ( file?.name.endsWith( acceptedTypesArr )) {
          acceptedFiles.push( file );
        } else {
          file["error"] = `Invalid File format, only ${acceptedExtensions} files are allowed`;
          acceptedFiles.push( file );
        }
      });

      if ( acceptedFiles.length > 0 ) {
        handleChange?.( event, acceptedFiles );
        event.currentTarget.value = "";
      }
      setDragCounter( 0 );
    }
  };

  if ( disabled ){
    return <div
      className="flex flex-col items-center justify-center gap-2 bg-gray-50 border-gray-100 rounded-lg w-full cursor-pointer sm:row-span-full overflow-y-auto">
      <div className="flex flex-col space-y-2 overflow-y-auto max-h-[20vh]">
        <span className="break-all">
          You are not authorized to upload files!
        </span>
      </div>
    </div>;
  }

  return (
    <div
      tabIndex={0}
      onDragStart={( event:DragEvent<HTMLDivElement> ) => {
        event.dataTransfer.clearData();
      }}
      onDragOver={handleDrag}
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDrop={handleDrop}
      onClick={filteredFiles?.length === 0 ? handleClick : undefined}
      className="flex flex-col items-center justify-center gap-2 bg-gray-50 border-gray-100 rounded-lg w-full cursor-pointer sm:row-span-full overflow-y-auto">
      {files?.length > 0 ? <>
        <div className="flex w-full items-center justify-between gap-2 px-4 py-2 shadow">
          <div className="flex-grow flex items-center gap-2">
            { uploadState === null ? <>
              {( filteredFiles?.length > 0 ) && <Button variant="stroked"
                size="sm"
                disabled={files.some(( file: any ) => file?.error )}
                onClick={() => uploadFiles( files )}
              >Upload Files</Button>}
              { files.some(( file: any ) => file?.error ) && <Tooltip trigger={<ADPIcon icon="warning" size="xs" classes="text-warning" />}>
                <span>Upload disabled due to invalid files</span>
              </Tooltip> }
            </> : <span>
              {[...Object.values( uploadState )?.filter(( item ) => item?.progress === 100 )]?.length}/{files?.length}{" "}{"Processed"}
            </span> }
          </div>
          <div className="flex flex-none">
            <Tooltip trigger={<ADPIcon icon="delete" size="xs" />}
              onTriggerClick={() => {
                setFiles([]);
                resetUploadState();
              }}
            >
              <span>Clear all files</span>
            </Tooltip>
          </div>
        </div>
        <div className="mb-3 px-4 flex-grow">
          <div className="flex flex-col space-y-2 overflow-y-auto max-h-[20vh]">
            {filteredFiles.map(( item:any ) => {
              const { progress = null, uploadError = "", fetchingURL = false } = uploadState?.[item.fileIndex] ?? {};
              return (
                <div
                  key={item.fileIndex}
                  className={styles.filesDiv}
                >
                  {uploadState === null && (

                    <button onClick={removeFiles( item.fileIndex )}
                      aria-label={"Close Panel"}
                      className={clsx( "group", styles.deleteFilesButton )}
                    >
                      <ADPIcon size="xs" icon="delete" classes="group-hover:text-white" title="Delete File"/>
                    </button>
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
                      <div className="text-gray text-sm dark:text-platinum">{readableFileSize( item.fileSize )}</div>
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
                          uploadError ? "Error in File Upload"
                            : ( fetchingURL
                              ? "Fetching Upload URL"
                              : ( progress
                                ? "Uploaded"
                                : "Pending Upload" ))
                        }
                        striped={progress !== null && progress !== 100}
                        showPercentage={false} />
                    </div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </> : <div
        className="flex flex-col items-center"
      >
        <ADPIcon size="xs" icon="upload" />
        <div
          className="pb-4 text-secondary-400 dark:text-platinum text-xs text-center py-4">
          {"Drag and drop or click to upload a file"}
          <p className="font-robotoItalic mt-4">{`Accepted File Types:- ${acceptedExtensions}`}</p>
        </div>
      </div> }
      {uploadState === null && (
        <div className="mt-8">
          {files.length !== 0 && ( <>
            {files.some(( file:any ) => file?.error ) && <p className="text-salsa">
                    Please remove invalid files to continue !
            </p>}
          </>
          )}
          <input
            type="file"
            accept={acceptedExtensions}
            ref={hiddenFileInput}
            multiple
            onChange={handleChange}
            style={{ display: "none" }}
          />
        </div>
      )}
    </div>
  );
};
