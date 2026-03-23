import { useEffect, useState } from 'react'
import { getSettings, setSettings } from '../lib/storage'

export function useTheme() {
  const [darkMode, setDarkMode] = useState(getSettings().darkMode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    const settings = getSettings()
    setSettings({ ...settings, darkMode })
  }, [darkMode])

  return { darkMode, setDarkMode }
}
