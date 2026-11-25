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
          className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              realtimeStatus === 'connected'
                ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.7)]'
                : realtimeStatus === 'reconnecting'
                  ? 'animate-pulse bg-amber-500'
                  : 'animate-pulse bg-slate-400'
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
                className={`rounded-lg border px-2.5 py-1 text-xs font-medium shadow-xs transition ${
                  notificationsEnabled
                    ? 'border-green-300 bg-green-50/90 text-green-700 dark:border-emerald-500/35 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'border-slate-200/90 bg-white/85 text-slate-600 hover:bg-white dark:border-emerald-500/20 dark:bg-emerald-950/50 dark:text-slate-300 dark:hover:bg-emerald-900/60'
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
              className="rounded-lg border border-slate-200/90 bg-white/85 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-xs transition hover:bg-white disabled:opacity-50 dark:border-emerald-500/20 dark:bg-emerald-950/50 dark:text-slate-300 dark:hover:bg-emerald-900/60"
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
          className="mb-6 rounded-xl border border-blue-200 bg-blue-50/95 px-4 py-3 text-sm font-medium text-blue-800 shadow-sm backdrop-blur-sm dark:border-sky-500/30 dark:bg-sky-950/55 dark:text-sky-200"
        >
          <div className="flex items-center justify-between gap-4">
            <p>{realtimeNotice}</p>

            <button
              type="button"
              onClick={onDismissNotice}
              className="shrink-0 font-bold text-blue-500 transition hover:text-blue-800 dark:text-sky-400 dark:hover:text-sky-200"
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
