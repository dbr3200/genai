// libraries
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ADPIcon,
  Button,
  EmptyState,
  SearchBar,
  SkeletonBlock
} from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PerfectScrollbar from "react-perfect-scrollbar";
import debounce from "lodash.debounce";

// components
import Paginator from "../paginator";
import Table from "./dataTable";
import Grid from "./dataGrid";
import OptionsModal from "./optionsModal";
import { OverflowEllipse } from "../../../utils/renderUtils";

// methods / hooks / constants / styles
import { useAppDispatch, useAppSelector, useListSwitch, usePermanentPaths } from "../../../utils/hooks";
import { IDisplayField, PaginationState, SortableFields } from "../../../types";
import { convertToLocalTime, findKeyInObject, splitPascalCase } from "../../../utils";
import { setPagination } from "../../../modules/pagination";
import { setColumns } from "../../../modules/configurableFields";
import styles from "./dataTable.module.scss";

type DataIdentifiers = {
  /**
   * Identifier to fetch route from permanent paths
   */
  permPathKey: string;
  /**
   * List of resource props to perform search on
   */
  searchKeys: string[];
  /**
   * Unique identifier of each resource in the list
   */
  id: string;
  /**
   * Name prop identifier of the resource
   */
  name: string;
  /**
   * Current selection identifier of the resource
   */
  currentSelection?: string;
};

type CustomAdvancedFilters = {
  sectionName: string,
  sectionDescription?: string,
  component: React.ReactNode,
  resetAdvancedFilters: () => void;
  setAdvancedFilters: () => void;
};

export interface DataTableProps {
  /**
   * The key value pairs to identify/search different props of given data
   */
  dataIdentifiers: DataIdentifiers;
  /**
   * Method to refetch data
   */
  reloadData?: () => void;
  /**
   * Additional CTAs to be displayed
   */
  additionalCTAs?: React.ReactNode;
  /**
   * Prop to control compact list display and details display
   */
  compactTable: boolean;
  /**
   * State of the query fetching
   */
  loading: boolean;
  /**
   * List of resources to iterate on
   */
  resourcesList: any[];
  /**
   * Custom JSX element to replace in display instead of string values
   */
  customFields: Record<string, any>;
  /**
   * Props to control the search debounceTime
   */
  debounceTime?: number;
  /**
   * Available field to be displayed in the table
   */
  availableFields: IDisplayField[];
  /**
   * Fields by which the table can be sorted
   */
  sortableFields?: SortableFields;
  /** Hides the Options Modal and the options CTA */
  hideOptionsModal?: boolean;
  /** The default pagination state for the Datatable */
  defaultPaginationState?: PaginationState;
  /** Hides Pagination */
  hidePagination?: boolean;
  /** Hides Searchbar Header */
  hideSearchHeader?: boolean;
   /** Display Sorting */
  isSortable? : boolean
   /**
    * Flag to show/hide options
    * * @default false
    */
  hideOptionsField? : boolean
  /** Custom Advanced Filter Sort Tab Component */
  customAdvancedFilters?: CustomAdvancedFilters;
  /**
   * Total number of records
   */
  totalCount?: number;
  /** Custom Date Range Filter Tab */
  enableDateRangeFilter? : boolean;
  /** Start datetime for the date range filter */
  fromDateTime?: Date;
  /**
   * Compact Table List to be sticky or not
   * @default true
  */
  isCompactListSticky? : boolean;
  showAdvancedSearchModal?: () => void;
}

type DefaultImageVariant = React.ComponentProps<typeof EmptyState>["defaultImageVariant"];

export const DataTable = ({
  dataIdentifiers,
  compactTable,
  reloadData,
  additionalCTAs,
  loading,
  resourcesList,
  customFields,
  debounceTime = 500,
  availableFields,
  sortableFields = {},
  hideOptionsModal,
  defaultPaginationState,
  hidePagination,
  hideSearchHeader,
  isSortable = true,
  hideOptionsField = false,
  customAdvancedFilters,
  totalCount = 0,
  enableDateRangeFilter = false,
  fromDateTime,
  isCompactListSticky = true,
  showAdvancedSearchModal
}: DataTableProps ): JSX.Element => {

  const [ listStyle, toggleListStyle ] = useListSwitch();
  const { t } = useTranslation();
  const permanentPaths = usePermanentPaths();
  const dispatch = useAppDispatch();
  const currentPaginationState = useAppSelector(({ pagination }) => pagination?.[dataIdentifiers.permPathKey] ?? defaultPaginationState );
  const [ optionsModalOpen, setOptionsModalOpen ] = useState<boolean>( false );
  const [ collapseCompactView, setCollapseCompactView ] = useState<boolean>( false );
  const [ filter, setFilter ] = useState<string>( "" );
  const [ filteredData, setFilteredData ] = useState<any[]>( resourcesList );
  const toggleOptionsModalVisibility = () => setOptionsModalOpen(( prevState ) => !prevState );

  const defaultDisplayFields = availableFields.filter( f => f?.FieldProps?.defaultDisplay === true ).map(( item:any ) => (
    { label: item.FieldProps?.displayName ? t( item.FieldProps?.displayName ) :
      splitPascalCase( item.FieldName ), key: item.FieldName, isFixed: item.FieldProps?.fixed }
  ));
  const { offset, limit, from_time, to_time } = currentPaginationState || {};
  const fieldsState = useAppSelector(( state ) => state.configurableFields?.[dataIdentifiers.permPathKey] ?? []);
  const fields = ( fieldsState?.length > 0
    ? fieldsState
    : defaultDisplayFields ).concat( !hideOptionsField
    ? [{ label: t( "common.words.options" ), key: "options", isFixed: true }]
    : []
  );

  const pageCount = Math.ceil( totalCount / limit );
  // selected page starts from 0
  const selectedPage = limit > 1 ? Math.floor( offset / limit ) : offset - 1;
  const hasQueryOptionsChanged = useMemo(() => {
    type KeyType = keyof PaginationState;

    return currentPaginationState && Object.entries( currentPaginationState ).some(([ key, value ]) => defaultPaginationState?.[key as KeyType] !== value );
  }, [ defaultPaginationState, currentPaginationState ]);

  const RenderOptionsCTA = () => hideOptionsModal
    ? null
    : <OptionsModal
      queryOptions={currentPaginationState}
      setQueryOptions={( data: Partial<PaginationState> ) => dispatch( setPagination({
        key: dataIdentifiers?.permPathKey,
        data: { ...currentPaginationState, ...data }
      }))}
      availableFields={availableFields}
      sortableFields={sortableFields}
      permPathKey={dataIdentifiers.permPathKey}
      isSortable={isSortable}
      customAdvancedFilters={customAdvancedFilters}
      isDateRangeFilterEnabled={enableDateRangeFilter}
      fromDateTime={fromDateTime}
      hasQueryOptionsChanged={hasQueryOptionsChanged}
      optionsModalOpen={optionsModalOpen}
      toggleOptionsModalVisibility={toggleOptionsModalVisibility}
      {...compactTable ? {} : { listStyle, toggleListStyle }}
    />;

  const RenderSearchBar = () => typeof showAdvancedSearchModal === "undefined"
    ? <SearchBar
      value={filter}
      autoFocus
      placeholder={t( "dataTable.filter" )}
      onChange={updateSearchValue}
      classes={styles.searchBar} />
    : <button onClick={showAdvancedSearchModal} className={styles.advancedSearchButton}>
      <ADPIcon size="xs" icon="search" />
      <span className="text-secondary-300">{t( "common.button.search" )}</span>
    </button>;

  const PaginationInfo = ({ classes } : {classes?: string}) => hidePagination || filteredData.length === 0
    ? null
    : <div className={ clsx( styles.paginationInfo, classes, ( loading ) && "hidden" )}>
      <div className={clsx( styles.resourceCountContainer )}>
        <span className="text-amorphicBlue">
          {`Showing ${offset} - ${offset + filteredData.length - 1} of ${totalCount} record(s)`}
        </span>
        <span>
          { enableDateRangeFilter && from_time && to_time
            ? ` from ${convertToLocalTime( from_time )} to ${convertToLocalTime( to_time )}` : "" }
        </span>
      </div>
      {( totalCount > limit ) && <Paginator
        loading={loading}
        selected={selectedPage}
        pageCount={pageCount}
        onPageChange={pageChange}
      />}</div>;

  const RefreshCTA = () => typeof reloadData === "function"
    ? <Button onClick={refetchData} variant="icon" classes={styles.button}
      title={t( "common.button.reload" )}>
      <ADPIcon size="xs" icon="sync" spin={loading} classes="w-auto" />
    </Button>
    : null;

  const refetchData = useCallback(() => {
    if ( reloadData ) {
      reloadData();
      setFilter( "" );
      setFilteredData( resourcesList );
    }
  }, [ reloadData, resourcesList ]);

  const filterList = debounce(( value: string ) => {
    if ( resourcesList?.length > 0 && dataIdentifiers.searchKeys?.length > 0 ){
      const data = resourcesList.filter(( dataItem ) =>
        dataIdentifiers.searchKeys.some( key => {
          return ( findKeyInObject( dataItem, key ))?.match( new RegExp( value ?? "", "gi" ));
        })
      );
      setFilteredData( data );
    }
  }, debounceTime );

  const updateSearchValue = ( event: React.FormEvent<HTMLInputElement> ) => {
    const { value } = event.currentTarget;
    setFilter( value ?? "" );
    filterList( value );
  };

  const pageChange = ({ selected = 0 }) => {
    dispatch( setPagination({
      key: dataIdentifiers?.permPathKey,
      data: { ...currentPaginationState, offset: Math.ceil( selected * limit ) + 1 }
    }));
  };

  // If the ConfigurableFields slice does not have any fields set for the current permPathKey then we need to set the default fields
  useEffect(() => {
    if ( fieldsState?.length === 0 ) {
      dispatch( setColumns({
        key: dataIdentifiers.permPathKey,
        data: defaultDisplayFields
      }));
    }
  }, [ dataIdentifiers.permPathKey, dispatch, fieldsState?.length, defaultDisplayFields ]);

  // Whenever the resourcesList changes, we need to reset the filteredData
  useEffect(() => {
    if ( resourcesList ) {
      setFilteredData( resourcesList );
      setFilter( "" );
    }
  }, [resourcesList]);

  return compactTable
    ? <div className={clsx( styles.compactListContainer, collapseCompactView && styles.collapsed )}>
      <div className={clsx( styles.compactList, collapseCompactView && styles.collapsedCompactView, isCompactListSticky && styles.stickyContainer )}>
        {!hideSearchHeader && <div className={styles.header}>
          <RenderSearchBar />
          <RenderOptionsCTA />
          <RefreshCTA />
          { typeof additionalCTAs !== "undefined" && additionalCTAs }
        </div>}
        <div className={styles.list}>
          { loading
            ? <PerfectScrollbar className={clsx( styles.scroll, "px-4" )}>
              <SkeletonBlock variant="lines" count={Number( limit ) || 12} />
            </PerfectScrollbar>
            : ( filteredData.length === 0
              ? <EmptyState classes={"w-full"} defaultImageVariant={"adjust-preferences" as DefaultImageVariant}>
                <EmptyState.Content>{t( "common.messages.noRecordsFound" )}</EmptyState.Content>
              </EmptyState>
              : <PerfectScrollbar className={styles.scroll}>
                {filteredData.map(( item ) => (
                  <Link key={item?.[dataIdentifiers.id]}
                    to={`${permanentPaths?.[dataIdentifiers.permPathKey]?.path}/${item?.[dataIdentifiers.id]}/details`}
                    className={clsx(
                      styles.listItem,
                      { [styles.active]: item?.[dataIdentifiers.id] === dataIdentifiers.currentSelection }
                    )}
                  >
                    <OverflowEllipse text={ findKeyInObject( item, dataIdentifiers.name ) ?? ""} length={23} />
                    <ADPIcon size="xxs" icon={"right-arrow"} classes="rtl:rotate-180" />
                  </Link>
                ))}
              </PerfectScrollbar> )
          }
          <div className={clsx( "px-2 py-4", collapseCompactView && styles.collapsedPagination )}>
            {!hidePagination && !filter && ( totalCount > limit ) && !loading &&
            <Paginator
              loading={loading}
              selected={selectedPage}
              pageCount={pageCount}
              onPageChange={pageChange}
            />}
          </div>
        </div>
      </div>
      {compactTable &&
          <Button size="md" type="button" classes={clsx( styles.toggleCollapseBtn, collapseCompactView && styles.collapsedBtn )} variant="icon" icon={
            <ADPIcon classes={styles.icon}
              icon="left-arrow" size="xs" />} title={collapseCompactView ? t( "dataTable.expandList" ) : t( "dataTable.collapseList" )}
          onClick={() => setCollapseCompactView( state => !state )} />
      }
    </div>
    : <div className={styles.listContainer}>
      {!hideSearchHeader && <div className={styles.header}>
        <RenderSearchBar />
        <RenderOptionsCTA />
        <RefreshCTA />
        { typeof additionalCTAs !== "undefined" && additionalCTAs }
      </div>}
      <PaginationInfo />
      { ( !loading && filteredData.length === 0 )
        ? <EmptyState>
          <EmptyState.Content>{t( "common.messages.noRecordsFound" )}</EmptyState.Content>
        </EmptyState>
        : <PerfectScrollbar className={clsx( styles.list, hidePagination && "pb-4" )}>
          {listStyle === "list" ?
            <Table {...{ fields, customFields, loading, resourcesList: filteredData, limit }}/>
            : <Grid {...{ fields, customFields, loading, resourcesList: filteredData, limit }}/>
          }
        </PerfectScrollbar> }
      <PaginationInfo classes="pb-4" />
    </div>;
};
