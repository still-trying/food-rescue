import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import Auth from './components/Auth'
import FilterBar from './components/FilterBar'
import Header from './components/Header'
import ListingFeed from './components/ListingFeed'
import NavTabs from './components/NavTabs'
import ProfileModal from './components/ProfileModal'
import RealtimeBanner from './components/RealtimeBanner'
import ResetPasswordModal from './components/ResetPasswordModal'
import { useAuth } from './hooks/useAuth'
import { useBrowserNotifications } from './hooks/useBrowserNotifications'
import { useListings } from './hooks/useListings'
import { useNowTick } from './hooks/useNowTick'
import { useRealtimeNotice } from './hooks/useRealtimeNotice'
import { useUserLocation } from './hooks/useUserLocation'
import type {
  DistanceFilter,
  Listing,
  SortOption,
  View,
} from './types/listing'
import { filterAndSortListings } from './utils/listingFilters'

const PostListingForm = lazy(() => import('./components/PostListingForm'))
const ListingsMap = lazy(() => import('./components/ListingsMap'))
const ImpactDashboard = lazy(() => import('./components/ImpactDashboard'))

const VIEW_METADATA: Record<
  Exclude<View, 'post'>,
  { title: string; subtitle: string }
> = {
  available: {
    title: 'Available Food',
    subtitle: 'Find surplus food available near you.',
  },
  my_claims: {
    title: 'My Claims',
    subtitle: 'Food listings you have claimed or picked up.',
  },
  claimed: {
    title: 'All Claimed Food',
    subtitle: 'Food that has already been claimed.',
  },
  picked_up: {
    title: 'Picked Up',
    subtitle: 'Food that has successfully been rescued.',
  },
  my_listings: {
    title: 'My Listings',
    subtitle: 'Food listings that you have posted.',
  },
  impact: {
    title: 'Rescue Impact',
    subtitle: 'Community and personal food-waste reduction metrics.',
  },
}

function App() {
  const [view, setView] = useState<View>('available')
  const [repostDraft, setRepostDraft] = useState<Partial<Listing> | null>(null)
  const [displayMode, setDisplayMode] = useState<'grid' | 'map'>('grid')
  const [highlightedListingId, setHighlightedListingId] = useState<
    string | null
  >(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortOption>('recommended')
  const [distanceFilter, setDistanceFilter] = useState<DistanceFilter>('all')
  const [profileOpen, setProfileOpen] = useState(false)
  const [error, setError] = useState('')

  const nowMs = useNowTick()
  const { realtimeNotice, showRealtimeNotice, clearRealtimeNotice } =
    useRealtimeNotice()
  const {
    permission: notificationPermission,
    notificationsEnabled,
    toggleNotifications,
    notifyIfEnabled,
  } = useBrowserNotifications()

  const handleRealtimeNotice = useCallback(
    (message: string) => {
      showRealtimeNotice(message)
      if (message.includes('New surplus food')) {
        notifyIfEnabled('Food Rescue — Surplus Food Nearby', message)
      }
    },
    [notifyIfEnabled, showRealtimeNotice]
  )

  const handleLocationEnabled = useCallback(() => {
    setSortBy((current) => (current === 'newest' ? 'nearest' : current))
  }, [])

  const {
    userLocation,
    locationLoading,
    locationError,
    requestUserLocation,
    clearUserLocation: clearStoredLocation,
  } = useUserLocation(handleLocationEnabled)

  const resetUiFilters = useCallback(() => {
    setView('available')
    setDisplayMode('grid')
    setHighlightedListingId(null)
    setSearch('')
    setCategoryFilter('all')
    setSortBy('recommended')
    setDistanceFilter('all')
  }, [])

  const handleSignedOutCleanup = useCallback(() => {
    setProfileOpen(false)
    resetUiFilters()
    clearStoredLocation()
    clearRealtimeNotice()
  }, [clearRealtimeNotice, clearStoredLocation, resetUiFilters])

  const {
    userId,
    userEmail,
    loading,
    loggingOut,
    passwordRecoveryOpen,
    dismissPasswordRecovery,
    handleLogout,
    handleAuthenticated,
  } = useAuth({
    onSignedOut: handleSignedOutCleanup,
    onError: setError,
  })

  const clearRealtimeError = useCallback(() => {
    setError((current) => (current.includes('Live updates') ? '' : current))
  }, [])

  const {
    listings,
    refreshing,
    realtimeStatus,
    pickupDetailsById,
    loadListings,
    retryPickupDetails,
    handleListingUpdated,
    handleListingCreated,
    handleListingDeleted,
  } = useListings({
    userId,
    showRealtimeNotice: handleRealtimeNotice,
    onError: setError,
    onClearRealtimeError: clearRealtimeError,
  })

  useEffect(() => {
    if (userId) {
      void loadListings()
    }
  }, [userId, loadListings])

  const clearUserLocation = useCallback(() => {
    clearStoredLocation()
    setDistanceFilter('all')
    setSortBy((current) => (current === 'nearest' ? 'recommended' : current))
  }, [clearStoredLocation])

  const clearFilters = useCallback(() => {
    setSearch('')
    setCategoryFilter('all')
    setDistanceFilter('all')
    setSortBy('recommended')
  }, [])

  const handleCreated = useCallback(
    (newListing: Listing) => {
      handleListingCreated(newListing)
      setRepostDraft(null)
      setView('available')
      setDisplayMode('grid')
    },
    [handleListingCreated]
  )

  const handleRepost = useCallback((expiredListing: Listing) => {
    setRepostDraft({
      title: expiredListing.title,
      description: expiredListing.description,
      category: expiredListing.category,
      quantity: expiredListing.quantity,
      location_text: expiredListing.location_text,
      dietary_type: expiredListing.dietary_type ?? null,
      storage_type: expiredListing.storage_type ?? null,
      allergens: expiredListing.allergens ?? null,
    })
    setView('post')
  }, [])

  const handleSelectListingFromMap = useCallback((listingId: string) => {
    setHighlightedListingId(listingId)
    setDisplayMode('grid')
    requestAnimationFrame(() => {
      document
        .getElementById(`listing-${listingId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }, [])

  const finalListings = useMemo(() => {
    if (view === 'post' || view === 'impact') {
      return []
    }
    return filterAndSortListings({
      listings,
      view,
      userId,
      search,
      categoryFilter,
      distanceFilter,
      sortBy,
      userLocation,
      nowMs,
    })
  }, [
    listings,
    view,
    userId,
    search,
    categoryFilter,
    distanceFilter,
    sortBy,
    userLocation,
    nowMs,
  ])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-600" />
          <p className="font-medium text-gray-700">Loading Food Rescue...</p>
          <p className="mt-1 text-sm text-gray-500">
            Connecting to the food rescue board
          </p>
        </div>
      </div>
    )
  }

  if (!userId) {
    return <Auth onAuthenticated={handleAuthenticated} />
  }

  const activeMeta = view === 'post' ? null : VIEW_METADATA[view]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {passwordRecoveryOpen && (
        <ResetPasswordModal onClose={dismissPasswordRecovery} />
      )}

      {profileOpen && (
        <ProfileModal
          userId={userId}
          userEmail={userEmail}
          onClose={() => setProfileOpen(false)}
        />
      )}

      <Header
        userEmail={userEmail}
        loggingOut={loggingOut}
        onNavigateHome={() => {
          setRepostDraft(null)
          setView('available')
        }}
        onOpenPost={() => {
          setRepostDraft(null)
          setView('post')
        }}
        onOpenProfile={() => setProfileOpen(true)}
        onLogout={() => void handleLogout()}
      />

      <NavTabs
        activeView={view}
        onSelectView={(nextView) => {
          setHighlightedListingId(null)
          setRepostDraft(null)
          setView(nextView)
        }}
      />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <RealtimeBanner
          realtimeStatus={realtimeStatus}
          realtimeNotice={realtimeNotice}
          onDismissNotice={clearRealtimeNotice}
          onRefresh={() => void loadListings()}
          refreshing={refreshing}
          notificationPermission={notificationPermission}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={() => void toggleNotifications()}
        />

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">Something went wrong</p>
                <p className="mt-1 text-sm">{error}</p>
              </div>

              <button
                type="button"
                onClick={() => setError('')}
                className="font-bold text-red-500 hover:text-red-700"
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {view === 'post' ? (
          <Suspense
            fallback={
              <div className="py-12 text-center text-sm text-gray-500">
                Loading listing form...
              </div>
            }
          >
            <PostListingForm
              key={repostDraft ? `repost-${repostDraft.title ?? 'draft'}` : 'new'}
              userId={userId}
              initialDraft={repostDraft}
              onCreated={handleCreated}
              onCancel={() => {
                setRepostDraft(null)
                setView('available')
              }}
            />
          </Suspense>
        ) : view === 'impact' ? (
          <>
            {activeMeta && (
              <div className="mb-8">
                <h2 className="text-3xl font-bold">{activeMeta.title}</h2>
                <p className="mt-2 text-gray-600">{activeMeta.subtitle}</p>
              </div>
            )}
            <Suspense
              fallback={
                <div className="py-12 text-center text-sm text-gray-500">
                  Loading impact dashboard...
                </div>
              }
            >
              <ImpactDashboard
                listings={listings}
                currentUserId={userId}
                nowMs={nowMs}
              />
            </Suspense>
          </>
        ) : (
          <>
            {activeMeta && (
              <div className="mb-8">
                <h2 className="text-3xl font-bold">{activeMeta.title}</h2>
                <p className="mt-2 text-gray-600">{activeMeta.subtitle}</p>
              </div>
            )}

            <FilterBar
              search={search}
              onSearchChange={setSearch}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              distanceFilter={distanceFilter}
              onDistanceFilterChange={setDistanceFilter}
              onClearFilters={clearFilters}
              userLocation={userLocation}
              locationLoading={locationLoading}
              locationError={locationError}
              onRequestLocation={requestUserLocation}
              onClearLocation={clearUserLocation}
            />

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {finalListings.length}{' '}
                  {finalListings.length === 1 ? 'listing' : 'listings'} found
                </p>

                {userLocation && distanceFilter !== 'all' && (
                  <p className="mt-1 text-xs text-gray-500">
                    Showing food within {distanceFilter} km of your location.
                  </p>
                )}

                {userLocation &&
                  sortBy === 'nearest' &&
                  distanceFilter === 'all' && (
                    <p className="mt-1 text-xs text-gray-500">
                      Showing the closest food first.
                    </p>
                  )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {userLocation && distanceFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setDistanceFilter('all')}
                    className="rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100"
                  >
                    📍 Within {distanceFilter} km ×
                  </button>
                )}

                <div
                  className="inline-flex rounded-xl border border-gray-200 bg-white p-1"
                  role="group"
                  aria-label="Feed display mode"
                >
                  <button
                    type="button"
                    onClick={() => setDisplayMode('grid')}
                    aria-pressed={displayMode === 'grid'}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      displayMode === 'grid'
                        ? 'bg-green-600 text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setDisplayMode('map')}
                    aria-pressed={displayMode === 'map'}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      displayMode === 'map'
                        ? 'bg-green-600 text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🗺️ Map
                  </button>
                </div>
              </div>
            </div>

            {displayMode === 'map' ? (
              <Suspense
                fallback={
                  <div className="py-12 text-center text-sm text-gray-500">
                    Loading interactive map...
                  </div>
                }
              >
                <ListingsMap
                  listings={finalListings}
                  userLocation={userLocation}
                  distanceFilter={distanceFilter}
                  currentUserId={userId}
                  onSelectListing={handleSelectListingFromMap}
                />
              </Suspense>
            ) : (
              <ListingFeed
                listings={finalListings}
                currentUserId={userId}
                nowMs={nowMs}
                pickupDetailsById={pickupDetailsById}
                highlightedListingId={highlightedListingId}
                onRetryPickupDetails={retryPickupDetails}
                onUpdated={handleListingUpdated}
                onDeleted={handleListingDeleted}
                onRepost={handleRepost}
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
