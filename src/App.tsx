import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import ListingFeed from './components/ListingFeed'
import PostListingForm from './components/PostListingForm'
import type { Listing } from './components/ListingCard'

type View =
  | 'available'
  | 'claimed'
  | 'picked_up'
  | 'my_listings'
  | 'post'

function App() {
  const [view, setView] = useState<View>('available')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [sortBy, setSortBy] = useState<'newest' | 'pickup_soonest'>('newest')
  const [listings, setListings] = useState<Listing[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkUser()

    // Listen for authentication changes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null)
      setUserEmail(session?.user?.email ?? null)

      if (session?.user) {
        loadListings()
      } else {
        setListings([])
      }

      setLoading(false)
    })

    // Real-time listing updates
    const listingsChannel = supabase
      .channel('listings-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listings',
        },
        (payload) => {
          console.log('Realtime listing change:', payload)

          // New listing created
          if (payload.eventType === 'INSERT') {
            const newListing = payload.new as Listing

            setListings((current) => {
              // Prevent duplicate listing
              if (
                current.some(
                  (listing) => listing.id === newListing.id
                )
              ) {
                return current
              }

              return [newListing, ...current]
            })
          }

          // Existing listing updated
          if (payload.eventType === 'UPDATE') {
            const updatedListing = payload.new as Listing

            setListings((current) =>
              current.map((listing) =>
                listing.id === updatedListing.id
                  ? updatedListing
                  : listing
              )
            )
          }

          // Listing deleted
          if (payload.eventType === 'DELETE') {
            const deletedListing = payload.old as Listing

            setListings((current) =>
              current.filter(
                (listing) => listing.id !== deletedListing.id
              )
            )
          }
        }
      )
      .subscribe((status) => {
        console.log('Listings realtime status:', status)
      })

    // Cleanup subscriptions when component unmounts
    return () => {
      authSubscription.unsubscribe()
      supabase.removeChannel(listingsChannel)
    }
  }, [])

  const checkUser = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      setUserId(session.user.id)
      setUserEmail(session.user.email ?? null)

      await loadListings()
    }

    setLoading(false)
  }

  const loadListings = async () => {
    setError('')

    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      return
    }

    setListings((data ?? []) as Listing[])
  }

  const handleUpdated = (updatedListing: Listing) => {
    setListings((current) =>
      current.map((listing) =>
        listing.id === updatedListing.id
          ? updatedListing
          : listing
      )
    )
  }

  const handleCreated = (newListing: Listing) => {
    setListings((current) => {
      // Prevent duplicate because Realtime may also receive INSERT
      if (
        current.some(
          (listing) => listing.id === newListing.id
        )
      ) {
        return current
      }

      return [newListing, ...current]
    })

    setView('available')
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()

    setUserId(null)
    setUserEmail(null)
    setListings([])
    setView('available')
  }

  const handleAuthenticated = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      setUserId(user.id)
      setUserEmail(user.email ?? null)

      await loadListings()
    }
  }

  const now = new Date()

  const filteredListings = listings
    .filter((listing) => {
      // --------------------------------------------------
      // 1. Hide expired available listings
      // --------------------------------------------------
      if (
        listing.status === 'available' &&
        new Date(listing.pickup_window_end) <= now
      ) {
        return false
      }

      // --------------------------------------------------
      // 2. My Listings
      // --------------------------------------------------
      if (view === 'my_listings') {
        if (listing.posted_by !== userId) {
          return false
        }
      } else {
        // ------------------------------------------------
        // 3. Normal status filters
        // ------------------------------------------------
        if (listing.status !== view) {
          return false
        }
      }

      // --------------------------------------------------
      // 4. Search filter
      // --------------------------------------------------
      const searchText = search.trim().toLowerCase()

      if (searchText) {
        const matchesSearch =
          listing.title.toLowerCase().includes(searchText) ||
          listing.description?.toLowerCase().includes(searchText) ||
          listing.location_text.toLowerCase().includes(searchText)

        if (!matchesSearch) {
          return false
        }
      }

      // --------------------------------------------------
      // 5. Category filter
      // --------------------------------------------------
      if (
        categoryFilter !== 'all' &&
        listing.category !== categoryFilter
      ) {
        return false
      }

      // Listing passed all filters
      return true
    })

    // ----------------------------------------------------
    // 6. Sorting
    // ----------------------------------------------------
    .sort((a, b) => {
      // Pickup ending soonest
      if (sortBy === 'pickup_soonest') {
        return (
          new Date(a.pickup_window_end).getTime() -
          new Date(b.pickup_window_end).getTime()
        )
      }

      // Default: newest first
      return (
        new Date(b.created_at).getTime() -
        new Date(a.created_at).getTime()
      )
    })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">
          Loading Food Rescue...
        </p>
      </div>
    )
  }

  // User is NOT logged in
  if (!userId) {
    return <Auth onAuthenticated={handleAuthenticated} />
  }

  // User IS logged in
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">

      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">

          <button
            onClick={() => setView('available')}
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
              onClick={() => setView('post')}
              className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700"
            >
              + Post Surplus
            </button>

            <button
              onClick={handleLogout}
              className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Logout
            </button>

          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl gap-7 px-6">

          <button
            onClick={() => setView('available')}
            className={`border-b-2 px-1 py-4 font-medium ${
              view === 'available'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Available
          </button>

          <button
            onClick={() => setView('claimed')}
            className={`border-b-2 px-1 py-4 font-medium ${
              view === 'claimed'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Claimed
          </button>

          <button
            onClick={() => setView('picked_up')}
            className={`border-b-2 px-1 py-4 font-medium ${
              view === 'picked_up'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            Picked Up
          </button>

          <button
            onClick={() => setView('my_listings')}
            className={`border-b-2 px-1 py-4 font-medium ${
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

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {view === 'post' ? (
          <PostListingForm
            userId={userId}
            onCreated={handleCreated}
            onCancel={() => setView('available')}
          />
        ) : (
          <>
            <div className="mb-8">

              <h2 className="text-3xl font-bold">
                {view === 'available' && 'Available Food'}
                {view === 'claimed' && 'Claimed Food'}
                {view === 'picked_up' && 'Picked Up'}
                {view === 'my_listings' && 'My Listings'}
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
              <div className="grid gap-4 md:grid-cols-3">

                {/* Search */}
                <div className="md:col-span-1">
                  <label className="mb-2 block text-sm font-semibold">
                    Search food
                  </label>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search food, description, location..."
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
                    onChange={(e) => setCategoryFilter(e.target.value)}
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
                        e.target.value as
                          | 'newest'
                          | 'pickup_soonest'
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
                  </select>
                </div>

              </div>
            </div>

            <ListingFeed
              listings={filteredListings}
              currentUserId={userId}
              onUpdated={handleUpdated}
            />
          </>
        )}

      </main>
    </div>
  )
}

export default App