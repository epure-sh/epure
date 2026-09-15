import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./error-state";

export interface RouteErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  backHref?: string;
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Route error boundary caught:", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      return (
        <ErrorState
          title={this.props.title ?? "This page crashed"}
          description="An unexpected error occurred. You can try again or go back."
          backHref={this.props.backHref ?? "/"}
          backLabel="Back to workspace"
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
