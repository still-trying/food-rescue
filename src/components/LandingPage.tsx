import type { Theme } from '../hooks/useTheme'
import AmbientBackground from './AmbientBackground'
import ThemeToggle from './ThemeToggle'

type Props = {
  onOpenAuth: (mode: 'login' | 'signup') => void
  theme?: Theme
  onToggleTheme?: () => void
}

const WORKFLOW_STEPS = [
  {
    step: '01',
    icon: '📤',
    title: 'Post Surplus Food',
    description:
      'Share food name, quantity, pickup window, dietary tags, and an optional photo with automatic EXIF stripping and AI autofill.',
    accent:
      'border-emerald-200/80 dark:border-emerald-500/25',
  },
  {
    step: '02',
    icon: '🗺️',
    title: 'Discover Nearby',
    description:
      'Rescuers browse real-time listings or the interactive area map ranked by pickup urgency, distance, and food category.',
    accent:
      'border-teal-200/80 dark:border-teal-500/25',
  },
  {
    step: '03',
    icon: '🤝',
    title: 'Claim & Coordinate',
    description:
      'Atomic server-side claiming reserves the food and unlocks the private pickup address, donor phone, and in-app chat.',
    accent:
      'border-amber-200/80 dark:border-amber-500/25',
  },
  {
    step: '04',
    icon: '🔑',
    title: 'PIN Handoff & Impact',
    description:
      'Confirm the pickup with a 4-digit handoff PIN and log estimated meals rescued, food weight, and CO₂e avoided.',
    accent:
      'border-sky-200/80 dark:border-sky-500/25',
  },
] as const

const PLATFORM_PILLARS = [
  {
    icon: '🛡️',
    title: 'Privacy-First Architecture',
    description:
      'Public listings display only a broad neighborhood area. Exact street addresses and phone numbers stay locked behind Row Level Security until a listing is claimed.',
  },
  {
    icon: '🥗',
    title: 'Food Safety & Allergen Clarity',
    description:
      'Clear badges highlight dietary type, storage temperature (hot, refrigerated, room temp, frozen), and common allergens before anyone claims.',
  },
  {
    icon: '⚡',
    title: 'Real-Time Sync & Smart Ranking',
    description:
      'WebSocket updates keep availability accurate across tabs, while Rescue Score prioritizes perishable food nearing the end of its pickup window.',
  },
] as const

const DONOR_GROUPS = [
  'Restaurants & Kitchens',
  'Bakeries & Cafes',
  'Catering & Events',
  'Grocery Stores',
  'NGOs & Shelters',
  'Home Donors',
] as const

export default function LandingPage({
  onOpenAuth,
  theme = 'light',
  onToggleTheme,
}: Props) {
  return (
    <div className="fr-hero-backdrop relative min-h-screen text-slate-900 transition-colors dark:text-slate-100">
      <AmbientBackground />

      {/* Top Sticky Glass Navigation */}
      <header className="fr-glass-bar sticky top-0 z-30 border-b border-slate-200/70 transition-colors dark:border-emerald-500/15">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="overflow-hidden rounded-xl bg-[#faf8f5] p-1 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/15">
              <img
                src="/logo.jpg"
                alt="Food Rescue logo"
                className="h-10 w-auto rounded-lg object-contain sm:h-11"
                width={120}
                height={44}
              />
            </div>
            <div className="hidden sm:block">
              <p className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50">
                Food Rescue
              </p>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Share Food • Reduce Waste • Nourish Lives
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {onToggleTheme && (
              <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
            )}

            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="rounded-xl border border-slate-300/90 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow active:translate-y-0 dark:border-emerald-500/25 dark:bg-emerald-950/60 dark:text-slate-100 dark:hover:bg-emerald-900/60"
            >
              Login
            </button>

            <button
              type="button"
              onClick={() => onOpenAuth('signup')}
              className="fr-btn-3d rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Sign Up
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        {/* Hero Section + 3D Workflow Preview */}
        <section className="grid items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/80 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs backdrop-blur-sm dark:border-emerald-500/30 dark:bg-emerald-950/70 dark:text-emerald-300">
              <span
                className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                aria-hidden="true"
              />
              Local Surplus Food Sharing Platform
            </div>

            <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1] dark:text-slate-50">
              Rescue good food before it{' '}
              <span className="bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-300 dark:to-amber-300">
                goes to waste.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">
              Food Rescue connects surplus food donors with nearby people and
              community organizations in real time. Post available meals in
              seconds, protect private pickup details until claimed, and verify
              every handoff cleanly.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="fr-btn-3d rounded-2xl bg-green-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-green-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                Create Free Account
              </button>

              <button
                type="button"
                onClick={() => onOpenAuth('login')}
                className="fr-surface-3d rounded-2xl border border-slate-300/90 px-6 py-3.5 text-base font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-green-500/50 dark:border-emerald-500/25 dark:text-slate-100 dark:hover:border-emerald-400/50"
              >
                Login to Continue →
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {DONOR_GROUPS.map((group) => (
                <span
                  key={group}
                  className="rounded-full border border-slate-200/90 bg-white/75 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur-xs dark:border-emerald-500/20 dark:bg-emerald-950/50 dark:text-slate-300"
                >
                  {group}
                </span>
              ))}
            </div>
          </div>

          {/* 3D Perspective Card Stack */}
          <div className="fr-perspective-stage lg:col-span-6">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Soft 3D halo behind the tilted card */}
              <div
                className="pointer-events-none absolute -inset-4 rounded-3xl bg-gradient-to-tr from-emerald-400/25 via-teal-300/20 to-amber-300/25 blur-2xl dark:from-emerald-500/20 dark:via-teal-500/10 dark:to-amber-500/15"
                aria-hidden="true"
              />

              <div className="fr-tilt-card fr-surface-3d relative rounded-3xl border border-white/80 p-6 sm:p-7 dark:border-emerald-400/25">
                <div className="fr-depth-layer-1 flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-500/35 dark:bg-emerald-950/80 dark:text-emerald-300">
                    ● Live Rescue Flow Preview
                  </span>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 dark:border-amber-500/35 dark:bg-amber-950/80 dark:text-amber-300">
                    ⚡ Priority Window
                  </span>
                </div>

                {/* Inner elevated card */}
                <div className="fr-depth-layer-2 mt-5 rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-md dark:border-emerald-500/20 dark:bg-[#0c1914]/90">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        🍛 Cooked Meals · Vegetarian
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">
                        Fresh Surplus Meal Trays
                      </h2>
                      <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                        📍 Broad area shown publicly until claimed
                      </p>
                    </div>
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-2xl text-white shadow-md">
                      🍱
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/70 dark:text-emerald-300">
                      🌱 Vegetarian
                    </span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:border-sky-500/30 dark:bg-sky-950/70 dark:text-sky-300">
                      🔥 Keep Hot
                    </span>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/70 dark:text-amber-300">
                      ⚠️ Allergen Tags
                    </span>
                  </div>
                </div>

                {/* Lifecycle steps inside the 3D card */}
                <div className="fr-depth-layer-1 mt-5 grid grid-cols-3 gap-2.5">
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-center dark:border-emerald-500/20 dark:bg-emerald-950/50">
                    <p className="text-xs font-bold text-green-700 dark:text-emerald-300">
                      1. Claim
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Atomic lock
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-center dark:border-emerald-500/20 dark:bg-emerald-950/50">
                    <p className="text-xs font-bold text-blue-700 dark:text-sky-300">
                      2. Chat
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      Private address
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/80 bg-white/80 p-3 text-center dark:border-emerald-500/20 dark:bg-emerald-950/50">
                    <p className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                      3. PIN
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                      4-digit handoff
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How Food Rescue Works */}
        <section className="mt-20" aria-labelledby="how-it-works-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700 dark:text-emerald-400">
              How It Works
            </p>
            <h2
              id="how-it-works-heading"
              className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
            >
              From surplus kitchen to rescued meal in four steps
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">
              Designed to make donating and claiming surplus food fast,
              privacy-safe, and reliable across every pickup window.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map((item) => (
              <div
                key={item.step}
                className={`fr-surface-3d fr-feature-3d rounded-2xl border p-6 ${item.accent}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-2xl shadow-xs dark:bg-emerald-950/80"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500">
                    STEP {item.step}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-slate-50">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Key Platform Capabilities */}
        <section className="mt-20" aria-labelledby="platform-pillars-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-green-700 dark:text-emerald-400">
              Built With Care
            </p>
            <h2
              id="platform-pillars-heading"
              className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50"
            >
              Privacy, safety, and speed at every step
            </h2>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {PLATFORM_PILLARS.map((pillar) => (
              <article
                key={pillar.title}
                className="fr-surface-3d fr-feature-3d rounded-2xl border border-slate-200/80 p-6 dark:border-emerald-500/20"
              >
                <div
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl shadow-xs dark:bg-emerald-950/80"
                  aria-hidden="true"
                >
                  {pillar.icon}
                </div>
                <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-slate-50">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {pillar.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Bottom CTA Card */}
        <section className="mt-20">
          <div className="fr-surface-3d relative overflow-hidden rounded-3xl border border-emerald-200/90 p-8 sm:p-10 dark:border-emerald-500/25">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-50">
                  Ready to share or rescue food nearby?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base dark:text-slate-300">
                  Sign up to post surplus listings or claim available food on
                  the live community board.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onOpenAuth('signup')}
                  className="fr-btn-3d rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 sm:text-base dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  Sign Up
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('login')}
                  className="rounded-xl border border-slate-300 bg-white/90 px-6 py-3 text-sm font-semibold text-slate-800 shadow-xs transition hover:-translate-y-0.5 hover:bg-white sm:text-base dark:border-emerald-500/25 dark:bg-emerald-950/70 dark:text-slate-100 dark:hover:bg-emerald-900/70"
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200/70 bg-white/40 py-6 backdrop-blur-sm dark:border-emerald-500/15 dark:bg-[#07100c]/50">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6 dark:text-slate-400">
          <p>Food Rescue — Share Food • Reduce Waste • Nourish Lives</p>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="font-semibold text-green-700 hover:underline dark:text-emerald-400"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('signup')}
              className="font-semibold text-green-700 hover:underline dark:text-emerald-400"
            >
              Sign Up
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
