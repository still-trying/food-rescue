import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FOOD_CATEGORIES,
  formatCategoryLabel,
  isValidCategory,
} from '../constants/categories'
import { supabase } from '../lib/supabase'
import type { Listing } from '../types/listing'
import { toLocalDateTimeInputValue } from '../utils/date'
import { geocodeLocation } from '../utils/geocoding'
import {
  detectImageMimeFromBytes,
  MAX_PHOTO_SIZE_BYTES,
  prepareFoodPhotoForUpload,
} from '../utils/imageProcessor'
import { isValidE164Phone, normalizePhoneE164 } from '../utils/phone'
import {
  detectPublicPiiLeak,
  suggestCategoryFromText,
} from '../utils/smartRescue'

type Props = {
  userId: string
  onCreated: (listing: Listing) => void
  onCancel: () => void
}

type AiPhotoAutofillResponse = {
  isFood?: boolean
  title?: string
  category?: string
  quantity?: string
  description?: string
  safetyNotes?: string
}

const START_GRACE_MS = 5 * 60 * 1000

function getDefaultPickupWindow(): { start: string; end: string } {
  const now = new Date()
  const start = new Date(now.getTime() + 5 * 60 * 1000)
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  return {
    start: toLocalDateTimeInputValue(start),
    end: toLocalDateTimeInputValue(end),
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.split(',')[1] ?? ''
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to encode photo.'))
    reader.readAsDataURL(blob)
  })
}

export default function PostListingForm({
  userId,
  onCreated,
  onCancel,
}: Props) {
  const [defaultWindow] = useState(getDefaultPickupWindow)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState('')
  const [location, setLocation] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [pickupInstructions, setPickupInstructions] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [pickupStart, setPickupStart] = useState(defaultWindow.start)
  const [pickupEnd, setPickupEnd] = useState(defaultWindow.end)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null)

  const [aiLoading, setAiLoading] = useState(false)
  const [aiNotice, setAiNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const revokePreviewUrl = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      revokePreviewUrl()
    }
  }, [])

  const clearPhotoSelection = () => {
    revokePreviewUrl()
    setPhotoPreviewUrl(null)
    setPhoto(null)
    setAiNotice('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const cleanupUploadedPhoto = async (path: string | null) => {
    if (!path) {
      return
    }
    const { error: cleanupError } = await supabase.storage
      .from('listing-photos')
      .remove([path])

    if (cleanupError && import.meta.env.DEV) {
      console.error('Photo cleanup error:', cleanupError)
    }
  }

  const handlePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setError('')
    setAiNotice('')
    const selectedFile = e.target.files?.[0] ?? null

    if (!selectedFile) {
      clearPhotoSelection()
      return
    }

    if (selectedFile.size > MAX_PHOTO_SIZE_BYTES) {
      setError('Image size must be 5 MB or smaller.')
      clearPhotoSelection()
      return
    }

    const detectedMime = await detectImageMimeFromBytes(selectedFile)
    if (!detectedMime) {
      setError('Please select a valid JPG, PNG, or WebP image.')
      clearPhotoSelection()
      return
    }

    revokePreviewUrl()
    const nextUrl = URL.createObjectURL(selectedFile)
    previewUrlRef.current = nextUrl
    setPhotoPreviewUrl(nextUrl)
    setPhoto(selectedFile)
  }

  const handleAiAutofill = async () => {
    if (!photo || aiLoading || loading) {
      return
    }

    setError('')
    setAiNotice('')
    setAiLoading(true)

    try {
      const prepared = await prepareFoodPhotoForUpload(photo)
      const imageBase64 = await blobToBase64(prepared.blob)

      const { data, error: fnError } =
        await supabase.functions.invoke<AiPhotoAutofillResponse>(
          'analyze-food-photo',
          {
            body: {
              imageBase64,
              mimeType: prepared.contentType,
            },
          }
        )

      if (fnError || !data) {
        setAiNotice(
          'AI autofill is unavailable right now (deploy the `analyze-food-photo` Edge Function with GEMINI_API_KEY to enable it). You can fill in the details manually.'
        )
        return
      }

      if (data.isFood === false) {
        setError(
          'The selected image does not appear to show food. Please upload a clear food photo.'
        )
        return
      }

      if (data.title && !title.trim()) {
        setTitle(data.title.slice(0, 100))
      }
      if (data.category && isValidCategory(data.category) && !category) {
        setCategory(data.category)
      }
      if (data.quantity && !quantity.trim()) {
        setQuantity(data.quantity.slice(0, 100))
      }
      if (data.description && !description.trim()) {
        setDescription(data.description.slice(0, 1000))
      }

      setAiNotice(
        data.safetyNotes
          ? `✨ Suggested details filled. Note: ${data.safetyNotes}`
          : '✨ Suggested details filled from photo. Please review before posting.'
      )
    } catch {
      setAiNotice(
        'Unable to analyze the photo right now. You can continue filling in the form manually.'
      )
    } finally {
      setAiLoading(false)
    }
  }

  const suggestedCategory = useMemo(() => {
    if (category) return null
    return suggestCategoryFromText(`${title} ${description}`)
  }, [category, title, description])

  const publicPiiWarnings = useMemo(() => {
    const locationWarnings = detectPublicPiiLeak(location)
    const descriptionWarnings = detectPublicPiiLeak(description)
    return Array.from(new Set([...locationWarnings, ...descriptionWarnings]))
  }, [location, description])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (loading) {
      return
    }

    setError('')

    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()
    const trimmedQuantity = quantity.trim()
    const trimmedLocation = location.trim()
    const trimmedPickupAddress = pickupAddress.trim()
    const trimmedPickupInstructions = pickupInstructions.trim()
    const normalizedContactPhone = normalizePhoneE164(contactPhone)

    if (
      !trimmedTitle ||
      !category ||
      !trimmedLocation ||
      !trimmedPickupAddress ||
      !normalizedContactPhone ||
      !pickupStart ||
      !pickupEnd
    ) {
      setError('Please fill in all required fields.')
      return
    }

    if (!isValidCategory(category)) {
      setError('Please select a valid food category.')
      return
    }

    if (trimmedTitle.length < 2) {
      setError('Food name must be at least 2 characters.')
      return
    }

    if (trimmedTitle.length > 100) {
      setError('Food name must be 100 characters or less.')
      return
    }

    if (trimmedDescription.length > 1000) {
      setError('Description must be 1000 characters or less.')
      return
    }

    if (trimmedQuantity.length > 100) {
      setError('Quantity must be 100 characters or less.')
      return
    }

    if (trimmedLocation.length < 2) {
      setError('Please enter a valid pickup area.')
      return
    }

    if (trimmedLocation.length > 200) {
      setError('Pickup area must be 200 characters or less.')
      return
    }

    if (trimmedPickupAddress.length < 5 || trimmedPickupAddress.length > 300) {
      setError(
        'Enter a complete pickup address between 5 and 300 characters.'
      )
      return
    }

    if (trimmedPickupInstructions.length > 500) {
      setError('Pickup instructions must be 500 characters or less.')
      return
    }

    if (!isValidE164Phone(normalizedContactPhone)) {
      setError(
        'Enter a valid phone number with country code, for example +91 98765 43210.'
      )
      return
    }

    const startDate = new Date(pickupStart)
    const endDate = new Date(pickupEnd)
    const now = new Date()

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      setError('Please enter valid pickup dates and times.')
      return
    }

    if (startDate.getTime() < now.getTime() - START_GRACE_MS) {
      setError('Pickup start time cannot be in the past.')
      return
    }

    if (endDate <= startDate || endDate <= now) {
      setError('Pickup end time must be in the future and after the start time.')
      return
    }

    setLoading(true)
    let uploadedPhotoPath: string | null = null

    try {
      const approximateCoordinates = await geocodeLocation(trimmedLocation)
      if (!approximateCoordinates) {
        setError(
          'We could not find that pickup area. Enter a broad area such as "Gomti Nagar, Lucknow".'
        )
        return
      }

      let photoUrl: string | null = null

      if (photo) {
        const preparedPhoto = await prepareFoodPhotoForUpload(photo)
        const fileName = `${userId}/${crypto.randomUUID()}.${preparedPhoto.extension}`

        const { error: uploadError } = await supabase.storage
          .from('listing-photos')
          .upload(fileName, preparedPhoto.blob, {
            contentType: preparedPhoto.contentType,
            upsert: false,
          })

        if (uploadError) {
          if (import.meta.env.DEV) {
            console.error('Photo upload error:', uploadError)
          }
          setError('Photo upload failed. Please try again.')
          return
        }

        uploadedPhotoPath = fileName

        const { data: publicUrlData } = supabase.storage
          .from('listing-photos')
          .getPublicUrl(fileName)

        photoUrl = publicUrlData.publicUrl
      }

      const { data, error: insertError } = await supabase.rpc(
        'create_listing_with_pickup_details',
        {
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
        }
      )

      if (insertError) {
        if (import.meta.env.DEV) {
          console.error('Listing creation error:', insertError)
        }
        await cleanupUploadedPhoto(uploadedPhotoPath)
        setError('Unable to create the food listing. Please try again.')
        return
      }

      if (!data) {
        await cleanupUploadedPhoto(uploadedPhotoPath)
        setError(
          'The listing could not be confirmed. Please refresh and check My Listings before trying again.'
        )
        return
      }

      onCreated(data)
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('Unexpected listing creation error:', err)
      }
      await cleanupUploadedPhoto(uploadedPhotoPath)
      setError(
        err instanceof Error && err.message.includes('image')
          ? err.message
          : 'Something went wrong while posting the food. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const minDateTimeLocal = toLocalDateTimeInputValue(new Date())

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Post Surplus Food</h2>
        <p className="mt-2 text-gray-500">
          Help someone nearby rescue food instead of wasting it.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <div className="flex items-start justify-between gap-3">
                <p>⚠️ {error}</p>

                <button
                  type="button"
                  onClick={() => setError('')}
                  className="font-bold text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          {publicPiiWarnings.length > 0 && (
            <div
              role="status"
              className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
            >
              <p className="font-semibold">
                🛡️ Privacy check: Public fields may contain{' '}
                {publicPiiWarnings.join(', ')}.
              </p>
              <p className="mt-1 text-xs text-amber-800">
                Keep exact addresses and phone numbers inside the private blue
                section below so only the successful claimant can view them.
              </p>
            </div>
          )}

          <div>
            <label
              htmlFor="listing-title"
              className="mb-2 block text-sm font-semibold"
            >
              Food name *
            </label>

            <input
              id="listing-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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

          <div>
            <label
              htmlFor="listing-category"
              className="mb-2 block text-sm font-semibold"
            >
              Food category *
            </label>

            <select
              id="listing-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
              required
            >
              <option value="">Select a category</option>
              {FOOD_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            {suggestedCategory && (
              <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                <span>Suggested:</span>
                <button
                  type="button"
                  onClick={() => setCategory(suggestedCategory)}
                  className="rounded-full border border-green-200 bg-green-50 px-3 py-1 font-semibold text-green-700 hover:bg-green-100"
                >
                  Apply {formatCategoryLabel(suggestedCategory)}
                </button>
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="listing-description"
              className="mb-2 block text-sm font-semibold"
            >
              Description
            </label>

            <textarea
              id="listing-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the food, dietary info, or allergens..."
              rows={3}
              maxLength={1000}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {description.length}/1000
            </p>
          </div>

          <div>
            <label
              htmlFor="listing-quantity"
              className="mb-2 block text-sm font-semibold"
            >
              Quantity
            </label>

            <input
              id="listing-quantity"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. Serves 8-10"
              maxLength={100}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {quantity.length}/100
            </p>
          </div>

          <div>
            <label
              htmlFor="listing-area"
              className="mb-2 block text-sm font-semibold"
            >
              Pickup area *
            </label>

            <input
              id="listing-area"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Gomti Nagar, Lucknow"
              maxLength={200}
              disabled={loading}
              aria-describedby="listing-area-help"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
              required
            />

            <p className="mt-1 text-right text-xs text-gray-400">
              {location.length}/200
            </p>

            <p id="listing-area-help" className="mt-1 text-xs text-gray-400">
              Only this broad area is visible before a claim. Exact pickup
              details stay private.
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <label
              htmlFor="listing-pickup-address"
              className="mb-2 block text-sm font-semibold text-blue-900"
            >
              Exact pickup address *
            </label>
            <input
              id="listing-pickup-address"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="House / shop / restaurant address and landmark"
              maxLength={300}
              disabled={loading}
              aria-describedby="listing-pickup-address-help"
              className="w-full rounded-xl border border-blue-200 bg-white px-4 py-3 outline-none focus:border-blue-600 disabled:bg-gray-100"
              required
            />
            <p
              id="listing-pickup-address-help"
              className="mt-2 text-xs text-blue-800"
            >
              Private: only you and the person who successfully claims this food
              can view this address. Google Maps receives it only when an
              authorized user opens directions.
            </p>

            <label
              htmlFor="listing-pickup-instructions"
              className="mb-2 mt-4 block text-sm font-semibold text-blue-900"
            >
              Pickup instructions (optional)
            </label>
            <textarea
              id="listing-pickup-instructions"
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

            <label
              htmlFor="donor-contact-phone"
              className="mb-2 mt-4 block text-sm font-semibold text-blue-900"
            >
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
            <p
              id="donor-contact-phone-help"
              className="mt-2 text-xs text-blue-800"
            >
              Include your country code. Only you and the person who
              successfully claims this food can see this number. Other users
              cannot access it.
            </p>
          </div>

          <div>
            <label
              htmlFor="listing-photo"
              className="mb-2 block text-sm font-semibold"
            >
              Food photo
            </label>

            <input
              id="listing-photo"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void handlePhotoChange(e)}
              disabled={loading}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 disabled:bg-gray-100"
            />

            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG or WebP · Maximum 5 MB (compressed &amp; EXIF metadata
              stripped automatically)
            </p>

            {photo && photoPreviewUrl && (
              <div className="mt-3 space-y-2 rounded-xl border border-green-200 bg-green-50 p-3">
                <div className="flex flex-wrap items-center gap-4">
                  <img
                    src={photoPreviewUrl}
                    alt="Selected food preview"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-green-800">
                      ✓ {photo.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleAiAutofill()}
                        disabled={aiLoading || loading}
                        className="rounded-lg border border-green-300 bg-white px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50"
                      >
                        {aiLoading
                          ? 'Analyzing photo...'
                          : '✨ Auto-fill from photo'}
                      </button>

                      <button
                        type="button"
                        onClick={clearPhotoSelection}
                        disabled={loading || aiLoading}
                        className="text-xs font-semibold text-red-600 underline hover:text-red-800 disabled:opacity-50"
                      >
                        Remove photo
                      </button>
                    </div>
                  </div>
                </div>

                {aiNotice && (
                  <p className="text-xs text-green-900" role="status">
                    {aiNotice}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="listing-pickup-start"
                className="mb-2 block text-sm font-semibold"
              >
                Pickup starts *
              </label>

              <input
                id="listing-pickup-start"
                type="datetime-local"
                min={minDateTimeLocal}
                value={pickupStart}
                onChange={(e) => setPickupStart(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
                required
              />
            </div>

            <div>
              <label
                htmlFor="listing-pickup-end"
                className="mb-2 block text-sm font-semibold"
              >
                Pickup ends *
              </label>

              <input
                id="listing-pickup-end"
                type="datetime-local"
                min={pickupStart || minDateTimeLocal}
                value={pickupEnd}
                onChange={(e) => setPickupEnd(e.target.value)}
                disabled={loading}
                className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600 disabled:bg-gray-100"
                required
              />
            </div>
          </div>
        </div>

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
            {loading ? 'Finding location & posting...' : 'Post Food'}
          </button>
        </div>
      </form>
    </div>
  )
}
