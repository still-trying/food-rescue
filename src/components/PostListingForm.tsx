import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Listing } from './ListingCard'

type Props = {
  userId: string
  onCreated: (listing: Listing) => void
  onCancel: () => void
}

const MAX_PHOTO_SIZE = 5 * 1024 * 1024 // 5 MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
]

const ALLOWED_CATEGORIES = [
  'cooked_meals',
  'bakery',
  'groceries',
  'fruits_vegetables',
  'beverages',
  'other',
] as const

type GeocodingResult = {
  lat: string
  lon: string
  display_name: string
}

async function geocodeLocation(
  location: string
): Promise<{
  latitude: number
  longitude: number
} | null> {
  const normalizedLocation = location
    .trim()
    .toLowerCase()

  const cacheKey =
    `food-rescue-geocode:${normalizedLocation}`

  // Reuse previously resolved locations.
  const cachedCoordinates =
    localStorage.getItem(cacheKey)

  if (cachedCoordinates) {
    try {
      const parsed = JSON.parse(
        cachedCoordinates
      )

      if (
        typeof parsed.latitude === 'number' &&
        typeof parsed.longitude === 'number' &&
        Number.isFinite(parsed.latitude) &&
        Number.isFinite(parsed.longitude)
      ) {
        return parsed
      }
    } catch {
      localStorage.removeItem(cacheKey)
    }
  }

  const params = new URLSearchParams({
    q: `${location.trim()}, India`,
    format: 'jsonv2',
    limit: '1',
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(
      `Geocoding request failed with status ${response.status}`
    )
  }

  const results =
    (await response.json()) as GeocodingResult[]

  if (results.length === 0) {
    return null
  }

  const latitude = Number(results[0].lat)
  const longitude = Number(results[0].lon)

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null
  }

  const coordinates = {
    latitude,
    longitude,
  }

  localStorage.setItem(
    cacheKey,
    JSON.stringify(coordinates)
  )

  return coordinates
}

export default function PostListingForm({
  userId,
  onCreated,
  onCancel,
}: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState('')
  const [location, setLocation] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupInstructions, setPickupInstructions] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [pickupStart, setPickupStart] = useState('')
  const [pickupEnd, setPickupEnd] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handlePhotoChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError('')

    const selectedFile =
      e.target.files?.[0] ?? null

    if (!selectedFile) {
      setPhoto(null)
      return
    }

    // Validate file type
    if (
      !ALLOWED_IMAGE_TYPES.includes(
        selectedFile.type
      )
    ) {
      setError(
        'Please select a JPG, PNG, or WebP image.'
      )

      e.target.value = ''
      setPhoto(null)

      return
    }

    // Validate file size
    if (selectedFile.size > MAX_PHOTO_SIZE) {
      setError(
        'Image size must be 5 MB or smaller.'
      )

      e.target.value = ''
      setPhoto(null)

      return
    }

    setPhoto(selectedFile)
  }

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault()

    // Prevent duplicate submissions
    if (loading) {
      return
    }

    setError('')

    const trimmedTitle = title.trim()
    const trimmedDescription =
      description.trim()
    const trimmedQuantity = quantity.trim()
    const trimmedLocation = location.trim()
    const trimmedPickupAddress = pickupAddress.trim()
    const trimmedPickupInstructions = pickupInstructions.trim()
    const trimmedContactPhone = contactPhone.trim()
    // Accept common spacing/parentheses/hyphens, then store canonical E.164.
    const normalizedContactPhone = trimmedContactPhone.replace(/[()\s.-]/g, '')

    // -----------------------------
    // Required field validation
    // -----------------------------

    if (
      !trimmedTitle ||
      !category ||
      !trimmedLocation ||
      !trimmedPickupAddress ||
      !normalizedContactPhone ||
      !pickupStart ||
      !pickupEnd
    ) {
      setError(
        'Please fill in all required fields.'
      )
      return
    }

    // -----------------------------
    // Category validation
    // -----------------------------

    if (
      !ALLOWED_CATEGORIES.includes(
        category as (typeof ALLOWED_CATEGORIES)[number]
      )
    ) {
      setError(
        'Please select a valid food category.'
      )
      return
    }

    // -----------------------------
    // Text length validation
    // -----------------------------

    if (trimmedTitle.length < 2) {
      setError(
        'Food name must be at least 2 characters.'
      )
      return
    }

    if (trimmedTitle.length > 100) {
      setError(
        'Food name must be 100 characters or less.'
      )
      return
    }

    if (trimmedDescription.length > 1000) {
      setError(
        'Description must be 1000 characters or less.'
      )
      return
    }

    if (trimmedQuantity.length > 100) {
      setError(
        'Quantity must be 100 characters or less.'
      )
      return
    }

    if (trimmedLocation.length < 2) {
      setError(
        'Please enter a valid pickup area.'
      )
      return
    }

    if (trimmedLocation.length > 200) {
      setError(
        'Pickup area must be 200 characters or less.'
      )
      return
    }

    if (trimmedPickupAddress.length < 5 || trimmedPickupAddress.length > 300) {
      setError('Enter a complete pickup address between 5 and 300 characters.')
      return
    }

    if (trimmedPickupInstructions.length > 500) {
      setError('Pickup instructions must be 500 characters or less.')
      return
    }

    if (!/^[+][1-9][0-9]{7,14}$/.test(normalizedContactPhone)) {
      setError('Enter a valid phone number with country code, for example +91 98765 43210.')
      return
    }

    // -----------------------------
    // Date validation
    // -----------------------------

    const startDate = new Date(pickupStart)
    const endDate = new Date(pickupEnd)
    const now = new Date()

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime())
    ) {
      setError(
        'Please enter valid pickup dates and times.'
      )
      return
    }

    // Pickup cannot start in the past
    if (startDate <= now) {
      setError(
        'Pickup start time must be in the future.'
      )
      return
    }

    // Pickup end must be after pickup start
    if (endDate <= startDate) {
      setError(
        'Pickup end time must be after the start time.'
      )
      return
    }

    setLoading(true)

    let uploadedPhotoPath: string | null = null

    try {
      // -----------------------------
      // Geocode pickup location
      // -----------------------------

      const approximateCoordinates = await geocodeLocation(trimmedLocation)
      if (!approximateCoordinates) {
        setError('We could not find that pickup area. Enter a broad area such as "Gomti Nagar, Lucknow".')
        return
      }


      // -----------------------------
      // Photo upload
      // -----------------------------

      let photoUrl: string | null = null

      if (photo) {
        const fileExtension =
          photo.name
            .split('.')
            .pop()
            ?.toLowerCase()

        if (!fileExtension) {
          setError(
            'Unable to determine the image file type.'
          )
          return
        }

        const fileName =
          `${userId}/${crypto.randomUUID()}.${fileExtension}`

        const {
          error: uploadError,
        } = await supabase.storage
          .from('listing-photos')
          .upload(
            fileName,
            photo
          )

        if (uploadError) {
          console.error(
            'Photo upload error:',
            uploadError
          )

          setError(
            'Photo upload failed. Please try again.'
          )

          return
        }

        uploadedPhotoPath = fileName

        const {
          data: publicUrlData,
        } = supabase.storage
          .from('listing-photos')
          .getPublicUrl(
            fileName
          )

        photoUrl =
          publicUrlData.publicUrl
      }

      // -----------------------------
      // Create listing
      // -----------------------------

      const {
        data,
        error: insertError,
      } = await supabase.rpc('create_listing_with_pickup_details', {
        p_title: trimmedTitle,
        p_description: trimmedDescription || null,
        p_category: category,
        p_quantity: trimmedQuantity || null,
        p_photo_url: photoUrl,
        p_location_text: trimmedLocation,
        p_approx_latitude: approximateCoordinates.latitude,
        p_approx_longitude: approximateCoordinates.longitude,
        p_pickup_window_start: startDate.toISOString(),
        p_pickup_window_end: endDate.toISOString(),
        p_pickup_address: trimmedPickupAddress,
        p_pickup_latitude: null,
        p_pickup_longitude: null,
        p_contact_phone: normalizedContactPhone,
        p_pickup_instructions: trimmedPickupInstructions || null,
      })

      // -----------------------------
      // Database insert failed
      // -----------------------------

      if (insertError) {
        console.error(
          'Listing creation error:',
          insertError
        )

        // Clean up uploaded photo if the
        // listing itself could not be created.
        if (uploadedPhotoPath) {
          const {
            error: cleanupError,
          } = await supabase.storage
            .from('listing-photos')
            .remove([
              uploadedPhotoPath,
            ])

          if (cleanupError) {
            console.error(
              'Photo cleanup error:',
              cleanupError
            )
          }
        }

        setError(
          'Unable to create the food listing. Please try again.'
        )

        return
      }

      // -----------------------------
      // Successfully created
      // -----------------------------

      if (!data) {
        if (uploadedPhotoPath) {
          const { error: cleanupError } = await supabase.storage
            .from('listing-photos')
            .remove([uploadedPhotoPath])

          if (cleanupError) {
            console.error('Photo cleanup error:', cleanupError)
          }
        }

        setError('The listing could not be confirmed. Please refresh and check My Listings before trying again.')
        return
      }

      onCreated(data as unknown as Listing)
    } catch (err) {
      console.error(
        'Unexpected listing creation error:',
        err
      )

      // Clean up uploaded image if
      // something failed after upload.
      if (uploadedPhotoPath) {
        const {
          error: cleanupError,
        } = await supabase.storage
          .from('listing-photos')
          .remove([
            uploadedPhotoPath,
          ])

        if (cleanupError) {
          console.error(
            'Photo cleanup error:',
            cleanupError
          )
        }
      }

      setError(
        'Something went wrong while posting the food. Please try again.'
      )
    } finally {
      setLoading(false)
    }
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

          {/* Error message */}
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <div className="flex items-start justify-between gap-3">
                <p>⚠️ {error}</p>

                <button
                  type="button"
                  onClick={() =>
                    setError('')
                  }
                  className="font-bold text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {/* Food name */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Food name *
            </label>

            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              placeholder="e.g. Vegetable Biryani"
              maxLength={100}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
              required
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {title.length}/100
            </p>
          </div>

          {/* Category */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Food category *
            </label>

            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value
                )
              }
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
              required
            >
              <option value="">
                Select a category
              </option>

              <option value="cooked_meals">
                🍛 Cooked Meals
              </option>

              <option value="bakery">
                🥖 Bakery
              </option>

              <option value="groceries">
                🛒 Groceries
              </option>

              <option value="fruits_vegetables">
                🥦 Fruits & Vegetables
              </option>

              <option value="beverages">
                🥤 Beverages
              </option>

              <option value="other">
                🍱 Other
              </option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Description
            </label>

            <textarea
              value={description}
              onChange={(e) =>
                setDescription(
                  e.target.value
                )
              }
              placeholder="Describe the food..."
              rows={3}
              maxLength={1000}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {description.length}/1000
            </p>
          </div>

          {/* Quantity */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Quantity
            </label>

            <input
              value={quantity}
              onChange={(e) =>
                setQuantity(
                  e.target.value
                )
              }
              placeholder="e.g. Serves 8-10"
              maxLength={100}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {quantity.length}/100
            </p>
          </div>

          {/* Pickup area */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Pickup area *
            </label>

            <input
              value={location}
              onChange={(e) =>
                setLocation(
                  e.target.value
                )
              }
              placeholder="e.g. Gomti Nagar, Lucknow"
              maxLength={200}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
              required
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {location.length}/200
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Only this broad area is visible before a claim. Exact pickup details stay private.
            </p>
          </div>

          {/* Private pickup address: visible only to the donor and claimant. */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <label className="mb-2 block text-sm font-semibold text-blue-900">
              Exact pickup address *
            </label>
            <input
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="House / shop / restaurant address and landmark"
              maxLength={300}
              disabled={loading}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-600 disabled:bg-gray-100"
              required
            />
            <p className="mt-2 text-xs text-blue-800">
              Private: only you and the person who successfully claims this food can view this address. Google Maps receives it only when an authorized user opens directions.
            </p>
            <label className="mb-2 mt-4 block text-sm font-semibold text-blue-900">
              Pickup instructions (optional)
            </label>
            <textarea
              value={pickupInstructions}
              onChange={(e) => setPickupInstructions(e.target.value)}
              placeholder="e.g. Ask for the manager at the side entrance."
              rows={2}
              maxLength={500}
              disabled={loading}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-600 disabled:bg-gray-100"
            />
            <p className="mt-1 text-right text-xs text-blue-700">
              {pickupInstructions.length}/500
            </p>

            <label htmlFor="donor-contact-phone" className="mb-2 mt-4 block text-sm font-semibold text-blue-900">
              Contact phone number *
            </label>
            <input
              id="donor-contact-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+91 98765 43210"
              maxLength={25}
              disabled={loading}
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-600 disabled:bg-gray-100"
              aria-describedby="donor-contact-phone-help"
              required
            />
            <p id="donor-contact-phone-help" className="mt-2 text-xs text-blue-800">
              Include your country code. Only you and the person who successfully claims this food can see this number. Other users cannot access it.
            </p>
          </div>

          {/* Photo upload */}
          <div>
            <label className="mb-2 block text-sm font-semibold">
              Food photo
            </label>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoChange}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 disabled:bg-gray-100"
            />

            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG or WebP · Maximum 5 MB
            </p>

            {photo && (
              <p className="mt-2 text-sm text-green-700">
                ✓ Selected: {photo.name}
              </p>
            )}
          </div>

          {/* Pickup window */}
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold">
                Pickup starts *
              </label>

              <input
                type="datetime-local"
                value={pickupStart}
                onChange={(e) =>
                  setPickupStart(
                    e.target.value
                  )
                }
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
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
                onChange={(e) =>
                  setPickupEnd(
                    e.target.value
                  )
                }
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
                required
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-7 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? 'Finding location & posting...'
              : 'Post Food'}
          </button>
        </div>
      </form>
    </div>
  )
}