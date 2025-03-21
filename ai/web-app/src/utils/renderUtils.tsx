// libraries
import React, { useState, lazy, ComponentType } from "react";
import { ADPIcon, Tooltip, Button, Label, Status, TextCopy } from "@amorphic/amorphic-ui-core";
import clsx from "clsx";
import PerfectScrollBar from "react-perfect-scrollbar";

// methods / hooks / constants / styles
import { LabelVariant, Option, Options, StatusVariants, IconOption } from "../types";
import { FieldErrorsImpl } from "react-hook-form";
import { getObjValue } from ".";

export const LabelWithTooltip = ({ label, tooltip, required = false, classes, renderOutSidePortal = false, size = "md", tooltipId }:
  {
    label: string, tooltip: string | JSX.Element, required?: boolean, classes?: string, renderOutSidePortal?: boolean,
    size?: "md" | "sm" | "lg", tooltipId?: string
  }): JSX.Element => <>
  <span className={clsx({ "requiredField": required }, "me-1 dark:text-platinum inline-flex items-center gap-1" )}>{label}
    <Tooltip tabIndex={tooltipId ? -1 : 0} renderOutSidePortal={renderOutSidePortal} size={size} trigger={<ADPIcon icon="info" size="xxs" classes={classes} />}>
      {tooltip}
    </Tooltip>
  </span>
  {Boolean( tooltipId ) && <div role="tooltip" id={tooltipId} className="sr-only">{tooltip}</div>}
</>;

interface HelperTooltipProps {
  /**
   * The helper text to display as a tooltip component
   */
  tooltip: string | JSX.Element;
  /**
   * Custom class name to apply for the tooltip component
   */
  classes?: string;
  /**
   * Target element to attach the tooltip to
   */
  placement?: Pick<React.ComponentProps<typeof Tooltip>, "placement">["placement"];
  children: React.ReactNode;
}

export const HelperTooltip = ({
  tooltip,
  classes,
  placement = "right",
  children,
  ...props
}: HelperTooltipProps ): React.ReactElement => {
  return <Tooltip trigger={<>{children}</>} size="sm" classes={clsx( classes )} {...props} placement={placement}>
    {typeof tooltip === "string"
      ? <span dangerouslySetInnerHTML={{ __html: tooltip }} />
      : tooltip
    }
  </Tooltip>;
};

type SelectedValues = string[] | string | boolean;

export const getSelectedOptions = ( selectedValues: SelectedValues, options: Options | IconOption, multiSelect = false, groupedOptions = false ): any => {

  let filteredOptions = [];

  if ( groupedOptions ) {
    filteredOptions = ( options as { label: string, options: Option[] | IconOption }[])?.map( group => {
      return group?.["options"]?.filter(( option:any ) => {
        if ( Array.isArray( selectedValues )) {
          return selectedValues.includes( option.value as any );
        } else if ( option.value === selectedValues ) {
          return true;
        }
      });
    }).flat();
  } else {
    filteredOptions = ( options as Option[] | IconOption ).filter(( option:any ) => {
      if ( Array.isArray( selectedValues )) {
        return selectedValues.includes( option.value as any );
      } else if ( option.value === selectedValues ) {
        return true;
      }
    });
  }

  return multiSelect ? filteredOptions : filteredOptions[0];
};

interface INonEmptyOrFallback {
  data: any[] | undefined;
  fallback?: React.ReactChild;
  children: React.ReactNode;
}

export const FallbackIfEmpty = ({ data, fallback, children }: INonEmptyOrFallback ): React.ReactElement => {
  if ( data && Array.isArray( data ) && data?.length > 0 ) {
    return <>{children}</>;
  } else {
    return <>{fallback ?? "-"}</>;
  }
};

interface IGetStringOrDefault {
  value: string | undefined;
  defaultValue?: string;
}

export const getStringOrDefault = ( props: IGetStringOrDefault ): string => {
  return props?.value || ( props?.defaultValue ?? "" );
};

interface IGetBooleanOrDefault {
  value: boolean | string | undefined;
  trueString?: string;
  falseString?: string;
}

export const getBooleanOrDefault = ( props: IGetBooleanOrDefault ): string => {
  if ( typeof props.value === "string" ) {
    return ( props?.value.localeCompare( "yes", undefined, { sensitivity: "base" }) === 0
      ? props?.trueString
      : props?.falseString
    ) || "";
  }
  return ( props.value === true ? props?.trueString : props?.falseString ) || "";
};

export const getBoolean = ( props: IGetBooleanOrDefault ): boolean => {
  if ( typeof props.value === "string" ) {
    return ( props?.value.localeCompare( "yes", undefined, { sensitivity: "base" }) === 0 );
  }
  return props.value === true;
};

export const domainGroupedDatasets = ( datasets: Record<string, any>[]) => {

  const sortedDomains = [...new Set( datasets.map( dataset => dataset.Domain ))].sort();
  return sortedDomains.reduce(( accumulator: any, domain: string ) => {
    return [ ...accumulator, {
      label: `Domain: ${domain}`,
      options: datasets.filter(( ds: any ) =>
        ds.Domain === domain ).sort(( a: any, b: any ) => a?.["DatasetName"]?.localeCompare( b?.["DatasetName"], "en", { sensitivity: "base" }))
        .map(( ds: any ) => {
          const dsObj = {
            value: ds?.["DatasetId"],
            label: `${domain}: ${ds?.["DatasetName"]}`
          };
          return dsObj;
        })
    }];
  }, []);
};

export const getKeyName = ( key: string ): string => {
  if ( key && typeof key === "string" && key.length > 0 ) {
    return key?.split( /(?=[A-Z])/ )?.join( " " );
  } else {
    return key;
  }
};

export const tagFormatter = ( tags: string[] = []): string => {
  if ( tags.length > 0 ) {
    return Array.isArray( tags ) ? tags.map(( tag ) => (
      `<span class='badge space-well badge-dark'>${tag}</span>`
    )).join( " " ) : tags;
  } else {
    return "<span class='badge space-well badge-dark'>None</span>";
  }
};

/**
 * Password Display Component to show or hide password.
 *
 * The value to be hidden/displayed.
 * @param passwordValue
 */
export const PasswordDisplay = ( passwordValue: any ): React.ReactElement => {
  const [ showPasswordValue, setShowPasswordValue ] = useState( false );
  return (
    <>
      <div className="flex items-center h-6">
        <p>
          {showPasswordValue ? String( passwordValue )?.trim() === "" ? "-"
            : String( passwordValue?.value ) : "*".repeat( passwordValue?.value?.length )}</p>
        <div className={clsx( String( passwordValue?.value || "" )?.trim() === "" && "hidden" )}>
          <Button variant="icon" onClick={() => setShowPasswordValue( !showPasswordValue )}>
            <ADPIcon size="xs" icon={showPasswordValue ? "hide-password" : "show-password"} />
          </Button>
        </div>
      </div>
    </>
  );
};

/**
 * Lazy Retry Function to be used for chunk errors occured due to lazy loading components.
 *
 * Takes the following params
 * @param component - The component that is to be lazy loaded
 * @param retriesLeft - The number of times the component needs to try reloading if there's an error with the chunk loading
 * @param interval - Duration during which it checks for the component is loaded or not (in ms)
 */

type ComponentPromise<T = any> = Promise<{ default: ComponentType<T> }>;

const retry = (
  fn: () => ComponentPromise,
  retriesLeft = 2,
  interval = 1000
): ComponentPromise => {
  return new Promise(( resolve, reject ) => {
    fn()
      .then( resolve )
      .catch(( error ) => {
        setTimeout(() => {
          if ( retriesLeft === 1 ) {
            reject( error );
            return;
          }
          retry( fn, retriesLeft - 1, interval ).then( resolve, reject );
        }, interval );
      });
  });
};

export const lazyRetry = (
  component: () => ComponentPromise,
  retries?: number,
  interval?: number
): React.LazyExoticComponent<React.ComponentType<any>> => {
  return lazy(() => retry( component, retries, interval ));
};

/**
 * Method to standardize the status to lowercase with spaces replaced by underscores.
 * @param status - status of the resource
 * @returns standardized status
 * @example
 * standardizeStatus("In Progress") // in_progress
 * standardizeStatus("COMPLETED") // completed
 * standardizeStatus("someStatus") // somestatus
 */
export const standardizeStatus = ( status: string ): string => {
  return status?.toLowerCase()?.replace( /[^A-Z0-9]+/ig, "_" );
};

/**
 * Method to determine the relevant props for the Status and Label components based on status
 * @param status - status of the resource
 * @param fallback - fallback status to use if no match is found
 * @returns statusVariant, labelVariant, spin
 * @example
 * propsByStatus("in_progress") // { statusVariant: "sync", labelVariant: "text-amber", spin: true }
 * propsByStatus("completed") // { statusVariant: "check-circle", labelVariant: "text-aquamarine" }
 * propsByStatus("someStatus", "info") // { statusVariant: "info-circle", labelVariant: "text-blue" }
 */

export const propsByStatus = ( status: string, fallback = "info" ): {
  statusVariant: StatusVariants, labelVariant: LabelVariant, spin?: boolean
} => {
  const statuses: any = {
    ...[ "completed", "success", "succeeded", "complete", "update_success",
      "active", "approve", "approved", "published",
      "enable", "enabled", "available", "green", "create", "finished",
      "create_complete", "update_complete", "delete_complete",
      "update_rollback_complete", "rollback_complete", "inservice", "yes"
    ].reduce(( a, c ) =>
      ({ [c]: { statusVariant: "icon-success", labelVariant: "success" }, ...a }),
    {}
    ),
    ...[ "processing", "running", "starting", "syncing", "creating", "modifying",
      "updating", "in_progress", "loading", "reloading",
      "create_in_progress", "update_in_progress", "delete_in_progress",
      "retrying", "restarting", "rebooting", "reboot_in_progress",
      "extracting_schema", "extracting_schema_in_progress",
      "system_updating", "registration_running", "task_preparation_running",
      "provisioning"
    ].reduce(( a, c ) =>
      ({ [c]: { statusVariant: "icon-loading-primary", labelVariant: "info", spin: true }, ...a }),
    {}
    ),
    ...[ "stopping", "deleting", "delete_in_progress", "waiting", "update" ].reduce(( a, c ) =>
      ({ [c]: { statusVariant: "icon-loading-secondary", labelVariant: "info", spin: true }, ...a }),
    {}
    ),
    ...[ "pending", "not_started", "timeout", "schema_error", "not_published",
      "registration_failed", "invalid", "empty", "none", "undefined",
      "delete_pending", "create_pending", "update_pending",
      "completed_with_failed_nodes", "no", "running_with_errors", "no_schema",
      "inactive", "unverified", "unknown"
    ].reduce(( a, c ) =>
      ({ [c]: { statusVariant: "icon-warning", labelVariant: "warning" }, ...a }),
    {}
    ),
    ...[ "failed", "error", "stopped", "expired",
      "cancelled", "deleted", "disabled", "unavailable",
      "not_found", "missing", "not_available"
    ].reduce(( a, c ) =>
      ({ [c]: { statusVariant: "icon-disable", labelVariant: "info" }, ...a }),
    {}
    ),
    ...["paused"].reduce(( a, c ) =>
      ({ [c]: { statusVariant: "icon-pause", labelVariant: "warning" }, ...a }),
    {}
    ),
    ...[ "default", "skipped", "completed_with_errors", "failure",
      "create_failed", "update_failed", "delete_failed", "task_preparation_failed",
      "create_skipped", "update_skipped", "delete_skipped", "completed_with_failures", "no"
    ].reduce(( a, c ) =>
      ({ [c]: { statusVariant: "icon-minus-circle", labelVariant: "error" }, ...a }),
    {}
    ),
    "info": { statusVariant: "icon-info", labelVariant: "info" },
    "ready": { statusVariant: "icon-minus-circle", labelVariant: "warning" }
  };

  return statuses?.[standardizeStatus( status )] ?? statuses?.[standardizeStatus( fallback )] ?? statuses["info"];
};

interface ILabelByStatusProps extends Omit<React.ComponentProps<typeof Label>, "variant"> {
  status: string;
  fallbackVariant?: LabelVariant;
}

/**
 * Method to determine the relevant Label component variant by using the status
 * @param status - status of the resource
 * @param fallback - fallback variant to use if no match is found
 * @returns Variant {@link LabelVariant}
 * @example
 * LabelByStatus("in_progress") // Label of "info" variant
 * LabelByStatus("completed") // Label of "success" variant
 * LabelByStatus("someStatus", "info") // Label of "info" variant
 */

export const LabelByStatus = ({ status, fallbackVariant,
  ...restProps }: ILabelByStatusProps ): JSX.Element => {
  const { labelVariant } = propsByStatus( status );
  return <Label {...restProps} variant={labelVariant ?? fallbackVariant} />;
};

interface IGenericStatusProps {
  status: string;
  fallback?: string;
  tooltip?: React.ReactNode;
  statusProps?: Omit<React.ComponentProps<typeof Status>, "variant">;
  tooltipOptions?: Omit<React.ComponentProps<typeof Tooltip>, "children" | "trigger">;
}

/**
 * Method to provide icon with tooltip based on status
 * @param status - status of the resource
 * @param fallback - fallback status to use if no match is found
 * @param tooltip - tooltip to be shown on hover
 * @returns ADPIcon with tooltip
 */
export const GenericStatus = ({
  status, fallback, tooltip, statusProps, tooltipOptions
}: IGenericStatusProps ): React.ReactElement => {
  const { statusVariant, spin } = propsByStatus( status, fallback );
  const Icon = <Status filled size="xs" classes={clsx({ "cursor-default": tooltip })}
    {...statusProps} variant={statusVariant} spin={spin} />;
  return tooltip ? <Tooltip trigger={Icon} clickable={false} {...tooltipOptions}>
    {tooltip}
  </Tooltip> : Icon;
};

interface TruncateStringProps {
  str: string;
  length?: number;
  postfix?: string;
  copyString?:boolean;
}

/**
 * Method to provide icon with tooltip based on status
 * @param str - String/Text to be truncated
 * @param length - length to truncate to (optional)
 * @param postfix - ending to add to truncated string (optional)
 * @param copyString - Add an option to copy the text if required (optional)
 * @returns ADPIcon with tooltip
 */
export const TruncateString = ({
  str, length = 8, postfix = "...", copyString = false
}: TruncateStringProps ): React.ReactElement => {

  const [ show, setShow ] = React.useState( false );
  if ( !str ) {
    return ( <>{"-"}</> );
  }

  return (
    <> {str.length > length ?
      show ?
        <PerfectScrollBar component="div" className="flex flex-col">
          <p className="hover:cursor-pointer" onClick={() => setShow( !show )}>
            {str}
          </p>
          <TextCopy classes="z-[9999]" text={str}>
            {" "}
          </TextCopy>
        </PerfectScrollBar> : <>
          {copyString ?
            <><p className="hover:cursor-pointer" onClick={() => setShow( !show )}>
              {str?.substring( 0, length )}
              {postfix}
            </p><TextCopy classes="z-[9999]" text={str}>
              {" "}
            </TextCopy></>
            :
            <p className="hover:cursor-pointer" onClick={() => setShow( !show )}>
              {str?.substring( 0, length )}
              { postfix }
            </p>
          }</> : str}
    </> );
};

type OverflowEllipseProps = {
  text: string;
  length: number;
  clipFromEnd?: boolean;
}

/**
 * Method to show a substring of a string with an ellipsis and a tooltip
 * @param text - String/Text to be truncated
 * @param length - The length after which the string should be truncated
 * @param clipFromEnd - Whether to clip the string from the end or from the beginning (optional)
 * @returns ADPIcon with tooltip
 * @example
 * <OverflowEllipse text="Hello World" length={5} - The length after which the string should be truncated
 **/
export const OverflowEllipse = ({ text, length, clipFromEnd = false }: OverflowEllipseProps ): JSX.Element => {
  if ( text?.length < length ) {
    return <>{text}</>;
  }
  return <Tooltip trigger={<span className="text-jetGray dark:text-platinum">{`${clipFromEnd
    ? text?.slice( -Math.abs( length )) : text?.substring( 0, length ) }...`}</span>}>{text}</Tooltip>;
};

export const renderError = ( errors: Partial<FieldErrorsImpl<{ [x: string]: any }>>,
  key: string ): JSX.Element | null => {
  const value = getObjValue( errors, key );
  return value?.message ? <p className="text-xs text-salsa mt-2">{value?.message}</p> : null;
};

