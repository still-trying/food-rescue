import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type Listing = {
  id: string
  title: string
  description: string | null
  quantity: string | null
  category: string | null
  photo_url: string | null

  location_text: string
  approx_latitude: number | null
  approx_longitude: number | null

  pickup_window_start: string
  pickup_window_end: string

  status: 'available' | 'claimed' | 'picked_up'

  posted_by: string
  claimed_by: string | null
  created_at: string
}

type PickupDetails = {
  pickup_address: string
  pickup_instructions: string | null
  contact_phone: string | null
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
  const [pickupDetailsState, setPickupDetailsState] = useState<{
    listingId: string
    userId: string
    details: PickupDetails | null
    loading: boolean
    error: string
  } | null>(null)

  const isOwner = Boolean(currentUserId && listing.posted_by === currentUserId)
  const isClaimant = Boolean(
    currentUserId &&
    listing.claimed_by === currentUserId &&
    (listing.status === 'claimed' || listing.status === 'picked_up')
  )
  const canReadPickupDetails = isOwner || isClaimant

  // Bind loaded private details to both the listing and the authorized user.
  // This prevents stale details from flashing after an account/listing change.
  const pickupDetailsStateMatches = Boolean(
    pickupDetailsState &&
    pickupDetailsState.listingId === listing.id &&
    pickupDetailsState.userId === currentUserId
  )
  const pickupDetails = canReadPickupDetails && pickupDetailsStateMatches
    ? pickupDetailsState?.details ?? null
    : null
  const pickupDetailsLoading = canReadPickupDetails && (
    !pickupDetailsStateMatches || Boolean(pickupDetailsState?.loading)
  )
  const pickupDetailsError = canReadPickupDetails && pickupDetailsStateMatches
    ? pickupDetailsState?.error ?? ''
    : ''

  useEffect(() => {
    if (!canReadPickupDetails || !currentUserId) return

    let cancelled = false
    const requestUserId = currentUserId

    const loadPickupDetails = async () => {
      const { data, error: detailsError } = await supabase
        .from('listing_pickup_details')
        .select('pickup_address, pickup_instructions, contact_phone')
        .eq('listing_id', listing.id)
        .maybeSingle()

      if (cancelled) return

      if (detailsError) {
        console.error('Private pickup details error:', detailsError)
        setPickupDetailsState({
          listingId: listing.id,
          userId: requestUserId,
          details: null,
          loading: false,
          error: 'Private pickup details could not be loaded. Please refresh this listing.',
        })
        return
      }

      setPickupDetailsState({
        listingId: listing.id,
        userId: requestUserId,
        details: data as PickupDetails | null,
        loading: false,
        error: '',
      })
    }

    void loadPickupDetails()

    return () => {
      cancelled = true
    }
  }, [listing.id, listing.posted_by, listing.claimed_by, listing.status, currentUserId, canReadPickupDetails])

  // Available listings expire once their pickup window ends.
  const isExpired =
    listing.status === 'available' &&
    new Date(listing.pickup_window_end) <= new Date()

  /*
   * Refresh a listing from Supabase when an action
   * returns an unexpected result.
   *
   * This helps recover when the local card is stale
   * because another user changed the listing.
   */
  const refreshListing = async (): Promise<boolean> => {
    try {
      const {
        data,
        error: refreshError,
      } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listing.id)
        .maybeSingle()

      if (refreshError) {
        console.error(
          'Listing refresh error:',
          refreshError
        )
        return false
      }

      if (!data) {
        return false
      }

      onUpdated(data as unknown as Listing)
      return true
    } catch (err) {
      console.error(
        'Unexpected listing refresh error:',
        err
      )
      return false
    }
  }

  /*
   * Claim available food.
   *
   * The update only succeeds when the listing is
   * still available and its pickup window has not ended.
   */
  const handleClaim = async () => {
    if (!currentUserId) {
      setError('Please log in first.')
      return
    }

    if (listing.posted_by === currentUserId) {
      setError('You cannot claim your own listing.')
      return
    }

    if (claiming) {
      return
    }

    setError('')
    setClaiming(true)

    try {
      const { data, error } = await supabase.rpc(
        'claim_listing',
        { p_listing_id: listing.id }
      )

      if (error) {
        console.error('Claim error:', error)

        // The action may have failed because the
        // listing changed or because of another error.
        const refreshed = await refreshListing()

        setError(
          refreshed
            ? 'Unable to claim this food. The latest listing status has been loaded. Please try again if it is still available.'
            : 'Unable to claim this food. Please check your connection and try again.'
        )

        return
      }

      if (!data) {
        /*
         * No row was updated. Another user may have
         * claimed the listing, or its pickup window
         * may have expired.
         */
        const refreshed = await refreshListing()

        if (!refreshed) {
          setError(
            'This food is no longer available. It may have been removed, expired, or already claimed.'
          )
          return
        }

        setError(
          'This food could not be claimed. The latest listing status has been loaded.'
        )

        return
      }

      onUpdated(data as unknown as Listing)
    } catch (err) {
      console.error('Unexpected claim error:', err)

      // Attempt recovery even after an unexpected failure.
      await refreshListing()

      setError(
        'Something went wrong while claiming this food. The listing has been refreshed if it is still available.'
      )
    } finally {
      setClaiming(false)
    }
  }

  /*
   * Mark food as picked up.
   *
   * Only the current claimant can perform this operation.
   */
  const handlePickedUp = async () => {
    if (
      !currentUserId ||
      listing.claimed_by !== currentUserId
    ) {
      setError(
        'Only the person who claimed this food can mark it as picked up.'
      )
      return
    }

    if (pickingUp) {
      return
    }

    setError('')
    setPickingUp(true)

    try {
      const { data, error } = await supabase.rpc(
        'mark_listing_picked_up',
        { p_listing_id: listing.id }
      )

      if (error) {
        console.error('Pickup error:', error)

        const refreshed = await refreshListing()

        setError(
          refreshed
            ? 'Unable to complete the pickup update. The latest listing status has been loaded.'
            : 'Unable to mark this food as picked up. Please check your connection and try again.'
        )

        return
      }

      if (!data) {
        /*
         * The listing may have changed before this
         * request completed.
         */
        const refreshed = await refreshListing()

        if (!refreshed) {
          setError(
            'Unable to update this listing. It may have been removed or changed.'
          )
          return
        }

        setError(
          'This listing changed before it could be updated. The latest status has been loaded.'
        )

        return
      }

      onUpdated(data as unknown as Listing)
    } catch (err) {
      console.error('Unexpected pickup error:', err)

      await refreshListing()

      setError(
        'Something went wrong while updating the pickup. The listing has been refreshed if it is still available.'
      )
    } finally {
      setPickingUp(false)
    }
  }

  /*
   * Open the private pickup destination. The database RLS policy
   * exposes these details only to the donor or successful claimant.
   */
  const handleOpenMaps = () => {
    const privateAddress = pickupDetails?.pickup_address.trim()
    if (!privateAddress) {
      setError('The private pickup address is not available for this listing.')
      return
    }

    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(privateAddress)}`
    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }

  const handleGetDirections = () => {
    const privateAddress = pickupDetails?.pickup_address.trim()
    if (!privateAddress) {
      setError('The private pickup address is not available for this listing.')
      return
    }

    const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
      privateAddress
    )}&travelmode=driving`
    window.open(directionsUrl, '_blank', 'noopener,noreferrer')
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

                {canReadPickupDetails && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                      Private pickup destination
                    </p>
                    {pickupDetailsLoading ? (
                      <p className="mt-1 text-sm text-blue-700">Loading pickup details...</p>
                    ) : pickupDetails ? (
                      <>
                        <p className="mt-1 break-words text-sm font-semibold text-blue-900">
                          {pickupDetails.pickup_address}
                        </p>
                        {pickupDetails.pickup_instructions && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-blue-800">
                            {pickupDetails.pickup_instructions}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 text-sm text-blue-700">
                        {pickupDetailsError || 'Private pickup details have not been added for this older listing yet.'}
                      </p>
                    )}
                  </div>
                )}

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
            aria-live="polite"
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
          {/* Navigation */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Pickup Navigation
            </p>

            {/* Available listing: exact navigation is donor-only until claimed. */}
            {listing.status === 'available' && !isExpired && (
              isOwner ? (
                pickupDetails && pickupDetails.pickup_address.trim() ? (
                  <div className="space-y-3">
                    <button type="button" onClick={handleOpenMaps} className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-semibold text-green-700 transition hover:bg-green-100">
                      🗺️ View Pickup Location
                    </button>
                    <button type="button" onClick={handleGetDirections} className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-700 transition hover:bg-blue-100">
                      🚗 Get Directions
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">
                    {pickupDetailsLoading ? 'Loading your private pickup details...' : 'Private pickup address is not available for this listing yet.'}
                  </div>
                )
              ) : (
                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center text-sm text-blue-800">
                  📍 Approximate pickup area shown. The full pickup destination is shared after you claim the food.
                </div>
              )
            )}

            {/* Claimed by current user */}
            {listing.status === 'claimed' &&
              listing.claimed_by === currentUserId && (
                <div className="space-y-3">
                  <div
                    className="
                      rounded-xl
                      border
                      border-blue-200
                      bg-blue-50
                      p-4
                    "
                  >
                    <p className="text-sm font-bold text-blue-800">
                      ✅ Food reserved for you
                    </p>

                    <p className="mt-1 text-sm leading-5 text-blue-700">
                      Head to the pickup location during the pickup
                      window, then mark the food as picked up.
                    </p>
                  </div>

                  {pickupDetails && pickupDetails.pickup_address.trim() ? (
                    <button
                      type="button"
                      onClick={handleGetDirections}
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
                        focus:outline-none
                        focus:ring-2
                        focus:ring-blue-500
                        focus:ring-offset-2
                      "
                    >
                      🚗 Get Directions to Pickup
                    </button>
                  ) : (
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
                </div>
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
                  {isOwner ? '🔒 Your listing has been claimed by someone else.' : '🔒 This food has already been claimed.'}
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
                  font-medium
                  text-gray-600
                "
              >
                📍 This rescue has already been completed.
              </div>
            )}

            {/* Expired available listing */}
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
                    font-medium
                    text-red-600
                  "
                >
                  ⏰ Navigation is unavailable because the pickup
                  window has expired.
                </div>
              )}
          </div>

          {/* Private donor contact: visible only to the donor or successful claimant. */}
          {canReadPickupDetails && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                {isClaimant ? 'Contact the donor' : 'Your contact number'}
              </p>

              {pickupDetailsLoading ? (
                <p className="mt-2 text-sm text-emerald-700">Loading private contact details...</p>
              ) : pickupDetails?.contact_phone ? (
                <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-emerald-950">
                    {pickupDetails.contact_phone}
                  </p>
                  {isClaimant && (
                    <a
                      href={`tel:${pickupDetails.contact_phone}`}
                      className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                    >
                      📞 Call donor
                    </a>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-emerald-800">
                  No contact number was saved for this listing.
                </p>
              )}

              <p className="mt-2 text-xs text-emerald-700">
                {isClaimant
                  ? 'Use this number to coordinate your pickup. Please contact the donor respectfully.'
                  : 'Your number is private and is shared only with the person who successfully claims this food.'}
              </p>
              {pickupDetailsError && (
                <p className="mt-2 text-xs text-red-700" role="alert">
                  {pickupDetailsError}
                </p>
              )}
            </div>
          )}

          {/* Available */}
          {listing.status === 'available' &&
            !isExpired && (
              isOwner ? (
                <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-semibold text-gray-600">
                  This is your listing.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleClaim}
                  disabled={claiming}
                  className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-green-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {claiming ? 'Claiming...' : 'Claim Food'}
                </button>
              )
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
                type="button"
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
                {isOwner ? '🔒 Your listing has been claimed by someone else.' : '🔒 This food has already been claimed.'}
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