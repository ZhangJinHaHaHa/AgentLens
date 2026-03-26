import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || "An unexpected error occurred."
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="hero-card">
            <p className="eyebrow">Application error</p>
            <h2>{this.props.fallbackTitle ?? "Something went wrong"}</h2>
            <p className="intro">
              {this.props.fallbackDescription ??
                "An unexpected error occurred. Please refresh the page and try again."}
            </p>
            {this.state.errorMessage ? (
              <p className="error-detail" role="alert">
                {this.state.errorMessage}
              </p>
            ) : null}
            <button
              type="button"
              className="retry-button"
              onClick={() => this.setState({ hasError: false, errorMessage: null })}
            >
              Try again
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
