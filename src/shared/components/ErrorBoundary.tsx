import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import { Icon8 } from './Icon8'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Catches render errors in the subtree and shows a recovery UI instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack)
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
          style={{ background: 'var(--bg-primary)' }}
          role="alert"
        >
          <div className="max-w-md space-y-4">
            <div className="inline-flex" aria-hidden="true">
              <Icon8 name="warning" size={42} />
            </div>
            <h1 className="text-xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
              Something went wrong
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              An unexpected error occurred. You can try reloading the page.
            </p>
            {import.meta.env.DEV && (
              <pre
                className="text-left text-xs p-3 rounded-xl overflow-auto max-h-40"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--danger)' }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              className="btn-primary py-2.5 px-6 text-sm"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
