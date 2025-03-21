// libraries
import React, { useMemo } from "react";
import {
  ADPIcon, Button, Divider,
  ReloadableSelect, SearchBar, Select, Skeleton, SkeletonBlock, Tooltip
} from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import clsx from "clsx";

// components

import { OwnersTable } from "./ownersTable";
import { ReadOnlyTable } from "./readOnlyTable";
import { LabelWithTooltip, renderError } from "../../../utils/renderUtils";

// methods / hooks / constants / styles

import { useGetCommonUsersQuery } from "../../../services/common";
import { useBooleanState, useSuccessNotification } from "../../../utils/hooks";
import { ComposeValidators, Validate_Required } from "../../../utils/formValidationUtils";
import { useGetAuthorizedUsersQuery, useUpdateAuthorizedUsersMutation } from "../../../services/authorizations";
import styles from "./authorised.module.scss";
import { Option } from "../../../types";

interface AuthorizationsProps {
  /**
   * The service name of the resource
   */
  serviceName: string;
  /**
   * Resource ID whose authorizations to be fetched
   */
  resourceId: string

}

export const Authorizations = ({
  serviceName,
  resourceId
}: AuthorizationsProps ): JSX.Element => {
  const { t } = useTranslation();
  const funtionTypeOptions: Option[] = React.useMemo(() => [
    { label: t( "authorization.owner" ), value: "owner" },
    { label: t( "Read Only" ), value: "read-only" }
  ], [t]);

  const { state: accessFormState, setTrue: showAccessForm, setFalse: hideAccessForm } = useBooleanState( false );

  const {
    data = {},
    isLoading: initFetching,
    isFetching: fetchingAuth,
    refetch: loadAuthUsers
  } = useGetAuthorizedUsersQuery(({ serviceName, resourceId }));

  const {
    data: {
      Users: allUsersList = []
    } = {}, isFetching: allUserIsFetching,
    refetch: loadUsers
  } = useGetCommonUsersQuery( undefined );

  const dropDownOptions = useMemo(() => {

    //User Dropdown Options Generation
    const userListOptions : Option[] = allUsersList?.slice()
      ?.sort(( a: any, b: any ) => a.UserId.toLowerCase().localeCompare( b.UserId.toLowerCase()))
      ?.map(( obj: any ) =>
        ({ value: obj.UserId, label: obj.UserId ? obj.UserId : obj.EmailId, type: "users" })
      );

    const currentUsersList: any[] = ( !fetchingAuth || !initFetching ) &&
    [ ...data?.Users?.owners, ...data?.Users?.readOnly ] || [];
    const currentUsersListLookup: Record<string, boolean> = {};
    currentUsersList?.forEach(( item ) => {
      currentUsersListLookup[item.UserId] = true;
    });

    const filteredUsersListOptions = userListOptions?.filter(( item: Option ) => !currentUsersListLookup[item.value]);

    return filteredUsersListOptions;
  }, [ data, fetchingAuth, initFetching, allUsersList ]);

  const [ updateAccess, { isLoading: isUsersUpdating }] = useUpdateAuthorizedUsersMutation();
  const [showSuccessNotification] = useSuccessNotification();

  const [ expanded, setExpanded ] = React.useState( false );
  const toggle = () => setExpanded( !expanded );

  const [ searchTerm, setSearchTerm ] = React.useState( "" );
  const onChange = React.useCallback(( searchString ) => setSearchTerm( searchString ), []);

  const { control, formState: { errors }, getValues, handleSubmit, reset } = useForm();

  const defaultValues: Record<string, any> = {
    accessType: { label: t( "authorization.owner" ), value: "owner" }
  };

  React.useEffect(() => {
    reset({ ...defaultValues });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  //Submit function which checks for either users
  const onSubmit = async () => {
    const { resource, accessType } = getValues();
    if ( !isUsersUpdating ) {

      const dataToSend = {
        AccessType: accessType?.value,
        Users: [
          ...data?.Users?.[`${accessType?.value}s`]
            ?.map(( item: any ) => item.UserId ) || [],
          resource?.value
        ]
      };
      try {
        const { Message } = await updateAccess({
          serviceName,
          resourceId,
          requestBody: dataToSend
        }).unwrap();
        showSuccessNotification({ content: Message });
        hideAccessForm();
        reset({ ...defaultValues });

        // eslint-disable-next-line no-empty
      } catch {}
    }

  };

  return ( <div>
    <div className={clsx( styles.authorizationFormContainer,
      {
        "h-12": !accessFormState,
        "h-36 md:h-28 lg:h-24": accessFormState
      }
    )}>
      {accessFormState === false ?
        <div className={clsx( styles.authorizationCardHeader )}>
          <div>
            <SearchBar
              // collapsable
              rightAlignment
              expanded={expanded}
              onChange={( event: React.ChangeEvent<HTMLInputElement> ) => onChange( event.target.value )}
              placeholder={t( "authorization.filterUsers" )}
              value={searchTerm}
              setExpanded={toggle}
              title={t( "authorization.filterUsers" )}
            />
          </div>
          <Tooltip
            trigger={ <Button
              size="md"
              aria-label={t( "common.button.refresh" )}
              onClick={loadAuthUsers}
              variant="icon"
              icon={<ADPIcon spin={fetchingAuth} icon="sync" size="sm" />}
            />
            }>
            {t( "common.button.refresh" )}
          </Tooltip>
          <Tooltip
            trigger={ <Button
              size="md"
              aria-label={t( "authorization.provideAccess" )}
              onClick={showAccessForm}
              variant="icon"
              icon={<ADPIcon classes="-translate-y-0.5" icon="add" size="sm" />}
            />
            }>
            {t( "authorization.provideAccess" )}
          </Tooltip>
        </div>
        :
        <div className={styles.formContainer}>
          <form onSubmit={handleSubmit( onSubmit )}>
            <div className={clsx( styles.provideAccess )}>
              <div className="w-full md:w-3/4 h-fit">
                <Controller
                  name="resource"
                  control={control}
                  rules={{
                    validate: ( value ) => ComposeValidators(
                      Validate_Required( t( "authorization.resource" )))( value?.value )
                  }}
                  //eslint-disable-next-line @typescript-eslint/no-unused-vars
                  render={({ field: { ref, ...rest } }) => {
                    return <ReloadableSelect
                      {...rest}
                      aria-invalid={errors?.resource ? "true" : "false"}
                      menuPortalTarget={document.body}
                      onReloadClick={() => {
                        loadUsers();
                      }}
                      isReloading={fetchingAuth}
                      isDisabled={fetchingAuth || isUsersUpdating}
                      floatingLabel={<LabelWithTooltip
                        label={t( "authorization.provideAccessTo" )} tooltip={t( "authorization.provideAccessToTooltip" )} required />}
                      className={clsx( styles.authorizationViewSelect )}
                      reloadIconTooltip={t( "common.button.reload" )}
                      reloadButtonIcon={<ADPIcon size="xs" spin={allUserIsFetching } icon="sync" />}
                      options={dropDownOptions}
                    />;
                  }}
                />
                {renderError( errors, "resource" )}
              </div>
              <div className="w-full md:w-1/3 h-fit">
                <Controller
                  name="accessType"
                  control={control}
                  rules={{
                    validate: ( value ) => ComposeValidators(
                      Validate_Required( t( "authorization.accessType" )))( value?.value )
                  }}
                  //eslint-disable-next-line @typescript-eslint/no-unused-vars
                  render={({ field: { ref, ...rest } }) => {
                    return <Select
                      {...rest}
                      options={funtionTypeOptions}
                      isDisabled={fetchingAuth || isUsersUpdating}
                      isClearable={false}
                      className={clsx( styles.authorizationViewSelect )}
                      floatingLabel={<LabelWithTooltip
                        label={t( "authorization.access" )} tooltip={t( "authorization.accessTypeTooltip" )} required />}
                      menuPortalTarget={document.body}
                    />;
                  }}
                />
                {renderError( errors, "accessType" )}
              </div>
              <div className={styles.CTAGroup}>
                <Button title={t( "common.button.cancel" )} aria-label={t( "common.button.cancel" )}
                  variant="stroked"
                  size="xs"
                  onClick={() => {
                    hideAccessForm();
                    reset({ ...defaultValues });
                  }}
                  classes="rounded-full text-white border-none bg-danger/70 hover:bg-danger"
                  icon={
                    <ADPIcon size="xxs" icon="cross" />
                  } />
                <Button title={t( "authorization.addUser" )}
                  aria-label={t( "authorization.addUser" )}
                  variant="stroked"
                  size="xs"
                  type="submit"
                  classes="rounded-full text-white border-none bg-success/70 hover:bg-success"
                  icon={
                    isUsersUpdating ?
                      <ADPIcon size="xs" spin={true} icon="sync" />
                      :
                      <ADPIcon size="xxs" icon="approve" />
                  } />
              </div>
            </div>
          </form>
        </div>
      }
    </div>
    {
      ( initFetching || allUserIsFetching
        ? <div>
          <Skeleton variant="bar" size="xl" />
          <SkeletonBlock variant="lines" count={3} rows={3} />
          <SkeletonBlock variant="lines" count={3} rows={3} />
        </div>
        : <div className="flex flex-col space-y-4">

          <Divider contentPosition="start" content={t( "authorization.owners" )} classes={styles.divider} />
          <OwnersTable
            ownersData={data?.Users?.owners || []}
            serviceName={serviceName}
            resourceId={resourceId}
            loadingAuthUsers={initFetching}
            searchTerm={searchTerm}
          />

          <Divider contentPosition="start" content={t( "authorization.readOnly" )} classes={styles.divider} />
          <ReadOnlyTable
            readOnlyData={data?.Users?.readOnly || []}
            serviceName={serviceName}
            resourceId={resourceId}
            loadingAuthUsers={initFetching}
            searchTerm={searchTerm}
          />
        </div>
      )
    }
  </div >
  );
};

export default Authorizations;
