import { FOOD_CATEGORIES } from '../constants/categories'
import type { FoodCategory, Listing } from '../types/listing'

const ENDING_SOON_WINDOW_MS = 60 * 60 * 1000 // 60 minutes

// Conservative per-listing average weight (kg) and CO2e factor (kg CO2e / kg food)
// based on typical surplus food portions. Clearly presented as estimates in UI.
const CATEGORY_IMPACT_ESTIMATES: Record<
  FoodCategory,
  { avgKg: number; co2ePerKg: number; avgMeals: number }
> = {
  cooked_meals: { avgKg: 2.5, co2ePerKg: 3.1, avgMeals: 5 },
  bakery: { avgKg: 1.8, co2ePerKg: 1.6, avgMeals: 4 },
  groceries: { avgKg: 3.0, co2ePerKg: 2.4, avgMeals: 6 },
  fruits_vegetables: { avgKg: 2.8, co2ePerKg: 1.1, avgMeals: 5 },
  beverages: { avgKg: 2.0, co2ePerKg: 0.9, avgMeals: 4 },
  other: { avgKg: 2.0, co2ePerKg: 2.0, avgMeals: 4 },
}

const CATEGORY_KEYWORDS: Record<FoodCategory, readonly string[]> = {
  cooked_meals: [
    'biryani',
    'curry',
    'rice',
    'dal',
    'meal',
    'lunch',
    'dinner',
    'pasta',
    'pizza',
    'thali',
    'soup',
    'noodles',
    'khichdi',
    'pulao',
    'sabzi',
    'roti',
    'paneer',
    'cooked',
  ],
  bakery: [
    'bread',
    'cake',
    'pastry',
    'pastries',
    'croissant',
    'bun',
    'muffin',
    'cookie',
    'cookies',
    'donut',
    'bakery',
    'loaf',
    'baguette',
    'pav',
  ],
  groceries: [
    'flour',
    'lentils',
    'cereal',
    'milk',
    'cheese',
    'yogurt',
    'oil',
    'sugar',
    'grains',
    'grocery',
    'groceries',
    'packaged',
    'canned',
    'biscuits',
  ],
  fruits_vegetables: [
    'apple',
    'banana',
    'mango',
    'tomato',
    'potato',
    'onion',
    'spinach',
    'salad',
    'fruit',
    'fruits',
    'vegetable',
    'vegetables',
    'veggies',
    'greens',
    'produce',
  ],
  beverages: [
    'juice',
    'tea',
    'coffee',
    'smoothie',
    'shake',
    'water',
    'soda',
    'lassi',
    'buttermilk',
    'drink',
    'beverage',
    'beverages',
  ],
  other: [],
}

/**
 * True when an available listing has <= 60 minutes remaining before expiry.
 */
export function isEndingSoon(
  listing: Pick<Listing, 'status' | 'pickup_window_end'>,
  nowMs: number
): boolean {
  if (listing.status !== 'available') {
    return false
  }
  const remainingMs = new Date(listing.pickup_window_end).getTime() - nowMs
  return remainingMs > 0 && remainingMs <= ENDING_SOON_WINDOW_MS
}

/**
 * Compute a composite Rescue Score (0-100) for ranking available surplus food
 * by expiry urgency, proximity, user category affinity, and listing richness.
 */
export function computeRescueScore(
  listing: Listing,
  distanceKm: number | null,
  nowMs: number,
  preferredCategories: ReadonlySet<string> = new Set()
): number {
  const endMs = new Date(listing.pickup_window_end).getTime()
  const hoursLeft = Math.max(0, (endMs - nowMs) / (1000 * 60 * 60))

  // Urgency (0..45): peaks as pickup window approaches end
  const urgencyScore =
    hoursLeft <= 0 ? 0 : 45 * Math.exp(-hoursLeft / 4)

  // Proximity (0..35): exponential decay with distance; neutral baseline if no location
  const proximityScore =
    distanceKm === null ? 15 : 35 * Math.exp(-distanceKm / 4)

  // Personal category affinity (0..10)
  const affinityScore =
    listing.category && preferredCategories.has(listing.category) ? 10 : 0

  // Listing completeness (0..10): photo + quantity + description help rescuers decide quickly
  let completenessScore = 0
  if (listing.photo_url) completenessScore += 4
  if (listing.quantity) completenessScore += 3
  if (listing.description) completenessScore += 3

  return Math.round(
    Math.min(100, urgencyScore + proximityScore + affinityScore + completenessScore)
  )
}

/**
 * Suggest a category from the donor's listing title/description keywords.
 */
export function suggestCategoryFromText(text: string): FoodCategory | null {
  const normalized = text.trim().toLowerCase()
  if (normalized.length < 3) {
    return null
  }

  let bestCategory: FoodCategory | null = null
  let bestScore = 0

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    let score = 0
    for (const keyword of keywords) {
      const pattern = new RegExp(`\\b${keyword}(?:s|es)?\\b`, 'i')
      if (pattern.test(normalized)) {
        score += 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestCategory = category as FoodCategory
    }
  }

  return bestCategory
}

/**
 * Detect accidental PII (phone numbers, emails, or street-level address markers)
 * in public listing fields before publishing.
 */
export function detectPublicPiiLeak(text: string): string[] {
  const warnings: string[] = []
  const trimmed = text.trim()
  if (!trimmed) {
    return warnings
  }

  // Phone-like sequences (10+ digits allowing spaces/hyphens)
  if (/(?:\+?\d[\s().-]*){10,14}/.test(trimmed)) {
    warnings.push('a phone number')
  }

  // Email addresses
  if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(trimmed)) {
    warnings.push('an email address')
  }

  // Street/apartment markers that belong in Exact Pickup Address instead
  if (
    /\b(?:house\s*(?:no\.?|#)|flat\s*(?:no\.?|#)|apt\.?\s*\d+|apartment\s*\d+|floor\s*\d+|plot\s*(?:no\.?|#))\b/i.test(
      trimmed
    )
  ) {
    warnings.push('a flat/house/plot number')
  }

  return warnings
}

export type CategoryBreakdownItem = {
  category: FoodCategory
  label: string
  rescuedCount: number
  availableCount: number
  estimatedKg: number
}

export type ImpactMetrics = {
  totalListings: number
  rescuedCount: number
  claimedActiveCount: number
  availableActiveCount: number
  estimatedMealsRescued: number
  estimatedKgSaved: number
  estimatedCo2eAvoidedKg: number
  personalDonatedRescues: number
  personalClaimedRescues: number
  categoryBreakdown: CategoryBreakdownItem[]
}

export function computeImpactMetrics(
  listings: Listing[],
  currentUserId: string | null,
  nowMs: number
): ImpactMetrics {
  let rescuedCount = 0
  let claimedActiveCount = 0
  let availableActiveCount = 0
  let estimatedMealsRescued = 0
  let estimatedKgSaved = 0
  let estimatedCo2eAvoidedKg = 0
  let personalDonatedRescues = 0
  let personalClaimedRescues = 0

  const byCategory = new Map<
    FoodCategory,
    { rescuedCount: number; availableCount: number; estimatedKg: number }
  >()

  for (const cat of FOOD_CATEGORIES) {
    byCategory.set(cat.value, {
      rescuedCount: 0,
      availableCount: 0,
      estimatedKg: 0,
    })
  }

  for (const listing of listings) {
    const categoryKey: FoodCategory =
      listing.category && listing.category in CATEGORY_IMPACT_ESTIMATES
        ? (listing.category as FoodCategory)
        : 'other'
    const factor = CATEGORY_IMPACT_ESTIMATES[categoryKey]
    const bucket = byCategory.get(categoryKey)!

    if (listing.status === 'picked_up') {
      rescuedCount += 1
      estimatedMealsRescued += factor.avgMeals
      estimatedKgSaved += factor.avgKg
      estimatedCo2eAvoidedKg += factor.avgKg * factor.co2ePerKg
      bucket.rescuedCount += 1
      bucket.estimatedKg += factor.avgKg

      if (currentUserId && listing.posted_by === currentUserId) {
        personalDonatedRescues += 1
      }
      if (currentUserId && listing.claimed_by === currentUserId) {
        personalClaimedRescues += 1
      }
    } else if (listing.status === 'claimed') {
      claimedActiveCount += 1
    } else if (
      listing.status === 'available' &&
      new Date(listing.pickup_window_end).getTime() > nowMs
    ) {
      availableActiveCount += 1
      bucket.availableCount += 1
    }
  }

  const categoryBreakdown: CategoryBreakdownItem[] = FOOD_CATEGORIES.map(
    (cat) => {
      const stats = byCategory.get(cat.value)!
      return {
        category: cat.value,
        label: cat.label,
        rescuedCount: stats.rescuedCount,
        availableCount: stats.availableCount,
        estimatedKg: Number(stats.estimatedKg.toFixed(1)),
      }
    }
  )

  return {
    totalListings: listings.length,
    rescuedCount,
    claimedActiveCount,
    availableActiveCount,
    estimatedMealsRescued,
    estimatedKgSaved: Number(estimatedKgSaved.toFixed(1)),
    estimatedCo2eAvoidedKg: Number(estimatedCo2eAvoidedKg.toFixed(1)),
    personalDonatedRescues,
    personalClaimedRescues,
    categoryBreakdown,
  }
}

export type ExpiryRiskAssessment = {
  riskScore: number // 0..1 probability estimate of expiring unclaimed
  riskTier: 'low' | 'medium' | 'high'
  reason: string
}

const CATEGORY_PERISHABILITY_BIAS: Record<FoodCategory, number> = {
  cooked_meals: 0.45,
  beverages: 0.25,
  bakery: 0.15,
  fruits_vegetables: 0.05,
  groceries: -0.35,
  other: 0.1,
}

/**
 * Interpretable logistic model estimating the risk that an available listing
 * goes unclaimed before pickup_window_end.
 */
export function predictExpiryRisk(
  listing: Pick<
    Listing,
    | 'status'
    | 'category'
    | 'photo_url'
    | 'quantity'
    | 'approx_latitude'
    | 'approx_longitude'
    | 'pickup_window_start'
    | 'pickup_window_end'
  >,
  nowMs: number
): ExpiryRiskAssessment {
  if (listing.status !== 'available') {
    return { riskScore: 0, riskTier: 'low', reason: 'Already claimed or rescued' }
  }

  const startMs = new Date(listing.pickup_window_start).getTime()
  const endMs = new Date(listing.pickup_window_end).getTime()
  const hoursLeft = Math.max(0, (endMs - nowMs) / (1000 * 60 * 60))
  const windowHours = Math.max(0.25, (endMs - startMs) / (1000 * 60 * 60))

  if (hoursLeft <= 0) {
    return { riskScore: 1, riskTier: 'high', reason: 'Pickup window has ended' }
  }

  const categoryKey: FoodCategory =
    listing.category && listing.category in CATEGORY_PERISHABILITY_BIAS
      ? (listing.category as FoodCategory)
      : 'other'

  // Linear logit over domain priors (calibrated on golden rescue scenarios)
  let logit = -0.65
  logit += CATEGORY_PERISHABILITY_BIAS[categoryKey]
  // Less time left -> sharply higher unclaimed risk
  logit += hoursLeft < 1 ? 1.55 : hoursLeft < 2 ? 0.75 : hoursLeft > 6 ? -0.8 : 0
  // Very tight total pickup window (< 1.5h) increases coordination friction
  if (windowHours < 1.5) logit += 0.45
  // Missing photo, quantity, or coordinates lowers rescuer conversion
  if (!listing.photo_url) logit += 0.55
  if (!listing.quantity) logit += 0.25
  if (listing.approx_latitude === null || listing.approx_longitude === null) {
    logit += 0.4
  }

  const riskScore = Number((1 / (1 + Math.exp(-logit))).toFixed(3))
  const riskTier: ExpiryRiskAssessment['riskTier'] =
    riskScore >= 0.68 ? 'high' : riskScore >= 0.4 ? 'medium' : 'low'

  const reason =
    hoursLeft < 1
      ? 'Less than 1 hour left to rescue'
      : !listing.photo_url
        ? 'Short window without photo preview'
        : 'Perishable window narrowing'

  return { riskScore, riskTier, reason }
}


