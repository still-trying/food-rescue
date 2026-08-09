import ListingCard, { type Listing } from './ListingCard'

type Props = {
  listings: Listing[]
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
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
        <div className="text-5xl">🍱</div>

        <h3 className="mt-4 text-xl font-semibold text-gray-900">
          No listings yet
        </h3>

        <p className="mt-2 text-gray-500">
          Be the first person to share surplus food.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          currentUserId={currentUserId}
          onUpdated={onUpdated}
        />
      ))}
    </div>
  )
}