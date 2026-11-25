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
    <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/95 p-3 dark:border-sky-500/25 dark:bg-sky-950/55">
      <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-sky-300">
        Private pickup destination
      </p>
      {loading ? (
        <p className="mt-1 text-sm text-blue-700 dark:text-sky-300">
          Loading pickup details...
        </p>
      ) : pickupDetails ? (
        <>
          <p className="mt-1 break-words text-sm font-semibold text-blue-900 dark:text-sky-100">
            {pickupDetails.pickup_address}
          </p>
          {pickupDetails.pickup_instructions && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-blue-800 dark:text-sky-200">
              {pickupDetails.pickup_instructions}
            </p>
          )}
        </>
      ) : (
        <div className="mt-1 space-y-2">
          <p className="text-sm text-blue-700 dark:text-sky-300">
            {error ||
              'Private pickup details have not been added for this older listing yet.'}
          </p>
          {error && (
            <button
              type="button"
              onClick={() => onRetry(listingId)}
              className="text-xs font-semibold text-blue-800 underline hover:text-blue-950 dark:text-sky-200 dark:hover:text-white"
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
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/95 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/55">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
        {isClaimant ? 'Contact the donor' : 'Your contact number'}
      </p>

      {loading ? (
        <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
          Loading private contact details...
        </p>
      ) : pickupDetails?.contact_phone ? (
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold text-emerald-950 dark:text-emerald-100">
            {pickupDetails.contact_phone}
          </p>
          {isClaimant && safeTelHref && (
            <a
              href={safeTelHref}
              className="fr-btn-3d inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:focus:ring-offset-slate-900"
            >
              📞 Call donor
            </a>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
          No contact number was saved for this listing.
        </p>
      )}

      <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300/80">
        {isClaimant
          ? 'Use this number to coordinate your pickup. Please contact the donor respectfully.'
          : 'Your number is private and is shared only with the person who successfully claims this food.'}
      </p>

      {error && (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
