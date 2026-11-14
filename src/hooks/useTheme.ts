import { useEffect, useState } from 'react'

// 'bespoke' matches the client's own site (ratrust.org): cream, maroon, serif.
export type Theme = 'light' | 'dark' | 'bespoke' | 'system'

const STORAGE_KEY = 'picaloco-theme'

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'bespoke') return stored
  } catch {
    // localStorage unavailable (private browsing, etc.) — fall through to system default
  }
  return 'system'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  const setTheme = (next: Theme) => {
    setThemeState(next)
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore — theme still applies for this session via state
    }
  }

  return { theme, setTheme }
}
