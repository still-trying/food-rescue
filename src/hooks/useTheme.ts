import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const THEME_STORAGE_KEY = 'food-rescue-theme'
const LIGHT_THEME_COLOR = '#16a34a'
const DARK_THEME_COLOR = '#09120e'

export function resolveInitialTheme(
  storedValue: string | null,
  prefersDark: boolean
): Theme {
  if (storedValue === 'light' || storedValue === 'dark') {
    return storedValue
  }
  return prefersDark ? 'dark' : 'light'
}

function readStoredTheme(): string | null {
  try {
    return typeof window !== 'undefined'
      ? window.localStorage.getItem(THEME_STORAGE_KEY)
      : null
  } catch {
    return null
  }
}

function readPrefersDark(): boolean {
  try {
    return Boolean(
      typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
    )
  } catch {
    return false
  }
}

export function applyThemeToDocument(theme: Theme) {
  if (typeof document === 'undefined') {
    return
  }
  const isDark = theme === 'dark'
  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.style.colorScheme = theme

  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) {
    meta.setAttribute('content', isDark ? DARK_THEME_COLOR : LIGHT_THEME_COLOR)
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    resolveInitialTheme(readStoredTheme(), readPrefersDark())
  )

  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (event: MediaQueryListEvent) => {
      if (!readStoredTheme()) {
        setTheme(event.matches ? 'dark' : 'light')
      }
    }
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // Ignore storage write errors (private browsing / quota)
      }
      return next
    })
  }, [])

  return { theme, setTheme, toggleTheme }
}
