import type { Theme } from '../hooks/useTheme'
import ThemeToggle from './ThemeToggle'

type Props = {
  userEmail: string | null
  loggingOut: boolean
  theme?: Theme
  onToggleTheme?: () => void
  onNavigateHome: () => void
  onOpenPost: () => void
  onOpenProfile: () => void
  onLogout: () => void
}

export default function Header({
  userEmail,
  loggingOut,
  theme = 'light',
  onToggleTheme,
  onNavigateHome,
  onOpenPost,
  onOpenProfile,
  onLogout,
}: Props) {
  return (
    <header className="fr-glass-bar sticky top-0 z-30 border-b border-slate-200/70 transition-colors dark:border-emerald-500/15">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-3 text-left transition hover:opacity-95"
        >
          <div className="overflow-hidden rounded-xl bg-[#faf8f5] p-1 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/15">
            <img
              src="/logo.jpg"
              alt="Food Rescue logo"
              className="h-10 w-auto rounded-lg object-contain sm:h-11"
              width={120}
              height={44}
            />
          </div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Share Food • Reduce Waste • Nourish Lives
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="hidden text-right md:block">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Logged in as
            </p>
            <p className="max-w-44 truncate text-sm font-medium text-slate-800 dark:text-slate-100">
              {userEmail}
            </p>
          </div>

          {onToggleTheme && (
            <ThemeToggle theme={theme} onToggle={onToggleTheme} compact />
          )}

          <button
            type="button"
            onClick={onOpenProfile}
            disabled={loggingOut}
            className="rounded-xl border border-slate-300/80 bg-white/85 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/20 dark:bg-emerald-950/60 dark:text-slate-100 dark:hover:bg-emerald-900/60"
          >
            👤 <span className="hidden sm:inline">Profile</span>
          </button>

          <button
            type="button"
            onClick={onOpenPost}
            disabled={loggingOut}
            className="fr-btn-3d rounded-xl bg-green-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-base dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            + Post Surplus
          </button>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="rounded-xl border border-slate-300/80 bg-white/85 px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4 sm:text-base dark:border-emerald-500/20 dark:bg-emerald-950/60 dark:text-slate-200 dark:hover:bg-emerald-900/60"
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  )
}
