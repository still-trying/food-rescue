import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../utils/telemetry'
import AmbientBackground from './AmbientBackground'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(
      `ErrorBoundary:${info.componentStack?.slice(0, 80) ?? 'root'}`,
      error
    )
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="relative flex min-h-screen items-center justify-center px-6">
          <AmbientBackground />
          <div className="fr-surface-3d w-full max-w-md rounded-2xl border border-slate-200/80 p-8 text-center dark:border-emerald-500/20">
            <div className="text-4xl" aria-hidden="true">
              ⚠️
            </div>
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-50">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              An unexpected error interrupted Food Rescue. Reload the page to
              continue safely.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="fr-btn-3d mt-6 w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Reload App
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
