import { supabase } from '../lib/supabase'

export type Listing = {
  id: string
  title: string
  description: string | null
  quantity: string | null
  photo_url: string | null
  location_text: string
  pickup_window_start: string
  pickup_window_end: string
  status: 'available' | 'claimed' | 'picked_up'
  posted_by: string
  claimed_by: string | null
  created_at: string
}

type Props = {
  listing: Listing
  currentUserId: string | null
  onUpdated: (listing: Listing) => void
}

function formatDate(date: string) {
  return new Date(date).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function ListingCard({
  listing,
  currentUserId,
  onUpdated,
}: Props) {
  // An available listing is expired once its pickup window has ended.
  const isExpired =
    listing.status === 'available' &&
    new Date(listing.pickup_window_end) <= new Date()

  const handleClaim = async () => {
    if (!currentUserId) {
      alert('Please log in first.')
      return
    }

    // Database-level protection:
    // the listing must still be available AND its pickup
    // window must not have expired.
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
      alert(error.message)
      return
    }

    if (!data) {
      alert(
        'This food is no longer available. It may have expired or already been claimed.'
      )
      return
    }

    onUpdated(data as Listing)
  }

  const handlePickedUp = async () => {
    if (!currentUserId || listing.claimed_by !== currentUserId) {
      return
    }

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
      alert(error.message)
      return
    }

    if (!data) {
      alert('Unable to mark this listing as picked up.')
      return
    }

    onUpdated(data as Listing)
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {listing.photo_url && (
        <img
          src={listing.photo_url}
          alt={listing.title}
          className="h-48 w-full object-cover"
        />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {listing.title}
            </h3>

            {listing.quantity && (
              <p className="mt-1 text-sm font-medium text-green-700">
                {listing.quantity}
              </p>
            )}
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              listing.status === 'available'
                ? isExpired
                  ? 'bg-red-100 text-red-600'
                  : 'bg-green-100 text-green-700'
                : listing.status === 'claimed'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-600'
            }`}
          >
            {isExpired ? 'expired' : listing.status.replace('_', ' ')}
          </span>
        </div>

        {listing.description && (
          <p className="mt-4 text-gray-600">{listing.description}</p>
        )}

        <div className="mt-5 space-y-2 text-sm text-gray-600">
          <p>
            📍 <strong>Pickup area:</strong> {listing.location_text}
          </p>

          <p>
            🕐 <strong>Pickup:</strong>{' '}
            {formatDate(listing.pickup_window_start)}
          </p>

          <p>
            🕐 <strong>Until:</strong>{' '}
            {formatDate(listing.pickup_window_end)}
          </p>
        </div>

        <div className="mt-5">
          {/* Available and not expired */}
          {listing.status === 'available' && !isExpired && (
            <button
              onClick={handleClaim}
              className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              Claim Food
            </button>
          )}

          {/* Available but expired */}
          {listing.status === 'available' && isExpired && (
            <div className="rounded-xl bg-red-50 p-3 text-center text-sm font-medium text-red-600">
              ⏰ Pickup window expired
            </div>
          )}

          {/* Claimed by current user */}
          {listing.status === 'claimed' &&
            listing.claimed_by === currentUserId && (
              <button
                onClick={handlePickedUp}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Mark as Picked Up
              </button>
            )}

          {/* Claimed by another user */}
          {listing.status === 'claimed' &&
            listing.claimed_by !== currentUserId && (
              <div className="rounded-xl bg-yellow-50 p-3 text-center text-sm text-yellow-700">
                This food has already been claimed.
              </div>
            )}

          {/* Successfully picked up */}
          {listing.status === 'picked_up' && (
            <div className="rounded-xl bg-gray-100 p-3 text-center text-sm font-medium text-gray-600">
              Food successfully rescued ✓
            </div>
          )}
        </div>
      </div>
    </article>
  )
}