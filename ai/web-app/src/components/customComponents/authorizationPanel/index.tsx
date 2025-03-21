import React from "react";
import SidePanel from "../sidePanel";
import Authorizations from "../authorizations";
import NotAuthorizedView from "../notAuthorizedView";

interface IAuthorizationPanel {
  /**
  * The header of the authorization panel.
  */
    header: React.ReactNode;
  /**
  * Show the authorization panel
  */
    show: boolean;
  /**
  * Onclosing of the panel
  */
    onClose: () => void;
  /**
  * Resource being used to check the access type.
  */
    resource: any;
  /**
  * Size of the panel
  * @default "md"
  */
    size?: any;
  /**
  * Resource Id for the auth component
  */
    resourceId: string;

  /**
  * Name of the service for the auth component.
  */
    serviceName: string;
  /**
  * Message values to be used in the message for interpolation.
  */
    messageValues: {
      [key:string]: any;
  }
}
export const AuthorizationPanel = ({ header,
  show,
  onClose,
  resource,
  resourceId,
  serviceName,
  size = "sm",
  messageValues }: IAuthorizationPanel ): JSX.Element => {
  return <SidePanel
    header={header}
    show={ show } size={size} onClose={onClose}>
    {resource?.AccessType === "owner"
      ? <Authorizations serviceName={serviceName} resourceId={resourceId} />
      : <div className="w-full h-full">
        <NotAuthorizedView
          messageValues={messageValues}
          showRedirectButton={false}
        />
      </div>
    }
  </SidePanel>;
};

export default AuthorizationPanel;