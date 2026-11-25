import type { Theme } from '../hooks/useTheme'

type Props = {
  theme: Theme
  onToggle: () => void
  compact?: boolean
}

export default function ThemeToggle({
  theme,
  onToggle,
  compact = false,
}: Props) {
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-300/80 bg-white/85 px-3 py-2.5 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow active:translate-y-0 dark:border-emerald-500/25 dark:bg-emerald-950/60 dark:text-emerald-100 dark:hover:border-emerald-400/40 dark:hover:bg-emerald-900/60"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {isDark ? '☀️' : '🌙'}
      </span>
      {!compact && (
        <span className="hidden md:inline">
          {isDark ? 'Light' : 'Dark'}
        </span>
      )}
    </button>
  )
}
