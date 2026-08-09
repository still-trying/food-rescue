import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Listing } from './ListingCard'

type Props = {
  userId: string
  onCreated: (listing: Listing) => void
  onCancel: () => void
}

export default function PostListingForm({
  userId,
  onCreated,
  onCancel,
}: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('')
  const [location, setLocation] = useState('')
  const [pickupStart, setPickupStart] = useState('')
  const [pickupEnd, setPickupEnd] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title || !location || !pickupStart || !pickupEnd) {
      alert('Please fill in all required fields.')
      return
    }

    if (new Date(pickupEnd) <= new Date(pickupStart)) {
      alert('Pickup end time must be after the start time.')
      return
    }

    setLoading(true)

    let photoUrl: string | null = null

    // Upload photo if one was selected
    if (photo) {
      const fileExt = photo.name.split('.').pop()
      const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('listing-photos')
        .upload(fileName, photo)

      if (uploadError) {
        setLoading(false)
        alert(`Photo upload failed: ${uploadError.message}`)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from('listing-photos')
        .getPublicUrl(fileName)

      photoUrl = publicUrlData.publicUrl
    }

    const { data, error } = await supabase
      .from('listings')
      .insert({
        title,
        description: description || null,
        quantity: quantity || null,
        photo_url: photoUrl,
        location_text: location,
        pickup_window_start: new Date(pickupStart).toISOString(),
        pickup_window_end: new Date(pickupEnd).toISOString(),
        posted_by: userId,
      })
      .select()
      .single()

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    onCreated(data as Listing)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">
          Post Surplus Food
        </h2>

        <p className="mt-2 text-gray-500">
          Help someone nearby rescue food instead of wasting it.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Food name *
            </label>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Vegetable Biryani"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the food..."
              rows={3}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Quantity
            </label>

            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. Serves 8-10"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">
              Pickup area *
            </label>

            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Gomti Nagar, Lucknow"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
              required
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Food photo
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-gray-300 px-4 py-3"
            />

            {photo && (
              <p className="mt-2 text-sm text-gray-500">
                Selected: {photo.name}
              </p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Pickup starts *
              </label>

              <input
                type="datetime-local"
                value={pickupStart}
                onChange={(e) => setPickupStart(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold">
                Pickup ends *
              </label>

              <input
                type="datetime-local"
                value={pickupEnd}
                onChange={(e) => setPickupEnd(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
                required
              />
            </div>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Posting...' : 'Post Food'}
          </button>
        </div>
      </form>
    </div>
  )
}