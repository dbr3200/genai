import React, { useEffect, useMemo, useRef, useState, DragEvent, ChangeEvent } from "react";
import { Button, ADPIcon, Select,
  Card, Tooltip, Progressbar } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";

import { useErrorNotification } from "../../../utils/hooks/index";
import { readableFileSize } from "../../../utils";
import styles from "./styles.module.scss";

interface Props {
  acceptedExtensions?: string[];
  fileType:string;
  uploadFiles:( files:any[])=>void;
  resetUploadState: () => void
  uploadState:Record<string, {
    fetchingURL:true;
    progress:number;
    uploadError:string;
  }>|null;
}

interface FileStat {
  fileName: string,
  fileSize: number,
  uploaded: number,
  fileIndex: string,
  actualFile?: File,
  error?: string
}

export const fileTypesToAccept = ( fileType:string ):string[] => {
  switch ( fileType?.toLowerCase()) {
  case "jpg":
  case "jpeg":
    return [ ".jpg", ".jpeg" ];
  case "csv":
  case "xlsx":
    return [ ".csv", ".xlsx" ];
  case "playground":
    return [ ".txt", ".csv", ".pdf" ];
  case "others":
    return [ ".txt", ".md", ".html", ".doc", ".docx", ".csv", ".xls", ".xlsx", ".pdf" ];
  default:
    return [`.${fileType?.toLowerCase()}`];
  }
};

export const UploadFilesForm = ({
  acceptedExtensions, fileType, uploadFiles,
  uploadState, resetUploadState
}: Props ): JSX.Element => {
  const hiddenFileInput = useRef( null );
  const fileSelectOptions = [
    { label: "All", value: "All" },
    { label: "Valid", value: "Valid" },
    { label: "Invalid", value: "Invalid" }
  ];
  const [showErrorNotification] = useErrorNotification();
  const [ fileStats, setFileStats ] = useState<FileStat[]>([]);
  const [ fileOptions, setFileOptions ] = useState<{value: string; label: string}|null>( fileSelectOptions[0]);

  const acceptedFileTypes = acceptedExtensions ?? fileTypesToAccept( fileType );

  const handleClick = () => ( hiddenFileInput?.current as any )?.click();

  const handleChange = ( event: ChangeEvent<HTMLInputElement> | null, dropFiles?:File[]) => {
    const actualFiles = dropFiles || ( event?.target.files ? Object.values( event.target.files ) : []);
    if ( actualFiles.length > 0 ) {

      actualFiles.forEach(( file:File, index:number ) => {
        const stats: FileStat =
           { fileName: file.name, fileSize: file.size, uploaded: 0, fileIndex: `file_${Math.floor( Math.random() * 10000 ) + index}` };
        // If file size is less than equal to 50MB
        if ( file.size <= 50000000 ) {
          stats["actualFile"] = file;
        } else {
          stats["error"] = "Files cannot be larger than 50MB";
        }
        setFileStats(( d ) => ([ ...d, stats ]));
        if ( event ) {
          event.currentTarget.value = "";
        }
      });
    }
  };

  const removeFiles = ( indexString:string ) => () => {
    resetUploadState();
    setFileStats(( d ) => d.filter(( item ) => item.fileIndex !== indexString ));
  };

  const filteredFiles = useMemo(() => {
    return fileStats.filter(( item ) => {
      if ( fileOptions?.value === "All" ){
        return true;
      } else if ( fileOptions?.value === "Valid" ){
        return Boolean( item?.error ) === false;
      } else if ( fileOptions?.value === "Invalid" ){
        return Boolean( item?.error ) === true;
      }
    });
  }, [ fileStats, fileOptions?.value ]);

  const [ dragCounter, setDragCounter ] = useState( 0 );
  const [ drag, setDrag ] = useState( false );

  //Drag Funcs

  useEffect(() => {
    if ( dragCounter === 0 ) {
      setDrag( false );
    }
  }, [dragCounter]);

  useEffect(() => {
    if ( uploadState ){
      const allProgressDone = Object.values( uploadState )?.every( x => x?.progress === 100 );
      if ( allProgressDone ){
        setTimeout(() => {
          setFileStats([]);
          resetUploadState();
        }, 5000 );
      }
    }
  }, [ resetUploadState, uploadState ]);

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

      Array.from( event.dataTransfer.files ).forEach( file => {
        let invalidType = true;
        acceptedFileTypes?.forEach( type => {
          if ( file?.name.endsWith( type )) {
            acceptedFiles.push( file );
            invalidType = false;
          }
        });
        invalidType && showErrorNotification({ content: `${file.name} - Invalid File type` });
      });

      if ( acceptedFiles.length > 0 ) {
        handleChange?.( null, acceptedFiles );
      }
      setDragCounter( 0 );
    }
  };

  return <div className="w-full space-y-4">
    <div className={styles.headerStyles}>
      <div className="w-full sm:w-1/4">
        {( fileStats?.length > 0 && uploadState === null ) && <Select
          menuPortalTarget={document.body}
          value={fileOptions}
          label={"Show"}
          onChange={setFileOptions} options={fileSelectOptions} />}
      </div>
      { uploadState === null
        ? <div className="flex gap-2">
          {filteredFiles?.length > 0 && <><Button size="sm"
            variant="stroked"
            disabled={fileStats.some(( file ) => file?.error )}
            onClick={() => {
              uploadFiles( fileStats );
            } }>{<span className="flex flex-row gap-2 items-center">
              <ADPIcon icon="upload" size="xxs" />
                            Upload {fileStats?.length > 0 ? `(${fileStats.length})` : ""} Files</span>}
          </Button><div className="flex flex-none">
            <Button size="sm"
              variant="stroked"
              onClick={() => {
                setFileStats([]);
                resetUploadState();
              } }>{<span className="flex flex-row gap-2 items-center">
                <ADPIcon icon="delete" size="xxs" />Clear All Files</span>}</Button>
          </div></>
          }
        </div>
        : <p className="dark:text-platinum">
          {[...Object.values( uploadState ).filter(( item ) => item?.progress === 100 )].length}/{fileStats.length}{" "}
          {"Processed"}</p> }
    </div>
    {fileStats?.length > 0
      ? <div className="mb-3">
        {filteredFiles.length === 0 &&
              <Card>
                <Card.Body>
                  {"No Filters Found"}
                </Card.Body>
              </Card>}
        <div className="flex flex-col space-y-4 ">
          {filteredFiles.map(( item ) => {
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
                      styles.uploadDiv3, "flex-grow",
                      { "text-salsa": item?.error }
                    )}>
                      <span className="break-all">{item.fileName}</span>
                      { item.error && <Tooltip trigger={<ADPIcon size="xs" icon="alert" />} >
                        {item.error}
                      </Tooltip>}
                    </div>
                    <div className="text-gray flex-none text-sm dark:text-platinum">{readableFileSize( item.fileSize )}</div>
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
      : <div
        tabIndex={0}
        onDragStart={( event:DragEvent<HTMLDivElement> ) => {
          event.dataTransfer.clearData();
        }}
        onDragOver={handleDrag}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDrop={handleDrop}
        onClick={filteredFiles?.length === 0 ? handleClick : undefined}
        className={clsx( "flex flex-col items-center justify-center gap-2 bg-[#eaf4ff] border-secondary-100 rounded-lg w-full",
          "cursor-pointer sm:row-span-full overflow-y-auto border p-4",
          drag && "bg-gray/50" )}>
        <div
          className="flex flex-col items-center"
        >
          <ADPIcon size="xs" icon="upload" />
          <div
            className="pb-4 text-secondary-400 dark:text-platinum text-xs text-center py-4">
            {"Drag and drop or click to upload a file"}
            <p className="font-robotoItalic mt-4">
              {`Accepted File Types:- ${acceptedFileTypes.join( ", " )}`}</p>
          </div>
        </div>
        <input
          type="file"
          id="adp-file-upload"
          accept= {acceptedFileTypes.join( "," ) }
          ref={hiddenFileInput}
          multiple
          onChange={handleChange}
          style={{ display: "none" }}
        />
      </div>}
    {uploadState === null && (
      <div className="mt-8">
        {fileStats.length !== 0 && ( <>
          {fileStats.some(( file ) => file?.error ) && <p className="text-salsa">
                    Please remove invalid files to continue !
          </p>}
          <Button classes="ms-auto" size="sm"
            disabled={fileStats.some(( file ) => file?.error )}
            onClick={() => {
              uploadFiles( fileStats );
            }} >{"Upload Files"}</Button>
        </>
        )}
      </div>
    )}
  </div>;
};
