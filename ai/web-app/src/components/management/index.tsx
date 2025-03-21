import React, { useCallback } from "react";
import { ADPIcon, Button, Select, Tabs } from "@amorphic/amorphic-ui-core";
import Header from "../layout/header";
import { Content } from "../layout/PageLayout";
import { useSuccessNotification } from "../../utils/hooks";
import { isTruthyValue } from "../../utils";
import { useGetUsersQuery, useUpdateUserRoleMutation } from "../../services/user";
import PerfectScrollBar from "react-perfect-scrollbar";
import clsx from "clsx";
import { IAccount } from "../../modules/types";
import TableLoader from "../common/loaders/tableLoader";
import { AppManagement } from "./appManagement";

export default function Management(): JSX.Element {

  const [showSuccessNotification] = useSuccessNotification();

  const [ selectedRole, setSelectedRole ] = React.useState<any>( "" );
  const [ updateRole, { isLoading: updatingRole }] = useUpdateUserRoleMutation();

  const onSubmit = useCallback( async ( userId: any ) => {
    updateRole({ userId: userId,
      requestBody: {
        Action: "update_user_role",
        UserRole: selectedRole?.value
      }
    }).unwrap().then(( response ) => {
      showSuccessNotification({
        content: response?.Message
      });
      setSelectedUser( "" );
      setSelectedRole( "" );
    });
  }, [ selectedRole?.value, showSuccessNotification, updateRole ]);

  const { data: {
    Users = []
  } = {}, isLoading, isFetching, refetch } = useGetUsersQuery( "" );

  const [ editRole, setEditRole ] = React.useState( false );

  const [ selectedUser, setSelectedUser ] = React.useState( "" );

  return <>
    <Header title="Management" subtitle="Users and App Management" />
    <Content className="flex flex-col sm:flex-row flex-wrap gap-4 w-full h-auto bg-white p-4">
      <Tabs>
        <Tabs.Tab title={<div className="flex items-center gap-2">
          <ADPIcon icon="group" size="xs" />
          <span>Users</span>
        </div>}>
          <PerfectScrollBar component="div" className="flex flex-col w-full gap-4">
            <Button variant="stroked" size="xs"
              classes="px-4 self-end"
              loading={updatingRole || isFetching || isLoading}
              disabled={updatingRole || isFetching || isLoading}
              onClick={refetch}>
              {"Reload"}
            </Button>
            <table className={clsx( "w-full whitespace-nowrap text-left p-4" )}>
              <colgroup>
                <col className="lg:w-3/6" />
                <col className="w-full sm:w-2/6" />
                <col className="lg:w-1/6" />
              </colgroup>
              <thead className={clsx( "border-b border-black/10 text-sm leading-6" )}>
                <tr>
                  <th scope="col" className="py-2 pl-2 font-semibold">
                    {"User"}
                  </th>
                  <th scope="col" className="py-2 pl-2 font-semibold">
                    {"User Role"}
                  </th>
                  <th scope="col" className="py-2 pl-2 font-semibold">
                    {"Amorphic Integration Status"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f7fafc] text-[#4a5568]">
                { isLoading ? <TableLoader colSpan={3} /> : Users?.slice()?.sort(
                  ( a: IAccount, b: IAccount ) => a?.UserId?.localeCompare( b?.UserId )
                )?.map(( user: IAccount ) => {
                  return <tr key={user.UserId}>
                    <td className="py-2 px-2 flex flex-col">
                      <span className="text-md text-dark3">{user.UserId}</span>
                      <span className="text-secondary-300">{user.EmailId}</span>
                    </td>
                    <td className="py-2 px-2">
                      {( editRole && selectedUser === user.UserId ) ? <div className="flex flex-row space-x-2 items-center">
                        <Select
                          defaultValue={{ label: user.UserRole, value: user.UserRole }}
                          options={[
                            { label: "Admins", value: "Admins" },
                            { label: "Developers", value: "Developers" },
                            { label: "Users", value: "Users" }
                          ]}
                          value={selectedRole}
                          menuPortalTarget={document.body}
                          onChange={( e ) => setSelectedRole( e )}
                          label="Select Role" />
                        <div className="flex flex-row">
                          <Button variant="icon"
                            disabled={updatingRole}
                            icon={<ADPIcon icon="check-circle" size="xs" />} onClick={() => onSubmit( user.UserId )} />
                          <Button variant="icon"
                            disabled={updatingRole}
                            icon={<ADPIcon icon="cross" size="xs" />} onClick={() => setEditRole( false )} />
                        </div>
                      </div> : <div className="flex items-center gap-2 group">
                        <span>{user.UserRole}</span>
                        <button className="hidden group-hover:inline-block" onClick={() => {
                          setSelectedRole({ label: user.UserRole, value: user.UserRole });
                          setSelectedUser( user.UserId );
                          setEditRole( true );
                        }}>
                          <ADPIcon icon="edit" size="xxs" />
                        </button>
                        <button className="sr-only" onClick={() => {
                          setSelectedRole( "" );
                          setSelectedUser( user.UserId );
                          setEditRole( true );
                        }}>
                            Edit Role
                        </button>
                      </div>}
                    </td>
                    <td className="py-2 px-2">
                      { isTruthyValue( user?.AmorphicIntegrationStatus ) ? "Integrated" : (
                        user?.AmorphicIntegrationStatus === "disconnected" ? "Not Integrated" : "Disabled"
                      )}
                    </td>
                  </tr>;
                })
                }
              </tbody>
            </table>
          </PerfectScrollBar>
        </Tabs.Tab>
        <Tabs.Tab title={<div className="flex items-center gap-2">
          <ADPIcon icon="app-management" size="xs" />
          <span>App Management</span>
        </div>} >
          <AppManagement />
        </Tabs.Tab>
      </Tabs>
    </Content>
  </>;
}