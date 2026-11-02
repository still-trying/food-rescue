import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import ListingFeed, {
  type ListingWithDistance,
} from './components/ListingFeed'
import PostListingForm from './components/PostListingForm'
import type { Listing } from './components/ListingCard'

type View =
  | 'available'
  | 'claimed'
  | 'picked_up'
  | 'my_listings'
  | 'post'

type SortOption =
  | 'newest'
  | 'pickup_soonest'
  | 'nearest'

type DistanceFilter =
  | 'all'
  | '1'
  | '5'
  | '10'

type UserLocation = {
  latitude: number
  longitude: number
}

type RealtimeStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'

type RealtimeChange = {
  version: number
  deleted: boolean
  listing?: Listing
}

/*
 * Calculate approximate distance between two
 * latitude/longitude points using the Haversine formula.
 */
function calculateDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const earthRadiusKm = 6371

  const toRadians = (degrees: number) =>
    (degrees * Math.PI) / 180

  const dLatitude = toRadians(
    latitude2 - latitude1
  )

  const dLongitude = toRadians(
    longitude2 - longitude1
  )

  const lat1 = toRadians(latitude1)
  const lat2 = toRadians(latitude2)

  const a =
    Math.sin(dLatitude / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(dLongitude / 2) ** 2

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    )

  return earthRadiusKm * c
}

function App() {
  const [view, setView] =
    useState<View>('available')

  const [search, setSearch] = useState('')

  const [categoryFilter, setCategoryFilter] =
    useState('all')

  const [sortBy, setSortBy] =
    useState<SortOption>('newest')

  const [distanceFilter, setDistanceFilter] =
    useState<DistanceFilter>('all')

  const [listings, setListings] =
    useState<Listing[]>([])

  const [userId, setUserId] =
    useState<string | null>(null)

  /*
   * Refs keep async realtime callbacks aligned with the latest
   * rendered state, even though the subscription effect runs once.
   */
  const listingsRef = useRef<Listing[]>([])
  const currentUserIdRef = useRef<string | null>(null)
  const realtimeEventVersionRef = useRef(0)
  const realtimeChangesRef = useRef<Map<string, RealtimeChange>>(new Map())
  const listingLoadRequestRef = useRef(0)

  const [userEmail, setUserEmail] =
    useState<string | null>(null)

  const [userLocation, setUserLocation] =
    useState<UserLocation | null>(null)

  const [locationLoading, setLocationLoading] =
    useState(false)

  const [locationError, setLocationError] =
    useState('')

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [loggingOut, setLoggingOut] =
    useState(false)

  /*
   * Realtime user-facing notification.
   *
   * Example:
   * "🟡 A food listing was just claimed."
   */
  const [realtimeNotice, setRealtimeNotice] =
    useState('')

  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>('connecting')

  // Synchronize callback-visible refs after React commits state changes.
  useEffect(() => {
    listingsRef.current = listings
    currentUserIdRef.current = userId
  }, [listings, userId])

  /*
   * Stores the active notification timer so
   * multiple realtime events do not create
   * competing timers.
   */
  const realtimeNoticeTimer =
    useRef<ReturnType<typeof setTimeout> | null>(null)
  const realtimeNoticeRef = useRef('')

  /*
   * Show a realtime notification for 4 seconds.
   * Repeated identical messages are ignored while visible.
   */
  const showRealtimeNotice = useCallback((
    message: string
  ) => {
    if (realtimeNoticeRef.current === message) {
      return
    }

    realtimeNoticeRef.current = message
    setRealtimeNotice(message)

    if (realtimeNoticeTimer.current) {
      clearTimeout(
        realtimeNoticeTimer.current
      )
    }

    realtimeNoticeTimer.current =
      setTimeout(() => {
        realtimeNoticeRef.current = ''
        setRealtimeNotice('')
        realtimeNoticeTimer.current = null
      }, 4000)
  }, [])

  /*
   * Request the user's current location.
   *
   * The location is kept only in React state.
   * It is not stored in Supabase.
   */
  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError(
        'Location services are not supported by this browser.'
      )
      return
    }

    setLocationLoading(true)
    setLocationError('')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude:
            position.coords.latitude,
          longitude:
            position.coords.longitude,
        })

        setLocationLoading(false)

        // Show nearest listings immediately
        // after location becomes available.
        setSortBy('nearest')
      },
      (positionError) => {
        console.error(
          'Location error:',
          positionError
        )

        setLocationLoading(false)

        switch (positionError.code) {
          case 1:
            setLocationError(
              'Location permission was denied. You can enable it in your browser settings.'
            )
            break

          case 2:
            setLocationError(
              'Your location could not be determined.'
            )
            break

          case 3:
            setLocationError(
              'Location request timed out. Please try again.'
            )
            break

          default:
            setLocationError(
              'Unable to determine your location.'
            )
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000,
      }
    )
  }

  /*
   * Clear the current browser-only location.
   */
  const clearUserLocation = () => {
    setUserLocation(null)
    setLocationError('')
    setDistanceFilter('all')

    if (sortBy === 'nearest') {
      setSortBy('newest')
    }
  }

  /*
   * Clear search/filter controls without
   * removing the user's location.
   */
  const clearFilters = () => {
    setSearch('')
    setCategoryFilter('all')
    setDistanceFilter('all')
    setSortBy('newest')
  }

  /*
   * Load listings from Supabase.
   *
   * A revision-aware merge prevents a slow snapshot request from
   * overwriting newer realtime events that arrived while it was running.
   */
  const loadListings = useCallback(async (
    options: { clearError?: boolean } = {}
  ) => {
    if (options.clearError !== false) {
      setError('')
    }

    const requestId = ++listingLoadRequestRef.current
    const eventVersionAtStart = realtimeEventVersionRef.current

    try {
      const {
        data,
        error: listingsError,
      } = await supabase
        .from('listings')
        .select('*')
        .order('created_at', {
          ascending: false,
        })

      // Ignore older overlapping load requests.
      if (requestId !== listingLoadRequestRef.current) {
        return
      }

      if (listingsError) {
        console.error(
          'Listings loading error:',
          listingsError
        )

        setError(
          'Unable to load food listings. Please try again.'
        )

        return
      }

      const snapshotById = new Map<string, Listing>(
        ((data ?? []) as Listing[]).map(
          (listing): [string, Listing] => [listing.id, listing]
        )
      )

      // Reapply events that occurred after this database request began.
      // This prevents an older response from undoing a newer claim/pickup
      // or reintroducing a listing deleted while the request was in flight.
      for (const [id, change] of realtimeChangesRef.current) {
        if (change.version <= eventVersionAtStart) {
          // The database snapshot began after this event, so it should
          // include the change. Drop this now-obsolete revision marker.
          realtimeChangesRef.current.delete(id)
          continue
        }

        if (change.deleted) {
          snapshotById.delete(id)
        } else if (change.listing) {
          snapshotById.set(id, change.listing)
        }
      }

      const refreshedListings = Array.from(
        snapshotById.values()
      ).sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )

      setListings(refreshedListings)
    } catch (err) {
      if (requestId !== listingLoadRequestRef.current) {
        return
      }

      console.error(
        'Unexpected listings loading error:',
        err
      )

      setError(
        'Something went wrong while loading listings.'
      )
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const initializeApp = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error(
            'Session error:',
            sessionError
          )

          if (mounted) {
            setError(
              'Unable to verify your session. Please refresh the page.'
            )
          }

          return
        }

        if (
          session?.user &&
          mounted
        ) {
          setUserId(
            session.user.id
          )

          setUserEmail(
            session.user.email ?? null
          )

          await loadListings()
        }
      } catch (err) {
        console.error(
          'Application initialization error:',
          err
        )

        if (mounted) {
          setError(
            'Unable to load Food Rescue. Please refresh the page.'
          )
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeApp()

    /*
     * Authentication changes
     */
    const {
      data: {
        subscription: authSubscription,
      },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) {
          return
        }

        setUserId(
          session?.user?.id ?? null
        )

        setUserEmail(
          session?.user?.email ?? null
        )

        if (session?.user) {
          await loadListings()
        } else {
          setListings([])
          setView('available')
          setUserLocation(null)
          setLocationError('')
          setDistanceFilter('all')
          setSearch('')
          setCategoryFilter('all')
          setSortBy('newest')
          realtimeNoticeRef.current = ''
          setRealtimeNotice('')
        }

        if (mounted) {
          setLoading(false)
        }
      }
    )

    /*
     * Realtime listing updates with automatic reconnection.
     */
    let listingsChannel: ReturnType<typeof supabase.channel> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let retryAttempt = 0
    let hasConnectedOnce = false

    const connectRealtime = () => {
      if (!mounted || listingsChannel) {
        return
      }

      setRealtimeStatus(
        hasConnectedOnce ? 'reconnecting' : 'connecting'
      )

      const channel = supabase
        .channel('listings-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'listings',
          },
          (payload) => {
            if (!mounted) {
              return
            }

            console.log(
              'Realtime listing change:',
              payload
            )

            /* New listing */
            if (payload.eventType === 'INSERT') {
              const newListing = payload.new as Listing
              const alreadyKnown = listingsRef.current.some(
                (listing) => listing.id === newListing.id
              )

              const version = ++realtimeEventVersionRef.current
              realtimeChangesRef.current.set(newListing.id, {
                version,
                deleted: false,
                listing: newListing,
              })

              setListings((current) => {
                if (
                  current.some(
                    (listing) => listing.id === newListing.id
                  )
                ) {
                  return current
                }

                return [newListing, ...current]
              })

              // Don't notify the person who created the listing.
              if (
                !alreadyKnown &&
                newListing.posted_by !== currentUserIdRef.current
              ) {
                showRealtimeNotice(
                  '🟢 New surplus food has been posted.'
                )
              }

              return
            }

            /* Updated listing */
            if (payload.eventType === 'UPDATE') {
              const oldListing = payload.old as Partial<Listing>
              const updatedListing = payload.new as Listing

              const previousLocalListing = listingsRef.current.find(
                (listing) => listing.id === updatedListing.id
              )

              const previousRealtimeChange =
                realtimeChangesRef.current.get(updatedListing.id)

              const previousRealtimeListing =
                previousRealtimeChange && !previousRealtimeChange.deleted
                  ? previousRealtimeChange.listing
                  : undefined

              // Prefer whichever known value reflects the furthest state in
              // the Available -> Claimed -> Picked Up lifecycle. This also
              // helps with rapid events arriving before React rerenders.
              const statusRank: Record<Listing['status'], number> = {
                available: 0,
                claimed: 1,
                picked_up: 2,
              }

              const candidateStatuses = [
                previousLocalListing?.status,
                previousRealtimeListing?.status,
                oldListing.status,
              ].filter(
                (status): status is Listing['status'] =>
                  status !== undefined
              )

              const previousStatus = candidateStatuses.reduce(
                (latest, candidate) =>
                  statusRank[candidate] > statusRank[latest]
                    ? candidate
                    : latest,
                candidateStatuses[0] ?? updatedListing.status
              )

              const currentUser = currentUserIdRef.current

              // Notify only on meaningful state transitions and don't notify
              // a user about their own claim or pickup action.
              if (
                previousStatus === 'available' &&
                updatedListing.status === 'claimed' &&
                updatedListing.claimed_by !== currentUser
              ) {
                showRealtimeNotice(
                  '🟡 A food listing was just claimed.'
                )
              } else if (
                previousStatus === 'claimed' &&
                updatedListing.status === 'picked_up' &&
                updatedListing.claimed_by !== currentUser
              ) {
                showRealtimeNotice(
                  '🔵 A food listing was marked as picked up.'
                )
              }

              const version = ++realtimeEventVersionRef.current
              realtimeChangesRef.current.set(updatedListing.id, {
                version,
                deleted: false,
                listing: updatedListing,
              })

              // Upsert the updated row so a missing local row is reconciled too.
              setListings((current) => {
                const alreadyExists = current.some(
                  (listing) => listing.id === updatedListing.id
                )

                if (!alreadyExists) {
                  return [updatedListing, ...current]
                }

                return current.map((listing) =>
                  listing.id === updatedListing.id
                    ? updatedListing
                    : listing
                )
              })

              return
            }

            /* Deleted listing */
            if (payload.eventType === 'DELETE') {
              const deletedListing = payload.old as Partial<Listing>
              const deletedId = deletedListing.id

              if (!deletedId) {
                return
              }

              const knownListing =
                listingsRef.current.find(
                  (listing) => listing.id === deletedId
                ) ??
                realtimeChangesRef.current.get(deletedId)?.listing

              const version = ++realtimeEventVersionRef.current
              realtimeChangesRef.current.set(deletedId, {
                version,
                deleted: true,
              })

              setListings((current) =>
                current.filter(
                  (listing) => listing.id !== deletedId
                )
              )

              // Only notify for a listing that was visible locally and
              // wasn't removed by its own current user.
              const ownerId =
                knownListing?.posted_by ?? deletedListing.posted_by

              if (
                knownListing &&
                ownerId !== currentUserIdRef.current
              ) {
                showRealtimeNotice(
                  '⚪ A food listing was removed.'
                )
              }
            }
          }
        )

      // Set the active channel before subscribing so that only
      // callbacks from the current channel can affect the UI.
      listingsChannel = channel

      channel.subscribe((status) => {
        if (!mounted || listingsChannel !== channel) {
          return
        }

        console.log(
          'Listings realtime status:',
          status
        )

        if (status === 'SUBSCRIBED') {
          const isReconnection = hasConnectedOnce

          hasConnectedOnce = true
          retryAttempt = 0
          setRealtimeStatus('connected')

          setError((current) => {
            if (current.includes('Live updates')) {
              return ''
            }

            return current
          })

          // Reconcile the local feed after reconnecting in case
          // changes occurred while this client was disconnected.
          if (isReconnection) {
            showRealtimeNotice(
              '🔄 Live connection restored. Refreshing listings...'
            )
            void loadListings({ clearError: false })
          }

          return
        }

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setRealtimeStatus('reconnecting')
          setError(
            'Live updates were interrupted. Reconnecting automatically...'
          )

          // Detach this channel before removal. The identity check above
          // prevents callbacks from the old channel scheduling more retries.
          listingsChannel = null
          void supabase.removeChannel(channel)

          if (reconnectTimer === null && mounted) {
            const retryDelay = Math.min(
              1000 * 2 ** retryAttempt,
              30000
            )

            retryAttempt += 1

            reconnectTimer = setTimeout(() => {
              reconnectTimer = null
              connectRealtime()
            }, retryDelay)
          }
        }
      })
    }

    connectRealtime()

    return () => {
      mounted = false

      authSubscription.unsubscribe()

      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      if (listingsChannel !== null) {
        const channelToRemove = listingsChannel
        listingsChannel = null
        void supabase.removeChannel(channelToRemove)
      }

      if (realtimeNoticeTimer.current) {
        clearTimeout(realtimeNoticeTimer.current)
        realtimeNoticeTimer.current = null
      }
    }
  }, [loadListings, showRealtimeNotice])


  /*
   * Update one listing locally.
   */
  const handleUpdated = (
    updatedListing: Listing
  ) => {
    setListings((current) =>
      current.map((listing) =>
        listing.id ===
        updatedListing.id
          ? updatedListing
          : listing
      )
    )
  }

  /*
   * Add newly created listing locally.
   */
  const handleCreated = (
    newListing: Listing
  ) => {
    setListings((current) => {
      if (
        current.some(
          (listing) =>
            listing.id ===
            newListing.id
        )
      ) {
        return current
      }

      return [
        newListing,
        ...current,
      ]
    })

    setView('available')
  }

  /*
   * Logout
   */
  const handleLogout = async () => {
    if (loggingOut) {
      return
    }

    setError('')
    setLoggingOut(true)

    try {
      const {
        error: logoutError,
      } = await supabase.auth.signOut()

      if (logoutError) {
        console.error(
          'Logout error:',
          logoutError
        )

        setError(
          'Unable to log out. Please try again.'
        )

        return
      }

      setUserId(null)
      setUserEmail(null)
      setListings([])

      setUserLocation(null)
      setLocationError('')

      setView('available')

      setSearch('')
      setCategoryFilter('all')
      setSortBy('newest')
      setDistanceFilter('all')
      realtimeNoticeRef.current = ''
      setRealtimeNotice('')
    } catch (err) {
      console.error(
        'Unexpected logout error:',
        err
      )

      setError(
        'Something went wrong while logging out.'
      )
    } finally {
      setLoggingOut(false)
    }
  }

  /*
   * Authentication callback
   */
  const handleAuthenticated =
    async () => {
      setError('')

      try {
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser()

        if (userError) {
          console.error(
            'Authentication verification error:',
            userError
          )

          setError(
            'Unable to verify your account. Please try again.'
          )

          return
        }

        if (user) {
          setUserId(user.id)

          setUserEmail(
            user.email ?? null
          )

          await loadListings()
        }
      } catch (err) {
        console.error(
          'Unexpected authentication error:',
          err
        )

        setError(
          'Something went wrong while signing you in.'
        )
      }
    }

  const now = new Date()

  /*
   * Filter listings.
   */
  const filteredListings = listings
    .filter((listing) => {
      /*
       * Hide expired available listings.
       */
      if (
        listing.status ===
          'available' &&
        new Date(
          listing.pickup_window_end
        ) <= now
      ) {
        return false
      }

      /*
       * My Listings
       */
      if (
        view === 'my_listings'
      ) {
        if (
          listing.posted_by !==
          userId
        ) {
          return false
        }
      } else {
        /*
         * Status filter
         */
        if (
          listing.status !==
          view
        ) {
          return false
        }
      }

      /*
       * Search
       */
      const searchText =
        search
          .trim()
          .toLowerCase()

      if (searchText) {
        const matchesSearch =
          listing.title
            .toLowerCase()
            .includes(searchText) ||
          listing.description
            ?.toLowerCase()
            .includes(searchText) ||
          listing.location_text
            .toLowerCase()
            .includes(searchText)

        if (!matchesSearch) {
          return false
        }
      }

      /*
       * Category
       */
      if (
        categoryFilter !==
          'all' &&
        listing.category !==
          categoryFilter
      ) {
        return false
      }

      return true
    })

  /*
   * Add calculated distance to each listing.
   */
  const listingsWithDistance: ListingWithDistance[] =
    filteredListings.map(
      (listing) => {
        /*
         * No user location or no listing
         * coordinates → no distance.
         */
        if (
          !userLocation ||
          listing.approx_latitude === null ||
          listing.approx_longitude === null
        ) {
          return {
            listing,
            distanceKm: null,
          }
        }

        /*
         * Calculate listing distance.
         */
        const distanceKm =
          calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            listing.approx_latitude,
            listing.approx_longitude
          )

        return {
          listing,
          distanceKm,
        }
      }
    )

  /*
   * Apply distance filter.
   */
  const nearbyListings =
    listingsWithDistance.filter(
      ({ distanceKm }) => {
        if (
          distanceFilter === 'all'
        ) {
          return true
        }

        /*
         * Cannot determine distance for
         * legacy listings without coordinates.
         */
        if (
          distanceKm === null
        ) {
          return false
        }

        return (
          distanceKm <=
          Number(distanceFilter)
        )
      }
    )

  /*
   * Sort the final results.
   */
  const finalListings =
    [...nearbyListings].sort(
      (a, b) => {
        /*
         * Nearest first
         */
        if (
          sortBy === 'nearest'
        ) {
          if (
            a.distanceKm === null
          ) {
            return 1
          }

          if (
            b.distanceKm === null
          ) {
            return -1
          }

          return (
            a.distanceKm -
            b.distanceKm
          )
        }

        /*
         * Pickup ending soonest
         */
        if (
          sortBy ===
          'pickup_soonest'
        ) {
          return (
            new Date(
              a.listing.pickup_window_end
            ).getTime() -
            new Date(
              b.listing.pickup_window_end
            ).getTime()
          )
        }

        /*
         * Newest
         */
        return (
          new Date(
            b.listing.created_at
          ).getTime() -
          new Date(
            a.listing.created_at
          ).getTime()
        )
      }
    )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">

          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />

          <p className="font-medium text-gray-700">
            Loading Food Rescue...
          </p>

          <p className="mt-1 text-sm text-gray-500">
            Connecting to the food rescue board
          </p>

        </div>
      </div>
    )
  }

  /*
   * User is not logged in.
   */
  if (!userId) {
    return (
      <Auth
        onAuthenticated={
          handleAuthenticated
        }
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">

          <button
            onClick={() =>
              setView('available')
            }
            className="text-left"
          >
            <h1 className="text-2xl font-bold">
              Food Rescue
            </h1>

            <p className="text-sm text-gray-500">
              Rescue surplus food. Reduce waste.
            </p>
          </button>

          <div className="flex items-center gap-3">

            <div className="hidden text-right sm:block">
              <p className="text-xs text-gray-500">
                Logged in as
              </p>

              <p className="max-w-48 truncate text-sm font-medium">
                {userEmail}
              </p>
            </div>

            <button
              onClick={() =>
                setView('post')
              }
              disabled={loggingOut}
              className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              + Post Surplus
            </button>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loggingOut
                ? 'Logging out...'
                : 'Logout'}
            </button>

          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl gap-7 overflow-x-auto px-6">

          <button
            onClick={() =>
              setView('available')
            }
            className={`whitespace-nowrap border-b-2 px-1 py-4 font-medium ${
              view === 'available'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Available
          </button>

          <button
            onClick={() =>
              setView('claimed')
            }
            className={`whitespace-nowrap border-b-2 px-1 py-4 font-medium ${
              view === 'claimed'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Claimed
          </button>

          <button
            onClick={() =>
              setView('picked_up')
            }
            className={`whitespace-nowrap border-b-2 px-1 py-4 font-medium ${
              view === 'picked_up'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Picked Up
          </button>

          <button
            onClick={() =>
              setView('my_listings')
            }
            className={`whitespace-nowrap border-b-2 px-1 py-4 font-medium ${
              view === 'my_listings'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            My Listings
          </button>

        </div>
      </nav>

      {/* Main */}
      <main className="mx-auto max-w-6xl px-6 py-10">

        {/* Realtime connection status */}
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-center gap-2 text-xs text-gray-500"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              realtimeStatus === 'connected'
                ? 'bg-green-500'
                : realtimeStatus === 'reconnecting'
                  ? 'animate-pulse bg-yellow-500'
                  : 'animate-pulse bg-gray-400'
            }`}
          />

          <span>
            {realtimeStatus === 'connected'
              ? 'Live updates connected'
              : realtimeStatus === 'reconnecting'
                ? 'Connection interrupted — reconnecting...'
                : 'Connecting to live updates...'}
          </span>
        </div>

        {/* Realtime notification */}
        {realtimeNotice && (
          <div
            role="status"
            aria-live="polite"
            className="
              mb-6
              rounded-xl
              border
              border-blue-200
              bg-blue-50
              px-4
              py-3
              text-sm
              font-medium
              text-blue-800
              shadow-sm
            "
          >
            <div className="flex items-center justify-between gap-4">

              <p>
                {realtimeNotice}
              </p>

              <button
                type="button"
                onClick={() => {
                  realtimeNoticeRef.current = ''
                  setRealtimeNotice('')
                  if (realtimeNoticeTimer.current) {
                    clearTimeout(realtimeNoticeTimer.current)
                    realtimeNoticeTimer.current = null
                  }
                }}
                className="
                  shrink-0
                  font-bold
                  text-blue-500
                  transition
                  hover:text-blue-800
                "
                aria-label="Dismiss live update"
              >
                ×
              </button>

            </div>
          </div>
        )}

        {/* Global error */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            <div className="flex items-start justify-between gap-4">

              <div>
                <p className="font-semibold">
                  Something went wrong
                </p>

                <p className="mt-1 text-sm">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setError('')
                }
                className="font-bold text-red-500 hover:text-red-700"
                aria-label="Dismiss error"
              >
                ×
              </button>

            </div>
          </div>
        )}

        {view === 'post' ? (
          <PostListingForm
            userId={userId}
            onCreated={
              handleCreated
            }
            onCancel={() =>
              setView('available')
            }
          />
        ) : (
          <>

            <div className="mb-8">
              <h2 className="text-3xl font-bold">

                {view === 'available' &&
                  'Available Food'}

                {view === 'claimed' &&
                  'Claimed Food'}

                {view === 'picked_up' &&
                  'Picked Up'}

                {view === 'my_listings' &&
                  'My Listings'}

              </h2>

              <p className="mt-2 text-gray-600">

                {view === 'available' &&
                  'Find surplus food available near you.'}

                {view === 'claimed' &&
                  'Food that has already been claimed.'}

                {view === 'picked_up' &&
                  'Food that has successfully been rescued.'}

                {view === 'my_listings' &&
                  'Food listings that you have posted.'}

              </p>
            </div>

            {/* Search + Filters */}
            <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-5">

              <div className="grid gap-4 md:grid-cols-4">

                {/* Search */}
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Search food
                  </label>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) =>
                      setSearch(
                        e.target.value
                      )
                    }
                    placeholder="Search food, description, location..."
                    maxLength={100}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 outline-none focus:border-green-600"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Category
                  </label>

                  <select
                    value={categoryFilter}
                    onChange={(e) =>
                      setCategoryFilter(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600"
                  >
                    <option value="all">
                      All Categories
                    </option>

                    <option value="cooked_meals">
                      🍛 Cooked Meals
                    </option>

                    <option value="bakery">
                      🥖 Bakery
                    </option>

                    <option value="groceries">
                      🛒 Groceries
                    </option>

                    <option value="fruits_vegetables">
                      🥦 Fruits & Vegetables
                    </option>

                    <option value="beverages">
                      🥤 Beverages
                    </option>

                    <option value="other">
                      🍱 Other
                    </option>
                  </select>
                </div>

                {/* Sort */}
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Sort by
                  </label>

                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target
                          .value as SortOption
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none focus:border-green-600"
                  >
                    <option value="newest">
                      Newest
                    </option>

                    <option value="pickup_soonest">
                      Pickup ending soonest
                    </option>

                    <option
                      value="nearest"
                      disabled={!userLocation}
                    >
                      Nearest first
                    </option>
                  </select>

                  {!userLocation && (
                    <p className="mt-2 text-xs text-gray-400">
                      Enable location to sort by distance.
                    </p>
                  )}
                </div>

                {/* Distance */}
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Distance
                  </label>

                  <select
                    value={distanceFilter}
                    onChange={(e) =>
                      setDistanceFilter(
                        e.target.value as DistanceFilter
                      )
                    }
                    disabled={!userLocation}
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-green-600 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value="all">
                      Any distance
                    </option>

                    <option value="1">
                      Within 1 km
                    </option>

                    <option value="5">
                      Within 5 km
                    </option>

                    <option value="10">
                      Within 10 km
                    </option>
                  </select>

                  {!userLocation && (
                    <p className="mt-2 text-xs text-gray-400">
                      Enable your location to filter food by distance.
                    </p>
                  )}
                </div>

              </div>

              {/* Clear filters */}
              {(search ||
                categoryFilter !== 'all' ||
                distanceFilter !== 'all' ||
                sortBy !== 'newest') && (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm font-semibold text-gray-500 underline underline-offset-2 transition hover:text-gray-800"
                  >
                    Clear filters
                  </button>
                </div>
              )}

              {/* Location control */}
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
                    onClick={
                      requestUserLocation
                    }
                    disabled={
                      locationLoading
                    }
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
                      <p className="font-semibold">
                        ✓ Location enabled
                      </p>

                      <p className="mt-0.5 text-xs text-green-600">
                        Distances are calculated locally in your browser.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        clearUserLocation
                      }
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

            {/* Listing count / active filters */}
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">

              <div>
                <p className="text-sm font-medium text-gray-700">
                  {finalListings.length}{' '}
                  {finalListings.length === 1
                    ? 'listing'
                    : 'listings'}{' '}
                  found
                </p>

                {userLocation &&
                  distanceFilter !==
                    'all' && (
                    <p className="mt-1 text-xs text-gray-500">
                      Showing food within{' '}
                      {distanceFilter} km of your location.
                    </p>
                  )}

                {userLocation &&
                  sortBy === 'nearest' &&
                  distanceFilter ===
                    'all' && (
                    <p className="mt-1 text-xs text-gray-500">
                      Showing the closest food first.
                    </p>
                  )}
              </div>

              {userLocation &&
                distanceFilter !==
                  'all' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">
                      Distance filter:
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setDistanceFilter(
                          'all'
                        )
                      }
                      className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                    >
                      📍 Within {distanceFilter} km ×
                    </button>
                  </div>
                )}

            </div>

            {/* Listings */}
            <ListingFeed
              listings={
                finalListings
              }
              currentUserId={userId}
              onUpdated={
                handleUpdated
              }
            />

          </>
        )}
      </main>
    </div>
  )
}

export default App
