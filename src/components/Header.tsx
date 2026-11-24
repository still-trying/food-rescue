type Props = {
  userEmail: string | null
  loggingOut: boolean
  onNavigateHome: () => void
  onOpenPost: () => void
  onLogout: () => void
}

export default function Header({
  userEmail,
  loggingOut,
  onNavigateHome,
  onOpenPost,
  onLogout,
}: Props) {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
        <button
          type="button"
          onClick={onNavigateHome}
          className="text-left"
        >
          <h1 className="text-2xl font-bold">Food Rescue</h1>
          <p className="text-sm text-gray-500">
            Rescue surplus food. Reduce waste.
          </p>
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="max-w-48 truncate text-sm font-medium">
              {userEmail}
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenPost}
            disabled={loggingOut}
            className="rounded-xl bg-green-600 px-5 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Post Surplus
          </button>

          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className="rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </header>
  )
}

