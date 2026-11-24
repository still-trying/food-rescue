import { useMemo, useState } from 'react'
import { formatCategoryLabel } from '../constants/categories'
import type {
  DistanceFilter,
  ListingWithDistance,
  UserLocation,
} from '../types/listing'
import { formatDateTime } from '../utils/date'
import { formatDistance } from '../utils/geo'
import {
  latLonToTileFraction,
  latLonToViewportPixel,
  metersPerPixel,
  TILE_SIZE,
} from '../utils/mapProjection'

type Props = {
  listings: ListingWithDistance[]
  userLocation: UserLocation | null
  distanceFilter: DistanceFilter
  currentUserId: string | null
  onSelectListing?: (listingId: string) => void
}

const DEFAULT_CENTER = { latitude: 26.8467, longitude: 80.9462 } // Lucknow fallback
const VIEWPORT_WIDTH = 900
const VIEWPORT_HEIGHT = 440

export default function ListingsMap({
  listings,
  userLocation,
  distanceFilter,
  currentUserId,
  onSelectListing,
}: Props) {
  const mappable = useMemo(
    () =>
      listings.filter(
        (item) =>
          item.listing.approx_latitude !== null &&
          item.listing.approx_longitude !== null
      ),
    [listings]
  )

  const initialCenter = useMemo(() => {
    if (userLocation) {
      return userLocation
    }
    const first = mappable[0]
    if (
      first &&
      first.listing.approx_latitude !== null &&
      first.listing.approx_longitude !== null
    ) {
      return {
        latitude: first.listing.approx_latitude,
        longitude: first.listing.approx_longitude,
      }
    }
    return DEFAULT_CENTER
  }, [mappable, userLocation])

  const [center, setCenter] = useState(initialCenter)
  const [zoom, setZoom] = useState(userLocation ? 13 : 12)
  const [selectedId, setSelectedId] = useState<string | null>(
    mappable[0]?.listing.id ?? null
  )
  const [tilesFailed, setTilesFailed] = useState(false)

  const activeCenter = center

  const tiles = useMemo(() => {
    const centerTile = latLonToTileFraction(
      activeCenter.latitude,
      activeCenter.longitude,
      zoom
    )
    const maxTile = 2 ** zoom
    const minTileX = Math.floor(
      centerTile.x - VIEWPORT_WIDTH / 2 / TILE_SIZE
    )
    const maxTileX = Math.ceil(
      centerTile.x + VIEWPORT_WIDTH / 2 / TILE_SIZE
    )
    const minTileY = Math.floor(
      centerTile.y - VIEWPORT_HEIGHT / 2 / TILE_SIZE
    )
    const maxTileY = Math.ceil(
      centerTile.y + VIEWPORT_HEIGHT / 2 / TILE_SIZE
    )

    const result: {
      key: string
      url: string
      left: number
      top: number
    }[] = []

    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= maxTile) continue
        const wrappedX = ((tx % maxTile) + maxTile) % maxTile
        result.push({
          key: `${zoom}-${tx}-${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          left: VIEWPORT_WIDTH / 2 + (tx - centerTile.x) * TILE_SIZE,
          top: VIEWPORT_HEIGHT / 2 + (ty - centerTile.y) * TILE_SIZE,
        })
      }
    }

    return result
  }, [activeCenter.latitude, activeCenter.longitude, zoom])

  const selectedEntry =
    mappable.find((item) => item.listing.id === selectedId) ?? mappable[0] ?? null

  const radiusRadiusPx = useMemo(() => {
    if (!userLocation || distanceFilter === 'all') {
      return null
    }
    const radiusMeters = Number(distanceFilter) * 1000
    const mpp = metersPerPixel(userLocation.latitude, zoom)
    return mpp > 0 ? radiusMeters / mpp : null
  }, [distanceFilter, userLocation, zoom])

  const userPixel = userLocation
    ? latLonToViewportPixel(
        userLocation.latitude,
        userLocation.longitude,
        activeCenter.latitude,
        activeCenter.longitude,
        zoom,
        VIEWPORT_WIDTH,
        VIEWPORT_HEIGHT
      )
    : null

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 px-4 py-3">
          <p className="text-xs font-medium text-gray-600">
            Showing {mappable.length}{' '}
            {mappable.length === 1 ? 'listing' : 'listings'} with approximate
            area coordinates
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(4, z - 1))}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-gray-100"
              aria-label="Zoom out map"
            >
              −
            </button>
            <span className="text-xs font-medium text-gray-500">
              Zoom {zoom}
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(17, z + 1))}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-gray-100"
              aria-label="Zoom in map"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setCenter(initialCenter)}
              className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            >
              Recenter
            </button>
          </div>
        </div>

        <div className="relative h-[440px] w-full overflow-hidden bg-slate-100">
          {!tilesFailed ? (
            <div className="pointer-events-none absolute inset-0">
              {tiles.map((tile) => (
                <img
                  key={tile.key}
                  src={tile.url}
                  alt=""
                  onError={() => setTilesFailed(true)}
                  className="absolute h-[256px] w-[256px] max-w-none select-none"
                  style={{
                    left: `${(tile.left / VIEWPORT_WIDTH) * 100}%`,
                    top: `${(tile.top / VIEWPORT_HEIGHT) * 100}%`,
                    width: `${(TILE_SIZE / VIEWPORT_WIDTH) * 100}%`,
                    height: `${(TILE_SIZE / VIEWPORT_HEIGHT) * 100}%`,
                  }}
                />
              ))}
            </div>
          ) : (
            <div
              className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]"
              aria-hidden="true"
            />
          )}

          {userPixel && radiusRadiusPx !== null && (
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-green-600/60 bg-green-500/10"
              style={{
                left: `${(userPixel.left / VIEWPORT_WIDTH) * 100}%`,
                top: `${(userPixel.top / VIEWPORT_HEIGHT) * 100}%`,
                width: `${((radiusRadiusPx * 2) / VIEWPORT_WIDTH) * 100}%`,
                height: `${((radiusRadiusPx * 2) / VIEWPORT_HEIGHT) * 100}%`,
              }}
            />
          )}

          {userPixel && (
            <div
              title="Your location"
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(userPixel.left / VIEWPORT_WIDTH) * 100}%`,
                top: `${(userPixel.top / VIEWPORT_HEIGHT) * 100}%`,
              }}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-blue-600 text-[10px] text-white shadow">
                ●
              </span>
            </div>
          )}

          {mappable.map(({ listing }) => {
            const pos = latLonToViewportPixel(
              listing.approx_latitude!,
              listing.approx_longitude!,
              activeCenter.latitude,
              activeCenter.longitude,
              zoom,
              VIEWPORT_WIDTH,
              VIEWPORT_HEIGHT
            )

            const isSelected = selectedEntry?.listing.id === listing.id
            const isMine = currentUserId === listing.posted_by
            const pinColor =
              listing.status === 'available'
                ? 'bg-green-600 text-white'
                : listing.status === 'claimed'
                  ? 'bg-amber-500 text-white'
                  : 'bg-gray-600 text-white'

            return (
              <button
                key={listing.id}
                type="button"
                onClick={() => {
                  setSelectedId(listing.id)
                  setCenter({
                    latitude: listing.approx_latitude!,
                    longitude: listing.approx_longitude!,
                  })
                }}
                aria-label={`Select ${listing.title} in ${listing.location_text}`}
                className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white px-2.5 py-1 text-xs font-bold shadow-md transition ${pinColor} ${
                  isSelected ? 'z-20 scale-110 ring-2 ring-green-900' : 'z-10 hover:scale-105'
                }`}
                style={{
                  left: `${(pos.left / VIEWPORT_WIDTH) * 100}%`,
                  top: `${(pos.top / VIEWPORT_HEIGHT) * 100}%`,
                }}
              >
                {isMine ? '★ ' : '🍱 '}
                <span className="hidden sm:inline">
                  {listing.title.slice(0, 14)}
                </span>
              </button>
            )
          })}

          <div className="absolute bottom-2 right-2 rounded bg-white/85 px-2 py-0.5 text-[10px] text-gray-600">
            © OpenStreetMap contributors · Approximate pickup areas only
          </div>
        </div>
      </div>

      {selectedEntry ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900">
                  {selectedEntry.listing.title}
                </h3>
                {formatCategoryLabel(selectedEntry.listing.category) && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                    {formatCategoryLabel(selectedEntry.listing.category)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-600">
                📍 {selectedEntry.listing.location_text}
                {formatDistance(selectedEntry.distanceKm)
                  ? ` · ${formatDistance(selectedEntry.distanceKm)}`
                  : ''}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Pickup until {formatDateTime(selectedEntry.listing.pickup_window_end)}
              </p>
            </div>

            {onSelectListing && (
              <button
                type="button"
                onClick={() => onSelectListing(selectedEntry.listing.id)}
                className="shrink-0 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
              >
                View Details in Feed
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No listings in this view have approximate map coordinates yet.
        </div>
      )}
    </div>
  )
}

