import { Component } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('GymPulse error boundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-64 p-10 text-center">
          <div className="p-3 bg-red-50 rounded-full mb-4">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Something went wrong</h2>
          <p className="text-sm text-slate-500 mb-5 max-w-sm">
            An unexpected error occurred on this page. Your data is safe — try refreshing.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            <RefreshCw size={14} /> Refresh page
          </button>
          {this.state.error && (
            <p className="mt-4 text-xs text-slate-300 font-mono max-w-sm truncate">{this.state.error.message}</p>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
