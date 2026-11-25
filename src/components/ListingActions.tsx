import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Listing, ReportReason } from '../types/listing'

const REPORT_REASONS: readonly { value: ReportReason; label: string }[] = [
  { value: 'unsafe_food', label: 'Food safety concern' },
  { value: 'wrong_location', label: 'Inaccurate location or details' },
  { value: 'spam', label: 'Spam or duplicate listing' },
  { value: 'harassment', label: 'Inappropriate content' },
  { value: 'other', label: 'Other' },
] as const

type Props = {
  listing: Listing
  currentUserId: string | null
  isOwner: boolean
  isClaimant: boolean
  isExpired: boolean
  onUpdated: (listing: Listing) => void
  onDeleted: (listingId: string) => void
  onEdit: () => void
  onRepost: (listing: Listing) => void
  onError: (message: string) => void
  refreshListing: () => Promise<boolean>
}

export default function ListingActions({
  listing,
  currentUserId,
  isOwner,
  isClaimant,
  isExpired,
  onUpdated,
  onDeleted,
  onEdit,
  onRepost,
  onError,
  refreshListing,
}: Props) {
  const [claiming, setClaiming] = useState(false)
  const [pickingUp, setPickingUp] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [unclaiming, setUnclaiming] = useState(false)
  const [confirmUnclaim, setConfirmUnclaim] = useState(false)
  const [pinLoading, setPinLoading] = useState(false)
  const [generatedPin, setGeneratedPin] = useState<string | null>(null)
  const [pinInput, setPinInput] = useState('')
  const [showPinVerify, setShowPinVerify] = useState(false)

  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState<ReportReason>('unsafe_food')
  const [reportDetails, setReportDetails] = useState('')
  const [reporting, setReporting] = useState(false)
  const [reportSubmitted, setReportSubmitted] = useState(false)

  const handleClaim = async () => {
    if (!currentUserId) {
      onError('Please log in first.')
      return
    }
    if (isOwner) {
      onError('You cannot claim your own listing.')
      return
    }
    if (claiming) return

    onError('')
    setClaiming(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('claim_listing', {
        p_listing_id: listing.id,
      })

      if (rpcError) {
        const refreshed = await refreshListing()
        onError(
          refreshed
            ? 'Unable to claim this food. The latest listing status has been loaded.'
            : 'Unable to claim this food. Please check your connection and try again.'
        )
        return
      }

      if (!data) {
        const refreshed = await refreshListing()
        onError(
          refreshed
            ? 'This food could not be claimed. The latest listing status has been loaded.'
            : 'This food is no longer available. It may have been removed, expired, or already claimed.'
        )
        return
      }

      onUpdated(data)
    } catch {
      await refreshListing()
      onError(
        'Something went wrong while claiming this food. The listing has been refreshed if available.'
      )
    } finally {
      setClaiming(false)
    }
  }

  const handlePickedUp = async () => {
    if (!isClaimant) {
      onError('Only the person who claimed this food can mark it as picked up.')
      return
    }
    if (pickingUp) return

    onError('')
    setPickingUp(true)

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'mark_listing_picked_up',
        { p_listing_id: listing.id }
      )

      if (rpcError || !data) {
        const refreshed = await refreshListing()
        onError(
          refreshed
            ? 'This listing changed before it could be updated. The latest status has been loaded.'
            : 'Unable to mark this food as picked up. Please check your connection and try again.'
        )
        return
      }

      onUpdated(data)
    } catch {
      await refreshListing()
      onError('Something went wrong while updating the pickup.')
    } finally {
      setPickingUp(false)
    }
  }

  const handleCancelListing = async () => {
    if (!isOwner || canceling) return
    onError('')
    setCanceling(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('cancel_listing', {
        p_listing_id: listing.id,
      })

      if (rpcError) {
        onError(
          rpcError.message.toLowerCase().includes('could not find')
            ? 'Listing cancellation requires applying the latest Supabase migration.'
            : 'Unable to cancel this listing. It may have already been claimed.'
        )
        setConfirmCancel(false)
        await refreshListing()
        return
      }

      if (!data) {
        onError('Listing could not be cancelled because its status changed.')
        setConfirmCancel(false)
        await refreshListing()
        return
      }

      onDeleted(listing.id)
    } catch {
      onError('Something went wrong while cancelling the listing.')
    } finally {
      setCanceling(false)
    }
  }

  const handleUnclaim = async () => {
    if (!isClaimant || unclaiming) return
    onError('')
    setUnclaiming(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('unclaim_listing', {
        p_listing_id: listing.id,
      })

      if (rpcError) {
        onError(
          rpcError.message.toLowerCase().includes('could not find')
            ? 'Releasing a claim requires applying the latest Supabase migration.'
            : 'Unable to release this claim right now.'
        )
        setConfirmUnclaim(false)
        await refreshListing()
        return
      }

      if (!data) {
        onError('Unable to release this claim. The listing status changed.')
        setConfirmUnclaim(false)
        await refreshListing()
        return
      }

      setConfirmUnclaim(false)
      onUpdated(data)
    } catch {
      onError('Something went wrong while releasing your claim.')
    } finally {
      setUnclaiming(false)
    }
  }

  const handleGeneratePin = async () => {
    if ((!isOwner && !isClaimant) || pinLoading) return
    onError('')
    setPinLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'generate_pickup_pin',
        { p_listing_id: listing.id }
      )
      if (rpcError || !data) {
        onError(
          rpcError?.message.toLowerCase().includes('could not find')
            ? '2-step pickup PIN requires applying the latest Supabase migration (`20261125000300`).'
            : 'Unable to generate pickup PIN right now.'
        )
        return
      }
      setGeneratedPin(data)
    } catch {
      onError('Something went wrong while generating the pickup PIN.')
    } finally {
      setPinLoading(false)
    }
  }

  const handleVerifyPinPickedUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!isOwner && !isClaimant) || pickingUp) return
    const trimmedPin = pinInput.trim()
    if (!/^[0-9]{4}$/.test(trimmedPin)) {
      onError('Enter the 4-digit pickup PIN.')
      return
    }
    onError('')
    setPickingUp(true)
    try {
      const { data, error: rpcError } = await supabase.rpc(
        'verify_and_mark_picked_up',
        { p_listing_id: listing.id, p_pin: trimmedPin }
      )
      if (rpcError || !data) {
        onError(
          rpcError?.message.toLowerCase().includes('incorrect pickup pin')
            ? 'Incorrect 4-digit pickup PIN. Please check with the other party.'
            : rpcError?.message.toLowerCase().includes('could not find')
              ? 'PIN verification requires applying the latest Supabase migration.'
              : 'Unable to verify pickup PIN right now.'
        )
        return
      }
      setShowPinVerify(false)
      onUpdated(data)
    } catch {
      onError('Something went wrong while verifying the pickup PIN.')
    } finally {
      setPickingUp(false)
    }
  }

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentUserId || reporting) return

    onError('')
    setReporting(true)

    try {
      const { error: rpcError } = await supabase.rpc('report_listing', {
        p_listing_id: listing.id,
        p_reason: reportReason,
        p_details: reportDetails.trim() || null,
      })

      if (rpcError) {
        onError(
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
      onError('Something went wrong while submitting your report.')
    } finally {
      setReporting(false)
    }
  }

  return (
    <div className="space-y-3">
      {listing.status === 'available' && !isExpired && (
        isOwner ? (
          <div className="space-y-2">
            <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-sm font-semibold text-gray-600">
              This is your listing.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Edit Listing
              </button>

              {!confirmCancel && (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="flex-1 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  Cancel Listing
                </button>
              )}
            </div>

            {confirmCancel && (
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
        <div className="space-y-2">
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center text-sm font-semibold text-red-600">
            ⏰ Pickup window expired
          </div>
          {isOwner && (
            <button
              type="button"
              onClick={() => onRepost(listing)}
              className="w-full rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800 transition hover:bg-green-100"
            >
              🔄 Repost with New Window
            </button>
          )}
        </div>
      )}

      {listing.status === 'claimed' && (isClaimant || isOwner) && (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-xs font-semibold text-indigo-900">
                🔐 2-Step Handoff PIN
              </span>
              <p className="text-[11px] text-indigo-700">
                Share this 4-digit PIN at pickup to verify handoff.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleGeneratePin()}
              disabled={pinLoading}
              className="rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
            >
              {pinLoading
                ? 'Loading...'
                : generatedPin
                  ? `PIN: ${generatedPin}`
                  : 'Show / Generate PIN'}
            </button>
          </div>

          {!showPinVerify ? (
            <button
              type="button"
              onClick={() => setShowPinVerify(true)}
              className="text-xs font-semibold text-indigo-700 underline hover:text-indigo-900"
            >
              Verify handoff with 4-digit PIN
            </button>
          ) : (
            <form
              onSubmit={(e) => void handleVerifyPinPickedUp(e)}
              className="flex gap-2"
            >
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="4-digit PIN"
                aria-label="4-digit pickup PIN"
                className="w-28 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-indigo-600"
              />
              <button
                type="submit"
                disabled={pickingUp}
                className="flex-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {pickingUp ? 'Verifying...' : 'Confirm Handoff'}
              </button>
            </form>
          )}
        </div>
      )}

      {listing.status === 'claimed' && isClaimant && (
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

      {listing.status === 'claimed' && !isClaimant && (
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
  )
}

