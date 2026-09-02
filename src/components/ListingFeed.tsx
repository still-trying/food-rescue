import ListingCard, { type Listing } from './ListingCard'

export type ListingWithDistance = {
  listing: Listing
  distanceKm: number | null
}

type Props = {
  listings: ListingWithDistance[]
  currentUserId: string | null
  onUpdated: (listing: Listing) => void
}

export default function ListingFeed({
  listings,
  currentUserId,
  onUpdated,
}: Props) {
  if (listings.length === 0) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center"
      >
        <div
          className="text-5xl"
          aria-hidden="true"
        >
          🍱
        </div>

        <h3 className="mt-4 text-xl font-semibold text-gray-900">
          No food listings found
        </h3>

        <p className="mt-2 text-gray-500">
          Try changing your search or filters, or be
          the first person to share surplus food.
        </p>
      </div>
    )
  }

  return (
    <section
      aria-label="Food listings"
      className="grid gap-6 md:grid-cols-2"
    >
      {listings.map(
        ({ listing, distanceKm }) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            distanceKm={distanceKm}
            currentUserId={currentUserId}
            onUpdated={onUpdated}
          />
        )
      )}
    </section>
  )
}