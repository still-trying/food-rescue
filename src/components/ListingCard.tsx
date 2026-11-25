import { lazy, memo, Suspense, useState } from 'react'
import {
  formatCategoryLabel,
  formatDietaryLabel,
  formatStorageLabel,
} from '../constants/categories'
import type { PickupDetailsEntry } from '../hooks/useListings'
import { supabase } from '../lib/supabase'
import type { Listing } from '../types/listing'
import { formatDateTime, isListingExpired } from '../utils/date'
import { formatDistance } from '../utils/geo'
import { isEndingSoon, predictExpiryRisk } from '../utils/smartRescue'
import EditListingModal from './EditListingModal'
import ListingActions from './ListingActions'
import ListingStatusBadge from './ListingStatusBadge'
import { PrivateContactBox, PrivateDestinationBox } from './PickupDetailsPanel'

const PickupChatPanel = lazy(() => import('./PickupChatPanel'))

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
  onRepost: (listing: Listing) => void
  highlighted?: boolean
}

function ListingCard({
  listing,
  distanceKm,
  currentUserId,
  nowMs,
  pickupDetailsEntry,
  onRetryPickupDetails,
  onUpdated,
  onDeleted,
  onRepost,
  highlighted = false,
}: Props) {
  const [error, setError] = useState('')
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

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
  const expiryRisk = predictExpiryRisk(listing, nowMs)
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
  const dietaryLabel = formatDietaryLabel(listing.dietary_type)
  const storageLabel = formatStorageLabel(listing.storage_type)
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
      {editOpen && (
        <EditListingModal
          listing={listing}
          onUpdated={onUpdated}
          onClose={() => setEditOpen(false)}
        />
      )}

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
          {dietaryLabel && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
              {dietaryLabel}
            </span>
          )}
          {storageLabel && (
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
              {storageLabel}
            </span>
          )}
          {listing.allergens && listing.allergens.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900">
              ⚠️ Contains: {listing.allergens.join(', ')}
            </span>
          )}
          {endingSoon && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
              ⚡ Rescue within 1 hr
            </span>
          )}
          {!endingSoon &&
            !isExpired &&
            listing.status === 'available' &&
            expiryRisk.riskTier === 'high' && (
              <span
                title={expiryRisk.reason}
                className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800"
              >
                🔥 High expiry risk
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

          {listing.status === 'claimed' && isClaimant && (
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

          {canReadPickupDetails &&
            currentUserId &&
            (listing.status === 'claimed' || listing.status === 'picked_up') && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setChatOpen((open) => !open)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {chatOpen ? 'Hide Pickup Chat' : '💬 Open Pickup Chat'}
                </button>

                {chatOpen && (
                  <Suspense
                    fallback={
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
                        Loading chat...
                      </div>
                    }
                  >
                    <PickupChatPanel
                      listingId={listing.id}
                      currentUserId={currentUserId}
                      donorId={listing.posted_by}
                    />
                  </Suspense>
                )}
              </div>
            )}

          <ListingActions
            listing={listing}
            currentUserId={currentUserId}
            isOwner={isOwner}
            isClaimant={isClaimant}
            isExpired={isExpired}
            onUpdated={onUpdated}
            onDeleted={onDeleted}
            onEdit={() => setEditOpen(true)}
            onRepost={onRepost}
            onError={setError}
            refreshListing={refreshListing}
          />
        </div>
      </div>
    </article>
  )
}

export default memo(ListingCard)
