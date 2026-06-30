'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Tool-level React Error Boundary.
 * Wraps the entire tool component tree to prevent tool crashes from
 * propagating to the dashboard layout.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error details server-side in production via a logging service.
    // Do NOT expose error.message to users — only log for developers.
    console.error('[ErrorBoundary] Uncaught error in tool:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-[color:var(--surface-1)] border border-red-500/20 rounded-xl p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[color:var(--text-primary)]">Something went wrong</h3>
            <p className="text-xs text-[color:var(--text-secondary)]">
              {this.props.fallbackMessage || 'The editor encountered an unexpected error.'}
            </p>
          </div>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[color:var(--surface-2)] border border-[color:var(--border-subtle)] hover:border-primary-gold rounded-lg text-xs font-bold transition-colors"
          >
            <RefreshCcw className="w-3.5 h-3.5" /> Reload Editor
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
