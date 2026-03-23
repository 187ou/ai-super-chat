import type { AppSettings, Conversation } from '../types'

const SETTINGS_KEY = 'ai_dev_assistant_settings'
const CONVERSATIONS_KEY = 'ai_dev_assistant_conversations'

const defaultSettings: AppSettings = {
  darkMode: true,
  codeTheme: 'github-dark',
  authRequired: false,
  mockMode: true,
  model: 'qwen-plus',
}

export function getSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY)
  if (!raw) return defaultSettings
  try {
    return { ...defaultSettings, ...(JSON.parse(raw) as Partial<AppSettings>) }
  } catch {
    return defaultSettings
  }
}

export function setSettings(next: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
}

export function getConversations(): Conversation[] {
  const raw = localStorage.getItem(CONVERSATIONS_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw) as Conversation[]
  } catch {
    return []
  }
}

export function setConversations(conversations: Conversation[]): void {
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
}

export async function syncConversationsToCloud(conversations: Conversation[]): Promise<void> {
  const endpoint = import.meta.env.VITE_CLOUD_CACHE_ENDPOINT as string | undefined
  if (!endpoint) return
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversations }),
  })
}
