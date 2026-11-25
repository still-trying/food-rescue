import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Listing, PickupDetails, RealtimeStatus } from '../types/listing'
import {
  mergeListingsSnapshot,
  type RealtimeChange,
} from '../utils/listingsMerge'

const FEED_FETCH_LIMIT = 500
const MAX_REVISION_CACHE_SIZE = 200
const EMPTY_LISTINGS: Listing[] = []
const EMPTY_PICKUP_DETAILS: Record<string, PickupDetailsEntry> = {}

export type PickupDetailsEntry = {
  userId: string
  details: PickupDetails | null
  loading: boolean
  error: string
}

type UseListingsOptions = {
  userId: string | null
  showRealtimeNotice: (message: string) => void
  onError: (message: string) => void
  onClearRealtimeError: () => void
}

const STATUS_RANK: Record<Listing['status'], number> = {
  available: 0,
  claimed: 1,
  picked_up: 2,
}

export function useListings({
  userId,
  showRealtimeNotice,
  onError,
  onClearRealtimeError,
}: UseListingsOptions) {
  const [listings, setListings] = useState<Listing[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeStatus>('connecting')
  const [pickupDetailsById, setPickupDetailsById] = useState<
    Record<string, PickupDetailsEntry>
  >({})

  const listingsRef = useRef<Listing[]>([])
  const currentUserIdRef = useRef<string | null>(userId)
  const realtimeEventVersionRef = useRef(0)
  const realtimeChangesRef = useRef<Map<string, RealtimeChange>>(new Map())
  const listingLoadRequestRef = useRef(0)
  const pickupDetailsInFlightRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    listingsRef.current = listings
    currentUserIdRef.current = userId
  }, [listings, userId])

  const recordRealtimeChange = useCallback(
    (id: string, change: Omit<RealtimeChange, 'version'>) => {
      const version = ++realtimeEventVersionRef.current
      realtimeChangesRef.current.set(id, { ...change, version })

      // Cap map size in long-lived sessions without reconnects.
      if (realtimeChangesRef.current.size > MAX_REVISION_CACHE_SIZE) {
        const oldestKey = realtimeChangesRef.current.keys().next().value
        if (oldestKey) {
          realtimeChangesRef.current.delete(oldestKey)
        }
      }
    },
    []
  )

  const loadListings = useCallback(
    async (options: { clearError?: boolean } = {}) => {
      if (!currentUserIdRef.current) {
        return
      }

      if (options.clearError !== false) {
        onClearRealtimeError()
      }

      const requestId = ++listingLoadRequestRef.current
      const eventVersionAtStart = realtimeEventVersionRef.current
      setRefreshing(true)

      try {
        // Prefer server-side filtered feed RPC when migrated; fall back cleanly.
        let rows: Listing[] | null = null
        let listingsError: { message: string } | null = null

        const rpcRes = await supabase.rpc('get_listings_feed', {
          p_limit: 200,
          p_offset: 0,
        })

        if (!rpcRes.error && Array.isArray(rpcRes.data)) {
          rows = rpcRes.data
        } else {
          const tableRes = await supabase
            .from('listings')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(FEED_FETCH_LIMIT)
          rows = tableRes.data
          listingsError = tableRes.error
        }

        if (requestId !== listingLoadRequestRef.current) {
          return
        }

        if (listingsError) {
          if (import.meta.env.DEV) {
            console.error('Listings loading error:', listingsError)
          }
          onError('Unable to load food listings. Please try again.')
          return
        }

        const refreshedListings = mergeListingsSnapshot(
          rows ?? [],
          realtimeChangesRef.current,
          eventVersionAtStart
        )

        listingsRef.current = refreshedListings
        setListings(refreshedListings)
      } catch (err) {
        if (requestId !== listingLoadRequestRef.current) {
          return
        }
        if (import.meta.env.DEV) {
          console.error('Unexpected listings loading error:', err)
        }
        onError('Something went wrong while loading listings.')
      } finally {
        if (requestId === listingLoadRequestRef.current) {
          setRefreshing(false)
        }
      }
    },
    [onClearRealtimeError, onError]
  )

  const fetchPickupDetailsBatch = useCallback(
    async (listingIds: string[], requestUserId: string) => {
      if (listingIds.length === 0) {
        return
      }

      for (const id of listingIds) {
        pickupDetailsInFlightRef.current.add(`${requestUserId}:${id}`)
      }

      setPickupDetailsById((prev) => {
        const next = { ...prev }
        for (const id of listingIds) {
          next[id] = {
            userId: requestUserId,
            details: prev[id]?.userId === requestUserId ? prev[id].details : null,
            loading: true,
            error: '',
          }
        }
        return next
      })

      try {
        const { data, error: detailsError } = await supabase
          .from('listing_pickup_details')
          .select('listing_id, pickup_address, pickup_instructions, contact_phone')
          .in('listing_id', listingIds)

        if (currentUserIdRef.current !== requestUserId) {
          return
        }

        if (detailsError) {
          if (import.meta.env.DEV) {
            console.error('Private pickup details error:', detailsError)
          }
          setPickupDetailsById((prev) => {
            const next = { ...prev }
            for (const id of listingIds) {
              next[id] = {
                userId: requestUserId,
                details: null,
                loading: false,
                error:
                  'Private pickup details could not be loaded. Please retry.',
              }
            }
            return next
          })
          return
        }

        const byListingId = new Map<string, PickupDetails>()
        for (const row of data ?? []) {
          byListingId.set(row.listing_id, {
            listing_id: row.listing_id,
            pickup_address: row.pickup_address,
            pickup_instructions: row.pickup_instructions,
            contact_phone: row.contact_phone,
          })
        }

        setPickupDetailsById((prev) => {
          const next = { ...prev }
          for (const id of listingIds) {
            next[id] = {
              userId: requestUserId,
              details: byListingId.get(id) ?? null,
              loading: false,
              error: '',
            }
          }
          return next
        })
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Unexpected pickup details error:', err)
        }
        if (currentUserIdRef.current !== requestUserId) {
          return
        }
        setPickupDetailsById((prev) => {
          const next = { ...prev }
          for (const id of listingIds) {
            next[id] = {
              userId: requestUserId,
              details: null,
              loading: false,
              error: 'Private pickup details could not be loaded. Please retry.',
            }
          }
          return next
        })
      } finally {
        for (const id of listingIds) {
          pickupDetailsInFlightRef.current.delete(`${requestUserId}:${id}`)
        }
      }
    },
    []
  )

  // Batch-load private pickup details for all listings where the signed-in user
  // is either the donor or the claimant, avoiding per-card N+1 queries.
  useEffect(() => {
    if (!userId) {
      pickupDetailsInFlightRef.current.clear()
      return
    }

    const authorizedIds = listings
      .filter(
        (listing) =>
          listing.posted_by === userId ||
          (listing.claimed_by === userId &&
            (listing.status === 'claimed' || listing.status === 'picked_up'))
      )
      .map((listing) => listing.id)

    const missingIds = authorizedIds.filter((id) => {
      if (pickupDetailsInFlightRef.current.has(`${userId}:${id}`)) {
        return false
      }
      const existing = pickupDetailsById[id]
      if (!existing || existing.userId !== userId) {
        return true
      }
      return false
    })

    if (missingIds.length > 0) {
      void fetchPickupDetailsBatch(missingIds, userId)
    }
  }, [listings, userId, pickupDetailsById, fetchPickupDetailsBatch])

  const retryPickupDetails = useCallback(
    (listingId: string) => {
      if (!userId) {
        return
      }
      void fetchPickupDetailsBatch([listingId], userId)
    },
    [userId, fetchPickupDetailsBatch]
  )

  // Gate Supabase Realtime subscription on an authenticated user.
  useEffect(() => {
    if (!userId) {
      realtimeChangesRef.current.clear()
      return
    }

    let mounted = true
    let listingsChannel: ReturnType<typeof supabase.channel> | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let retryAttempt = 0
    let hasConnectedOnce = false

    const connectRealtime = () => {
      if (!mounted || listingsChannel) {
        return
      }

      const nextStatus: RealtimeStatus = hasConnectedOnce
        ? 'reconnecting'
        : 'connecting'
      queueMicrotask(() => {
        if (mounted) {
          setRealtimeStatus(nextStatus)
        }
      })

      const channel = supabase
        .channel(`listings-realtime:${userId}`)
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

            if (import.meta.env.DEV) {
              console.log('Realtime listing change:', payload.eventType)
            }

            if (payload.eventType === 'INSERT') {
              const newListing = payload.new as Listing
              const alreadyKnown = listingsRef.current.some(
                (listing) => listing.id === newListing.id
              )

              recordRealtimeChange(newListing.id, {
                deleted: false,
                listing: newListing,
              })

              setListings((current) => {
                if (current.some((listing) => listing.id === newListing.id)) {
                  return current
                }
                const updated = [newListing, ...current]
                listingsRef.current = updated
                return updated
              })

              if (
                !alreadyKnown &&
                newListing.posted_by !== currentUserIdRef.current
              ) {
                showRealtimeNotice('🟢 New surplus food has been posted.')
              }

              return
            }

            if (payload.eventType === 'UPDATE') {
              const oldListing = payload.old as Partial<Listing>
              const updatedListing = payload.new as Listing

              const previousLocalListing = listingsRef.current.find(
                (listing) => listing.id === updatedListing.id
              )
              const previousRealtimeChange = realtimeChangesRef.current.get(
                updatedListing.id
              )
              const previousRealtimeListing =
                previousRealtimeChange && !previousRealtimeChange.deleted
                  ? previousRealtimeChange.listing
                  : undefined

              const candidateStatuses = [
                previousLocalListing?.status,
                previousRealtimeListing?.status,
                oldListing.status,
              ].filter(
                (status): status is Listing['status'] => status !== undefined
              )

              const previousStatus = candidateStatuses.reduce(
                (latest, candidate) =>
                  STATUS_RANK[candidate] > STATUS_RANK[latest]
                    ? candidate
                    : latest,
                candidateStatuses[0] ?? updatedListing.status
              )

              const currentUser = currentUserIdRef.current

              if (
                previousStatus === 'available' &&
                updatedListing.status === 'claimed' &&
                updatedListing.claimed_by !== currentUser
              ) {
                showRealtimeNotice('🟡 A food listing was just claimed.')
              } else if (
                previousStatus === 'claimed' &&
                updatedListing.status === 'picked_up' &&
                updatedListing.claimed_by !== currentUser
              ) {
                showRealtimeNotice(
                  '🔵 A food listing was marked as picked up.'
                )
              }

              recordRealtimeChange(updatedListing.id, {
                deleted: false,
                listing: updatedListing,
              })

              setListings((current) => {
                const alreadyExists = current.some(
                  (listing) => listing.id === updatedListing.id
                )
                const updated = alreadyExists
                  ? current.map((listing) =>
                      listing.id === updatedListing.id
                        ? updatedListing
                        : listing
                    )
                  : [updatedListing, ...current]
                listingsRef.current = updated
                return updated
              })

              return
            }

            if (payload.eventType === 'DELETE') {
              const deletedListing = payload.old as Partial<Listing>
              const deletedId = deletedListing.id

              if (!deletedId) {
                return
              }

              const knownListing =
                listingsRef.current.find(
                  (listing) => listing.id === deletedId
                ) ?? realtimeChangesRef.current.get(deletedId)?.listing

              recordRealtimeChange(deletedId, { deleted: true })

              setListings((current) => {
                const updated = current.filter(
                  (listing) => listing.id !== deletedId
                )
                listingsRef.current = updated
                return updated
              })

              const ownerId =
                knownListing?.posted_by ?? deletedListing.posted_by

              if (knownListing && ownerId !== currentUserIdRef.current) {
                showRealtimeNotice('⚪ A food listing was removed.')
              }
            }
          }
        )

      listingsChannel = channel

      channel.subscribe((status) => {
        if (!mounted || listingsChannel !== channel) {
          return
        }

        if (import.meta.env.DEV) {
          console.log('Listings realtime status:', status)
        }

        if (status === 'SUBSCRIBED') {
          const isReconnection = hasConnectedOnce
          hasConnectedOnce = true
          retryAttempt = 0
          setRealtimeStatus('connected')
          onClearRealtimeError()

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
          onError(
            'Live updates were interrupted. Reconnecting automatically...'
          )

          listingsChannel = null
          void supabase.removeChannel(channel)

          if (reconnectTimer === null && mounted) {
            const retryDelay = Math.min(1000 * 2 ** retryAttempt, 30000)
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

      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      if (listingsChannel !== null) {
        const channelToRemove = listingsChannel
        listingsChannel = null
        void supabase.removeChannel(channelToRemove)
      }
    }
  }, [
    userId,
    loadListings,
    onClearRealtimeError,
    onError,
    recordRealtimeChange,
    showRealtimeNotice,
  ])

  const handleListingUpdated = useCallback(
    (updatedListing: Listing) => {
      recordRealtimeChange(updatedListing.id, {
        deleted: false,
        listing: updatedListing,
      })

      setListings((current) => {
        const next = current.map((listing) =>
          listing.id === updatedListing.id ? updatedListing : listing
        )
        listingsRef.current = next
        return next
      })
    },
    [recordRealtimeChange]
  )

  const handleListingCreated = useCallback(
    (newListing: Listing) => {
      recordRealtimeChange(newListing.id, {
        deleted: false,
        listing: newListing,
      })

      setListings((current) => {
        if (current.some((listing) => listing.id === newListing.id)) {
          return current
        }
        const next = [newListing, ...current]
        listingsRef.current = next
        return next
      })
    },
    [recordRealtimeChange]
  )

  const handleListingDeleted = useCallback(
    (deletedId: string) => {
      recordRealtimeChange(deletedId, { deleted: true })

      setListings((current) => {
        const next = current.filter((listing) => listing.id !== deletedId)
        listingsRef.current = next
        return next
      })
    },
    [recordRealtimeChange]
  )

  const resetListingsState = useCallback(() => {
    listingsRef.current = []
    setListings([])
    setPickupDetailsById({})
    realtimeChangesRef.current.clear()
    pickupDetailsInFlightRef.current.clear()
  }, [])

  return {
    listings: userId ? listings : EMPTY_LISTINGS,
    refreshing,
    realtimeStatus: userId ? realtimeStatus : 'connecting',
    pickupDetailsById: userId ? pickupDetailsById : EMPTY_PICKUP_DETAILS,
    loadListings,
    retryPickupDetails,
    handleListingUpdated,
    handleListingCreated,
    handleListingDeleted,
    resetListingsState,
  }
}
