import type { PickupDetails } from '../types/listing'
import { sanitizeTelHref } from '../utils/phone'

type Props = {
  listingId: string
  isClaimant: boolean
  pickupDetails: PickupDetails | null
  loading: boolean
  error: string
  onRetry: (listingId: string) => void
}

export function PrivateDestinationBox({
  listingId,
  pickupDetails,
  loading,
  error,
  onRetry,
}: Omit<Props, 'isClaimant'>) {
  return (
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
        Private pickup destination
      </p>
      {loading ? (
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
        <div className="mt-1 space-y-2">
          <p className="text-sm text-blue-700">
            {error ||
              'Private pickup details have not been added for this older listing yet.'}
          </p>
          {error && (
            <button
              type="button"
              onClick={() => onRetry(listingId)}
              className="text-xs font-semibold text-blue-800 underline hover:text-blue-950"
            >
              Retry loading details
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function PrivateContactBox({
  isClaimant,
  pickupDetails,
  loading,
  error,
}: Omit<Props, 'listingId' | 'onRetry'>) {
  const safeTelHref = sanitizeTelHref(pickupDetails?.contact_phone)

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
        {isClaimant ? 'Contact the donor' : 'Your contact number'}
      </p>

      {loading ? (
        <p className="mt-2 text-sm text-emerald-700">
          Loading private contact details...
        </p>
      ) : pickupDetails?.contact_phone ? (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-emerald-950">
            {pickupDetails.contact_phone}
          </p>
          {isClaimant && safeTelHref && (
            <a
              href={safeTelHref}
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

      {error && (
        <p className="mt-2 text-xs text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

