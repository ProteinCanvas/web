'use client'

import { Component, type ReactNode, type ErrorInfo } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
  label?: string
  compact?: boolean
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ''}]`, error, info.componentStack)
  }

  reset = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    const { label, compact } = this.props
    const message = error.message || 'An unexpected error occurred'

    if (compact) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 w-full h-full min-h-[120px] p-6 text-center">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-foreground">
              {label ? `${label} failed to load` : 'Something went wrong'}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono leading-snug max-w-xs break-words">
              {message}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <RotateCcw size={11} />
            Try again
          </button>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 w-full h-full min-h-[200px] p-8 text-center">
        <AlertCircle size={28} className="text-red-400 shrink-0" />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-semibold text-foreground">
            {label ? `${label} encountered an error` : 'Something went wrong'}
          </p>
          <p className="text-xs text-muted-foreground font-mono leading-relaxed max-w-md break-words">
            {message}
          </p>
        </div>
        <button
          onClick={this.reset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <RotateCcw size={11} />
          Try again
        </button>
      </div>
    )
  }
}
