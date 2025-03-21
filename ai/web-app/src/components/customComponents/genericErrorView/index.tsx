// libraries
import React from "react";
import { Button, EmptyState, SkeletonBlock } from "@amorphic/amorphic-ui-core";
import { Trans, useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import NotAuthorizedView from "../notAuthorizedView";
import styles from "./styles.module.scss";

const NotAuthorizedCodes = [ "1011", "1010", "1002", "006 " ];

export type ErrorType = {
  status: number;
  data: {
    Message:string
  }
}
interface GenericErrorViewProps {
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
    /**
     * Error Object of the Corresponding API
     */
    error?:ErrorType;
    /**
     * Route Path to be redirected when on click of the button
     */
    routePath?:string;
    /**
     * Custom Button Label
     */
    customRedirectButtonLabel?:React.ReactNode;
    /**
     * Loading in between transitions
     */
    isLoading: boolean;
    /**
     * Used to either show or hide the redirect button.
     */
     showRedirectButton?: boolean;
    /**
     * Add corresponding translation key to be displayed as the error message
     */
     translationKeyPath?:string;
      /**
     * Title of the error card.
     */
    title?:string;
}

const GenericErrorView = ({
  display = "horizontal",
  error = {} as ErrorType,
  messageValues = {},
  routePath,
  customRedirectButtonLabel,
  isLoading,
  showRedirectButton = true,
  translationKeyPath,
  title
}: GenericErrorViewProps ) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const errorCode = error?.data?.Message?.slice( 5, 9 );

  const hasKeys = Boolean( Object.keys( error ).length );

  const errorTitle = title?.length ? title : t( "common.messages.notAuthorized" );

  //Error Code for Schedules no access is SCH-1006. Update it later accordingly.
  if ( NotAuthorizedCodes.includes( errorCode ) ||
   error?.data?.Message === "User is not authorized to view" ||
  error?.data?.Message === "User is not authorized to edit" ) {
    return (
      <NotAuthorizedView
        messageValues={messageValues}
        routePath={routePath}
        showRedirectButton={showRedirectButton}
      />
    );
  } else {
    return isLoading ?
      <div className="h-full w-full">
        <SkeletonBlock variant="lines" size="xl" rows={8} />
      </div> : <EmptyState classes={styles.errorCardStyles} display={display} defaultImageVariant={"no-auth" as const}>
        {hasKeys ?
          <EmptyState.Content title={ messageValues?.resourceName ? t( "common.messages.notAuthorized" ) : t( "common.messages.somethingWentWrong" ) }>
            {Object.keys( error ).length === 0 && error.constructor === Object ?
              <Trans
                i18nKey={messageValues?.resourceName ? "common.messages.notAuthorizedActionMessage" : "common.messages.notAuthorizedMessage"}
                values={messageValues}
              />
              : error?.data?.Message}
          </EmptyState.Content>
          :
          <EmptyState.Content title={errorTitle}>
            <Trans
              i18nKey={translationKeyPath ? translationKeyPath : "common.messages.notAuthorizedActionMessage" }
              values={messageValues}
            />
          </EmptyState.Content>
        }
        {showRedirectButton ?
          <EmptyState.CTA>
            <Button size="sm" classes="min-h-[40px]" onClick={() => routePath ? navigate( routePath ) : navigate( -1 )}>
              {customRedirectButtonLabel ? customRedirectButtonLabel : t( "common.button.previousPage" ) }
            </Button>
          </EmptyState.CTA>
          : <></> }
      </EmptyState>;
  }
};

export default React.memo( GenericErrorView );