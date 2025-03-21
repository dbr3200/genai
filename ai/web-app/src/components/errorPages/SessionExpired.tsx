// libraries
import * as React from "react";
import { Button, EmptyState } from "@amorphic/amorphic-ui-core";

// methods / hooks / constants / styles
import { useAppDispatch } from "../../utils/hooks";
import { logout } from "../../modules/auth/actions";

const SessionExpired = ():JSX.Element => {
  const dispatch = useAppDispatch();
  const triggerLogout = () => {
    dispatch( logout());
  };
  return <EmptyState defaultImageVariant="no-auth" display="vertical">
    <EmptyState.Content>
      <p className="text-xl text-salsa pb-8">
            Your authentication token has expired and session ended. Please re-login now to continue !!
      </p>
    </EmptyState.Content>
    <EmptyState.CTA>
      <Button variant="stroked" onClick={triggerLogout}>Re-Login Now !</Button>
    </EmptyState.CTA>
  </EmptyState>;
};

export default SessionExpired;