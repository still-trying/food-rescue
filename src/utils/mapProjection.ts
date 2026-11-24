export const TILE_SIZE = 256

/**
 * Convert WGS84 latitude/longitude into fractional slippy-map tile coordinates
 * at a given Web Mercator zoom level.
 */
export function latLonToTileFraction(
  latitude: number,
  longitude: number,
  zoom: number
): { x: number; y: number } {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, latitude))
  const latRad = (clampedLat * Math.PI) / 180
  const n = 2 ** zoom

  const x = ((longitude + 180) / 360) * n
  const y =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n

  return { x, y }
}

/**
 * Convert a target coordinate into pixel offsets relative to the center of a
 * viewport centered on `(centerLat, centerLon)` at `zoom`.
 */
export function latLonToViewportPixel(
  latitude: number,
  longitude: number,
  centerLat: number,
  centerLon: number,
  zoom: number,
  viewportWidth: number,
  viewportHeight: number
): { left: number; top: number } {
  const centerTile = latLonToTileFraction(centerLat, centerLon, zoom)
  const targetTile = latLonToTileFraction(latitude, longitude, zoom)

  return {
    left: viewportWidth / 2 + (targetTile.x - centerTile.x) * TILE_SIZE,
    top: viewportHeight / 2 + (targetTile.y - centerTile.y) * TILE_SIZE,
  }
}

/**
 * Approximate meters per pixel at a latitude and Web Mercator zoom level.
 */
export function metersPerPixel(latitude: number, zoom: number): number {
  const earthCircumferenceMeters = 40_075_016.686
  return (
    (earthCircumferenceMeters * Math.cos((latitude * Math.PI) / 180)) /
    (TILE_SIZE * 2 ** zoom)
  )
}

