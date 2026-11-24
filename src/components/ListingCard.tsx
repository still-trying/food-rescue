import { memo, useState } from 'react'
import { formatCategoryLabel } from '../constants/categories'
import type { PickupDetailsEntry } from '../hooks/useListings'
import { supabase } from '../lib/supabase'
import type { Listing, ReportReason } from '../types/listing'
import { formatDateTime, isListingExpired } from '../utils/date'
import { formatDistance } from '../utils/geo'
import { isEndingSoon } from '../utils/smartRescue'
import ListingStatusBadge from './ListingStatusBadge'
import { PrivateContactBox, PrivateDestinationBox } from './PickupDetailsPanel'

export type { Listing }

type Props = {
  listing: Listing
  distanceKm: number | null
  currentUserId: string | null
  nowMs: number
  pickupDetailsEntry?: PickupDetailsEntry
  onRetryPickupDetails: (listingId: string) => void
  onUpdated: (listing: Listing) => void
  onDeleted: (listingId: string) => void
  highlighted?: boolean
}

const REPORT_REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'unsafe_food', label: 'Food safety concern' },
  { value: 'wrong_location', label: 'Inaccurate location or details' },
  { value: 'spam', label: 'Spam or duplicate listing' },
  { value: 'harassment', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
] as const

function ListingCard({
  listing,
  distanceKm,
  currentUserId,
  nowMs,
  pickupDetailsEntry,
  onRetryPickupDetails,
  onUpdated,
  onDeleted,
  highlighted = false,
}: Props) {
  const [claiming, setClaiming] = useState(false)
  const [pickingUp, setPickingUp] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [unclaiming, setUnclaiming] = useState(false)
  const [confirmUnclaim, setConfirmUnclaim] = useState(false)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason>('unsafe_food')
  const [reportDetails, setReportDetails] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportSubmitted, setReportSubmitted] = useState(false)

  const [error, setError] = useState('')
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)

  const isOwner = Boolean(currentUserId && listing.posted_by === currentUserId)
  const isClaimant = Boolean(
    currentUserId &&
      listing.claimed_by === currentUserId &&
      (listing.status === 'claimed' || listing.status === 'picked_up')
  )
  const canReadPickupDetails = isOwner || isClaimant

  const detailsMatchesUser = Boolean(
    pickupDetailsEntry && pickupDetailsEntry.userId === currentUserId
  )
  const pickupDetails =
    canReadPickupDetails && detailsMatchesUser
      ? pickupDetailsEntry?.details ?? null
      : null
  const pickupDetailsLoading =
    canReadPickupDetails &&
    (!detailsMatchesUser || Boolean(pickupDetailsEntry?.loading))
  const pickupDetailsError =
    canReadPickupDetails && detailsMatchesUser
      ? pickupDetailsEntry?.error ?? ''
      : ''

  const isExpired = isListingExpired(listing, nowMs)
  const endingSoon = isEndingSoon(listing, nowMs)
  const showPhoto =
    Boolean(listing.photo_url) && failedPhotoUrl !== listing.photo_url

  const refreshListing = async (): Promise<boolean> => {
    try {
      const { data, error: refreshError } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listing.id)
        .maybeSingle()

      if (refreshError || !data) {
        return false
      }

      onUpdated(data)
      return true
    } catch {
      return false
    }
  }

  const handleClaim = async () => {
    if (!currentUserId) {
      setError('Please log in first.')
      return
    }
    if (listing.posted_by === currentUserId) {
      setError('You cannot claim your own listing.')
      return
    }
    if (claiming) return

    setError('')
    setClaiming(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('claim_listing', {
        p_listing_id: listing.id,
      })

      if (rpcError) {
        if (import.meta.env.DEV) {
          console.error('Claim error:', rpcError)
        }
        const refreshed = await refreshListing()
        setError(
          refreshed
            ? 'Unable to claim this food. The latest listing status has been loaded.'
            : 'Unable to claim this food. Please check your connection and try again.'
        )
        return
      }

      if (!data) {
        const refreshed = await refreshListing()
        setError(
          refreshed
            ? 'This food could not be claimed. The latest listing status has been loaded.'
            : 'This food is no longer available. It may have been removed, expired, or already claimed.'
        )
        return
      }

      onUpdated(data)
    } catch {
      await refreshListing()
      setError(
        'Something went wrong while claiming this food. The listing has been refreshed if available.'
      )
    } finally {
      setClaiming(false)
    }
  }

  const handlePickedUp = async () => {
    if (!currentUserId || listing.claimed_by !== currentUserId) {
      setError(
        'Only the person who claimed this food can mark it as picked up.'
      )
      return
    }
    if (pickingUp) return

    setError('')
    setPickingUp(true)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'mark_listing_picked_up',
        { p_listing_id: listing.id }
      )

      if (rpcError || !data) {
        const refreshed = await refreshListing()
        setError(
          refreshed
            ? 'This listing changed before it could be updated. The latest status has been loaded.'
            : 'Unable to mark this food as picked up. Please check your connection and try again.'
        )
        return
      }

      onUpdated(data)
    } catch {
      await refreshListing()
      setError('Something went wrong while updating the pickup.')
    } finally {
      setPickingUp(false)
    }
  }

  const handleCancelListing = async () => {
    if (!isOwner || canceling) return
    setError('')
    setCanceling(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_listing', {
        p_listing_id: listing.id,
      })

      if (rpcError) {
        if (import.meta.env.DEV) {
          console.error('Cancel listing error:', rpcError)
        }
        setError(
          rpcError.message.toLowerCase().includes('could not find')
            ? 'Listing cancellation requires applying the latest Supabase migration.'
            : 'Unable to cancel this listing. It may have already been claimed.'
        )
        setConfirmCancel(false)
        await refreshListing()
        return
      }

      if (!data) {
        setError('Listing could not be cancelled because its status changed.')
        setConfirmCancel(false)
        await refreshListing()
        return
      }

      onDeleted(listing.id)
    } catch {
      setError('Something went wrong while cancelling the listing.')
    } finally {
      setCanceling(false)
    }
  }

  const handleUnclaim = async () => {
    if (!isClaimant || unclaiming) return
    setError('')
    setUnclaiming(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('unclaim_listing', {
        p_listing_id: listing.id,
      })

      if (rpcError) {
        if (import.meta.env.DEV) {
          console.error('Unclaim listing error:', rpcError)
        }
        setError(
          rpcError.message.toLowerCase().includes('could not find')
            ? 'Releasing a claim requires applying the latest Supabase migration.'
            : 'Unable to release this claim right now.'
        )
        setConfirmUnclaim(false)
        await refreshListing()
        return
      }

      if (!data) {
        setError('Unable to release this claim. The listing status changed.')
        setConfirmUnclaim(false)
        await refreshListing()
        return
      }

      setConfirmUnclaim(false)
      onUpdated(data)
    } catch {
      setError('Something went wrong while releasing your claim.')
    } finally {
      setUnclaiming(false)
    }
  }

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId || reporting) return

    setError('')
    setReporting(true)

    try {
      const { error: rpcError } = await supabase.rpc('report_listing', {
        p_listing_id: listing.id,
        p_reason: reportReason,
        p_details: reportDetails.trim() || null,
      })

      if (rpcError) {
        if (import.meta.env.DEV) {
          console.error('Report listing error:', rpcError)
        }
        setError(
          rpcError.message.toLowerCase().includes('could not find')
            ? 'Reporting requires applying the latest Supabase migration.'
            : 'Unable to submit report right now. Please try again.'
        )
        return
      }

      setReportSubmitted(true)
      setReportOpen(false)
      setReportDetails('')
    } catch {
      setError('Something went wrong while submitting your report.')
    } finally {
      setReporting(false)
    }
  }

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

  const categoryLabel = formatCategoryLabel(listing.category)
  const distanceLabel = formatDistance(distanceKm)

  return (
    <article
      id={`listing-${listing.id}`}
      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        highlighted
          ? 'border-green-600 ring-2 ring-green-500/40'
          : 'border-gray-200'
      }`}
    >
      {showPhoto && listing.photo_url ? (
        <div className="relative overflow-hidden bg-gray-100">
          <img
            src={listing.photo_url}
            alt={listing.title}
            loading="lazy"
            onError={() => setFailedPhotoUrl(listing.photo_url)}
            className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
          />

          <div className="absolute right-3 top-3">
            <ListingStatusBadge
              status={listing.status}
              isExpired={isExpired}
              isEndingSoon={endingSoon}
              withBackdrop
            />
          </div>
        </div>
      ) : (
        <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-green-50 to-gray-50">
          <span className="text-5xl" aria-hidden="true">
            🍱
          </span>

          <div className="absolute right-3 top-3">
            <ListingStatusBadge
              status={listing.status}
              isExpired={isExpired}
              isEndingSoon={endingSoon}
            />
          </div>
        </div>
      )}

      <div className="p-5 sm:p-6">
        <div className="min-w-0">
          <h3 className="truncate text-xl font-bold text-gray-900">
            {listing.title}
          </h3>

          {listing.quantity && (
            <p className="mt-1.5 text-sm font-semibold text-green-700">
              {listing.quantity}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {categoryLabel && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">
              {categoryLabel}
            </span>
          )}
          {endingSoon && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              ⚡ Rescue within 1 hr
            </span>
          )}
        </div>

        {listing.description && (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-600">
            {listing.description}
          </p>
        )}

        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-base" aria-hidden="true">
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
                  <PrivateDestinationBox
                    listingId={listing.id}
                    pickupDetails={pickupDetails}
                    loading={pickupDetailsLoading}
                    error={pickupDetailsError}
                    onRetry={onRetryPickupDetails}
                  />
                )}

                {distanceLabel && (
                  <p className="mt-1 text-sm font-semibold text-green-700">
                    📏 {distanceLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-gray-200" />

            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-base" aria-hidden="true">
                🕐
              </span>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Pickup window
                </p>

                <p className="mt-0.5 text-sm font-medium text-gray-700">
                  {formatDateTime(listing.pickup_window_start)}
                </p>

                <p className="text-sm text-gray-500">
                  until {formatDateTime(listing.pickup_window_end)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
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

        <div className="mt-5 space-y-3">
          {listing.status === 'available' && !isExpired && (
            isOwner ? (
              pickupDetails && pickupDetails.pickup_address.trim() ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleOpenMaps}
                    className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-semibold text-green-700 transition hover:bg-green-100"
                  >
                    🗺️ View Pickup Location
                  </button>
                  <button
                    type="button"
                    onClick={handleGetDirections}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-700 transition hover:bg-blue-100"
                  >
                    🚗 Get Directions
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">
                  {pickupDetailsLoading
                    ? 'Loading your private pickup details...'
                    : 'Private pickup address is not available for this listing yet.'}
                </div>
              )
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-center text-sm text-blue-800">
                📍 Approximate pickup area shown. The full pickup destination is
                shared after you claim the food.
              </div>
            )
          )}

          {listing.status === 'claimed' &&
            listing.claimed_by === currentUserId && (
              <div className="space-y-3">
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-bold text-blue-800">
                    ✅ Food reserved for you
                  </p>
                  <p className="mt-1 text-sm leading-5 text-blue-700">
                    Head to the pickup location during the pickup window, then
                    mark the food as picked up.
                  </p>
                </div>

                {pickupDetails && pickupDetails.pickup_address.trim() ? (
                  <button
                    type="button"
                    onClick={handleGetDirections}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    🚗 Get Directions to Pickup
                  </button>
                ) : (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500">
                    📍 Map location unavailable
                  </div>
                )}
              </div>
            )}

          {canReadPickupDetails && (
            <PrivateContactBox
              isClaimant={isClaimant}
              pickupDetails={pickupDetails}
              loading={pickupDetailsLoading}
              error={pickupDetailsError}
            />
          )}

          {listing.status === 'available' && !isExpired && (
            isOwner ? (
              <div className="space-y-2">
                <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-semibold text-gray-600">
                  This is your listing.
                </div>

                {!confirmCancel ? (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="w-full rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Cancel Listing
                  </button>
                ) : (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-center text-xs font-medium text-red-800">
                      Remove this listing from the board?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmCancel(false)}
                        disabled={canceling}
                        className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700"
                      >
                        Keep
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancelListing()}
                        disabled={canceling}
                        className="flex-1 rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        {canceling ? 'Cancelling...' : 'Confirm Cancel'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void handleClaim()}
                disabled={claiming}
                className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-green-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
              >
                {claiming ? 'Claiming...' : 'Claim Food'}
              </button>
            )
          )}

          {listing.status === 'available' && isExpired && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm font-semibold text-red-600">
              ⏰ Pickup window expired
            </div>
          )}

          {listing.status === 'claimed' &&
            listing.claimed_by === currentUserId && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => void handlePickedUp()}
                  disabled={pickingUp || unclaiming}
                  className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pickingUp ? 'Updating...' : 'Mark as Picked Up'}
                </button>

                {!confirmUnclaim ? (
                  <button
                    type="button"
                    onClick={() => setConfirmUnclaim(true)}
                    disabled={pickingUp}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    Can&apos;t make it? Release claim
                  </button>
                ) : (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-center text-xs font-medium text-amber-900">
                      Release this reservation so someone else can rescue it?
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmUnclaim(false)}
                        disabled={unclaiming}
                        className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-xs font-semibold text-gray-700"
                      >
                        Keep Claim
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleUnclaim()}
                        disabled={unclaiming}
                        className="flex-1 rounded-lg bg-amber-600 py-2 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        {unclaiming ? 'Releasing...' : 'Confirm Release'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

          {listing.status === 'claimed' &&
            listing.claimed_by !== currentUserId && (
              <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center text-sm font-medium text-yellow-700">
                {isOwner
                  ? '🔒 Your listing has been claimed by someone else.'
                  : '🔒 This food has already been claimed.'}
              </div>
            )}

          {listing.status === 'picked_up' && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-sm font-semibold text-gray-600">
              🎉 Food successfully rescued
            </div>
          )}

          {!isOwner && (
            <div className="pt-1">
              {reportSubmitted ? (
                <p className="text-center text-xs text-gray-500">
                  ✓ Report submitted for review.
                </p>
              ) : !reportOpen ? (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => setReportOpen(true)}
                    className="text-xs font-medium text-gray-400 hover:text-gray-600"
                  >
                    ⚑ Report listing
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={(e) => void handleReportSubmit(e)}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-left"
                >
                  <label
                    htmlFor={`report-reason-${listing.id}`}
                    className="block text-xs font-semibold text-gray-700"
                  >
                    Reason
                  </label>
                  <select
                    id={`report-reason-${listing.id}`}
                    value={reportReason}
                    onChange={(e) =>
                      setReportReason(e.target.value as ReportReason)
                    }
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs"
                  >
                    {REPORT_REASONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <label
                    htmlFor={`report-details-${listing.id}`}
                    className="mt-2 block text-xs font-semibold text-gray-700"
                  >
                    Details (optional)
                  </label>
                  <textarea
                    id={`report-details-${listing.id}`}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Briefly describe the issue..."
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs"
                  />

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReportOpen(false)}
                      disabled={reporting}
                      className="flex-1 rounded-lg border border-gray-300 bg-white py-1.5 text-xs font-semibold text-gray-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reporting}
                      className="flex-1 rounded-lg bg-gray-800 py-1.5 text-xs font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
                    >
                      {reporting ? 'Sending...' : 'Submit Report'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

export default memo(ListingCard)
