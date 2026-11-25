import type { NotificationPermissionState } from '../hooks/useBrowserNotifications'
import type { RealtimeStatus } from '../types/listing'

type Props = {
  realtimeStatus: RealtimeStatus
  realtimeNotice: string
  onDismissNotice: () => void
  onRefresh?: () => void
  refreshing?: boolean
  notificationPermission?: NotificationPermissionState
  notificationsEnabled?: boolean
  onToggleNotifications?: () => void
}

export default function RealtimeBanner({
  realtimeStatus,
  realtimeNotice,
  onDismissNotice,
  onRefresh,
  refreshing = false,
  notificationPermission = 'unsupported',
  notificationsEnabled = false,
  onToggleNotifications,
}: Props) {
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 text-xs text-gray-500"
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

        <div className="flex items-center gap-2">
          {onToggleNotifications &&
            notificationPermission !== 'unsupported' && (
              <button
                type="button"
                onClick={onToggleNotifications}
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                  notificationsEnabled
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {notificationsEnabled ? '🔔 Alerts On' : '🔕 Enable Alerts'}
              </button>
            )}

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {refreshing ? 'Refreshing...' : '↻ Refresh'}
            </button>
          )}
        </div>
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
