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
    ? 'bg-red-50 text-red-700 border-red-200'
    : status === 'available'
      ? isEndingSoon
        ? 'bg-amber-50 text-amber-800 border-amber-300'
        : 'bg-green-50 text-green-700 border-green-200'
      : status === 'claimed'
        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'

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

