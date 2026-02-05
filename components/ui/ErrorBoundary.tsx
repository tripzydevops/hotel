"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary catches JavaScript errors anywhere in their child component tree,
 * logs those errors, and displays a fallback UI instead of the component tree that crashed.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public resetErrorBoundary = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
          <div className="w-16 h-16 rounded-full bg-[var(--danger)]/10 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-[var(--danger)]" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-[var(--text-muted)] max-w-md mb-6">
            We encountered an unexpected error while loading this section.
            {this.state.error && (
              <span className="block mt-2 text-xs opacity-50 font-mono bg-black/30 p-2 rounded">
                {this.state.error.message}
              </span>
            )}
          </p>
          <button
            onClick={this.resetErrorBoundary}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--deep-ocean)] hover:bg-[var(--deep-ocean-accent)] text-white rounded-lg transition-colors border border-white/10 shadow-lg"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
