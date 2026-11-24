import { FOOD_CATEGORIES } from '../constants/categories'
import type {
  DistanceFilter,
  SortOption,
  UserLocation,
} from '../types/listing'

type Props = {
  search: string
  onSearchChange: (value: string) => void
  categoryFilter: string
  onCategoryFilterChange: (value: string) => void
  sortBy: SortOption
  onSortByChange: (value: SortOption) => void
  distanceFilter: DistanceFilter
  onDistanceFilterChange: (value: DistanceFilter) => void
  onClearFilters: () => void
  userLocation: UserLocation | null
  locationLoading: boolean
  locationError: string
  onRequestLocation: () => void
  onClearLocation: () => void
}

export default function FilterBar({
  search,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  sortBy,
  onSortByChange,
  distanceFilter,
  onDistanceFilterChange,
  onClearFilters,
  userLocation,
  locationLoading,
  locationError,
  onRequestLocation,
  onClearLocation,
}: Props) {
  const hasActiveFilters = Boolean(
    search ||
      categoryFilter !== 'all' ||
      distanceFilter !== 'all' ||
      sortBy !== 'recommended'
  )

  return (
    <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5">
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label
            htmlFor="filter-search"
            className="mb-2 block text-sm font-semibold"
          >
            Search food
          </label>
          <input
            id="filter-search"
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search food, description, location..."
            maxLength={100}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
          />
        </div>

        <div>
          <label
            htmlFor="filter-category"
            className="mb-2 block text-sm font-semibold"
          >
            Category
          </label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600"
          >
            <option value="all">All Categories</option>
            {FOOD_CATEGORIES.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="filter-sort"
            className="mb-2 block text-sm font-semibold"
          >
            Sort by
          </label>
          <select
            id="filter-sort"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortOption)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600"
          >
            <option value="recommended">⚡ Recommended (Urgent + Nearby)</option>
            <option value="newest">Newest</option>
            <option value="pickup_soonest">Pickup ending soonest</option>
            <option value="nearest" disabled={!userLocation}>
              Nearest first
            </option>
          </select>

          {!userLocation && (
            <p className="mt-2 text-xs text-gray-400">
              Enable location to sort by distance.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="filter-distance"
            className="mb-2 block text-sm font-semibold"
          >
            Distance
          </label>
          <select
            id="filter-distance"
            value={distanceFilter}
            onChange={(e) =>
              onDistanceFilterChange(e.target.value as DistanceFilter)
            }
            disabled={!userLocation}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-green-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="all">Any distance</option>
            <option value="1">Within 1 km</option>
            <option value="5">Within 5 km</option>
            <option value="10">Within 10 km</option>
          </select>

          {!userLocation && (
            <p className="mt-2 text-xs text-gray-400">
              Enable your location to filter food by distance.
            </p>
          )}
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClearFilters}
            className="text-sm font-semibold text-gray-500 underline underline-offset-2 transition hover:text-gray-800"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="mt-5 border-t border-gray-100 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">
              Find food near you
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Your location is used locally to calculate approximate distances.
            </p>
          </div>

          <button
            type="button"
            onClick={onRequestLocation}
            disabled={locationLoading}
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {locationLoading
              ? 'Finding your location...'
              : userLocation
                ? '🔄 Update location'
                : '📍 Use my location'}
          </button>
        </div>

        {userLocation && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">✓ Location enabled</p>
              <p className="mt-0.5 text-xs text-green-600">
                Distances are calculated locally in your browser.
              </p>
            </div>

            <button
              type="button"
              onClick={onClearLocation}
              className="text-left text-xs font-semibold text-green-700 underline underline-offset-2 hover:text-green-900 sm:text-right"
            >
              Clear location
            </button>
          </div>
        )}

        {locationError && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {locationError}
          </div>
        )}
      </div>
    </div>
  )
}

