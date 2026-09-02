import { useState } from 'react'
import { supabase } from '../lib/supabase'

export type Listing = {
  id: string
  title: string
  description: string | null
  quantity: string | null
  category: string | null
  photo_url: string | null

  location_text: string
  latitude: number | null
  longitude: number | null

  pickup_window_start: string
  pickup_window_end: string

  status: 'available' | 'claimed' | 'picked_up'

  posted_by: string
  claimed_by: string | null
  created_at: string
}

type Props = {
  listing: Listing
  distanceKm: number | null
  currentUserId: string | null
  onUpdated: (listing: Listing) => void
}

function formatDate(date: string) {
  return new Date(date).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

// Converts database category into a user-friendly label
function formatCategory(category: string | null) {
  switch (category) {
    case 'cooked_meals':
      return '🍛 Cooked Meals'

    case 'bakery':
      return '🥖 Bakery'

    case 'groceries':
      return '🛒 Groceries'

    case 'fruits_vegetables':
      return '🥦 Fruits & Vegetables'

    case 'beverages':
      return '🥤 Beverages'

    case 'other':
      return '🍱 Other'

    default:
      return null
  }
}

// Converts distance in kilometers into a readable label
function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) {
    return null
  }

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000)
    return `${meters} m away · straight-line`
  }

  return `${distanceKm.toFixed(1)} km away · straight-line`
}

export default function ListingCard({
  listing,
  distanceKm,
  currentUserId,
  onUpdated,
}: Props) {
  const [claiming, setClaiming] = useState(false)
  const [pickingUp, setPickingUp] = useState(false)
  const [error, setError] = useState('')

  // Available listings expire once their pickup window ends.
  const isExpired =
    listing.status === 'available' &&
    new Date(listing.pickup_window_end) <= new Date()

  const handleClaim = async () => {
    if (!currentUserId) {
      setError('Please log in first.')
      return
    }

    if (claiming) {
      return
    }

    setError('')
    setClaiming(true)

    try {
      const { data, error } = await supabase
        .from('listings')
        .update({
          status: 'claimed',
          claimed_by: currentUserId,
        })
        .eq('id', listing.id)
        .eq('status', 'available')
        .gt('pickup_window_end', new Date().toISOString())
        .select()
        .maybeSingle()

      if (error) {
        console.error('Claim error:', error)
        setError('Unable to claim this food. Please try again.')
        return
      }

      if (!data) {
        setError(
          'This food is no longer available. It may have expired or already been claimed.'
        )
        return
      }

      onUpdated(data as Listing)
    } catch (err) {
      console.error('Unexpected claim error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  const handlePickedUp = async () => {
    if (!currentUserId || listing.claimed_by !== currentUserId) {
      return
    }

    if (pickingUp) {
      return
    }

    setError('')
    setPickingUp(true)

    try {
      const { data, error } = await supabase
        .from('listings')
        .update({
          status: 'picked_up',
        })
        .eq('id', listing.id)
        .eq('status', 'claimed')
        .eq('claimed_by', currentUserId)
        .select()
        .maybeSingle()

      if (error) {
        console.error('Pickup error:', error)
        setError(
          'Unable to mark this food as picked up. Please try again.'
        )
        return
      }

      if (!data) {
        setError(
          'Unable to mark this listing as picked up. The listing may have changed.'
        )
        return
      }

      onUpdated(data as Listing)
    } catch (err) {
      console.error('Unexpected pickup error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setPickingUp(false)
    }
  }

  /*
   * Open the exact listing coordinates in Google Maps.
   *
   * We use coordinates rather than only the text location
   * so the map points to the actual geocoded location.
   */
  const handleOpenMaps = () => {
    if (
      listing.latitude === null ||
      listing.longitude === null
    ) {
      setError(
        'Map location is not available for this listing.'
      )
      return
    }

    const mapsUrl =
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${listing.latitude},${listing.longitude}`
      )}`

    window.open(
      mapsUrl,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const categoryLabel = formatCategory(listing.category)
  const distanceLabel = formatDistance(distanceKm)

  /*
   * Status UI
   */
  const statusLabel = isExpired
    ? 'Expired'
    : listing.status === 'available'
      ? 'Available'
      : listing.status === 'claimed'
        ? 'Claimed'
        : 'Picked Up'

  const statusStyles = isExpired
    ? 'bg-red-50 text-red-700 border-red-200'
    : listing.status === 'available'
      ? 'bg-green-50 text-green-700 border-green-200'
      : listing.status === 'claimed'
        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
        : 'bg-gray-50 text-gray-600 border-gray-200'

  return (
    <article
      className="
        group
        overflow-hidden
        rounded-2xl
        border
        border-gray-200
        bg-white
        shadow-sm
        transition
        duration-200
        hover:-translate-y-0.5
        hover:shadow-md
      "
    >
      {/* Food image */}
      {listing.photo_url ? (
        <div className="relative overflow-hidden bg-gray-100">
          <img
            src={listing.photo_url}
            alt={listing.title}
            className="
              h-52
              w-full
              object-cover
              transition
              duration-300
              group-hover:scale-[1.02]
            "
          />

          {/* Status over image */}
          <div className="absolute right-3 top-3">
            <span
              className={`
                inline-flex
                items-center
                rounded-full
                border
                px-3
                py-1.5
                text-xs
                font-bold
                shadow-sm
                backdrop-blur-sm
                ${statusStyles}
              `}
            >
              <span className="mr-1.5">
                {isExpired
                  ? '⏰'
                  : listing.status === 'available'
                    ? '●'
                    : listing.status === 'claimed'
                      ? '●'
                      : '✓'}
              </span>

              {statusLabel}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-green-50 to-gray-50">
          <span className="text-5xl">🍱</span>

          {/* Status over placeholder */}
          <div className="absolute right-3 top-3">
            <span
              className={`
                inline-flex
                items-center
                rounded-full
                border
                px-3
                py-1.5
                text-xs
                font-bold
                ${statusStyles}
              `}
            >
              {statusLabel}
            </span>
          </div>
        </div>
      )}

      <div className="p-5 sm:p-6">
        {/* Title + quantity */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-bold text-gray-900">
              {listing.title}
            </h3>

            {listing.quantity && (
              <p className="mt-1.5 text-sm font-semibold text-green-700">
                {listing.quantity}
              </p>
            )}
          </div>

          {/* Status when there is no image */}
          {!listing.photo_url && (
            <span
              className={`
                hidden
                shrink-0
                rounded-full
                border
                px-3
                py-1
                text-xs
                font-bold
                sm:inline-flex
                ${statusStyles}
              `}
            >
              {statusLabel}
            </span>
          )}
        </div>

        {/* Category badge */}
        {categoryLabel && (
          <div className="mt-3">
            <span
              className="
                inline-flex
                items-center
                rounded-full
                bg-gray-100
                px-3
                py-1.5
                text-xs
                font-semibold
                text-gray-700
              "
            >
              {categoryLabel}
            </span>
          </div>
        )}

        {/* Description */}
        {listing.description && (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-600">
            {listing.description}
          </p>
        )}

        {/* Pickup information */}
        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <div className="space-y-3">

            {/* Pickup area + distance */}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-base">
                📍
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Pickup area
                </p>

                <p className="mt-0.5 break-words text-sm font-medium text-gray-700">
                  {listing.location_text}
                </p>

                {distanceLabel && (
                  <p className="mt-1 text-sm font-semibold text-green-700">
                    📏 {distanceLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200" />

            {/* Pickup window */}
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-base">
                🕐
              </span>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Pickup window
                </p>

                <p className="mt-0.5 text-sm font-medium text-gray-700">
                  {formatDate(
                    listing.pickup_window_start
                  )}
                </p>

                <p className="text-sm text-gray-500">
                  until{' '}
                  {formatDate(
                    listing.pickup_window_end
                  )}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="
              mt-4
              rounded-xl
              border
              border-red-200
              bg-red-50
              p-3
              text-sm
              text-red-700
            "
          >
            <div className="flex items-start justify-between gap-3">
              <p>⚠️ {error}</p>

              <button
                type="button"
                onClick={() => setError('')}
                className="shrink-0 font-bold text-red-500 hover:text-red-700"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 space-y-3">

          {/* Open in Maps */}
          {listing.latitude !== null &&
            listing.longitude !== null && (
              <button
                type="button"
                onClick={handleOpenMaps}
                className="
                  w-full
                  rounded-xl
                  border
                  border-green-200
                  bg-green-50
                  px-4
                  py-3
                  font-semibold
                  text-green-700
                  transition
                  hover:bg-green-100
                "
              >
                🗺️ Open in Maps
              </button>
            )}

          {/* No map coordinates */}
          {listing.latitude === null &&
            listing.longitude === null && (
              <div
                className="
                  rounded-xl
                  border
                  border-gray-200
                  bg-gray-50
                  p-3
                  text-center
                  text-xs
                  text-gray-500
                "
              >
                📍 Map location unavailable
              </div>
            )}

          {/* Available */}
          {listing.status === 'available' &&
            !isExpired && (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="
                  w-full
                  rounded-xl
                  bg-green-600
                  px-4
                  py-3
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-green-700
                  hover:shadow
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {claiming
                  ? 'Claiming...'
                  : 'Claim Food'}
              </button>
            )}

          {/* Expired */}
          {listing.status === 'available' &&
            isExpired && (
              <div
                className="
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50
                  p-3
                  text-center
                  text-sm
                  font-semibold
                  text-red-600
                "
              >
                ⏰ Pickup window expired
              </div>
            )}

          {/* Claimed by current user */}
          {listing.status === 'claimed' &&
            listing.claimed_by === currentUserId && (
              <button
                onClick={handlePickedUp}
                disabled={pickingUp}
                className="
                  w-full
                  rounded-xl
                  bg-blue-600
                  px-4
                  py-3
                  font-semibold
                  text-white
                  shadow-sm
                  transition
                  hover:bg-blue-700
                  hover:shadow
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {pickingUp
                  ? 'Updating...'
                  : 'Mark as Picked Up'}
              </button>
            )}

          {/* Claimed by another user */}
          {listing.status === 'claimed' &&
            listing.claimed_by !== currentUserId && (
              <div
                className="
                  rounded-xl
                  border
                  border-yellow-200
                  bg-yellow-50
                  p-3
                  text-center
                  text-sm
                  font-medium
                  text-yellow-700
                "
              >
                🔒 This food has already been claimed.
              </div>
            )}

          {/* Picked up */}
          {listing.status === 'picked_up' && (
            <div
              className="
                rounded-xl
                border
                border-gray-200
                bg-gray-50
                p-3
                text-center
                text-sm
                font-semibold
                text-gray-600
              "
            >
              🎉 Food successfully rescued
            </div>
          )}

        </div>
      </div>
    </article>
  )
}