export type AssistantContextItem = {
  id: string
  source: string
  route: string
  title: string
  content: string
  createdAt: number
}

const STORAGE_KEY = 'ai_dev_assistant_recent_context_v1'
const MAX_ITEMS = 8

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function readList(): AssistantContextItem[] {
  if (typeof window === 'undefined') return []
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const arr = JSON.parse(raw) as AssistantContextItem[]
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x) => x && typeof x.content === 'string')
      .slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

function writeList(list: AssistantContextItem[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)))
}

export function pushAssistantContext(input: {
  source: string
  route: string
  title: string
  content: string
}) {
  const text = input.content.trim()
  if (!text) return
  const next: AssistantContextItem = {
    id: uid(),
    source: input.source,
    route: input.route,
    title: input.title,
    content: text.length > 2000 ? `${text.slice(0, 2000)}...` : text,
    createdAt: Date.now(),
  }
  const rest = readList().filter((x) => !(x.route === next.route && x.source === next.source))
  writeList([next, ...rest])
}

export function getRecentAssistantContexts(limit = 4): AssistantContextItem[] {
  return readList().slice(0, Math.max(1, Math.min(8, limit)))
}
