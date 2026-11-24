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
}: Props) {
  if (listings.length === 0) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center"
      >
        <div className="text-5xl" aria-hidden="true">
          🍱
        </div>

        <h3 className="mt-4 text-xl font-semibold text-gray-900">
          No food listings found
        </h3>

        <p className="mt-2 text-gray-500">
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
        />
      ))}
    </section>
  )
}
