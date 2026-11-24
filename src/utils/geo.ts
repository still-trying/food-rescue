/**
 * Calculate approximate straight-line distance in kilometers between two
 * latitude/longitude coordinates using the Haversine formula.
 */
export function calculateDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
): number {
  const earthRadiusKm = 6371
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180

  const dLatitude = toRadians(latitude2 - latitude1)
  const dLongitude = toRadians(longitude2 - longitude1)
  const lat1 = toRadians(latitude1)
  const lat2 = toRadians(latitude2)

  const a =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLongitude / 2) ** 2

  const clampedA = Math.min(1, Math.max(0, a))
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA))

  return earthRadiusKm * c
}

/**
 * Format a distance in kilometers into a user-friendly straight-line label.
 */
export function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return null
  }

  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000)
    return `${meters} m away · straight-line`
  }

  return `${distanceKm.toFixed(1)} km away · straight-line`
}

