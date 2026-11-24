import { useEffect, useState } from 'react'

const DEFAULT_TICK_MS = 30_000

/**
 * Returns a reactive epoch timestamp (ms) that refreshes periodically and
 * whenever the browser tab becomes visible again so expiration checks stay current.
 */
export function useNowTick(intervalMs = DEFAULT_TICK_MS): number {
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const refreshNow = () => {
      setNowMs(Date.now())
    }

    const timer = setInterval(refreshNow, intervalMs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNow()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs])

  return nowMs
}

