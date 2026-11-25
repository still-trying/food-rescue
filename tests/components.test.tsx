import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import Auth from '../src/components/Auth'
import FilterBar from '../src/components/FilterBar'
import Header from '../src/components/Header'
import ImpactDashboard from '../src/components/ImpactDashboard'
import ListingFeed from '../src/components/ListingFeed'
import ListingsMap from '../src/components/ListingsMap'
import ListingStatusBadge from '../src/components/ListingStatusBadge'
import NavTabs from '../src/components/NavTabs'
import {
  PrivateContactBox,
  PrivateDestinationBox,
} from '../src/components/PickupDetailsPanel'
import RealtimeBanner from '../src/components/RealtimeBanner'
import type { Listing } from '../src/types/listing'

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    title: 'Paneer Biryani',
    description: 'Freshly packed boxes',
    quantity: 'Serves 6',
    category: 'cooked_meals',
    photo_url: null,
    location_text: 'Gomti Nagar, Lucknow',
    approx_latitude: 26.85,
    approx_longitude: 80.95,
    pickup_window_start: '2026-11-25T10:00:00.000Z',
    pickup_window_end: '2026-11-25T16:00:00.000Z',
    status: 'available',
    posted_by: 'donor-1',
    claimed_by: null,
    created_at: '2026-11-25T09:00:00.000Z',
    ...overrides,
  }
}

describe('React component rendering', () => {
  it('renders Header, NavTabs, RealtimeBanner, and FilterBar with accessibility attributes', () => {
    const headerHtml = renderToStaticMarkup(
      <Header
        userEmail="donor@example.com"
        loggingOut={false}
        onNavigateHome={() => {}}
        onOpenPost={() => {}}
        onOpenProfile={() => {}}
        onLogout={() => {}}
      />
    )
    assert.ok(headerHtml.includes('Food Rescue'))
    assert.ok(headerHtml.includes('donor@example.com'))
    assert.ok(headerHtml.includes('Profile'))

    const navHtml = renderToStaticMarkup(
      <NavTabs activeView="my_claims" onSelectView={() => {}} />
    )
    assert.ok(navHtml.includes('role="tablist"'))
    assert.ok(navHtml.includes('My Claims'))
    assert.ok(navHtml.includes('Impact'))

    const bannerHtml = renderToStaticMarkup(
      <RealtimeBanner
        realtimeStatus="connected"
        realtimeNotice="🟢 New surplus food has been posted."
        onDismissNotice={() => {}}
        onRefresh={() => {}}
        notificationPermission="default"
        notificationsEnabled={false}
        onToggleNotifications={() => {}}
      />
    )
    assert.ok(bannerHtml.includes('Live updates connected'))
    assert.ok(bannerHtml.includes('Enable Alerts'))
    assert.ok(bannerHtml.includes('Refresh'))

    const filterHtml = renderToStaticMarkup(
      <FilterBar
        search=""
        onSearchChange={() => {}}
        categoryFilter="all"
        onCategoryFilterChange={() => {}}
        sortBy="recommended"
        onSortByChange={() => {}}
        distanceFilter="all"
        onDistanceFilterChange={() => {}}
        onClearFilters={() => {}}
        userLocation={null}
        locationLoading={false}
        locationError=""
        onRequestLocation={() => {}}
        onClearLocation={() => {}}
      />
    )
    assert.ok(filterHtml.includes('for="filter-search"'))
    assert.ok(filterHtml.includes('Recommended'))
  })

  it('renders Auth screen with login/signup tabs and forgot password trigger', () => {
    const html = renderToStaticMarkup(<Auth onAuthenticated={() => {}} />)
    assert.ok(html.includes('Food Rescue'))
    assert.ok(html.includes('Forgot password?'))
    assert.ok(html.includes('Sign Up'))
  })

  it('renders ListingStatusBadge states and PrivateContactBox tel sanitization', () => {
    const endingSoon = renderToStaticMarkup(
      <ListingStatusBadge status="available" isExpired={false} isEndingSoon />
    )
    assert.ok(endingSoon.includes('Ending Soon'))

    const safeContactHtml = renderToStaticMarkup(
      <PrivateContactBox
        isClaimant
        pickupDetails={{
          pickup_address: '12 Main Rd',
          pickup_instructions: null,
          contact_phone: '+91 98765 43210',
        }}
        loading={false}
        error=""
      />
    )
    assert.ok(safeContactHtml.includes('href="tel:+919876543210"'))

    const unsafeContactHtml = renderToStaticMarkup(
      <PrivateContactBox
        isClaimant
        pickupDetails={{
          pickup_address: '12 Main Rd',
          pickup_instructions: null,
          contact_phone: 'javascript:alert(1)',
        }}
        loading={false}
        error=""
      />
    )
    assert.ok(!unsafeContactHtml.includes('href="tel:'))

    const destErrorHtml = renderToStaticMarkup(
      <PrivateDestinationBox
        listingId="l1"
        pickupDetails={null}
        loading={false}
        error="Failed to load"
        onRetry={() => {}}
      />
    )
    assert.ok(destErrorHtml.includes('Retry loading details'))
  })

  it('renders ListingFeed empty state and populated feed with dietary badges & privacy isolation', () => {
    const nowMs = new Date('2026-11-25T12:00:00.000Z').getTime()

    const emptyHtml = renderToStaticMarkup(
      <ListingFeed
        listings={[]}
        currentUserId="user-2"
        nowMs={nowMs}
        pickupDetailsById={{}}
        onRetryPickupDetails={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onRepost={() => {}}
      />
    )
    assert.ok(emptyHtml.includes('No food listings found'))

    const listing = makeListing({
      dietary_type: 'veg',
      storage_type: 'hot',
      allergens: ['Dairy', 'Nuts'],
    })

    const bystanderHtml = renderToStaticMarkup(
      <ListingFeed
        listings={[{ listing, distanceKm: 1.2 }]}
        currentUserId="bystander-1"
        nowMs={nowMs}
        pickupDetailsById={{
          'listing-1': {
            userId: 'donor-1',
            details: {
              pickup_address: 'Secret House 99',
              pickup_instructions: 'Ring bell',
              contact_phone: '+919876543210',
            },
            loading: false,
            error: '',
          },
        }}
        onRetryPickupDetails={() => {}}
        onUpdated={() => {}}
        onDeleted={() => {}}
        onRepost={() => {}}
      />
    )
    assert.ok(bystanderHtml.includes('Paneer Biryani'))
    assert.ok(bystanderHtml.includes('Vegetarian'))
    assert.ok(bystanderHtml.includes('Keep Hot'))
    assert.ok(bystanderHtml.includes('Dairy, Nuts'))
    assert.ok(bystanderHtml.includes('Claim Food'))
    assert.ok(!bystanderHtml.includes('Secret House 99'))
    assert.ok(!bystanderHtml.includes('+919876543210'))
  })

  it('renders ImpactDashboard and ListingsMap cleanly', () => {
    const nowMs = new Date('2026-11-25T12:00:00.000Z').getTime()
    const listings = [
      makeListing({
        id: 'l1',
        status: 'picked_up',
        posted_by: 'u1',
      }),
      makeListing({
        id: 'l2',
        status: 'available',
      }),
    ]

    const impactHtml = renderToStaticMarkup(
      <ImpactDashboard listings={listings} currentUserId="u1" nowMs={nowMs} />
    )
    assert.ok(impactHtml.includes('Rescues Completed'))
    assert.ok(impactHtml.includes('Your Personal Impact'))

    const mapHtml = renderToStaticMarkup(
      <ListingsMap
        listings={[{ listing: listings[1]!, distanceKm: 0.8 }]}
        userLocation={{ latitude: 26.85, longitude: 80.95 }}
        distanceFilter="5"
        currentUserId="u1"
      />
    )
    assert.ok(mapHtml.includes('OpenStreetMap'))
    assert.ok(mapHtml.includes('Paneer Biryani'))
  })
})

