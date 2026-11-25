import type { View } from '../types/listing'

type Props = {
  activeView: View
  onSelectView: (view: Exclude<View, 'post'>) => void
}

const TABS: readonly { id: Exclude<View, 'post'>; label: string }[] = [
  { id: 'available', label: 'Available' },
  { id: 'my_claims', label: 'My Claims' },
  { id: 'claimed', label: 'All Claimed' },
  { id: 'picked_up', label: 'Picked Up' },
  { id: 'my_listings', label: 'My Listings' },
  { id: 'impact', label: 'Impact' },
] as const

export default function NavTabs({ activeView, onSelectView }: Props) {
  return (
    <nav
      className="border-b border-slate-200/70 bg-white/65 backdrop-blur-md transition-colors dark:border-emerald-500/15 dark:bg-[#0b1511]/70"
      aria-label="Listing sections"
    >
      <div
        className="mx-auto flex max-w-6xl gap-7 overflow-x-auto px-4 sm:px-6"
        role="tablist"
      >
        {TABS.map((tab) => {
          const isSelected = activeView === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => onSelectView(tab.id)}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-semibold transition sm:text-base ${
                isSelected
                  ? 'border-green-600 text-green-700 dark:border-emerald-400 dark:text-emerald-300'
                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
