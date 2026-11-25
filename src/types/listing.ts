export type ListingStatus = 'available' | 'claimed' | 'picked_up'

export type FoodCategory =
  | 'cooked_meals'
  | 'bakery'
  | 'groceries'
  | 'fruits_vegetables'
  | 'beverages'
  | 'other'

export type DietaryType = 'veg' | 'vegan' | 'non_veg' | 'eggetarian'

export type StorageType = 'hot' | 'refrigerated' | 'room_temp' | 'frozen'

export type OrganizationType =
  | 'individual'
  | 'restaurant'
  | 'bakery'
  | 'ngo'
  | 'catering'
  | 'grocery'

export type UserProfile = {
  id: string
  display_name: string | null
  organization_name: string | null
  organization_type: OrganizationType | null
  is_verified: boolean
  updated_at: string
}

export type Listing = {
  id: string
  title: string
  description: string | null
  quantity: string | null
  category: string | null
  photo_url: string | null

  location_text: string
  approx_latitude: number | null
  approx_longitude: number | null

  pickup_window_start: string
  pickup_window_end: string

  status: ListingStatus

  posted_by: string
  claimed_by: string | null
  created_at: string

  dietary_type?: DietaryType | null
  allergens?: string[] | null
  storage_type?: StorageType | null
}

export type PickupDetails = {
  listing_id?: string
  pickup_address: string
  pickup_instructions: string | null
  contact_phone: string | null
  pickup_pin?: string | null
}

export type View =
  | 'available'
  | 'my_claims'
  | 'claimed'
  | 'picked_up'
  | 'my_listings'
  | 'impact'
  | 'post'

export type SortOption =
  | 'recommended'
  | 'newest'
  | 'pickup_soonest'
  | 'nearest'

export type DistanceFilter = 'all' | '1' | '5' | '10'

export type UserLocation = {
  latitude: number
  longitude: number
}

export type RealtimeStatus = 'connecting' | 'connected' | 'reconnecting'

export type ListingWithDistance = {
  listing: Listing
  distanceKm: number | null
  rescueScore?: number
}

export type ReportReason =
  | 'unsafe_food'
  | 'spam'
  | 'wrong_location'
  | 'harassment'
  | 'other'
