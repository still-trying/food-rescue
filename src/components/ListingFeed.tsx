import type { PickupDetailsEntry } from '../hooks/useListings'
import type { Listing, ListingWithDistance } from '../types/listing'
import ListingCard from './ListingCard'

export type { ListingWithDistance }

type Props = {
  listings: ListingWithDistance[]
  currentUserId: string | null
  nowMs: number
  pickupDetailsById: Record<string, PickupDetailsEntry>
  highlightedListingId?: string | null
  onRetryPickupDetails: (listingId: string) => void
  onUpdated: (listing: Listing) => void
  onDeleted: (listingId: string) => void
  onRepost: (listing: Listing) => void
}

export default function ListingFeed({
  listings,
  currentUserId,
  nowMs,
  pickupDetailsById,
  highlightedListingId = null,
  onRetryPickupDetails,
  onUpdated,
  onDeleted,
  onRepost,
}: Props) {
  if (listings.length === 0) {
    return (
      <div
        role="status"
        className="fr-surface-3d rounded-2xl border border-dashed border-slate-300 p-12 text-center dark:border-emerald-500/25"
      >
        <div className="text-5xl" aria-hidden="true">
          🍱
        </div>

        <h3 className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">
          No food listings found
        </h3>

        <p className="mt-2 text-slate-500 dark:text-slate-400">
          Try changing your search or filters, or be the first person to share
          surplus food.
        </p>
      </div>
    )
  }

  return (
    <section
      aria-label="Food listings"
      className="grid gap-6 md:grid-cols-2"
    >
      {listings.map(({ listing, distanceKm }) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          distanceKm={distanceKm}
          currentUserId={currentUserId}
          nowMs={nowMs}
          pickupDetailsEntry={pickupDetailsById[listing.id]}
          highlighted={highlightedListingId === listing.id}
          onRetryPickupDetails={onRetryPickupDetails}
          onUpdated={onUpdated}
          onDeleted={onDeleted}
          onRepost={onRepost}
        />
      ))}
    </section>
  )
}
