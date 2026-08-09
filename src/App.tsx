import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import Auth from './components/Auth'
import ListingFeed from './components/ListingFeed'
import PostListingForm from './components/PostListingForm'
import type { Listing } from './components/ListingCard'

type View = 'available' | 'claimed' | 'picked_up' | 'post'

function App() {
  const [view, setView] = useState<View>('available')
  const [listings, setListings] = useState<Listing[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    checkUser()

    const {
      data: { subscription },
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

    return () => {
      subscription.unsubscribe()
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
        listing.id === updatedListing.id ? updatedListing : listing
      )
    )
  }

  const handleCreated = (newListing: Listing) => {
    setListings((current) => [newListing, ...current])
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

const filteredListings = listings.filter((listing) => {
  // Available listings disappear after their pickup window ends
  if (
    listing.status === 'available' &&
    new Date(listing.pickup_window_end) <= now
  ) {
    return false
  }

  return listing.status === view
})

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading Food Rescue...</p>
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
          <button onClick={() => setView('available')} className="text-left">
            <h1 className="text-2xl font-bold">Food Rescue</h1>
            <p className="text-sm text-gray-500">
              Rescue surplus food. Reduce waste.
            </p>
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs text-gray-500">Logged in as</p>
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
              </h2>

              <p className="mt-2 text-gray-600">
                {view === 'available' &&
                  'Find surplus food available near you.'}

                {view === 'claimed' &&
                  'Food that has already been claimed.'}

                {view === 'picked_up' &&
                  'Food that has successfully been rescued.'}
              </p>
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