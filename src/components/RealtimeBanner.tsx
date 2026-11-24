import type { RealtimeStatus } from '../types/listing'

type Props = {
  realtimeStatus: RealtimeStatus
  realtimeNotice: string
  onDismissNotice: () => void
}

export default function RealtimeBanner({
  realtimeStatus,
  realtimeNotice,
  onDismissNotice,
}: Props) {
  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="mb-4 flex items-center gap-2 text-xs text-gray-500"
      >
        <span
          className={`h-2 w-2 rounded-full ${
            realtimeStatus === 'connected'
              ? 'bg-green-500'
              : realtimeStatus === 'reconnecting'
                ? 'animate-pulse bg-yellow-500'
                : 'animate-pulse bg-gray-400'
          }`}
        />

        <span>
          {realtimeStatus === 'connected'
            ? 'Live updates connected'
            : realtimeStatus === 'reconnecting'
              ? 'Connection interrupted — reconnecting...'
              : 'Connecting to live updates...'}
        </span>
      </div>

      {realtimeNotice && (
        <div
          role="status"
          aria-live="polite"
          className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800 shadow-sm"
        >
          <div className="flex items-center justify-between gap-4">
            <p>{realtimeNotice}</p>

            <button
              type="button"
              onClick={onDismissNotice}
              className="shrink-0 font-bold text-blue-500 transition hover:text-blue-800"
              aria-label="Dismiss live update"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}

