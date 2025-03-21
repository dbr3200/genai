import React, { ChangeEvent, DragEvent, useEffect, useRef, useState } from "react";
import { ADPIcon, Button, Card } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import { useTranslation } from "react-i18next";

import { useErrorNotification } from "../../../utils/hooks";
import styles from "./upload.module.scss";

type FileInfo = { name: string, uploadPath: string };

interface Props {
  uploadedFiles?: FileInfo | FileInfo[] | null;
  removeFile: ( fileName: string ) => void;
  uploading?: boolean;
  /**
   * Comma-separated list of unique file type specifiers the input should accept
   * @default ".json"
   */
  acceptedFileType?: string;
  /**
   * When multipleFiles is set to true, the file input allows the user to select more than one file
   * @default false
   */
  multipleFiles?: boolean;
  /**
   * Disabling the upload input in case of optional field
   * @default false
   */
  disabled?: boolean;
  /**
   * Comma separated classnames to override the Upload component styles
   */
  classes?:string
  /**
   * Callback to handle the File or FileList
   */
  handleUpload: ( file: File | File[]) => void;
  /**
   * Message to be displayed to the user
   */
  userMessage?: string;
}

export function Upload({
  uploadedFiles,
  removeFile,
  uploading = false,
  userMessage,
  acceptedFileType = ".json",
  multipleFiles = false,
  disabled = false,
  classes,
  handleUpload
} : Props ): JSX.Element{
  const [showErrorNotification] = useErrorNotification();
  const inputRef = useRef<HTMLInputElement>( null );
  const [ dragCounter, setDragCounter ] = useState( 0 );
  const [ drag, setDrag ] = useState( false );
  const { t } = useTranslation();

  useEffect(() => {
    if ( dragCounter === 0 ) {
      setDrag( false );
    }
  }, [dragCounter]);

  const openFileExplorer = () => {
    inputRef.current?.click();
  };

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

      const acceptedTypesArr = acceptedFileType.split( "," );

      Array.from( event.dataTransfer.files ).forEach( file => {
        let invalidType = true;
        acceptedTypesArr.forEach( type => {
          if ( file?.name.endsWith( type )) {
            acceptedFiles.push( file );
            invalidType = false;
          }
        });
        invalidType && showErrorNotification({ content: `${file.name} - Invalid File type` });
      });

      if ( acceptedFiles.length > 0 ) {
        handleUpload?.( multipleFiles ? Array.from( acceptedFiles ) : acceptedFiles[0]);
      }

      event.dataTransfer.clearData();
      setDragCounter( 0 );
    }
  };

  const uploadHandler = ( event: ChangeEvent<HTMLInputElement> ) => {
    const { files } = event.target;
    if ( files !== null ) {
      handleUpload?.( multipleFiles ? Array.from( files ) : files[0]);
    }
    event.currentTarget.value = "";
  };

  return <>
    <div
      {...( disabled ? {} : {
        onDragOver: handleDrag,
        onDragEnter: handleDragIn,
        onDragLeave: handleDragOut,
        onDrop: handleDrop
      })}
      className={clsx( "bg-platinum relative", disabled ? "cursor-no-drop" : drag ? styles.drag : "", styles.container, classes )}
    >
      <input accept={acceptedFileType} onChange={uploadHandler} multiple={multipleFiles} disabled={disabled}
        ref={inputRef} name="clone" className="hidden" type="file" />
      {userMessage && <p className="my-4">{userMessage}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" classes={styles.uploadButton}
          variant="filled" size="xs" disabled={disabled} onClick={openFileExplorer}>
          <ADPIcon icon="upload" size="xxs" />{t( "common.button.upload" )}
        </Button>  <span className="font-regular">{t( "upload.dragMessage" )}</span>
      </div>
      <p className="font-light mt-2">{t( "upload.acceptedFileType", { acceptedFileType })}</p>
      { uploading && <div className={styles.uploadingMsgContainer}>
        <div className={styles.uploadingMsg}>
          <ADPIcon icon="spinner" classes="shrink-0 text-white" size="md" spin/>
          <p className="text-white text-sm mt-2">{t( "common.words.uploading" )}</p>
        </div>
      </div> }
    </div>
    <div className="mt-2 space-y-4">
      {uploadedFiles
        ? Array.isArray( uploadedFiles )
          ? uploadedFiles.map(( file: FileInfo, index ) =>
            <Card key={index} classes={styles.uploadedFileCard}>
              <p>{file.name}</p><Button disabled={uploading} variant="icon" icon={<ADPIcon icon="delete" size="xs" classes="text-danger" />}
                title="Remove" onClick={() => removeFile( file.name )}></Button>
            </Card> )
          : <Card classes={styles.uploadedFileCard}>
            <p>{uploadedFiles.name}</p><Button disabled={uploading} variant="icon" icon={<ADPIcon icon="delete" size="xs" classes="text-danger" />}
              title="Remove" onClick={() => removeFile( uploadedFiles.name )}></Button>
          </Card>
        : <></>}
    </div>
  </>;
}