type Props = {
  userEmail: string | null
  loggingOut: boolean
  onNavigateHome: () => void
  onOpenPost: () => void
  onOpenProfile: () => void
  onLogout: () => void
}

export default function Header({
  userEmail,
  loggingOut,
  onNavigateHome,
  onOpenPost,
  onOpenProfile,
  onLogout,
}: Props) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-3 text-left"
        >
          <img
            src="/logo.jpg"
            alt="Food Rescue logo"
            className="h-12 w-auto rounded-xl object-contain"
            width={120}
            height={48}
          />
          <div className="hidden sm:block">
            <p className="text-sm text-gray-500">
              Share Food • Reduce Waste • Nourish Lives
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="max-w-48 truncate text-sm font-medium">
              {userEmail}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenProfile}
            disabled={loggingOut}
            className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            👤 Profile
          </button>

          <button
            type="button"
            onClick={onOpenPost}
            disabled={loggingOut}
            className="rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 sm:px-5 sm:text-base"
          >
            + Post Surplus
          </button>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  )
}
