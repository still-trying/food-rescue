import { useCallback, useState } from 'react'
import type { UserLocation } from '../types/listing'

export function useUserLocation(onLocationEnabled?: () => void) {
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [locationError, setLocationError] = useState('')

  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Location services are not supported by this browser.')
      return
    }

    setLocationLoading(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
        setLocationLoading(false)
        onLocationEnabled?.()
      },
      (positionError) => {
        if (import.meta.env.DEV) {
          console.error('Location error:', positionError)
        }

        setLocationLoading(false)

        switch (positionError.code) {
          case 1:
            setLocationError(
              'Location permission was denied. You can enable it in your browser settings.'
            )
            break
          case 2:
            setLocationError('Your location could not be determined.')
            break
          case 3:
            setLocationError('Location request timed out. Please try again.')
            break
          default:
            setLocationError('Unable to determine your location.')
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    )
  }, [onLocationEnabled])

  const clearUserLocation = useCallback(() => {
    setUserLocation(null)
    setLocationError('')
  }, [])

  return {
    userLocation,
    locationLoading,
    locationError,
    requestUserLocation,
    clearUserLocation,
  }
}

