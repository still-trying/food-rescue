import { useMemo } from 'react'
import type { Listing } from '../types/listing'
import { computeImpactMetrics } from '../utils/smartRescue'

type Props = {
  listings: Listing[]
  currentUserId: string | null
  nowMs: number
}

export default function ImpactDashboard({
  listings,
  currentUserId,
  nowMs,
}: Props) {
  const metrics = useMemo(
    () => computeImpactMetrics(listings, currentUserId, nowMs),
    [listings, currentUserId, nowMs]
  )

  const maxCategoryCount = Math.max(
    1,
    ...metrics.categoryBreakdown.map(
      (item) => item.rescuedCount + item.availableCount
    )
  )

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-green-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Rescues Completed
          </p>
          <p className="mt-2 text-3xl font-bold text-green-700">
            {metrics.rescuedCount}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {metrics.claimedActiveCount} in progress ·{' '}
            {metrics.availableActiveCount} available now
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Est. Meals Rescued
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-700">
            ~{metrics.estimatedMealsRescued}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Based on category portion averages
          </p>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Est. Food Saved
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-700">
            ~{metrics.estimatedKgSaved} kg
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Diverted from potential landfill waste
          </p>
        </div>

        <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Est. CO₂e Avoided
          </p>
          <p className="mt-2 text-3xl font-bold text-teal-700">
            ~{metrics.estimatedCo2eAvoidedKg} kg
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Estimated emissions prevented
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900">Your Personal Impact</h3>
        <p className="mt-1 text-sm text-gray-500">
          Your completed rescues across donated and claimed surplus food.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-green-100 bg-green-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800">
              Surplus Food Donated &amp; Picked Up
            </p>
            <p className="mt-1 text-2xl font-bold text-green-900">
              {metrics.personalDonatedRescues}{' '}
              {metrics.personalDonatedRescues === 1 ? 'rescue' : 'rescues'}
            </p>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800">
              Surplus Food Claimed &amp; Rescued
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-900">
              {metrics.personalClaimedRescues}{' '}
              {metrics.personalClaimedRescues === 1 ? 'rescue' : 'rescues'}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900">
          Category Breakdown
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Completed rescues vs. active listings by food category.
        </p>

        <div className="mt-5 space-y-4">
          {metrics.categoryBreakdown.map((item) => {
            const total = item.rescuedCount + item.availableCount
            const widthPct = Math.round((total / maxCategoryCount) * 100)

            return (
              <div key={item.category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{item.label}</span>
                  <span className="text-xs text-gray-500">
                    {item.rescuedCount} rescued (~{item.estimatedKg} kg) ·{' '}
                    {item.availableCount} active
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-green-600 transition-all"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Note: Weight, meal, and CO₂e figures are conservative category-level
          estimates computed from completed rescues currently loaded in the feed.
        </p>
      </div>
    </div>
  )
}

