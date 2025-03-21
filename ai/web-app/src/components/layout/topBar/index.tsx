import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import {
  Tabs,
  ADPIcon,
  EmptyState,
  Modal,
  Avatar } from "@amorphic/amorphic-ui-core";
import { Link, useNavigate } from "react-router-dom";
import PerfectScroll from "react-perfect-scrollbar";

import { usePermanentPaths } from "../../utils/hooks/usePermanentPaths";
import logo from "../../../assets/images/LogoMark.svg";
import { useDispatch } from "react-redux";
import { logout } from "../../../modules/auth/actions";
import { useAppSelector } from "../../../utils/hooks";
import {
  EUserRoles,
  IconType,
  RouteObject
} from "../../../types";
import { nanoid } from "nanoid";
import {
  userResources
} from "../../../modules/common/actions";
import { setHelpPanelVisibility } from "../../../modules/globalConfig/reducer";
import { toggleDarkMode } from "../../../modules/account/reducer";
import styles from "./topbar.module.scss";

export type ListOptionProps = {
  text?: string;
  icon?: IconType | undefined;
  beta?: boolean;
  tagMatch?: boolean;
  descriptionMatch?: boolean;
  onClick?: () => void,
};

export function MenuList(): RouteObject[] {
  const permanentPaths = usePermanentPaths();
  const { UserId = "", UserRole = "Users" } = useAppSelector(
    ({ account }) => account
  );
  const menuList = [permanentPaths.workspaces];
  if ( !UserId ) {
    return [];
  }
  if ( UserRole === EUserRoles.Admins ) {
    menuList.push( permanentPaths.management );
  }
  return menuList;
}

const RoleMapper = {
  "admins": "Administrator",
  "users": "User",
  "developers": "Developer"
};

export default function Menu(): JSX.Element {
  const permanentPaths = usePermanentPaths();
  const [ isOpen, setIsOpen ] = useState( false );
  const appState = useAppSelector( state => state );
  const { account, globalConfig = {} } = appState;
  const {
    UserRole = "Users",
    FullName,
    Preferences = {}
  } = account;

  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [ searchValue, setSearchValue ] = useState( "" );
  const [ searchResults, setSearchResults ] = useState<any>([]);
  const { helpPanelVisible } = globalConfig;

  const showPanel = () =>
    dispatch( setHelpPanelVisibility({ helpPanelVisible: true }));

  const hidePanel = () =>
    dispatch( setHelpPanelVisibility({ helpPanelVisible: false }));

  const handleLogout = () => {
    dispatch( logout( navigate ));
  };

  const handleDarkMode = () => {
    dispatch( toggleDarkMode());
  };

  const handleProfileAndSetting = () => {
    navigate(
      `${permanentPaths?.profileAndSettings?.path}/#`
    );
    document
      .querySelector( "#Profile" )
      ?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
  };

  const handleChangePassword = () => {
    navigate(
      `${permanentPaths?.profileAndSettings?.path}/#Security`
    );
    document
      .querySelector( "#Security" )
      ?.scrollIntoView({
        block: "start",
        behavior: "smooth"
      });
  };

  const TopMenuOptions = [
    { text: "Profile and Settings", icon: "settings", onClick: handleProfileAndSetting },
    { text: "Change Password", icon: "key", onClick: handleChangePassword },
    //{ text: "Dark Mode", icon: "settings", onClick: handleDarkMode },
    { text: "Log out", icon: "sign-out", onClick: handleLogout }
  ];

  const TopMenuOption = ({
    text,
    icon,
    onClick
  }: ListOptionProps ) => {
    const isDarkModeMenu = text?.replaceAll( " ", "" )?.toLowerCase()?.includes( "darkmode" );
    const isLogoutMenu = text?.replaceAll( " ", "" )?.toLowerCase()?.includes( "logout" );
    return (
      <li onClick={onClick} className={clsx( styles.menuOption, isDarkModeMenu && "border-y-2 border-[#ECF2F8] dark:border-[#343146]" )}>
        <ADPIcon
          icon={icon}
          classes={clsx( isLogoutMenu ? "text-[#9F1313]" : "", "h-[0.875rem] ml-2 w-[0.875rem]" )}
        />
        {!isDarkModeMenu ?
          <div
            className={clsx( isLogoutMenu ? "text-[#9F1313]" : "", "block px-2 py-2 text-sm cursor-pointer" )}
            role="menuitem"
          >
            {text}
          </div>
          :
          <div className="flex p-2 gap-2 items-center">
            <span className="text-sm">
              Dark Mode
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                value={Preferences.darkMode}
                className="sr-only peer"
                onChange={handleDarkMode}
                checked={Preferences.darkMode ? true : false}
              />
              <div className="w-11 h-6 bg-gray peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300
               dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full
                peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px]
                 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5
                 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        }
      </li>
    );
  };

  useEffect(() => {
    if ( searchResults?.length && !helpPanelVisible ) {
      showPanel();
    }
  }, [searchResults]);

  useEffect(() => {
    if ( !helpPanelVisible ) {
      setSearchResults([]);
      setSearchValue( "" );
    }
  }, [helpPanelVisible]);

  useEffect(() => {
    const handleKeyUp = ( event: any ) => {
      if ( event.key === "k" && event.ctrlKey ) {
        dispatch( setHelpPanelVisibility({ helpPanelVisible: true }));
      }
    };

    const onKeyDown = ( e ) => {
      if ( e.metaKey && e.key === "k" ) {
        dispatch( setHelpPanelVisibility({ helpPanelVisible: true }));
      }
    };
    window.addEventListener( "keyup", handleKeyUp );
    window.addEventListener( "keydown", onKeyDown );

    return () => {
      window.removeEventListener( "keyup", handleKeyUp );
      window.removeEventListener( "keydown", onKeyDown );
    };
  }, [dispatch]);
  useEffect(() => {
    if ( helpPanelVisible ) {
      dispatch( userResources());
    }
  }, [ helpPanelVisible, dispatch ]);

  const menuRef = useRef<any>( null );

  useEffect(() => {
    const handleClickOutside = ( event: any ) => {
      if ( menuRef.current && !( menuRef.current.contains( event.target )) && isOpen ) {
        setIsOpen( false );
      }
    };
    document.addEventListener( "click", handleClickOutside, true );
    return () => {
      document.removeEventListener( "click", handleClickOutside, true );
    };
  }, [isOpen]);

  return (
    <nav className={styles.navBody}>
      <div className={styles.navPadding}>
        <div className={styles.navFlex}>
          <div className="flex items-center">
            <button
              data-drawer-target="logo-sidebar"
              data-drawer-toggle="logo-sidebar"
              aria-controls="logo-sidebar"
              type="button"
              className="inline-flex items-center p-2 text-sm text-gray-500 rounded-lg sm:hidden hover:bg-gray-100
              focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
            >
              <span className="sr-only">Open sidebar</span>
              <svg
                className="w-6 h-6"
                aria-hidden="true"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  clipRule="evenodd"
                  fillRule="evenodd"
                  // eslint-disable-next-line max-len
                  d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 4.75zm0 10.5a.75.75 0 01.75-.75h7.5a.75.75 0 010 1.5h-7.5a.75.75 0 01-.75-.75zM2 10a.75.75 0 01.75-.75h14.5a.75.75 0 010 1.5H2.75A.75.75 0 012 10z"
                ></path>
              </svg>
            </button>
            <Link to={permanentPaths.playground.path} className="ml-7">
              <span className="sr-only">Amorphic AI</span>
              <img
                src={logo}
                alt="Amorphic AI"
                width={40}
                height={32}
                className="h-8 w-8"
              />
            </Link>
          </div>
          <div className="flex items-center">
            <div className="block items-center ml-3 mr-5">
              {typeof FullName !== "undefined" && <button className="flex" onClick={() => setIsOpen( !isOpen )}>
                <Avatar label={FullName} variant="success"/>
                {/* <div className="p-1">
                  <button
                    type="button"
                    className={styles.avatar}
                    aria-expanded="false"
                    data-dropdown-toggle="dropdown-user"
                  >
                    <span className="sr-only">Open user menu</span>
                    <p className=" rounded-3xl py-2 px-3 dark:text-white">
                      {FullName?.charAt( 0 )}
                    </p>
                  </button>
                </div> */}
                <div>
                  <button
                    className="pl-2"
                    type="button"
                    aria-expanded="false"
                    data-dropdown-toggle="dropdown-user"
                  >
                    <span className={styles.name}>
                      {FullName}
                    </span>
                    <span className={styles.role}>
                      {RoleMapper?.[UserRole?.toLowerCase()] ?? "User"}
                    </span>
                  </button>
                </div>
                <div className="p-1 mt-2">
                  <ADPIcon
                    icon="down-arrow"
                    classes="h-[1.125rem] w-[1.125rem] pl-2 dark:text-white"
                  />
                </div>
              </button>}
              <div
                className={clsx( isOpen ? "block" : "hidden", styles.menuContainer )}
                id="dropdown-user"
                ref={menuRef}
              >
                <ul className="py-1 dark:bg-secondary-400" role="none">
                  {
                    TopMenuOptions.map(({ text, icon, onClick }) => <TopMenuOption key={nanoid()} text={text} icon={icon} onClick={onClick} /> )
                  }
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div >
      <Modal escKeyClose backdropClickClose closeButton={false} showModal={helpPanelVisible} size="lg" onHide={hidePanel}>
        <Modal.Body classes={"min-w-[50vw] h-96"}>
          {/* <div className={"relative flex items-center flex-col"}> */}
          <PerfectScroll
            options={{ suppressScrollX: true }}
            className="max-h-[25rem] space-y-6 relative overflow-x-hidden w-full"
            component="div">
            {
              searchValue?.length ?
                searchResults?.length ?
                  <Tabs classes="pt-0">
                    {
                      searchResults.map(( result: any ) => {
                        return (
                          <Tabs.Tab key={nanoid()} title={`${result.heading } (${ result.options.length }) `}>
                            <PerfectScroll
                              className="ps-4 divide-y divide-platinum"
                              component="ul">
                              {result.options.map(( option: any ) =>
                                <li
                                  className={"flex flex-wrap break-words items-center gap-2 py-4 w-auto cursor-pointer text-gray hover:text-amorphicBlue"}
                                  key={nanoid()}
                                  onClick={() => {
                                    setHelpPanelVisibility({ helpPanelVisible: false });
                                    // optionClickHandler(option, navigate, permanentPaths);
                                  }}>
                                  {option.label}
                                </li> )}
                            </PerfectScroll>
                          </Tabs.Tab>
                        );
                      })
                    }
                  </Tabs>
                  :
                  <EmptyState classes="bg-white" display="vertical" defaultImageVariant="zero-results" transparentBG>
                    <EmptyState.Content title={"No Results Found"} />
                  </EmptyState>
                :
                <EmptyState classes="bg-platinum" display="vertical" transparentBG>
                  <EmptyState.Content title={"Search for a resource"} />
                </EmptyState>
            }
          </PerfectScroll >
          {/* </div> */}
        </Modal.Body>
      </Modal>
    </nav>
    // <header className="sticky top-0 isolate z-[60] flex-none bg-white dark:bg-slate-800 shadow dark:shadow-slate-700">
    //   <Container as="nav" className="flex items-center justify-between md:justify-start" aria-label="Global">
    //     <div className="flex md:flex-0">
    //       <Link to="/home" className="-my-1.5">
    //         <span className="sr-only">Amorphic AI</span>
    //         {/* <ADPIcon icon="file" classes="text-[#0676e1]" size="sm" /> */}
    //         <img src={logo} alt="Amorphic AI" className="h-8 w-auto" />
    //       </Link>
    //     </div>
    //     <div className="flex md:hidden">
    //       <button
    //         type="button"
    //         className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-slate-800 dark:text-slate-200"
    //         onClick={() => setMobileMenuOpen(true)}
    //       >
    //         <span className="sr-only">Open main menu</span>
    //         <ADPIcon icon="menu" aria-hidden="true" />
    //       </button>
    //     </div>
    //     {(UserId && UserRole) ? <Popover.Group className="hidden md:flex md:items-center md:flex-1 md:gap-x-6 md:mx-6">
    //       <Popover>
    //         <Popover.Button className="text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">
    //           <div className="flex items-center gap-x-1">
    //             <span>Services</span>
    //             <ADPIcon icon="down-arrow" classes="flex-none text-slate-800 dark:text-slate-200" size="xxs" aria-hidden="true" />
    //           </div>
    //         </Popover.Button>

  //         <Transition
  //           as={Fragment}
  //           enter="transition ease-out duration-200"
  //           enterFrom="opacity-0 -translate-y-1"
  //           enterTo="opacity-100 translate-y-0"
  //           leave="transition ease-in duration-150"
  //           leaveFrom="opacity-100 translate-y-0"
  //           leaveTo="opacity-0 -translate-y-1"
  //         >
  //           <Popover.Panel className="absolute inset-x-0 top-0 -z-10 bg-white dark:bg-slate-800 pt-16 shadow-lg ring-1 ring-gray-900/5">
  //             <div className="border-t border-slate-200 dark:border-slate-600">
  //               <div className="mx-auto grid max-w-7xl grid-cols-4 gap-x-4 px-6 py-10 md:px-4 xl:gap-x-8">
  //                 {fetchedUpdatedMenu?.map((item) => (
  //                   <Popover.Button key={item.name} as={Link} to={item.path} >
  //                     <div className="group relative rounded-lg p-6 text-sm leading-6 hover:bg-[#0676e1] hover:bg-opacity-10">
  //                       <div className="flex items-center justify-center rounded-lg bg-gray-50 dark:bg-slate-900 group-hover:bg-[#0676e1] p-2 h-14 w-14">
  //                         <ADPIcon icon={item.icon} size="lg" classes="text-slate-600 dark:text-slate-300 group-hover:text-white" />
  //                       </div>
  //                       <a className="mt-6 block font-semibold text-lg text-slate-800 dark:text-slate-200 text-start">
  //                         {item.name}
  //                         <span className="absolute inset-0" />
  //                       </a>
  //                       <p className="mt-1 text-slate-600 dark:text-slate-200 text-start">{item.description}</p>
  //                     </div>
  //                   </Popover.Button>
  //                 ))}
  //               </div>
  //               {/* TODO: uncomment below when CTAs are finalized. @susheel */}
  //               {/* <div className="bg-slate-200 dark:bg-slate-900">
  //                 <div className="mx-auto max-w-7xl px-6 md:px-8">
  //                   <div className="grid grid-cols-3 divide-x divide-gray-900/5 border-x border-gray-900/5">
  //                     {callsToAction.map(( item ) => {
  //                       return item.trigger ? <Popover.Button onClick={nextBg}
  //                         key={item.name}
  //                         className="flex items-center justify-center gap-x-2.5 p-3 text-sm font-semibold
  //                         leading-6 text-slate-800 dark:text-slate-200 hover:bg-[#f7fafc] dark:hover:bg-slate-800"
  //                       >
  //                         {item.icon}
  //                         {item.name}
  //                       </Popover.Button> : <a
  //                         key={item.name}
  //                         href={item.href}
  //                         className="flex items-center justify-center gap-x-2.5 p-3
  //                         text-sm font-semibold leading-6 text-slate-800 dark:text-slate-200 hover:bg-[#f7fafc] dark:hover:bg-slate-800"
  //                       >
  //                        // <ADPIcon icon="notification" classes="flex-none text-gray-400" aria-hidden="true" />
  //                         {item.icon}
  //                         {item.name}
  //                       </a>;
  //                     })}
  //                   </div>
  //                 </div>
  //               </div> */}
  //             </div>
  //           </Popover.Panel>
  //         </Transition>
  //       </Popover>

  // <div className="relative flex items-center">
  //   <input
  //     type="text"
  //     onFocus={() => {
  //       showPanel();
  //     }}
  //     name="search"
  //     id="search"
  //     className="block w-full rounded-md border-0 py-0.5 pr-14 text-gray-900
  //      shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset
  //       focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-slate-600"
  //   />
  //   <div className="absolute inset-y-0 right-0 flex py-0.5 pr-0.5">
  //     <kbd className="inline-flex items-center rounded border border-[#edf2f7] px-1 font-sans text-xs text-slate-400 dark:text-slate-900">
  //       {navigator.userAgent.includes("Macintosh") ? "⌘K" : "Ctrl+K"}
  //     </kbd>
  //   </div>
  // </div>
  //     </Popover.Group> : <div className="md:flex-1"></div>}
  //     <div className="hidden md:flex md:justify-end">
  //       <Popover className="relative">
  //         <Popover.Button className="text-sm font-semibold leading-6 text-slate-900 dark:text-slate-100">
  //           <span className="sr-only">Open user menu</span>
  //           <ADPIcon icon="user" size="xs" />
  //         </Popover.Button>
  //         <Popover.Panel className="absolute z-10 max-w-xs min-w-max px-4 mt-3 transform -translate-x-1/2 -left-20 sm:px-0">
  //           <ul className="list-none bg-[#002c59] text-white p-4 rounded-lg border border-[#0676e1] space-y-2">
  //             {UserId && <li className="py-2">
  //               <Popover.Button as={Link} to={permanentPaths?.profileAndSettings?.path}>
  //                 <div className="flex items-center gap-x-2">
  //                   <ADPIcon icon={permanentPaths?.profileAndSettings?.icon} size="xs" classes="flex-shrink-0" aria-hidden="true" />
  //                   <span>{permanentPaths?.profileAndSettings?.name}</span>
  //                 </div>
  //               </Popover.Button>
  //             </li>}
  //             <li className="py-2">
  //               <Popover.Button onClick={() => {
  //                 dispatch(logout(navigate));
  //               }}>
  //                 <div className="flex items-center gap-x-2">
  //                   <ADPIcon icon="sign-out" size="xs" classes="flex-shrink-0" aria-hidden="true" />
  //                   <span>Logout</span>
  //                 </div>
  //               </Popover.Button>
  //             </li>
  //           </ul>
  //         </Popover.Panel>
  //       </Popover>
  //     </div>
  //   </Container>
  //   <Dialog as="div" className="md:hidden" open={mobileMenuOpen} onClose={setMobileMenuOpen}>
  //     <div className="fixed inset-0 z-10" />
  //     <Dialog.Panel className="fixed inset-y-0 right-0 z-10 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10">
  //       <div className="flex items-center justify-between">
  //         <a href="#" className="-m-1.5 p-1.5 flex items-center gap-x-4">
  //           <span className="sr-only">Amorphic AI</span>
  //           <ADPIcon icon="file" classes="text-[#0676e1]" size="md" />
  //           <span className="font-semibold text-xl">Amorphic AI</span>
  //         </a>
  //         <button
  //           type="button"
  //           className="-m-2.5 rounded-md p-2.5 text-gray-700"
  //           onClick={() => setMobileMenuOpen(false)}
  //         >
  //           <span className="sr-only">Close menu</span>
  //           <ADPIcon icon="times-circle" aria-hidden="true" />
  //         </button>
  //       </div>
  //       <div className="mt-6 flow-root">
  //         <div className="-my-6 divide-y divide-gray-500/10">
  //           <div className="space-y-2 py-6">
  //             <Disclosure as="div" className="-mx-3">
  //               {({ open }) => (
  //                 <>
  //                   <Disclosure.Button className="flex w-full items-center justify-between
  //                    rounded-lg py-2 pl-3 pr-3.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50">
  //                     Services
  //                     <ADPIcon icon="down-arrow"
  //                       classes={clsx(open ? "rotate-180" : "", "h-5 w-5 flex-none")}
  //                       aria-hidden="true"
  //                     />
  //                   </Disclosure.Button>
  //                   <Disclosure.Panel className="mt-2 space-y-2">
  //                     {(MenuList()).map((item) => (
  //                       <Disclosure.Button
  //                         key={item.name}
  //                         as="a"
  //                         href={item.href}
  //                         className="block rounded-lg py-2 pl-6 pr-3 text-sm font-semibold leading-7 text-gray-900 hover:bg-gray-50"
  //                       >
  //                         {item.name}
  //                       </Disclosure.Button>
  //                     ))}
  //                   </Disclosure.Panel>
  //                 </>
  //               )}
  //             </Disclosure>
  //             <Link to={permanentPaths?.profileAndSettings?.path}
  //               className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
  //             >
  //               {permanentPaths?.profileAndSettings?.name}
  //             </Link>
  //           </div>
  //           <div className="py-6">
  //             <button
  //               type="button"
  //               className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
  //               onClick={() => dispatch(logout(navigate))}
  //             >
  //               Log out
  //             </button>
  //           </div>
  //         </div>
  //       </div>
  //     </Dialog.Panel>
  //   </Dialog>
  // </header>
  );
}
