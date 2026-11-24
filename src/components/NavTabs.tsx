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
    <nav className="border-b bg-white" aria-label="Listing sections">
      <div
        className="mx-auto flex max-w-6xl gap-7 overflow-x-auto px-6"
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
              className={`whitespace-nowrap border-b-2 px-1 py-4 font-medium transition ${
                isSelected
                  ? 'border-green-600 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
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
