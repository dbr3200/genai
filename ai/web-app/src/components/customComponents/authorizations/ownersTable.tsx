// libraries
import React, { useCallback, useState } from "react";
import { Card, ADPIcon, Button, Table, EmptyState, SkeletonBlock, Tooltip, Avatar } from "@amorphic/amorphic-ui-core";
import { useTranslation } from "react-i18next";
import PerfectScrollBar from "react-perfect-scrollbar";

// components
import { ConfirmationModal } from "../confirmationModal";

// methods / hooks / constants / styles
import { useUpdateAuthorizedUsersMutation } from "../../../services/authorizations";
import { useSuccessNotification } from "../../../utils/hooks";
import styles from "./authorised.module.scss";
import clsx from "clsx";

interface Props {
  /**
   * List of users data to be displayed
   */
  ownersData: Array<Record<string, any>>;
  /**
   * Indicates the type of service being used.
   */
  serviceName: string;
  /**
   * Resource ID whose authorizations to be fetched
   */
  resourceId: string;
  /**
  * Is Loading for authorized users .
  */
  loadingAuthUsers: boolean;
  /**
  * Current Accesstype for the user that is to be added.
  */
  accessType?: string;
  /**
* Common search term for the search bar.
*/
  searchTerm: string;
}

export const OwnersTable = ({
  ownersData,
  serviceName,
  resourceId,
  loadingAuthUsers,
  searchTerm
}: Props ): JSX.Element => {
  const [ updateAccess, { isLoading: isUsersUpdating }] = useUpdateAuthorizedUsersMutation();

  const { t } = useTranslation();
  const [showSuccessNotification] = useSuccessNotification();
  const [ selectedUser, setSelectedUser ] = useState<any>( null );

  const searchFunction = ( data: any = []) => {
    return data?.filter(( user: any ) => {
      const sanitisedSearchString = searchTerm?.replaceAll( /[&\\/\\#,()$~%'":<>{}[\]]/g, ( substr ) => `\\${substr}` ) || "";
      return user?.Name?.match( new RegExp( sanitisedSearchString ?? "", "gi" )) ||
        user?.EmailId?.match( new RegExp( sanitisedSearchString ?? "", "gi" ));
    });
  };

  function tableFunction( data: Record<string, any>[]): JSX.Element {
    return (
      <PerfectScrollBar component="div" className={styles.psContainer}>
        <Table classes={styles.authTable}>
          <Table.Body>
            {searchFunction( data )?.length > 0 ? searchFunction( data )?.map(( user: any, index: number ) => {
              return (
                <tr key={index}>
                  <td className="group">
                    <div className={styles.listItem}>
                      <div className={styles.listItemInfoContainer}>
                        <Avatar label={user?.Name || user?.UserId} size="md" />
                        <div className={styles.listItemInfo}>
                          <div className={styles.heading}>
                            <span>
                              {user?.Name || user?.UserId}
                            </span>
                          </div>
                          <div className={styles.subHeading}>
                            {user?.EmailId}
                          </div>
                        </div>
                      </div>
                      <div className={clsx( styles.ctas, "invisible group-hover:visible" )}>
                        <Tooltip
                          trigger={<Button title={t( "authorization.removeUser" )}
                            aria-label={t( "authorization.removeUser" )}
                            variant="icon"
                            // disabled={isUsersUpdating || user?.UserId === username}
                            size="sm"
                            onClick={() => setSelectedUser( user?.UserId )}
                            icon={
                              <ADPIcon icon="delete-user" classes="text-danger/50 hover:text-danger/80" />
                            } />}>
                          {t( "authorization.removeUser" )}
                        </Tooltip>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            }) : ( data?.length > 0 &&
              <EmptyState display="vertical" transparentBG defaultImageVariant="zero-results">
                <EmptyState.Content>
                  {t( "authorization.noResults" )}
                </EmptyState.Content>
              </EmptyState>
            )}
          </Table.Body>
        </Table>
        {data?.length === 0 && <EmptyState display="vertical" transparentBG>
          <EmptyState.Content title={`${t( "authorization.noOwnerUsers" )} ${t( `authorization.${serviceName}` ).toLocaleLowerCase()}`} />
        </EmptyState>}
      </PerfectScrollBar>
    );
  }

  const onDelete = useCallback( async ( userId ) => {
    if ( !isUsersUpdating ) {
      try {
        const { Message }: any = await updateAccess({
          serviceName,
          resourceId,
          requestBody: {
            AccessType: "owner",
            Users: ownersData
              ?.filter( curr => curr?.UserId !== userId )
              ?.map(( user: any ) => user?.UserId ) || []
          } }).unwrap();
        showSuccessNotification({
          content: Message
        });
      } catch {
        setSelectedUser( null );
      } finally {
        setSelectedUser( null );
      }
    }
  }, [ ownersData, isUsersUpdating, updateAccess, serviceName, resourceId, showSuccessNotification ]);

  return (
    <>
      {loadingAuthUsers ? <SkeletonBlock variant="card" count={1} /> :
        <Card classes={styles.tableCardClasses}>
          <div className="flex flex-col min-h-fit max-h-[18rem]">
            <PerfectScrollBar component="div" className="flex flex-col min-h-[18rem]">
              {tableFunction( ownersData )}
            </PerfectScrollBar>
          </div>
        </Card>
      }
      <ConfirmationModal
        confirmButtonText={t( "profile.settings.confirm" )}
        cancelButtonText={t( "profile.settings.cancel" )}
        onConfirm={async () => {
          onDelete( selectedUser );
        }}
        showModal={Boolean( selectedUser )}
        loading={isUsersUpdating}
        closeModal={() => setSelectedUser( null )}
        onCancel={() => setSelectedUser( null )}
      >
        <>
          {t( "authorization.removeUserConfirmation", { userid: selectedUser })}
        </>
      </ConfirmationModal>
    </>
  );
};
