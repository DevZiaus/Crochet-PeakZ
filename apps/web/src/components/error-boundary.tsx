"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorBoundaryProps {
  /** Fallback UI to render when an error is caught. Overrides the default display. */
  fallback?: ReactNode;
  /** Called with the error and component stack on catch. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** The component tree to wrap. */
  children: ReactNode;
  /** Additional CSS class names for the fallback container. */
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches JavaScript errors in its child component tree and displays
 * a branded fallback UI with an icon, heading, description, and retry button.
 * Uses the design token palette for consistency with the rest of the app.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
            this.props.className,
          )}
          role="alert"
        >
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle
              className="size-7 text-destructive"
              aria-hidden="true"
            />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              {this.state.error?.message ||
                "An unexpected error occurred. Please try again."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            className="mt-2 gap-2"
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
export type { ErrorBoundaryProps };
