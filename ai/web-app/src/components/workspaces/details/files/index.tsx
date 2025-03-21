import React, { useCallback, useEffect, useState } from "react";

import { useDeleteWorkspaceDocumentMutation, useGetWorkspaceDocumentsQuery } from "../../../../services/workspaces";
import { useAppDispatch, useAppSelector, usePaginationState, useSuccessNotification } from "../../../../utils/hooks";
import { DataTable } from "../../../customComponents/dataTable";
import { CustomFieldConstructor } from "./customFieldConstructor";
import WorkspaceStats from "../stats/workspaceStats";
import { setPagination } from "../../../../modules/pagination";
import { useTranslation } from "react-i18next";
import { ConfirmationModal } from "../../../customComponents/confirmationModal";
import DeleteConfirmationMessage from "../../../customComponents/deleteConfirmationMessage";
import SidePanel from "../../../customComponents/sidePanel";
import DocumentDetailsMetadata from "./fileDetails";
import { Badge, Select, StatusCard } from "@amorphic/amorphic-ui-core";
import { getSelectedOptions } from "../../../../utils/renderUtils";
import { formatFileName } from "../../../../utils";

interface IFilesProps {
  accessType?: string;
  resourceId: string;
}

const SORT_COLUMN_MAPPINGS = {
  LastModifiedTime: "LastModifiedTime",
  LastModifiedBy: "LastModifiedBy"
};

const DISPLAY_FIELDS:Record<string, any> = {
  file: [
    { "FieldName": "DocumentName", "FieldProps": { defaultDisplay: true } },
    { "FieldName": "DocumentId", "FieldProps": { defaultDisplay: true } },
    { "FieldName": "DocumentType", "FieldProps": { defaultDisplay: false } },
    { "FieldName": "LastModifiedBy", "FieldProps": { defaultDisplay: true } },
    { "FieldName": "Message", "FieldProps": { defaultDisplay: true } }
  ],
  website: [
    { "FieldName": "WebpageURL", "FieldProps": { defaultDisplay: true } },
    { "FieldName": "DocumentId", "FieldProps": { defaultDisplay: true } },
    { "FieldName": "DocumentType", "FieldProps": { defaultDisplay: false } },
    { "FieldName": "LastModifiedBy", "FieldProps": { defaultDisplay: true } },
    { "FieldName": "Message", "FieldProps": { defaultDisplay: true } }
  ]
};

const MODULE_DEFAULT_PAGINATION_SETTING = { limit: 50, sortBy: "LastModifiedTime", sortOrder: "desc" };

const dataTypeOptions = [
  { label: "File", value: "file" },
  { label: "Webpage", value: "website" }
];

export const FilesList = ({
  accessType,
  resourceId
}: IFilesProps ): JSX.Element => {
  const { t } = useTranslation();
  const permPathKey = "workspaceFiles";

  const dispatch = useAppDispatch();

  const defaultPaginationState = usePaginationState( SORT_COLUMN_MAPPINGS, MODULE_DEFAULT_PAGINATION_SETTING );

  const [ documentType, setDocumentType ] = useState( "file" );

  const { offset, limit, sortBy, sortOrder } = useAppSelector(({ pagination }) => pagination?.[permPathKey] ?? defaultPaginationState );

  const {
    data: { Documents: resourcesList = [], total_count = 0 } = {},
    isFetching,
    isLoading,
    isUninitialized,
    refetch } = useGetWorkspaceDocumentsQuery({ id: resourceId, queryParams: { documentType: documentType,
    offset, limit, sortby: sortBy, sortorder: sortOrder } }, {
    skip: !resourceId
  });

  const [ deleteDocument, { isLoading: deletingDocument }] = useDeleteWorkspaceDocumentMutation();

  const [ documentDetails, setDocumentDetails ] = useState<any>({});

  const [ showDeleteModal, toggleDeleteModal ] = React.useReducer(( state ) => !state, false );

  const [ showDocumentDetails, setShowDocumentDetails ] = useState<boolean>( false );

  const customDisplayFields = CustomFieldConstructor( setDocumentDetails, toggleDeleteModal, setShowDocumentDetails );

  const [showSuccessNotification] = useSuccessNotification();

  const handleDeleteDocument = useCallback( async () => {
    try {
      const response = await deleteDocument({ workspaceId: resourceId, documentId: documentDetails?.DocumentId }).unwrap();

      showSuccessNotification({ content: response?.Message });
    } catch ( error ) {
      // do nothing
    } finally {
      toggleDeleteModal();
    }
  }, [ deleteDocument, documentDetails?.DocumentId, resourceId, showSuccessNotification ]);

  useEffect(() => {
    dispatch( setPagination({
      key: permPathKey,
      data: defaultPaginationState
    }));
  // Adding more dependencies will cause infinite loop
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceId]);

  return <div className="space-y-8 pt-4">
    <StatusCard
      variant="info"
      classes="!border-primary-300 !bg-primary-200/10 text-secondary-200"
    >
      {t( "services.workspaces.scheduleRunMsg" )}
    </StatusCard>
    <div className="w-full overflow-auto">
      <WorkspaceStats
        accessType={accessType}
        resourceId={resourceId}
      />
    </div>
    <DataTable
      key={documentType}
      // for identifying, search & display
      dataIdentifiers={{
        permPathKey: `${documentType}${permPathKey}`,
        searchKeys: documentType === "file" ? ["DocumentDetails.FileName"] : ["DocumentDetails.WebsiteURL"],
        id: "DocumentId",
        name: documentType === "file" ? "DocumentDetails.FileName" : "DocumentDetails.WebsiteURL",
        currentSelection: resourceId
      }}
      // for pagination actions
      defaultPaginationState={defaultPaginationState}
      totalCount={total_count}
      // loading and data display
      reloadData={refetch}
      compactTable={false}
      loading={isFetching || isLoading || isUninitialized}
      resourcesList={ resourcesList}
      customFields={customDisplayFields}
      // for sorting & filtering
      availableFields={DISPLAY_FIELDS[documentType]}
      sortableFields={SORT_COLUMN_MAPPINGS}
      additionalCTAs={
        <div className="flex flex-row gap-4 mx-4">
          <Badge classes="flex h-[40px] rounded border-[1px] border-secondary-100"
            label={<p className="whitespace-nowrap">{t( "Document Type" )}</p>}
            value={<div className="flex items-center w-[6rem] pt-1">
              <Select
                className="w-full"
                value={getSelectedOptions( documentType, dataTypeOptions, false )}
                label=""
                menuPortalTarget={document.body}
                options={dataTypeOptions}
                onChange={( e:any ) => setDocumentType( e.value )}
              />
            </div>} />
        </div>
      }
    />
    <ConfirmationModal
      confirmButtonText={documentDetails?.DocumentType === "website" ? "Delete webpage content" : "Delete File"}
      cancelButtonText={t( "profile.settings.cancel" )}
      onConfirm={async() => {
        handleDeleteDocument();
      }}
      showModal={Boolean( showDeleteModal )}
      loading={deletingDocument }
      bodyClasses="break-all"
      closeModal={toggleDeleteModal}
      onCancel={toggleDeleteModal}
    >
      <>
        {
          documentDetails?.DocumentType === "website"
            ? <DeleteConfirmationMessage translationKey="services.workspaces.websiteDeleteConfirmation"
              resourceName={documentDetails?.DocumentDetails?.WebsiteURL} />
            : <DeleteConfirmationMessage resourceType="file" resourceName={ formatFileName( documentDetails?.DocumentDetails?.FileName ) } />
        }
      </>
    </ConfirmationModal>
    <SidePanel
      size="sm"
      show={showDocumentDetails}
      header={documentDetails?.DocumentType === "website" ? "Website details" : "File Details"}
      onClose={() => {
        setShowDocumentDetails( false );
      }}
    >
      <DocumentDetailsMetadata resourceId={resourceId} documentId={documentDetails?.DocumentId} documentType={documentDetails?.DocumentType} />
    </SidePanel>

  </div>;
};

export default FilesList;