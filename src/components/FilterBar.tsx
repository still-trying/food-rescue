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

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-300 bg-white/90 px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-500/20 dark:border-emerald-500/25 dark:bg-[#0b1511]/85 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-emerald-400'

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
    <div className="fr-surface-3d mb-8 rounded-2xl border border-slate-200/80 p-5 dark:border-emerald-500/20">
      <div className="grid gap-4 md:grid-cols-4">
        <div>
          <label
            htmlFor="filter-search"
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
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
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label
            htmlFor="filter-category"
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            Category
          </label>
          <select
            id="filter-category"
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value)}
            className={INPUT_CLASS}
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
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            Sort by
          </label>
          <select
            id="filter-sort"
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value as SortOption)}
            className={INPUT_CLASS}
          >
            <option value="recommended">⚡ Recommended (Urgent + Nearby)</option>
            <option value="newest">Newest</option>
            <option value="pickup_soonest">Pickup ending soonest</option>
            <option value="nearest" disabled={!userLocation}>
              Nearest first
            </option>
          </select>

          {!userLocation && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Enable location to sort by distance.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="filter-distance"
            className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-200"
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
            className={`${INPUT_CLASS} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:bg-slate-900/70 dark:disabled:text-slate-500`}
          >
            <option value="all">Any distance</option>
            <option value="1">Within 1 km</option>
            <option value="5">Within 5 km</option>
            <option value="10">Within 10 km</option>
          </select>

          {!userLocation && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
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
            className="text-sm font-semibold text-slate-500 underline underline-offset-2 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Clear filters
          </button>
        </div>
      )}

      <div className="mt-5 border-t border-slate-200/70 pt-5 dark:border-emerald-500/15">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Find food near you
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Your location is used locally to calculate approximate distances.
            </p>
          </div>

          <button
            type="button"
            onClick={onRequestLocation}
            disabled={locationLoading}
            className="rounded-xl border border-green-200 bg-green-50/90 px-4 py-3 text-sm font-semibold text-green-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/70"
          >
            {locationLoading
              ? 'Finding your location...'
              : userLocation
                ? '🔄 Update location'
                : '📍 Use my location'}
          </button>
        </div>

        {userLocation && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-green-200/80 bg-green-50/90 px-4 py-3 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-500/25 dark:bg-emerald-950/50 dark:text-emerald-200">
            <div>
              <p className="font-semibold">✓ Location enabled</p>
              <p className="mt-0.5 text-xs text-green-700 dark:text-emerald-300/80">
                Distances are calculated locally in your browser.
              </p>
            </div>

            <button
              type="button"
              onClick={onClearLocation}
              className="text-left text-xs font-semibold text-green-800 underline underline-offset-2 hover:text-green-950 sm:text-right dark:text-emerald-300 dark:hover:text-emerald-100"
            >
              Clear location
            </button>
          </div>
        )}

        {locationError && (
          <div
            role="alert"
            className="mt-3 rounded-xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/55 dark:text-red-300"
          >
            {locationError}
          </div>
        )}
      </div>
    </div>
  )
}
