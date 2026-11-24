import type { Listing } from '../types/listing'

export function formatDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function isListingExpired(listing: Pick<Listing, 'status' | 'pickup_window_end'>, nowMs: number): boolean {
  if (listing.status !== 'available') {
    return false
  }
  const endMs = new Date(listing.pickup_window_end).getTime()
  return Number.isFinite(endMs) && endMs <= nowMs
}

/**
 * Format a Date as `YYYY-MM-DDTHH:mm` in the user's local timezone
 * for `<input type="datetime-local">` values and `min` attributes.
 */
export function toLocalDateTimeInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

