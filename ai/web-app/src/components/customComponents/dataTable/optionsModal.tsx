// libraries
import React, { useEffect, useState, memo, useRef } from "react";
import { ADPIcon, Button, Datepicker, Modal, Select, Toggle } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import clsx from "clsx";
import PerfectScroll from "react-perfect-scrollbar";

// methods / hooks / constants / styles
import { convertToUTCTime, unCamelize, splitPascalCase } from "../../../utils";
import { useAppDispatch, useAppSelector } from "../../../utils/hooks";
import { ResourcesListingType, ResultsPerPageType, SortOrderType } from "../../../constants";
import { setColumns } from "../../../modules/configurableFields";
import { IDisplayField, PaginationState, SortableFields } from "../../../types";
// import ResourcesDisplaySwitch from "../resourcesDisplaySwitch";
import styles from "./optionsModal.module.scss";

dayjs.extend( utc );

// Amorphic Start Date - Default Start Date for filter if resource creation date is not available
const initialFromDateTime = new Date( 1483228800000 ); // Jan 01 2017 00:00:00 GMT

interface Props {
  permPathKey: string;
  queryOptions: PaginationState;
  setQueryOptions: ( data: Partial<PaginationState> ) => void;
  availableFields: IDisplayField[];
  sortableFields: SortableFields;
  isSortable?: boolean;
  /** Custom Advanced Filter Sort Tab Component */
  customAdvancedFilters?: {
    sectionName: string,
    sectionDescription?: string,
    component: React.ReactNode,
    resetAdvancedFilters: () => void;
    setAdvancedFilters: () => void;
  }
  /** Custom Date Range Filter Tab */
  isDateRangeFilterEnabled?: boolean;
  /** Start datetime for the date range filter */
  fromDateTime?: Date;
  hasQueryOptionsChanged?: boolean;
  optionsModalOpen: boolean;
  listStyle?: typeof ResourcesListingType[number];
  toggleListStyle?: () => void;
  toggleOptionsModalVisibility: () => void;
}

type ConfigurableField = { label: string, key: string, isFixed?: boolean };
type Field = IDisplayField & {
  FieldProps: {
    selected: boolean;
  }
}
type ItemRef = { index: number };
interface ColumnPreferencesProps {
  fields: Field[];
  setFields: React.Dispatch<React.SetStateAction<Field[]>>;
}

const setRootDpId = () => {
  // cleanup stale/existing id
  const currentElements = document.querySelectorAll( "#root-dp" );
  currentElements.forEach( node => node?.setAttribute( "id", "" ));

  // Set id again
  // This "[data-focus-lock-disabled=\"false\"]" selector is applied as the HeadlessUI (from core pakage) Modal
  // applies an "aria-hidden=true" and  "data-focus-on-hidden=true" on all other divs under body tag
  // The only div that is focussable here is the modal's div itself and we select it using the below selector.
  const modalElement = document.querySelector( "[data-focus-lock-disabled=\"false\"]" );
  modalElement && modalElement?.setAttribute( "id", "root-dp" );
};

const ColumnPreferences = ({ fields, setFields }: ColumnPreferencesProps ) => {
  const dragItemRef = useRef<ItemRef>({ index: -1 });
  const dragOverItemRef = useRef<ItemRef>({ index: -1 });
  const { t } = useTranslation();

  const handleDrop = ( event: React.DragEvent<HTMLElement> ) => {
    event.stopPropagation();
    const listCopy = structuredClone( fields );
    const requiredItem = listCopy[dragItemRef.current.index];
    listCopy.splice( dragOverItemRef.current.index, 0, requiredItem );
    const dragLocationIndex = dragItemRef.current.index >= dragOverItemRef.current.index ? dragItemRef.current.index + 1 : dragItemRef.current.index;
    listCopy.splice( dragLocationIndex, 1 );
    setFields( listCopy );
  };

  const toggleItem = ( index: number ) => {
    const listCopy = structuredClone( fields );
    listCopy[index].FieldProps.selected = !listCopy[index]?.FieldProps?.selected;
    setFields( listCopy );
  };

  return <>
    <PerfectScroll className="max-h-[50vh]" onDragEnter={event => event.preventDefault()}
      onDragOver={event => event.preventDefault()}
      onDrop={handleDrop}>
      {fields.map(( item: IDisplayField, index: number ) => <div draggable={!item?.FieldProps?.fixed}
        className={clsx( styles.draggableItem, item?.FieldProps?.fixed && styles.notDraggable )}
        onDragStart={( event ) => {
          event.stopPropagation();
          dragItemRef.current.index = index;

        }}
        onDragEnter={( event ) => {
          event.stopPropagation();
          dragOverItemRef.current.index = index;

        }}
        onDragOver={( event ) => {
          event.currentTarget.classList?.add( styles.onTop );
        }}
        onDragLeave={( event ) => {
          event.currentTarget.classList?.remove( styles.onTop );
        }}
        onDrop={( event ) => {
          event.currentTarget?.classList.remove( styles.onTop );
        }}
        key={item.FieldName}>
        <div className="flex justify-start items-center gap-2">
          <ADPIcon classes="text-secondary-400 w-4" icon={item?.FieldProps?.fixed ? "password" : "v-menu"} size="xs" />
          <span>{item.FieldProps?.displayName ? t( item.FieldProps?.displayName ) : splitPascalCase( item.FieldName )}</span>
        </div>
        <Toggle
          classes="ms-auto me-0"
          disabled={item?.FieldProps?.fixed}
          toggled={item?.FieldProps?.fixed || Boolean( item?.FieldProps?.selected ) || false}
          onChange={() => toggleItem( index )}
        />
      </div> )}
    </PerfectScroll>
  </>;
};

const OptionsModal = ({
  availableFields,
  sortableFields,
  isSortable,
  queryOptions,
  setQueryOptions,
  permPathKey,
  customAdvancedFilters,
  isDateRangeFilterEnabled,
  fromDateTime,
  hasQueryOptionsChanged,
  optionsModalOpen,
  listStyle,
  toggleListStyle,
  toggleOptionsModalVisibility
}: Props ): JSX.Element => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const configurableFieldsState: ConfigurableField[] = useAppSelector(( state ) => state.configurableFields?.[permPathKey] ?? []);
  const [ sortOptions, setSortOptions ] = useState<PaginationState>( queryOptions );
  const [resourceDisplayStyle] = useState< "list" | "grid">( listStyle as any );
  const [ fields, setFields ] = useState<Field[]>([]);
  const { limit, sortOrder, sortBy } = sortOptions || {};
  isDateRangeFilterEnabled && setRootDpId();

  // const toggleResourceDisplayStyle = () => setResourceDisplayStyle(( style ) => style === "list" ? "grid" : "list" );

  const onChange = ( key: string ) => ({ value }: any ) => setSortOptions(( data: PaginationState ) => ({ ...data, [key]: value }));

  const applyFieldChange = () => {
    setQueryOptions({
      ...sortOptions,
      ...isDateRangeFilterEnabled
        ? {
          from_time: convertToUTCTime( selectedStartTime, "YYYY-MM-DDThh:mm:ss" ),
          to_time: convertToUTCTime( selectedEndTime, "YYYY-MM-DDThh:mm:ss" )
        }
        : {},
      offset: 1 });

    dispatch( setColumns({
      key: permPathKey,
      data: fields.filter(( item ) => item.FieldProps.selected || item.FieldProps.fixed ).map(( item ) => {
        return { label: item.FieldProps?.displayName ? t( item.FieldProps?.displayName ) : splitPascalCase( item.FieldName ),
          key: item.FieldName, isFixed: item.FieldProps.fixed };
      })
    }));

    if ( listStyle !== resourceDisplayStyle ) {
      toggleListStyle?.();
    }
  };

  useEffect(() => {
    const selectedFields = configurableFieldsState.map(( item ) => item.key );
    const unselectedFields = availableFields.filter(( item ) => !selectedFields.includes( item.FieldName ));

    setFields([ ...configurableFieldsState.map( field => {
      return { FieldName: field.key, FieldProps: { displayName: field.label, selected: true, fixed: field.isFixed } };
    }), ...unselectedFields.map(({ FieldName, FieldProps: { displayName } }: IDisplayField ) => {
      return { FieldName, FieldProps: { displayName, selected: false, fixed: false } };
    }) ]);

  }, [ availableFields, configurableFieldsState ]);

  const sanitizedSortBy = sortBy ? unCamelize( sortBy?.keyValue || sortBy ) : undefined;

  // Default value for Start Time - Creation Date of the resource or Amorphic Starting Date
  const selectedStartTime = sortOptions?.from_time ? new Date( sortOptions.from_time ) :
    ( queryOptions?.from_time ? new Date( queryOptions?.from_time ) : fromDateTime ?? initialFromDateTime );
  // Default value for End Time - Current Date
  const selectedEndTime = sortOptions?.to_time ? new Date( sortOptions.to_time ) :
    ( queryOptions?.to_time ? new Date( queryOptions?.to_time ) : new Date());

  return <>
    <Button onClick={toggleOptionsModalVisibility} variant="icon" title={t( "dataTable.filtersAndPreferences" )}>
      <ADPIcon size="xs" icon="filter" classes={clsx({ "text-amorphicBlue": hasQueryOptionsChanged })} />
    </Button>
    <Modal size="lg" onHide={ toggleOptionsModalVisibility} showModal={optionsModalOpen} classes={styles.optionsModal}>
      <Modal.Header classes={styles.header}>
        <h1>{t( "dataTable.filtersAndPreferences" )}</h1>
      </Modal.Header>
      <Modal.Body classes={styles.body}>
        <div className={styles.sectionsContainer}>
          <PerfectScroll className={styles.leftColumn}>
            {/* Section hidden from users as part of listStyle deprecation: @susheel Feb 27, 2024  */}
            {/* <section className="hidden">
              <div>
                <h2 className={styles.heading}>{t( "dataTable.layout" )}</h2>
                <sub className={styles.description}>{t( "dataTable.layoutDescription" )}</sub>
                <hr className="border-secondary-200 my-2" />
              </div>
              <ResourcesDisplaySwitch
                display={true}
                currentStyle={resourceDisplayStyle}
                onClick={toggleResourceDisplayStyle}
              />
            </section> */}
            {isSortable
              ? <section>
                <div>
                  <h2 className={styles.heading}>{t( "dataTable.sortOptions" )}</h2>
                  <sub className={styles.description}>{t( "dataTable.sortOptionsDescription" )}</sub>
                </div>
                <PerfectScroll className="grid grid-cols-1 md:grid-cols-2 gap-8 h-fit py-2">
                  <div className="col-span-full">
                    <Select
                      onChange={onChange( "sortBy" )}
                      options={Object.values( sortableFields )?.map(( item ) => {
                        return typeof item === "string"
                          ? { label: item, value: item, key: item }
                          : { label: t( item.keyDisplayName ), value: item.keyValue, key: item.keyValue };
                      })}
                      defaultValue={sortBy ? {
                        label: unCamelize( sanitizedSortBy ), value: sanitizedSortBy
                      } : undefined}
                      floatingLabel={t( "dataTable.sortBy" )}
                      menuPortalTarget={document.body}
                    />
                  </div>
                  <Select
                    floatingLabel={t( "dataTable.sortOrder" )}
                    onChange={onChange( "sortOrder" )}
                    defaultValue={sortOrder ? { label: unCamelize( `${sortOrder}ending` ), value: sortOrder } : undefined}
                    options={SortOrderType.map(
                      ( value ) => ({ label: unCamelize( `${value}ending` ), value })
                    )}
                    menuPortalTarget={document.body}
                  />
                  <Select
                    onChange={onChange( "limit" )}
                    defaultValue={limit ? { label: `${limit}`, value: `${limit}` } : undefined}
                    floatingLabel={t( "dataTable.fetchResultsPerPage" )}
                    options={ResultsPerPageType.map( l => ({ label: `${l}`, value: `${l}` }))}
                    menuPortalTarget={document.body}
                  />
                </PerfectScroll>
              </section>
              : <></> }
            { isDateRangeFilterEnabled
              ? <section>
                <div>
                  <h2 className={styles.heading}>{t( "dataTable.dateRangeFilters" )}</h2>
                  <sub className={styles.description}>{t( "dataTable.dateRangeFiltersDescription" )}</sub>
                </div>
                <PerfectScroll className="grid grid-cols-1 md:grid-cols-2 gap-8 h-fit py-2">
                  <Datepicker
                    autoFocus
                    classes={styles.datepicker}
                    dateFormat="yyyy/MM/dd HH:mm:ss"
                    label={ t( "dataTable.fromDate" ) }
                    minDate={fromDateTime}
                    maxDate={selectedEndTime ?? new Date()}
                    selected={selectedStartTime}
                    showTimeSelect
                    showYearDropdown
                    portalId={"root-dp"}
                    onChange={value => onChange( "from_time" )({ value })}
                  />
                  <Datepicker
                    autoFocus
                    dateFormat="yyyy/MM/dd HH:mm:ss"
                    label={ t( "dataTable.toDate" ) }
                    minDate={selectedStartTime ?? fromDateTime}
                    maxDate={new Date()}
                    selected={selectedEndTime}
                    showTimeSelect
                    showYearDropdown
                    portalId={"root-dp"}
                    onChange={value => onChange( "to_time" )({ value })}
                  />
                </PerfectScroll>
              </section>
              : <></> }
            { customAdvancedFilters && Object.keys( customAdvancedFilters ).length
              ? <section>
                <div>
                  <h2 className={styles.heading}>{customAdvancedFilters?.sectionName}</h2>
                  <sub className={styles.description}>{customAdvancedFilters?.sectionDescription || "-"}</sub>
                </div>
                <PerfectScroll className="max-h-[25vh] space-y-8 pt-2">
                  {customAdvancedFilters?.component}
                </PerfectScroll>
              </section>
              : <></>
            }
            { ( !isSortable && !isDateRangeFilterEnabled && !customAdvancedFilters ) && <div
              className={styles.noOptionsAvailableContainer}
            >
              <ADPIcon icon="executions" size="xl" />
              <div>{t( "common.messages.noOptionsAvailable" )}</div>
            </div> }
          </PerfectScroll>
          <PerfectScroll component="section" className={styles.rightColumn}>
            <div>
              <h2 className={styles.heading}>{t( "dataTable.columnPreferences" )}</h2>
              <sub className={styles.description}>{t( "dataTable.columnPreferencesDescription" )}</sub>
            </div>
            <ColumnPreferences fields={fields} setFields={setFields} />
          </PerfectScroll>
        </div>
        <div className={styles.btnContainer}>
          <Button
            size="sm"
            classes={styles.btn}
            variant="stroked"
            onClick={() => {
              customAdvancedFilters?.resetAdvancedFilters();
              setQueryOptions({ offset: 1, from_time: undefined, to_time: undefined });
              toggleOptionsModalVisibility();
            } }
          >
            {t( "common.button.cancel" )}
          </Button>
          <Button
            size="sm"
            classes={styles.btn}
            onClick={() => {
              customAdvancedFilters?.setAdvancedFilters();
              applyFieldChange();
              toggleOptionsModalVisibility();
            }}
          >
            {t( "common.button.apply" )}
          </Button>
        </div>
      </Modal.Body>
    </Modal>
  </>;
};

export default memo( OptionsModal );