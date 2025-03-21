// libraries
import React from "react";
import { Button, EmptyState } from "@amorphic/amorphic-ui-core";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

interface NotAuthorizedViewProps {
    /**
     * Prop to manipulate the display
     */
    display?: React.ComponentProps<typeof EmptyState>["display"];
    /**
     * Message values to be used in the message for interpolation.
     */
    messageValues?: {
        [key:string]: any;
    }
    routePath?:any;
    /**
     * Show/Hide the redirect button from the error card.
     */
     showRedirectButton?: boolean;
}

const NotAuthorizedView = ({
  display = "horizontal",
  messageValues = {},
  routePath,
  showRedirectButton = true
}: NotAuthorizedViewProps ) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  if ( typeof messageValues.resourceName === "undefined" ) {
    messageValues.resourceName = "resource";
  }
  return <EmptyState display={display} defaultImageVariant={"no-auth" as const}>
    <EmptyState.Content title={t( "common.messages.notAuthorized" )}>
      <Trans
        i18nKey={messageValues?.resourceName ? "common.messages.notAuthorizedActionMessage" : "common.messages.notAuthorizedMessage"}
        values={messageValues}
      />
    </EmptyState.Content>
    { showRedirectButton ?
      <EmptyState.CTA>
        <Button size="sm" classes="min-h-[40px]" onClick={() => routePath ? navigate( routePath ) : navigate( -1 )}>
          {t( "common.button.previousPage" )}
        </Button>
      </EmptyState.CTA>
      : <></>}
  </EmptyState>;
};

export default React.memo( NotAuthorizedView );