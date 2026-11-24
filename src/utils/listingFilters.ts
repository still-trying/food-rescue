import type {
  DistanceFilter,
  Listing,
  ListingWithDistance,
  SortOption,
  UserLocation,
  View,
} from '../types/listing'
import { isListingExpired } from './date'
import { calculateDistanceKm } from './geo'
import { computeRescueScore } from './smartRescue'

export type FilterAndSortParams = {
  listings: Listing[]
  view: Exclude<View, 'post' | 'impact'>
  userId: string | null
  search: string
  categoryFilter: string
  distanceFilter: DistanceFilter
  sortBy: SortOption
  userLocation: UserLocation | null
  nowMs: number
}

export function filterAndSortListings({
  listings,
  view,
  userId,
  search,
  categoryFilter,
  distanceFilter,
  sortBy,
  userLocation,
  nowMs,
}: FilterAndSortParams): ListingWithDistance[] {
  const searchText = search.trim().toLowerCase()
  const maxDistanceKm = distanceFilter === 'all' ? null : Number(distanceFilter)

  const preferredCategories = new Set<string>()
  if (userId) {
    for (const item of listings) {
      if (item.claimed_by === userId && item.category) {
        preferredCategories.add(item.category)
      }
    }
  }

  const filtered = listings.filter((listing) => {
    if (isListingExpired(listing, nowMs)) {
      return false
    }

    if (view === 'my_listings') {
      if (listing.posted_by !== userId) {
        return false
      }
    } else if (view === 'my_claims') {
      if (listing.claimed_by !== userId) {
        return false
      }
    } else if (listing.status !== view) {
      return false
    }

    if (searchText) {
      const matchesSearch =
        listing.title.toLowerCase().includes(searchText) ||
        Boolean(listing.description?.toLowerCase().includes(searchText)) ||
        listing.location_text.toLowerCase().includes(searchText)

      if (!matchesSearch) {
        return false
      }
    }

    if (categoryFilter !== 'all' && listing.category !== categoryFilter) {
      return false
    }

    return true
  })

  const withDistance: ListingWithDistance[] = filtered.map((listing) => {
    const distanceKm =
      !userLocation ||
      listing.approx_latitude === null ||
      listing.approx_longitude === null
        ? null
        : calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            listing.approx_latitude,
            listing.approx_longitude
          )

    const rescueScore = computeRescueScore(
      listing,
      distanceKm,
      nowMs,
      preferredCategories
    )

    return { listing, distanceKm, rescueScore }
  })

  const nearby =
    maxDistanceKm === null
      ? withDistance
      : withDistance.filter(
          ({ distanceKm }) => distanceKm !== null && distanceKm <= maxDistanceKm
        )

  return [...nearby].sort((a, b) => {
    if (sortBy === 'recommended') {
      const scoreDiff = (b.rescueScore ?? 0) - (a.rescueScore ?? 0)
      if (scoreDiff !== 0) {
        return scoreDiff
      }
      return (
        new Date(a.listing.pickup_window_end).getTime() -
        new Date(b.listing.pickup_window_end).getTime()
      )
    }

    if (sortBy === 'nearest') {
      if (a.distanceKm === null && b.distanceKm === null) return 0
      if (a.distanceKm === null) return 1
      if (b.distanceKm === null) return -1
      return a.distanceKm - b.distanceKm
    }

    if (sortBy === 'pickup_soonest') {
      return (
        new Date(a.listing.pickup_window_end).getTime() -
        new Date(b.listing.pickup_window_end).getTime()
      )
    }

    return (
      new Date(b.listing.created_at).getTime() -
      new Date(a.listing.created_at).getTime()
    )
  })
}
