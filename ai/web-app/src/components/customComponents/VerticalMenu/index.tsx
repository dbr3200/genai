import React, { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { SkeletonBlock, EmptyState, ADPIcon, Select, ReloadableSelect, Button, SearchBar } from "@amorphic/amorphic-ui-core";
import PerfectScrollbar from "react-perfect-scrollbar";
import { useTranslation } from "react-i18next";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList as List } from "react-window";

import styles from "./styles.module.scss";
import { Option } from "../../../types";

type DefaultImageVariant = React.ComponentProps<typeof EmptyState>["defaultImageVariant"];

interface VerticalMenuProps {
  options: Option[];
  onSelect: ( option: Option ) => void;
  loading?: boolean;
  defaultValue?: Option;
  isDisabled?:boolean;
  value?: Option;
  searchbarPlaceholder?: string;
  showHeader?: boolean;
  hideFilter?: boolean;
  handleReload?: () => void;
  classes?: string;
  selectLabel?: string;
  /**
   * If true, the menu will be sticky to the top of the screen when scrolling
   * @default true
   */
  sticky?: boolean;
  /** Virtualize the list
   * @default false
   */
  virtualize?: boolean;
}

export const VerticalMenu = ({
  options = [],
  onSelect,
  loading = false,
  defaultValue,
  value,
  showHeader = false,
  hideFilter = false,
  handleReload,
  searchbarPlaceholder = undefined,
  classes,
  selectLabel,
  isDisabled,
  sticky = true,
  virtualize = false
}: VerticalMenuProps ): JSX.Element => {
  const { t } = useTranslation();
  const [ searchValue, setSearchValue ] = useState( "" );
  const [ selectedOption, setSelectedOption ] = useState<Option | undefined>();
  const [ filteredOptions, setFilteredOptions ] = useState( options );

  useEffect(() => {
    setFilteredOptions( searchValue ? options.filter(({ label }) =>
      ( label as string )?.match( new RegExp( searchValue ?? "", "gi" ))) : options );
  }, [ options, searchValue ]);

  useEffect(() => {
    if ( defaultValue && typeof selectedOption === "undefined" ) {
      setSelectedOption( defaultValue );
    }
  }, [ defaultValue, selectedOption ]);

  useEffect(() => {
    if ( typeof value?.value !== "undefined" ) {
      setSelectedOption( value );
    }
  }, [value]);

  const handleOnChange = useCallback(( option: Option | null ) => {
    if ( option ){
      setSelectedOption( option );
      onSelect( option );
    }
  }, [onSelect]);

  const isReloadable = typeof handleReload !== "undefined";

  const selectProps = {
    floatingLabel: selectLabel,
    value: value,
    options: filteredOptions,
    defaultValue: defaultValue,
    menuPortalTarget: document.body,
    isSearchable: true,
    inputValue: searchValue,
    isClearable: true,
    onChange: handleOnChange,
    onInputChange: setSearchValue
  };

  return <div className={clsx( classes, sticky ? styles.stickyCard : styles.card )}>
    {showHeader && <div className={styles.cardHeader}>
      <SearchBar
        value={searchValue}
        onChange={event => setSearchValue( event.currentTarget.value )}
        placeholder={searchbarPlaceholder}
        classes={clsx( "w-full text-base", { "invisible": hideFilter })}
      />
      { isReloadable &&
        <Button variant="icon" title={t( "common.button.reload" )} onClick={handleReload}>
          <ADPIcon spin={loading} icon="sync"/>
        </Button>}
    </div>}
    <PerfectScrollbar component="ul" className={clsx( styles.list, showHeader && styles.roundedTopNone )}>
      { loading
        ? <li className={styles.skeleton}>
          <SkeletonBlock variant="lines" count={5} />
        </li>
        : ( options.length === 0
          ? <EmptyState classes="w-full"
            defaultImageVariant={"zero-results" as DefaultImageVariant}>
            <EmptyState.Content>{t( "common.messages.noRecordsFound" )}</EmptyState.Content>
          </EmptyState>
          : virtualize
            ? <AutoSizer>
              {({ height, width }: { height: number, width: number }) => (
                <List
                  height={height ?? 200}
                  itemCount={filteredOptions?.length ?? 0}
                  itemSize={60}
                  width={width ?? 40}
                >
                  {({ index, style }) => {
                    const item = filteredOptions?.[index];

                    return (
                      <li
                        key={index}
                        style={style as any}
                        className={clsx(
                          styles.listItem,
                          { [styles.active]: item?.value === selectedOption?.value },
                          ( isDisabled || item.isDisabled ) && styles.listItemDisabled
                        )}
                        onClick={() => isDisabled ? null : !item.isDisabled && handleOnChange( item )}
                      >
                        <span>{item.label}</span>
                        <ADPIcon size="xxs" icon="right-arrow" classes="md:rtl:rotate-180" />
                      </li>
                    );
                  }}
                </List>
              )}
            </AutoSizer>
            : filteredOptions.map(( item: Option ) => (
              <li
                key={item?.value}
                className={clsx(
                  styles.listItem,
                  { [styles.active]: item?.value === selectedOption?.value },
                  ( isDisabled || item.isDisabled ) && styles.listItemDisabled
                )}
                onClick={() => isDisabled ? null : !item.isDisabled && handleOnChange( item )}
              >
                <span>{item.label}</span>
                <ADPIcon size="xxs" icon="right-arrow" classes="md:rtl:rotate-180" />
              </li>
            )))
      }
    </PerfectScrollbar>
    <div className={styles.selectContainer}>
      {isReloadable
        ? <ReloadableSelect
          {...selectProps}
          isReloading={loading}
          onReloadClick={handleReload} />
        : <Select {...selectProps} />}
    </div>
  </div>;
};
