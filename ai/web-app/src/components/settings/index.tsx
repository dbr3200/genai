import React, { useCallback, useMemo, useReducer } from "react";
import { ADPIcon, Avatar, Button, EmptyState, Modal,
  ReloadableSelect, Spinner, Tabs, TextCopy, Textarea, Tooltip } from "@amorphic/amorphic-ui-core";
import Header from "../layout/header";
import { Content } from "../layout/PageLayout";
import { useAppSelector, useSuccessNotification } from "../../utils/hooks";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { ComparePassword, ComposeValidators, Validate_Password, Validate_Required } from "../../utils/formValidationUtils";
import { LabelWithTooltip, getSelectedOptions, renderError } from "../../utils/renderUtils";
import { changePassword, logout } from "../../modules/auth/actions";
import { extractMessage, removeWhiteSpaces } from "../../utils";
import TableOfContent from "../customComponents/tableOfContent/TableOfContent";
import { useGetUserAlertPreferencesQuery,
  useUnsubscribeUserAlertsPreferencesMutation,
  useUpdateAmorphicIntegrationMutation,
  useUpdateUserAlertPreferencesMutation,
  useUpdateUserPreferencesMutation } from "../../services/user";
import jwtDecode from "jwt-decode";
import { useLazyGetAmorphicDomainsQuery, useLazyGetAmorphicRolesQuery, useLazyGetAmorphicTenantsQuery } from "../../services/amorphic";
import { loadUserAccount } from "../../modules/account/actions";

export default function Settings(): JSX.Element {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const formUtils = useForm();
  const { t } = useTranslation();

  const [ loading, setLoading ] = React.useState( false );
  const [ openModal, setOpenModal ] = React.useState( false );
  const [ editDefaultRole, toggleDefaultRole ] = useReducer(( state ) => !state, false );
  const [ editDefaultTenant, toggleDefaultTenant ] = useReducer(( state ) => !state, false );

  const disableLoading = () => setLoading( false );
  const { handleSubmit, register, formState: { errors, isDirty }, watch, setValue } = formUtils;
  const {
    UserId,
    FullName,
    EmailId,
    AmorphicIntegrationStatus,
    fetchingUser,
    silentFetchUser,
    DefaultDomain,
    TenantName,
    UserRole
  } = useAppSelector(({ account }) => account );
  const [ selectedDefaultDomain, setSelectedDefaultDomain ] = React.useState<string>( DefaultDomain );
  const [ selectedDefaultTenant, setSelectedDefaultTenant ] = React.useState<string>( TenantName );
  const [ updateAmorphicIntegration, { isLoading: integratingUser }] = useUpdateAmorphicIntegrationMutation();
  const [ updateUserPreferences, { isLoading: updatingUserPreferences }] = useUpdateUserPreferencesMutation();
  const { data: {
    EmailSubscriptionStatus = "no"
  } = {}, isFetching: fetchingAlertPreferences, refetch: fetchAlertPreferences } = useGetUserAlertPreferencesQuery({
    userId: UserId
  });
  const [ subscribeToAlerts, { isLoading: subscribing }] = useUpdateUserAlertPreferencesMutation();
  const [ unSubscribeToAlerts, { isLoading: unSubscribing }] = useUnsubscribeUserAlertsPreferencesMutation();

  const [ fetchDomains, {
    isUninitialized: domainsUninitialized,
    isFetching: isDomainsFetching,
    data: {
      Domains = []
    } = {}
  }] = useLazyGetAmorphicDomainsQuery();

  const domainOptions = useMemo(() => {
    const domainOptionsData = Domains.map(( item:any ) => ({
      label: `${item.DisplayName} (${item.DomainName})`,
      value: item.DomainName
    }));
    return domainOptionsData;
  }, [Domains]);

  const [ fetchTenants, {
    isUninitialized: tenantsUninitialized,
    isFetching: isTenantsFetching,
    data: {
      Tenants = []
    } = {}
  }] = useLazyGetAmorphicTenantsQuery();

  const tenantOptions = useMemo(() => {
    const tenantOptionsData = Tenants.map(( item:any ) => ({
      label: `${item.DisplayName} (${item.TenantName})`,
      value: item.TenantName
    }));
    return tenantOptionsData;
  }, [Tenants]);

  const [ patToken, setPatToken ] = React.useState<string>( "" );
  const [ roleId, setRoleId ] = React.useState<string>( "" );
  const [ patError, setPatError ] = React.useState<string>( "" );
  const [showSuccessNotification] = useSuccessNotification();

  const [ fetchRoles, {
    isFetching: fetchingRoles,
    data: {
      Roles = []
    } = {}
  }] = useLazyGetAmorphicRolesQuery({});

  const onSubmit = useCallback( async ( values: any ) => {
    setLoading( true );
    const { oldPassword, newPassword } = values;
    // TO DO: @sashank: add error handling
    // @ts-expect-error Unknown type conversion issue
    dispatch( changePassword( oldPassword, newPassword, navigate, disableLoading ));
  }, [ dispatch, navigate ]);

  const sectionMenuLabels:{[key: string]: any} = {
    Profile: {
      name: "Profile",
      icon: "profile"
    },
    Integrations: {
      name: "Integrations",
      icon: "app-management"
    },
    Security: {
      name: "Security",
      icon: "password"
    },
    Notifications: {
      name: "Notifications",
      icon: "bell"
    },
    ...( AmorphicIntegrationStatus === "connected" && { Preferences: {
      name: "Preferences",
      icon: "settings"
    } }),
    Logout: {
      name: "Logout",
      icon: "sign-out"
    }
  };

  const reloadAccount = useCallback(() => {
    fetchAlertPreferences?.();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Return statement not required
    return dispatch( loadUserAccount( UserId, false, true, 1 ));
  }, [ UserId, dispatch, fetchAlertPreferences ]);

  React.useEffect(() => {
    if ( patToken?.length > 0 ){
      try {
        const { iss, role } = jwtDecode( patToken ) as { iss: string, role: string };
        if ( iss === "PAT_GEN" && role?.length > 0 ){
          setPatError( "" );
          setRoleId( role ?? "" );
        } else {
          setPatError( "Invalid PAT Token" );
        }
      } catch {
        setPatError( "Invalid PAT Token" );
      }
    }
  }, [patToken]);

  /*
  * Needs to be updated with roles call and confirm whether AmorphicIntegrationStatus is sent as disabled when disabled as we
  cannot differentiate between disabled and not integrated.
  */

  const onIntegrateAmorphic = useCallback( async ( action = "connect" ) => {
    const requestBody = action === "connect" ? {
      RoleId: roleId,
      ...( patToken?.length && { Token: patToken })
    } : {};

    updateAmorphicIntegration({ action: action, requestBody, userId: UserId }).unwrap().then(( response ) => {
      showSuccessNotification({
        content: response?.Message
      });
      setOpenModal( false );
    });
  }, [ roleId, patToken, updateAmorphicIntegration, UserId, showSuccessNotification ]);

  const updateAllUserPreferences = useCallback(( updatedField, Value ) => {
    const dataToUpdate = {
      ...( updatedField === "DefaultDomain" ? { DomainName: Value } : { TenantName: Value })
    };
    updateUserPreferences({ userId: UserId, requestBody: dataToUpdate }).unwrap().then(( response ) => {
      showSuccessNotification({
        content: response?.Message
      });
      updatedField === "DefaultDomain" ? toggleDefaultRole() : toggleDefaultTenant();
      reloadAccount();
    });
  }, [ updateUserPreferences, UserId, showSuccessNotification, reloadAccount ]);

  return ( <>
    <Header title="Settings" subtitle="User profile and settings" />
    <Content className="flex flex-col sm:flex-row flex-wrap gap-4 w-full h-full bg-white pt-2">
      <TableOfContent sectionMenu={sectionMenuLabels} />
      <div id="menu" className="flex-grow flex flex-col gap-24 overflow-auto max-h-[90vh]">
        <section id={removeWhiteSpaces( sectionMenuLabels.Profile?.name )} className="flex flex-col gap-4">
          <div className="flex border-b border-[#edf2f7] pb-4 h-full justify-between items-center">
            <div className="flex flex-col">
              <h3 className="text-lg font-semibold">Profile</h3>
              <p className="text-sm text-gray-500">Update your profile information</p>
            </div>
            <Button variant="stroked" size="xs" classes="me-2 px-4"
              onClick={reloadAccount} loading={silentFetchUser || fetchingUser}>
              Refresh
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-secondary-100 w-full flex flex-col items-center justify-center h-auto py-8">
              <Avatar label={FullName || UserId} size="xl" />
              <div className="flex items-center gap-1 mt-4">
                <h1 className="text-2xl font-arloPn">{FullName || UserId}</h1>
              </div>
              <p className={"secondary-text"}>{EmailId}</p>
            </div>
            <ul className="list-none flex flex-col gap-4 divide-y divide-secondary-200 flex-grow">
              <li className="py-2"><span className="text-gray">{"Username"}:{" "}</span>
                <TextCopy classes="font-bold" displayOnHover>{UserId}</TextCopy></li>
              <li className="py-2"><span className="text-gray">{"Email"}:{" "}</span>
                <TextCopy classes="font-bold" displayOnHover>{EmailId}</TextCopy></li>
              <li className="py-2"><span className="text-gray">{"Current Role"}:{" "}</span>
                <TextCopy classes="font-bold" displayOnHover>{UserRole}</TextCopy></li>
              <li className="flex items-center justify-between py-2 rounded w-full gap-2">
                <span className="text-gray">{"Alert Preferences"}:{" "}</span>
                <div className="flex flex-grow flex-wrap items-center justify-between pe-4">
                  { EmailSubscriptionStatus === "yes" && <>
                    <span className="font-bold">Subscribed</span>
                    <Button size="xs"
                      onClick={() => unSubscribeToAlerts({ userId: UserId }).unwrap().then(( data ) => {
                        fetchAlertPreferences?.();
                        showSuccessNotification({
                          content: extractMessage({ data })
                        });
                      })}
                      classes="btn btn-danger"
                      loading={fetchingAlertPreferences || unSubscribing}>Unsubscribe</Button>
                  </> }
                  { EmailSubscriptionStatus === "no" && <>
                    <span className="font-bold">Not Subscribed</span>
                    <Button size="xs"
                      onClick={() => subscribeToAlerts({ userId: UserId }).unwrap().then(( data ) => {
                        fetchAlertPreferences?.();
                        showSuccessNotification({
                          content: extractMessage({ data })
                        });
                      })}
                      classes="btn btn-success"
                      loading={fetchingAlertPreferences || subscribing}>Subscribe</Button>
                  </> }
                  { EmailSubscriptionStatus === "pending" && <>
                    <span className="font-bold">Email Verification Pending</span>
                    <Button size="xs"
                      onClick={() => subscribeToAlerts({ userId: UserId }).unwrap().then(( data ) => {
                        fetchAlertPreferences?.();
                        showSuccessNotification({
                          content: extractMessage({ data })
                        });
                      })}
                      classes="btn btn-warning"
                      loading={fetchingAlertPreferences || subscribing}>Resend Verification</Button>
                  </> }
                </div>
              </li>
            </ul>
          </div>
        </section>
        <section id={removeWhiteSpaces( sectionMenuLabels.Integrations?.name )} className="flex flex-col gap-4">
          <div className="flex flex-col border-b border-[#edf2f7] pb-4">
            <h3 className="text-lg font-semibold">Integrations</h3>
            <p className="text-sm text-gray-500">Integrate with Amorphic</p>
          </div>
          {( fetchingUser || silentFetchUser ) ?
            <div className="flex flex-col gap-4 items-center justify-center py-12 bg-slate-100 text-slate-600 rounded-md">
              <Spinner size="sm" />
            </div> : <>
              <EmptyState
                img={<ADPIcon icon="app-management" size="xl" classes="text-[#0676e1]" />}
                display="vertical"
                classes="bg-secondary-100"
              >
                <EmptyState.Content>
                  <p className="text-lg">
                    { AmorphicIntegrationStatus === "connected" && <span>
                      Successfully connected to Amorphic application.
                    </span> }
                    { AmorphicIntegrationStatus === "disconnected" && <span>
                      This integration will create a PAT token in Amorphic and securely stores it to facilitate cross-platform communication.
                    </span> }
                    { AmorphicIntegrationStatus === "disabled" && <span>
                      Your Integration with Amorphic is disabled. Please enable it to use Amorphic features.
                    </span> }
                  </p>
                </EmptyState.Content>
                <EmptyState.CTA>
                  { AmorphicIntegrationStatus === "disconnected" ? <Button onClick={() => setOpenModal( true )}
                    classes="btn btn-primary" size="sm">
                    Connect to Amorphic
                  </Button> : <>
                    <Button loading={integratingUser} onClick={() => onIntegrateAmorphic( "disconnect" )}
                      classes="btn btn-danger" size="sm">
                        Disconnect from Amorphic
                    </Button>
                    {AmorphicIntegrationStatus === "disabled" ?
                      <Button loading={integratingUser} onClick={() => onIntegrateAmorphic( "enable" )}
                        classes="btn btn-primary" size="sm">Enable</Button>
                      : <Button variant="stroked" loading={integratingUser} onClick={() => onIntegrateAmorphic( "disable" )}
                        classes="btn btn-secondary" size="sm">Disable </Button>}
                  </> }
                </EmptyState.CTA>
              </EmptyState>
              <Modal size="lg" showModal={openModal} onHide={() => setOpenModal( false )}>
                <Modal.Header classes="flex w-full items-center justify-between">
                  {"Amorphic Integration"}
                </Modal.Header>
                <Modal.Body classes="w-[50vw] min-h-[30vh] py-4">
                  <Tabs>
                    <Tabs.Tab title="Auto Connect">
                      <div className="py-4">
                        <ReloadableSelect
                          onChange={( e ) => {
                            setRoleId( e?.value ?? "" );
                            setPatToken( "" );
                          }}
                          options={Roles?.map(( role: any ) => ({ label: role.RoleName, value: role.RoleId }))}
                          floatingLabel={"Select amorphic role"}
                          menuPortalTarget={document.body}
                          onReloadClick={() => fetchRoles({})}
                          isReloading={fetchingRoles}
                          isDisabled={fetchingRoles}
                          isClearable
                        />
                      </div>
                    </Tabs.Tab>
                    <Tabs.Tab title="Manual">
                      <div className="py-4 flex flex-col gap-4">
                        <Textarea
                          floatingLabel={<LabelWithTooltip
                            label="Enter your PAT Token here" tooltip={"You can get your PAT token from Amorphic"} />}
                          value={patToken}
                          onChange={( e ) => {
                            setRoleId( "" );
                            setPatToken( e?.target?.value );
                          }}
                        />
                        { patToken?.length > 0 && <div className="py-1 text-sm">
                          { patError ? <span className="text-danger">{patError}</span> : <span className="text-success"><b>RoleId:</b>{" "}{roleId}</span> }
                        </div>
                        }
                      </div>
                    </Tabs.Tab>
                  </Tabs>
                </Modal.Body>
                <Modal.Footer>
                  <div className="w-full flex justify-end">
                    <Button loading={integratingUser} size="sm"
                      variant="stroked" onClick={() => onIntegrateAmorphic( "connect" )}> Integrate </Button>
                  </div>
                </Modal.Footer>
              </Modal>
            </>
          }
        </section>
        <section id={removeWhiteSpaces( sectionMenuLabels.Security?.name )} className="flex flex-col gap-4">
          <form onSubmit={handleSubmit( onSubmit )}>
            <div className="flex flex-col border-b border-[#edf2f7] pb-4">
              <h3 className="text-lg font-semibold">Security</h3>
              <p className="text-sm text-gray-500">Update your password</p>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:max-w-xl sm:grid-cols-6 py-8">
              <div className="col-span-full">
                <label htmlFor="current-password" className="block text-sm font-medium leading-6 ">
                        Current password
                </label>
                <div className="mt-2">
                  <input
                    {...register( "oldPassword",
                      {
                        validate: Validate_Required( t( "profile.settings.oldPassword" ).toLowerCase()),
                        onChange: ( e ) => setValue( "oldPassword", e.target.value )
                      })}
                    type="password"
                    className="block w-full rounded-md border-0 bg-black/8 py-1.5
                   shadow-sm ring-1 ring-inset ring-black/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                  {renderError( errors, "oldPassword" )}
                </div>
              </div>
              <div className="col-span-3">
                <label htmlFor="current-password" className="block text-sm font-medium leading-6 ">
                        New password
                </label>
                <div className="mt-2">
                  <input
                    {...register( "newPassword", {
                      validate: ComposeValidators( Validate_Required( t( "profile.settings.newPassword" ).toLowerCase()), Validate_Password ),
                      onChange: ( e ) => setValue( "newPassword", e.target.value )
                    })}
                    type="password"
                    className="block w-full rounded-md border-0 bg-black/8 py-1.5
                   shadow-sm ring-1 ring-inset ring-black/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                  {renderError( errors, "newPassword" )}
                </div>
              </div>
              <div className="col-span-3">
                <label htmlFor="confirm-password" className="block text-sm font-medium leading-6 ">
                        Confirm password
                </label>
                <div className="mt-2">
                  <input
                    {...register( "confirmPassword",
                      {
                        validate: ComposeValidators( Validate_Required( t( "profile.settings.confirmPassword" ).toLowerCase()),
                          Validate_Password, ComparePassword( watch( "newPassword" ))),
                        onChange: ( e ) => setValue( "confirmPassword", e.target.value )

                      })}
                    type="password"
                    autoComplete="current-password"
                    className="block w-full rounded-md border-0 bg-black/8 py-1.5
                   shadow-sm ring-1 ring-inset ring-black/10 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                  />
                  {renderError( errors, "confirmPassword" )}
                </div>
              </div>
            </div>
            <div className="my-4">
              <Button type="submit" loading={loading} disabled={loading || !isDirty} aria-label={t( "profile.settings.submitForm" )}
                size="sm" classes="btn btn-primary">Update Password</Button>
            </div>
          </form>
        </section>
        <section id={removeWhiteSpaces( sectionMenuLabels.Notifications?.name )} className="flex flex-col">
          <div className="flex flex-col border-b border-[#edf2f7] pb-4">
            <h3 className="text-lg font-semibold">Notifications</h3>
            <p className="text-sm text-gray-500">Add or remove notifications for your resources</p>
          </div>
          <EmptyState display="vertical">
            <EmptyState.Content>
              <span>No notification settings found !</span>
            </EmptyState.Content>
          </EmptyState>
        </section>
        {AmorphicIntegrationStatus === "connected" &&
        <section id={removeWhiteSpaces( sectionMenuLabels.Preferences?.name )} className="flex flex-col">
          <div className="flex flex-col border-b border-[#edf2f7] pb-4">
            <h3 className="text-lg font-semibold">Preferences</h3>
            <p className="text-sm text-gray-500">Update your Preferences</p>
          </div>
          <ul className="text-base my-2 grid grid-cols-2 gap-x-6 gap-y-4">
            <li className="items-center justify-between px-4 py-2 rounded bg-white dark:bg-dark2 flex w-full shadow-lg p-6">
              {editDefaultRole ?
                <div className="flex flex-row gap-2 items-center w-full">
                  <ReloadableSelect
                    isReloading={isDomainsFetching}
                    options={domainOptions}
                    menuPortalTarget={document.body}
                    aria-describedby="SetDefaultDomain"
                    noOptionsMessage={() => domainsUninitialized ? "Reload domains list" : "No domains found"}
                    onChange={( e ) => {
                      setSelectedDefaultDomain( e?.value ?? "" );
                    }}
                    value={getSelectedOptions( selectedDefaultDomain, domainOptions )}
                    floatingLabel={<LabelWithTooltip
                      tooltipId="SetDefaultDomain"
                      required
                      label={"Select Domain"}
                      tooltip={"Select the default Amorphic domain to be used."} />}
                    onReloadClick={() => fetchDomains({})} />
                  <Tooltip trigger={
                    <Button variant="icon"
                      loading={updatingUserPreferences}
                      icon={<ADPIcon icon="check-circle" size="xs" classes="text-success" />}
                      onClick={() => updateAllUserPreferences( "DefaultDomain", selectedDefaultDomain )}
                    />}>
                    <span>Save default domain preference</span>
                  </Tooltip>
                  <Tooltip trigger={
                    <Button variant="icon"
                      disabled={updatingUserPreferences}
                      icon={<ADPIcon icon="times-circle" size="xs" classes="text-danger" />} onClick={toggleDefaultRole} />}
                  >
                    <span>Cancel</span>
                  </Tooltip>
                </div>
                : <>
                  <span className="font-robotoMedium">{"Default Domain"} : <span className="font-bold">{DefaultDomain}</span></span>
                  <Tooltip trigger={
                    <Button variant="icon" icon={<ADPIcon icon="edit" size="xs" />} onClick={toggleDefaultRole} />}>
                    <span>Update default domain</span>
                  </Tooltip></> }
            </li>
            <li className="items-center justify-between px-4 py-2 rounded bg-white dark:bg-dark2 flex w-full shadow-lg p-6">
              {editDefaultTenant ?
                <div className="flex flex-row space-x-2 items-center w-full">
                  <ReloadableSelect
                    isReloading={isTenantsFetching}
                    options={tenantOptions}
                    creatable
                    menuPortalTarget={document.body}
                    noOptionsMessage={() => tenantsUninitialized ? "Reload tenant list" : "No tenants found"}
                    aria-describedby="SetDefaultTenant"
                    onChange={( e ) => {
                      setSelectedDefaultTenant( e?.value ?? "" );
                    }}
                    value={getSelectedOptions( selectedDefaultTenant, tenantOptions )}
                    floatingLabel={<LabelWithTooltip
                      tooltipId="SetDefaultTenant"
                      required
                      label={"Set Default Tenant"}
                      tooltip={"Select the default Amorphic tenant to be used."} />}
                    onReloadClick={() => fetchTenants({})} />
                  <Tooltip trigger={
                    <Button variant="icon"
                      loading={updatingUserPreferences}
                      icon={<ADPIcon icon="check-circle" size="xs" classes="text-success" />}
                      onClick={() => updateAllUserPreferences( "TenantName", selectedDefaultTenant )} />}>
                    <span>Save default tenant preference</span>
                  </Tooltip>
                  <Tooltip trigger={
                    <Button variant="icon"
                      disabled={updatingUserPreferences}
                      icon={<ADPIcon icon="times-circle" size="xs" classes="text-danger" />} onClick={toggleDefaultTenant} />}>
                    <span>Cancel</span>
                  </Tooltip>
                </div>
                : <>
                  <span className="font-robotoMedium">{"Default Tenant"} : <span className="font-bold">{TenantName}</span></span>
                  <Tooltip trigger={
                    <Button variant="icon" icon={<ADPIcon icon="edit" size="xs" />} onClick={toggleDefaultTenant} />}>
                    <span>Update default tenant</span>
                  </Tooltip>
                </> }
            </li>
          </ul>
        </section>
        }
        <section id={removeWhiteSpaces( sectionMenuLabels.Logout?.name )} className="flex flex-col">
          <div className="flex flex-col border-b border-[#edf2f7] pb-4">
            <h3 className="text-lg font-semibold">Logout</h3>
            <p className="text-sm text-gray-500">Logout of the application</p>
          </div>
          <div className="my-4">
            <Button onClick={() => {
              dispatch( logout( navigate ));
            }} size="sm" classes="btn btn-danger">Logout</Button>
          </div>
        </section>
        <section className="py-0 sm:py-60"></section>
      </div>
    </Content>
  </> );
}