import { Component, type ErrorInfo, type ReactNode } from 'react'
import { reportClientError } from '../utils/telemetry'

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
    reportClientError(`ErrorBoundary:${info.componentStack?.slice(0, 80) ?? 'root'}`, error)
  }

  private handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="text-4xl" aria-hidden="true">
              ⚠️
            </div>
            <h1 className="mt-4 text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              An unexpected error interrupted Food Rescue. Reload the page to
              continue safely.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700"
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

