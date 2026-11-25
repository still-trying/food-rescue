import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  formatCategoryLabel,
  formatDietaryLabel,
  formatStorageLabel,
  isValidCategory,
} from '../src/constants/categories'
import { resolveInitialTheme } from '../src/hooks/useTheme'
import type { Listing } from '../src/types/listing'
import { isListingExpired, toLocalDateTimeInputValue } from '../src/utils/date'
import { calculateDistanceKm, formatDistance } from '../src/utils/geo'
import { geocodeLocation } from '../src/utils/geocoding'
import { detectImageMimeFromBytes } from '../src/utils/imageProcessor'
import { filterAndSortListings } from '../src/utils/listingFilters'
import {
  mergeListingsSnapshot,
  type RealtimeChange,
} from '../src/utils/listingsMerge'
import {
  latLonToTileFraction,
  latLonToViewportPixel,
  metersPerPixel,
} from '../src/utils/mapProjection'
import {
  isValidE164Phone,
  normalizePhoneE164,
  sanitizeTelHref,
} from '../src/utils/phone'
import {
  computeImpactMetrics,
  computeRescueScore,
  detectPublicPiiLeak,
  isEndingSoon,
  predictExpiryRisk,
  suggestCategoryFromText,
} from '../src/utils/smartRescue'
import { scrubPii } from '../src/utils/telemetry'

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'listing-1',
    title: 'Vegetable Biryani',
    description: 'Freshly cooked trays',
    quantity: 'Serves 10',
    category: 'cooked_meals',
    photo_url: null,
    location_text: 'Gomti Nagar, Lucknow',
    approx_latitude: 26.8467,
    approx_longitude: 80.9462,
    pickup_window_start: '2026-11-25T10:00:00.000Z',
    pickup_window_end: '2026-11-25T14:00:00.000Z',
    status: 'available',
    posted_by: 'donor-1',
    claimed_by: null,
    created_at: '2026-11-25T09:00:00.000Z',
    ...overrides,
  }
}

function createMemoryStorage(throwOnSet = false): Storage {
  const store = new Map<string, string>()
  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      if (throwOnSet) {
        throw new Error('QuotaExceededError')
      }
      store.set(key, value)
    },
  }
}

describe('geo utilities', () => {
  it('calculates zero distance for identical coordinates', () => {
    assert.equal(calculateDistanceKm(26.8467, 80.9462, 26.8467, 80.9462), 0)
  })

  it('calculates reasonable straight-line distance between Lucknow and Kanpur', () => {
    const km = calculateDistanceKm(26.8467, 80.9462, 26.4499, 80.3319)
    assert.ok(km > 70 && km < 85, `Expected ~75 km, got ${km}`)
  })

  it('formats sub-kilometer distances in meters and >= 1km in km', () => {
    assert.equal(formatDistance(0.45), '450 m away · straight-line')
    assert.equal(formatDistance(2.36), '2.4 km away · straight-line')
    assert.equal(formatDistance(null), null)
    assert.equal(formatDistance(Number.NaN), null)
  })
})

describe('date utilities', () => {
  it('marks only available listings past pickup_window_end as expired', () => {
    const end = '2026-11-25T12:00:00.000Z'
    const beforeEnd = new Date('2026-11-25T11:59:59.000Z').getTime()
    const atEnd = new Date('2026-11-25T12:00:00.000Z').getTime()

    assert.equal(
      isListingExpired(makeListing({ status: 'available', pickup_window_end: end }), beforeEnd),
      false
    )
    assert.equal(
      isListingExpired(makeListing({ status: 'available', pickup_window_end: end }), atEnd),
      true
    )
    assert.equal(
      isListingExpired(makeListing({ status: 'claimed', pickup_window_end: end }), atEnd),
      false
    )
    assert.equal(
      isListingExpired(makeListing({ status: 'picked_up', pickup_window_end: end }), atEnd),
      false
    )
  })

  it('formats local datetime input value in YYYY-MM-DDTHH:mm', () => {
    const formatted = toLocalDateTimeInputValue(new Date(2026, 10, 25, 9, 5))
    assert.equal(formatted, '2026-11-25T09:05')
  })
})

describe('phone utilities', () => {
  it('normalizes and validates E.164 phone numbers', () => {
    const normalized = normalizePhoneE164(' +91 (987) 654-3210 ')
    assert.equal(normalized, '+919876543210')
    assert.equal(isValidE164Phone(normalized), true)
    assert.equal(isValidE164Phone('9876543210'), false)
    assert.equal(isValidE164Phone('+0123456789'), false)
  })

  it('sanitizes tel href against malformed or injected values', () => {
    assert.equal(sanitizeTelHref('+91 98765 43210'), 'tel:+919876543210')
    assert.equal(sanitizeTelHref('javascript:alert(1)'), null)
    assert.equal(sanitizeTelHref(null), null)
  })
})

describe('image magic-byte validation', () => {
  it('detects JPEG, PNG, and WebP signatures and rejects spoofed files', async () => {
    const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00])])
    const png = new Blob([
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ])
    const webp = new Blob([
      new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
      ]),
    ])
    const spoofedHtml = new Blob(['<html><script>alert(1)</script></html>'])

    assert.equal(await detectImageMimeFromBytes(jpeg), 'image/jpeg')
    assert.equal(await detectImageMimeFromBytes(png), 'image/png')
    assert.equal(await detectImageMimeFromBytes(webp), 'image/webp')
    assert.equal(await detectImageMimeFromBytes(spoofedHtml), null)
  })
})

describe('categories & safety labels', () => {
  it('validates and formats known categories, dietary types, and storage types', () => {
    assert.equal(isValidCategory('cooked_meals'), true)
    assert.equal(isValidCategory('invalid_cat'), false)
    assert.equal(formatCategoryLabel('bakery'), '🥖 Bakery')
    assert.equal(formatCategoryLabel('unknown'), null)
    assert.equal(formatDietaryLabel('vegan'), '🌱 Vegan')
    assert.equal(formatStorageLabel('refrigerated'), '❄️ Refrigerated')
  })
})

describe('telemetry PII scrubbing', () => {
  it('redacts emails, phones, and JWTs while preserving dates and context', () => {
    const raw =
      '2026-11-25 Error for user@example.com phone +91 98765 43210 token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc_123'
    const scrubbed = scrubPii(raw)
    assert.ok(scrubbed.includes('2026-11-25'))
    assert.ok(!scrubbed.includes('user@example.com'))
    assert.ok(!scrubbed.includes('98765'))
    assert.ok(!scrubbed.includes('eyJhbGci'))
    assert.ok(scrubbed.includes('[REDACTED_EMAIL]'))
    assert.ok(scrubbed.includes('[REDACTED_PHONE]'))
    assert.ok(scrubbed.includes('[REDACTED_TOKEN]'))
  })
})

describe('smartRescue & impact analytics', () => {
  const nowMs = new Date('2026-11-25T12:00:00.000Z').getTime()

  it('flags available listings ending within 60 minutes', () => {
    assert.equal(
      isEndingSoon(
        makeListing({ pickup_window_end: '2026-11-25T12:45:00.000Z' }),
        nowMs
      ),
      true
    )
    assert.equal(
      isEndingSoon(
        makeListing({ pickup_window_end: '2026-11-25T14:00:00.000Z' }),
        nowMs
      ),
      false
    )
  })

  it('scores urgent nearby preferred listings higher than distant later ones', () => {
    const urgentNear = makeListing({
      id: 'u1',
      category: 'bakery',
      photo_url: 'https://example.com/a.jpg',
      pickup_window_end: '2026-11-25T12:30:00.000Z',
    })
    const laterFar = makeListing({
      id: 'l2',
      category: 'other',
      photo_url: null,
      quantity: null,
      description: null,
      pickup_window_end: '2026-11-25T20:00:00.000Z',
    })

    const preferred = new Set(['bakery'])
    const scoreA = computeRescueScore(urgentNear, 0.5, nowMs, preferred)
    const scoreB = computeRescueScore(laterFar, 12, nowMs, preferred)
    assert.ok(scoreA > scoreB, `Expected ${scoreA} > ${scoreB}`)
  })

  it('suggests categories from food keywords and detects public PII leaks', () => {
    assert.equal(suggestCategoryFromText('Leftover Sourdough Bread'), 'bakery')
    assert.equal(suggestCategoryFromText('Vegetable Biryani Trays'), 'cooked_meals')
    assert.equal(suggestCategoryFromText('Mystery box'), null)

    const pii = detectPublicPiiLeak(
      'Call +91 98765 43210 or visit Flat No. 402, email test@example.com'
    )
    assert.ok(pii.includes('a phone number'))
    assert.ok(pii.includes('an email address'))
    assert.ok(pii.includes('a flat/house/plot number'))
    assert.deepEqual(detectPublicPiiLeak('Gomti Nagar, Lucknow'), [])
  })

  it('computes community and personal impact metrics', () => {
    const listings = [
      makeListing({
        id: 'p1',
        status: 'picked_up',
        category: 'cooked_meals',
        posted_by: 'u1',
        claimed_by: 'u2',
      }),
      makeListing({
        id: 'p2',
        status: 'picked_up',
        category: 'bakery',
        posted_by: 'u3',
        claimed_by: 'u1',
      }),
      makeListing({
        id: 'a1',
        status: 'available',
        pickup_window_end: '2026-11-25T15:00:00.000Z',
      }),
    ]

    const metrics = computeImpactMetrics(listings, 'u1', nowMs)
    assert.equal(metrics.rescuedCount, 2)
    assert.equal(metrics.availableActiveCount, 1)
    assert.equal(metrics.personalDonatedRescues, 1)
    assert.equal(metrics.personalClaimedRescues, 1)
    assert.equal(metrics.estimatedMealsRescued, 9)
    assert.equal(metrics.estimatedKgSaved, 4.3)
  })

  it('assesses higher expiry risk for short unphotographed listings than long well-described ones', () => {
    const highRisk = predictExpiryRisk(
      makeListing({
        category: 'cooked_meals',
        photo_url: null,
        quantity: null,
        approx_latitude: null,
        approx_longitude: null,
        pickup_window_start: '2026-11-25T11:30:00.000Z',
        pickup_window_end: '2026-11-25T12:30:00.000Z',
      }),
      nowMs
    )
    const lowRisk = predictExpiryRisk(
      makeListing({
        category: 'groceries',
        photo_url: 'https://example.com/photo.jpg',
        quantity: 'Serves 10',
        pickup_window_start: '2026-11-25T10:00:00.000Z',
        pickup_window_end: '2026-11-25T19:00:00.000Z',
      }),
      nowMs
    )

    assert.equal(highRisk.riskTier, 'high')
    assert.equal(lowRisk.riskTier, 'low')
    assert.ok(highRisk.riskScore > lowRisk.riskScore)
  })
})

describe('listingsMerge snapshot reconciliation', () => {
  it('preserves newer realtime claims/deletes over older in-flight DB snapshots and prunes obsolete markers', () => {
    const snapshot = [
      makeListing({ id: 'keep', status: 'available', created_at: '2026-11-25T09:00:00.000Z' }),
      makeListing({ id: 'deleted-in-flight', status: 'available', created_at: '2026-11-25T10:00:00.000Z' }),
      makeListing({ id: 'claimed-in-flight', status: 'available', created_at: '2026-11-25T11:00:00.000Z' }),
    ]

    const pending = new Map<string, RealtimeChange>([
      ['obsolete-marker', { version: 2, deleted: true }],
      ['deleted-in-flight', { version: 6, deleted: true }],
      [
        'claimed-in-flight',
        {
          version: 7,
          deleted: false,
          listing: makeListing({
            id: 'claimed-in-flight',
            status: 'claimed',
            claimed_by: 'user-2',
            created_at: '2026-11-25T11:00:00.000Z',
          }),
        },
      ],
    ])

    const merged = mergeListingsSnapshot(snapshot, pending, 5)

    assert.deepEqual(
      merged.map((l) => l.id),
      ['claimed-in-flight', 'keep']
    )
    assert.equal(merged[0]?.status, 'claimed')
    assert.equal(pending.has('obsolete-marker'), false)
    assert.equal(pending.has('claimed-in-flight'), true)
  })
})

describe('mapProjection utilities', () => {
  it('centers viewport coordinates accurately and computes positive metersPerPixel', () => {
    const centerPixel = latLonToViewportPixel(
      26.8467,
      80.9462,
      26.8467,
      80.9462,
      13,
      900,
      440
    )
    assert.equal(Math.round(centerPixel.left), 450)
    assert.equal(Math.round(centerPixel.top), 220)

    const tile = latLonToTileFraction(0, 0, 2)
    assert.equal(tile.x, 2)
    assert.equal(tile.y, 2)

    assert.ok(metersPerPixel(26.8467, 13) > 10)
  })
})

describe('geocoding cache & quota safety', () => {
  it('caches fresh responses, expires stale entries, evicts LRU > 100, and survives QuotaExceededError', async () => {
    const originalStorage = globalThis.localStorage
    const originalFetch = globalThis.fetch

    try {
      const storage = createMemoryStorage(false)
      globalThis.localStorage = storage

      // Seed 100 old entries to trigger LRU eviction
      for (let i = 0; i < 100; i++) {
        storage.setItem(
          `food-rescue-geocode:place-${i}|india`,
          JSON.stringify({ latitude: 26, longitude: 80, cachedAt: i + 1 })
        )
      }
      // Seed expired entry
      storage.setItem(
        'food-rescue-geocode:gomti nagar|india',
        JSON.stringify({
          latitude: 1,
          longitude: 1,
          cachedAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        })
      )

      let fetchCount = 0
      globalThis.fetch = (async () => {
        fetchCount += 1
        return new Response(
          JSON.stringify([{ lat: '26.85', lon: '80.99', display_name: 'Gomti Nagar' }]),
          { status: 200 }
        )
      }) as typeof fetch

      const first = await geocodeLocation('Gomti Nagar')
      assert.deepEqual(first, { latitude: 26.85, longitude: 80.99 })
      assert.equal(fetchCount, 1)

      // Oldest seeded entry should be evicted so cache stays <= 100
      assert.equal(storage.getItem('food-rescue-geocode:place-0|india'), null)

      // Second call should hit fresh cache without calling fetch
      const second = await geocodeLocation('Gomti Nagar')
      assert.deepEqual(second, { latitude: 26.85, longitude: 80.99 })
      assert.equal(fetchCount, 1)

      // QuotaExceededError on setItem should not throw
      globalThis.localStorage = createMemoryStorage(true)
      const third = await geocodeLocation('Hazratganj')
      assert.deepEqual(third, { latitude: 26.85, longitude: 80.99 })
      assert.equal(fetchCount, 2)
    } finally {
      globalThis.localStorage = originalStorage
      globalThis.fetch = originalFetch
    }
  })
})

describe('listingFilters', () => {
  const nowMs = new Date('2026-11-25T12:00:00.000Z').getTime()

  const activeNear = makeListing({
    id: 'near',
    title: 'Fresh Bread',
    category: 'bakery',
    approx_latitude: 26.85,
    approx_longitude: 80.95,
    pickup_window_end: '2026-11-25T15:00:00.000Z',
    created_at: '2026-11-25T10:00:00.000Z',
  })

  const activeFarNoCoords = makeListing({
    id: 'nocoord',
    title: 'Rice Bowls',
    category: 'cooked_meals',
    approx_latitude: null,
    approx_longitude: null,
    pickup_window_end: '2026-11-25T13:00:00.000Z',
    created_at: '2026-11-25T11:00:00.000Z',
  })

  const expired = makeListing({
    id: 'expired',
    title: 'Old Salad',
    pickup_window_end: '2026-11-25T11:00:00.000Z',
  })

  const claimedByUser = makeListing({
    id: 'claimed-by-me',
    status: 'claimed',
    posted_by: 'donor-2',
    claimed_by: 'user-1',
    pickup_window_end: '2026-11-25T11:00:00.000Z',
  })

  it('excludes expired available listings and supports my_claims view', () => {
    const available = filterAndSortListings({
      listings: [activeNear, activeFarNoCoords, expired, claimedByUser],
      view: 'available',
      userId: 'user-1',
      search: '',
      categoryFilter: 'all',
      distanceFilter: 'all',
      sortBy: 'newest',
      userLocation: null,
      nowMs,
    })

    assert.deepEqual(
      available.map((x) => x.listing.id),
      ['nocoord', 'near']
    )

    const myClaims = filterAndSortListings({
      listings: [activeNear, expired, claimedByUser],
      view: 'my_claims',
      userId: 'user-1',
      search: '',
      categoryFilter: 'all',
      distanceFilter: 'all',
      sortBy: 'newest',
      userLocation: null,
      nowMs,
    })

    assert.deepEqual(
      myClaims.map((x) => x.listing.id),
      ['claimed-by-me']
    )
  })

  it('applies distance filter (excluding null coords), nearest-first, and recommended sort', () => {
    const userLocation = { latitude: 26.85, longitude: 80.95 }

    const within1Km = filterAndSortListings({
      listings: [activeNear, activeFarNoCoords],
      view: 'available',
      userId: 'user-1',
      search: '',
      categoryFilter: 'all',
      distanceFilter: '1',
      sortBy: 'nearest',
      userLocation,
      nowMs,
    })
    assert.deepEqual(
      within1Km.map((x) => x.listing.id),
      ['near']
    )

    const nearestAll = filterAndSortListings({
      listings: [activeFarNoCoords, activeNear],
      view: 'available',
      userId: 'user-1',
      search: '',
      categoryFilter: 'all',
      distanceFilter: 'all',
      sortBy: 'nearest',
      userLocation,
      nowMs,
    })
    assert.deepEqual(
      nearestAll.map((x) => x.listing.id),
      ['near', 'nocoord']
    )

    const recommended = filterAndSortListings({
      listings: [activeFarNoCoords, activeNear],
      view: 'available',
      userId: 'user-1',
      search: '',
      categoryFilter: 'all',
      distanceFilter: 'all',
      sortBy: 'recommended',
      userLocation,
      nowMs,
    })
    assert.equal(recommended[0]?.listing.id, 'near')
    assert.ok((recommended[0]?.rescueScore ?? 0) > (recommended[1]?.rescueScore ?? 0))
  })
})

describe('theme preference resolution', () => {
  it('respects explicit stored preference and falls back to system preference', () => {
    assert.equal(resolveInitialTheme('dark', false), 'dark')
    assert.equal(resolveInitialTheme('light', true), 'light')
    assert.equal(resolveInitialTheme(null, true), 'dark')
    assert.equal(resolveInitialTheme('invalid', false), 'light')
  })
})
