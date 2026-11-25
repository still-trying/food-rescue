import type { ListingStatus } from '../types/listing'

type Props = {
  status: ListingStatus
  isExpired: boolean
  isEndingSoon?: boolean
  withBackdrop?: boolean
}

export default function ListingStatusBadge({
  status,
  isExpired,
  isEndingSoon = false,
  withBackdrop = false,
}: Props) {
  const statusLabel = isExpired
    ? 'Expired'
    : status === 'available'
      ? isEndingSoon
        ? 'Ending Soon'
        : 'Available'
      : status === 'claimed'
        ? 'Claimed'
        : 'Picked Up'

  const statusStyles = isExpired
    ? 'bg-red-50/95 text-red-700 border-red-200 dark:bg-red-950/80 dark:text-red-300 dark:border-red-500/35'
    : status === 'available'
      ? isEndingSoon
        ? 'bg-amber-50/95 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-500/35'
        : 'bg-green-50/95 text-green-700 border-green-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-500/35'
      : status === 'claimed'
        ? 'bg-yellow-50/95 text-yellow-700 border-yellow-200 dark:bg-yellow-950/80 dark:text-yellow-300 dark:border-yellow-500/35'
        : 'bg-slate-100/95 text-slate-600 border-slate-200 dark:bg-slate-800/85 dark:text-slate-300 dark:border-slate-600/40'

  const statusIcon = isExpired
    ? '⏰'
    : status === 'available' && isEndingSoon
      ? '⚡'
      : status === 'picked_up'
        ? '✓'
        : '●'

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${
        withBackdrop ? 'shadow-sm backdrop-blur-sm ' : ''
      }${statusStyles}`}
    >
      <span className="mr-1.5" aria-hidden="true">
        {statusIcon}
      </span>
      {statusLabel}
    </span>
  )
}
