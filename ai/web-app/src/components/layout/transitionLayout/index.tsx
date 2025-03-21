// libraries
import { Button, EmptyState } from "@amorphic/amorphic-ui-core";
import * as React from "react";
import i18n from "../../../i18n";
import { loadUserAccount } from "../../../modules/account/actions";
import { useAppDispatch, useAppSelector } from "../../../utils/hooks";
// import { WidgetSkeleton } from "../../customComponents/skeletons";
// import { UserAgreement } from "../../dynamicImports";
import { PageLoadSpinner } from "../../pageLoadSpinner";
import { UserRegistration } from "./userRegistration";

interface ITransitionLayout {
  username: string;
  mfaEnabled?: boolean;
}

const TransitionLayout = ({ username }: ITransitionLayout ): JSX.Element => {
  const dispatch = useAppDispatch();
  // MfaStatus = "disabled"
  const {
    UserId = "",
    UserRole = "Users",
    Preferences = {},
    fetchingUser,
    fetchingUserError
  } = useAppSelector(({ account }) => account );

  const fetchUserAccount = React.useCallback(() => {
    dispatch( loadUserAccount( username, true ));
  }, [ dispatch, username ]);

  React.useEffect(() => {
    fetchUserAccount();
    // dependency array is empty because we only want to fetch the user account once on component mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if ( UserId && Boolean( Preferences?.preferredLanguage ) && Preferences?.preferredLanguage !== i18n.language ) {
      i18n.changeLanguage( Preferences.preferredLanguage );
    }
  }, [ Preferences, UserId ]);

  return (
    <React.Suspense fallback={<PageLoadSpinner />}>
      {(( fetchingUser ))
        ? <PageLoadSpinner />
        : (( !UserId )
          ? <UserRegistration />
          : (( fetchingUserError || !UserRole ) ? <EmptyState defaultImageVariant="no-auth" display="vertical">
            <EmptyState.Content>
              {JSON.stringify( fetchingUserError )}
            </EmptyState.Content>
            <EmptyState.CTA>
              <Button onClick={fetchUserAccount}>Retry</Button>
            </EmptyState.CTA>
          </EmptyState> : null )
        )}
    </React.Suspense>
  );
};

export default TransitionLayout;