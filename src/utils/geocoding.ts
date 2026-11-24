export type Coordinates = {
  latitude: number
  longitude: number
}

type CachedGeocodeEntry = Coordinates & {
  cachedAt: number
}

type GeocodingResult = {
  lat: string
  lon: string
  display_name: string
}

const CACHE_PREFIX = 'food-rescue-geocode:'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const MAX_CACHE_ENTRIES = 100

function readCachedCoordinates(cacheKey: string): Coordinates | null {
  try {
    const raw = localStorage.getItem(cacheKey)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<CachedGeocodeEntry>
    const isFresh =
      typeof parsed.cachedAt === 'number' &&
      Date.now() - parsed.cachedAt <= CACHE_TTL_MS

    if (
      isFresh &&
      typeof parsed.latitude === 'number' &&
      typeof parsed.longitude === 'number' &&
      Number.isFinite(parsed.latitude) &&
      Number.isFinite(parsed.longitude)
    ) {
      return {
        latitude: parsed.latitude,
        longitude: parsed.longitude,
      }
    }

    localStorage.removeItem(cacheKey)
    return null
  } catch {
    try {
      localStorage.removeItem(cacheKey)
    } catch {
      // Ignore storage failures in restricted browsing modes.
    }
    return null
  }
}

function writeCachedCoordinates(cacheKey: string, coordinates: Coordinates): void {
  try {
    const geocodeKeys: { key: string; cachedAt: number }[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || !key.startsWith(CACHE_PREFIX)) {
        continue
      }
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? '') as Partial<CachedGeocodeEntry>
        geocodeKeys.push({
          key,
          cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : 0,
        })
      } catch {
        geocodeKeys.push({ key, cachedAt: 0 })
      }
    }

    if (geocodeKeys.length >= MAX_CACHE_ENTRIES) {
      geocodeKeys.sort((a, b) => a.cachedAt - b.cachedAt)
      const toRemove = geocodeKeys.slice(0, geocodeKeys.length - MAX_CACHE_ENTRIES + 1)
      for (const item of toRemove) {
        localStorage.removeItem(item.key)
      }
    }

    const entry: CachedGeocodeEntry = {
      ...coordinates,
      cachedAt: Date.now(),
    }
    localStorage.setItem(cacheKey, JSON.stringify(entry))
  } catch {
    // Gracefully skip caching if storage quota is exceeded or disabled.
  }
}

function isValidCoordinates(
  latitude: number,
  longitude: number
): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  )
}

async function geocodeViaEdgeProxy(query: string): Promise<Coordinates | null> {
  const { supabase } = await import('../lib/supabase')
  const { data, error } = await supabase.functions.invoke<Partial<Coordinates>>(
    'geocode-area',
    {
      body: { query },
    }
  )

  if (error || !data) {
    return null
  }

  if (
    typeof data.latitude === 'number' &&
    typeof data.longitude === 'number' &&
    isValidCoordinates(data.latitude, data.longitude)
  ) {
    return { latitude: data.latitude, longitude: data.longitude }
  }

  return null
}

/**
 * Resolve a broad pickup area string into approximate coordinates.
 * Routes through the `geocode-area` Edge Function when VITE_USE_GEOCODE_PROXY=true,
 * falling back to Nominatim when direct geocoding is configured.
 */
export async function geocodeLocation(location: string): Promise<Coordinates | null> {
  const trimmedLocation = location.trim()
  if (!trimmedLocation) {
    return null
  }

  const env = (import.meta as { env?: Record<string, string | undefined> }).env
  const configuredCountry = (env?.VITE_GEOCODE_COUNTRY ?? 'India').trim()
  const normalizedLocation = `${trimmedLocation.toLowerCase()}|${configuredCountry.toLowerCase()}`
  const cacheKey = `${CACHE_PREFIX}${normalizedLocation}`

  const cached = readCachedCoordinates(cacheKey)
  if (cached) {
    return cached
  }

  const query =
    configuredCountry &&
    !trimmedLocation.toLowerCase().includes(configuredCountry.toLowerCase())
      ? `${trimmedLocation}, ${configuredCountry}`
      : trimmedLocation

  if (env?.VITE_USE_GEOCODE_PROXY === 'true') {
    const proxied = await geocodeViaEdgeProxy(query)
    if (proxied) {
      writeCachedCoordinates(cacheKey, proxied)
      return proxied
    }
  }

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '1',
  })

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    }
  )

  if (!response.ok) {
    throw new Error(`Geocoding request failed with status ${response.status}`)
  }

  const results = (await response.json()) as GeocodingResult[]
  const firstResult = results[0]
  if (!firstResult) {
    return null
  }

  const latitude = Number(firstResult.lat)
  const longitude = Number(firstResult.lon)

  if (!isValidCoordinates(latitude, longitude)) {
    return null
  }

  const coordinates = { latitude, longitude }
  writeCachedCoordinates(cacheKey, coordinates)
  return coordinates
}
