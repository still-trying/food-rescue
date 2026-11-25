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
      className={`fr-surface-3d fr-card-3d group overflow-hidden rounded-2xl border ${
        highlighted
          ? 'border-green-600 ring-2 ring-green-500/40 dark:border-emerald-400 dark:ring-emerald-400/35'
          : 'border-slate-200/80 dark:border-emerald-500/20'
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
        <div className="relative overflow-hidden bg-slate-100 dark:bg-emerald-950/60">
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
        <div className="relative flex h-32 items-center justify-center bg-gradient-to-br from-emerald-50 via-green-50/70 to-amber-50/50 dark:from-emerald-950/90 dark:via-[#0e1f18] dark:to-amber-950/35">
          <span className="text-5xl drop-shadow-sm" aria-hidden="true">
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
          <h3 className="truncate text-xl font-bold text-slate-900 dark:text-slate-50">
            {listing.title}
          </h3>

          {listing.quantity && (
            <p className="mt-1.5 text-sm font-semibold text-green-700 dark:text-emerald-400">
              {listing.quantity}
            </p>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {categoryLabel && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
              {categoryLabel}
            </span>
          )}
          {dietaryLabel && (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/70 dark:text-emerald-300">
              {dietaryLabel}
            </span>
          )}
          {storageLabel && (
            <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/70 dark:text-sky-300">
              {storageLabel}
            </span>
          )}
          {listing.allergens && listing.allergens.length > 0 && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/70 dark:text-amber-300">
              ⚠️ Contains: {listing.allergens.join(', ')}
            </span>
          )}
          {endingSoon && (
            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/70 dark:text-amber-300">
              ⚡ Rescue within 1 hr
            </span>
          )}
          {!endingSoon &&
            !isExpired &&
            listing.status === 'available' &&
            expiryRisk.riskTier === 'high' && (
              <span
                title={expiryRisk.reason}
                className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-800 dark:border-orange-500/30 dark:bg-orange-950/70 dark:text-orange-300"
              >
                🔥 High expiry risk
              </span>
            )}
        </div>

        {listing.description && (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {listing.description}
          </p>
        )}

        <div className="mt-5 rounded-xl border border-slate-200/60 bg-slate-50/85 p-4 dark:border-emerald-500/15 dark:bg-[#0a1410]/70">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-base" aria-hidden="true">
                📍
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Pickup area
                </p>

                <p className="mt-0.5 break-words text-sm font-medium text-slate-700 dark:text-slate-200">
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
                  <p className="mt-1 text-sm font-semibold text-green-700 dark:text-emerald-400">
                    📏 {distanceLabel}
                  </p>
                )}
              </div>
            </div>

            <div className="border-t border-slate-200/80 dark:border-emerald-500/15" />

            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-base" aria-hidden="true">
                🕐
              </span>

              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Pickup window
                </p>

                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {formatDateTime(listing.pickup_window_start)}
                </p>

                <p className="text-sm text-slate-500 dark:text-slate-400">
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
            className="mt-4 rounded-xl border border-red-200 bg-red-50/95 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-300"
          >
            <div className="flex items-start justify-between gap-3">
              <p>⚠️ {error}</p>
              <button
                type="button"
                onClick={() => setError('')}
                className="shrink-0 font-bold text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-200"
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
                    className="w-full rounded-xl border border-green-200 bg-green-50/90 px-4 py-3 font-semibold text-green-700 transition hover:bg-green-100 dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
                  >
                    🗺️ View Pickup Location
                  </button>
                  <button
                    type="button"
                    onClick={handleGetDirections}
                    className="w-full rounded-xl border border-blue-200 bg-blue-50/90 px-4 py-3 font-semibold text-blue-700 transition hover:bg-blue-100 dark:border-sky-500/30 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/70"
                  >
                    🚗 Get Directions
                  </button>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-center text-xs text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-400">
                  {pickupDetailsLoading
                    ? 'Loading your private pickup details...'
                    : 'Private pickup address is not available for this listing yet.'}
                </div>
              )
            ) : (
              <div className="rounded-xl border border-blue-100 bg-blue-50/90 p-3 text-center text-sm text-blue-800 dark:border-sky-500/25 dark:bg-sky-950/45 dark:text-sky-200">
                📍 Approximate pickup area shown. The full pickup destination is
                shared after you claim the food.
              </div>
            )
          )}

          {listing.status === 'claimed' && isClaimant && (
            <div className="space-y-3">
              <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-4 dark:border-sky-500/30 dark:bg-sky-950/55">
                <p className="text-sm font-bold text-blue-800 dark:text-sky-200">
                  ✅ Food reserved for you
                </p>
                <p className="mt-1 text-sm leading-5 text-blue-700 dark:text-sky-300">
                  Head to the pickup location during the pickup window, then
                  mark the food as picked up.
                </p>
              </div>

              {pickupDetails && pickupDetails.pickup_address.trim() ? (
                <button
                  type="button"
                  onClick={handleGetDirections}
                  className="fr-btn-3d w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-sky-600 dark:hover:bg-sky-500 dark:focus:ring-offset-slate-900"
                >
                  🚗 Get Directions to Pickup
                </button>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500 dark:border-slate-700/60 dark:bg-slate-900/60 dark:text-slate-400">
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
                  className="w-full rounded-xl border border-slate-300 bg-white/90 px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-emerald-500/25 dark:bg-emerald-950/60 dark:text-slate-200 dark:hover:bg-emerald-900/70"
                >
                  {chatOpen ? 'Hide Pickup Chat' : '💬 Open Pickup Chat'}
                </button>

                {chatOpen && (
                  <Suspense
                    fallback={
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
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
