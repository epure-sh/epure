import { Component, type ErrorInfo, type ReactNode } from "react";
import { ErrorState } from "./error-state";

export interface RouteErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  backHref?: string;
}

interface RouteErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Partial<RouteErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Route error boundary caught:", error, errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  private handleRetry = (): void => {
    this.setState({ error: null, errorInfo: null });
  };

  render(): ReactNode {
    if (this.state.error) {
      const fullStack = `${this.state.error.stack ?? this.state.error.message}\nComponent Stack:${this.state.errorInfo?.componentStack ?? ""}`;
      return (
        <ErrorState
          title={this.props.title ?? "This view encountered an error"}
          description="An unexpected runtime error occurred. You can reload the page, try again, or navigate back."
          error={this.state.error}
          stack={fullStack}
          showReload={true}
          backHref={this.props.backHref ?? "/"}
          backLabel="Back to workspace"
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
