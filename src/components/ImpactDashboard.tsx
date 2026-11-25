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
        <div className="fr-surface-3d fr-card-3d rounded-2xl border border-green-200/80 p-5 dark:border-emerald-500/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Rescues Completed
          </p>
          <p className="mt-2 text-3xl font-bold text-green-700 dark:text-emerald-400">
            {metrics.rescuedCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {metrics.claimedActiveCount} in progress ·{' '}
            {metrics.availableActiveCount} available now
          </p>
        </div>

        <div className="fr-surface-3d fr-card-3d rounded-2xl border border-emerald-200/80 p-5 dark:border-emerald-400/25">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Est. Meals Rescued
          </p>
          <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-300">
            ~{metrics.estimatedMealsRescued}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Based on category portion averages
          </p>
        </div>

        <div className="fr-surface-3d fr-card-3d rounded-2xl border border-blue-200/80 p-5 dark:border-sky-500/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Est. Food Saved
          </p>
          <p className="mt-2 text-3xl font-bold text-blue-700 dark:text-sky-400">
            ~{metrics.estimatedKgSaved} kg
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Diverted from potential landfill waste
          </p>
        </div>

        <div className="fr-surface-3d fr-card-3d rounded-2xl border border-teal-200/80 p-5 dark:border-teal-500/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Est. CO₂e Avoided
          </p>
          <p className="mt-2 text-3xl font-bold text-teal-700 dark:text-teal-300">
            ~{metrics.estimatedCo2eAvoidedKg} kg
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Estimated emissions prevented
          </p>
        </div>
      </div>

      <div className="fr-surface-3d rounded-2xl border border-slate-200/80 p-6 dark:border-emerald-500/20">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          Your Personal Impact
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Your completed rescues across donated and claimed surplus food.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-green-200/80 bg-green-50/85 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/55">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800 dark:text-emerald-300">
              Surplus Food Donated &amp; Picked Up
            </p>
            <p className="mt-1 text-2xl font-bold text-green-900 dark:text-emerald-100">
              {metrics.personalDonatedRescues}{' '}
              {metrics.personalDonatedRescues === 1 ? 'rescue' : 'rescues'}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200/80 bg-blue-50/85 p-4 dark:border-sky-500/30 dark:bg-sky-950/55">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-sky-300">
              Surplus Food Claimed &amp; Rescued
            </p>
            <p className="mt-1 text-2xl font-bold text-blue-900 dark:text-sky-100">
              {metrics.personalClaimedRescues}{' '}
              {metrics.personalClaimedRescues === 1 ? 'rescue' : 'rescues'}
            </p>
          </div>
        </div>
      </div>

      <div className="fr-surface-3d rounded-2xl border border-slate-200/80 p-6 dark:border-emerald-500/20">
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
          Category Breakdown
        </h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Completed rescues vs. active listings by food category.
        </p>

        <div className="mt-5 space-y-4">
          {metrics.categoryBreakdown.map((item) => {
            const total = item.rescuedCount + item.availableCount
            const widthPct = Math.round((total / maxCategoryCount) * 100)

            return (
              <div key={item.category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {item.label}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {item.rescuedCount} rescued (~{item.estimatedKg} kg) ·{' '}
                    {item.availableCount} active
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-emerald-950/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-600 to-emerald-500 transition-all dark:from-emerald-500 dark:to-teal-400"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
          Note: Weight, meal, and CO₂e figures are conservative category-level
          estimates computed from completed rescues currently loaded in the feed.
        </p>
      </div>
    </div>
  )
}
