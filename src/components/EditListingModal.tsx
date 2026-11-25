import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Listing } from '../types/listing'
import { toLocalDateTimeInputValue } from '../utils/date'

type Props = {
  listing: Listing
  onUpdated: (listing: Listing) => void
  onClose: () => void
}

export default function EditListingModal({
  listing,
  onUpdated,
  onClose,
}: Props) {
  const [title, setTitle] = useState(listing.title)
  const [description, setDescription] = useState(listing.description ?? '')
  const [quantity, setQuantity] = useState(listing.quantity ?? '')
  const [pickupEnd, setPickupEnd] = useState(
    toLocalDateTimeInputValue(new Date(listing.pickup_window_end))
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    setError('')
    const trimmedTitle = title.trim()
    if (trimmedTitle.length < 2 || trimmedTitle.length > 100) {
      setError('Food name must be between 2 and 100 characters.')
      return
    }

    const endDate = new Date(pickupEnd)
    const startDate = new Date(listing.pickup_window_start)
    if (
      Number.isNaN(endDate.getTime()) ||
      endDate <= startDate ||
      endDate <= new Date()
    ) {
      setError('Pickup end time must be in the future and after start time.')
      return
    }

    setSaving(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('edit_listing', {
        p_listing_id: listing.id,
        p_title: trimmedTitle,
        p_description: description.trim() || null,
        p_quantity: quantity.trim() || null,
        p_pickup_window_end: endDate.toISOString(),
      })

      if (rpcError) {
        setError(
          rpcError.message.toLowerCase().includes('could not find')
            ? 'Editing requires applying the latest Supabase migration (`edit_listing`).'
            : 'Unable to update this listing. It may no longer be available.'
        )
        return
      }

      if (!data) {
        setError('Unable to update this listing because its status changed.')
        return
      }

      onUpdated(data)
      onClose()
    } catch {
      setError('Something went wrong while updating the listing.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`edit-title-${listing.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
    >
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <h2
            id={`edit-title-${listing.id}`}
            className="text-lg font-bold text-gray-900"
          >
            Edit Available Listing
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close edit dialog"
            className="font-bold text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor={`edit-name-${listing.id}`}
              className="mb-1 block text-xs font-semibold text-gray-700"
            >
              Food name *
            </label>
            <input
              id={`edit-name-${listing.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              required
              disabled={saving}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label
              htmlFor={`edit-qty-${listing.id}`}
              className="mb-1 block text-xs font-semibold text-gray-700"
            >
              Quantity
            </label>
            <input
              id={`edit-qty-${listing.id}`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              maxLength={100}
              disabled={saving}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label
              htmlFor={`edit-desc-${listing.id}`}
              className="mb-1 block text-xs font-semibold text-gray-700"
            >
              Description
            </label>
            <textarea
              id={`edit-desc-${listing.id}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              disabled={saving}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label
              htmlFor={`edit-end-${listing.id}`}
              className="mb-1 block text-xs font-semibold text-gray-700"
            >
              Pickup ends *
            </label>
            <input
              id={`edit-end-${listing.id}`}
              type="datetime-local"
              min={toLocalDateTimeInputValue(new Date())}
              value={pickupEnd}
              onChange={(e) => setPickupEnd(e.target.value)}
              required
              disabled={saving}
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-green-600"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700"
            >
              ⚠️ {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

