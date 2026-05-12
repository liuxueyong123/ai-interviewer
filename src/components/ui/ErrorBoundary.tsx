"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="p-8 text-center">
            <p className="text-danger text-sm font-medium">组件加载失败</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 text-accent text-sm font-medium hover:underline cursor-pointer"
            >
              重试
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
