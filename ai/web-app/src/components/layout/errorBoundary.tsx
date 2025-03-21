// libraries
import * as React from "react";
import { Button, EmptyState } from "@amorphic/amorphic-ui-core";

type Props = {
  /**
   * Pass a callback which will be called whenever an error is caught by the ErrorBoundary
   */
  errorCallback?: () => void;
  /**
   * Fallback component to render when an error is caught by the ErrorBoundary
   */
  fallbackContent?: React.ReactNode;
  children?: React.ReactNode;
}

type State = {
  /**
   * Flag to indicate if an error has been caught by the ErrorBoundary
   */
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor( props: any ) {
    super( props );
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean; } {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(): void {
    this.props.errorCallback?.();
  }

  render(): React.ReactNode {
    if ( this.state.hasError ) {
      return this.props.fallbackContent ?? <FallBackErrorContent/>;
    }

    return this.props.children;
  }
}

const FallBackErrorContent = (): JSX.Element => {
  return <div className="flex h-full w-auto mx-auto my-4 items-center justify-center dark:bg-dark2 dark:text-platinum">
    <EmptyState
      display="vertical"
      transparentBG
      defaultImageVariant={"bug" as const}
    >
      {/*
        susheel Apr 12, 2022
        TO DO: Replace with translations & useNavigation,
        however this component should be free of any dependencies as we are not sure
        which component or method has caused this error in the first place
      */}
      <EmptyState.Content title="Something went wrong !!">
        The page you are trying to access has an error and cannot be safely rendered.
        You can try to reload the page or go back to the previous page.<br/>
        If the problem persists, please contact the administrator for help with debugging.
      </EmptyState.Content>
      <EmptyState.CTA>
        <Button variant="stroked" onClick={() => window.history.go( -1 )}>
          Back to previous page
        </Button>
        <Button variant="stroked" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </EmptyState.CTA>
    </EmptyState>
  </div>;
};