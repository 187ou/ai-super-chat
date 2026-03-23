export type DailyStatKey = 'chatSessions' | 'codegenRuns' | 'debugRuns' | 'ragAnswers' | 'multimodalAnalyses'

type DailyStats = {
  date: string
  chatSessions: number
  codegenRuns: number
  debugRuns: number
  ragAnswers: number
  multimodalAnalyses: number
}

const STORAGE_KEY = 'ai_dev_assistant_daily_stats_v1'

function todayStr(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function emptyStats(): DailyStats {
  const date = todayStr()
  return {
    date,
    chatSessions: 0,
    codegenRuns: 0,
    debugRuns: 0,
    ragAnswers: 0,
    multimodalAnalyses: 0,
  }
}

function readStats(): DailyStats {
  if (typeof window === 'undefined') return emptyStats()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return emptyStats()
  try {
    const parsed = JSON.parse(raw) as Partial<DailyStats>
    const base = emptyStats()
    const date = typeof parsed.date === 'string' ? parsed.date : base.date
    const isSameDay = date === base.date
    return {
      date: base.date,
      chatSessions: isSameDay ? Number(parsed.chatSessions ?? 0) : 0,
      codegenRuns: isSameDay ? Number(parsed.codegenRuns ?? 0) : 0,
      debugRuns: isSameDay ? Number(parsed.debugRuns ?? 0) : 0,
      ragAnswers: isSameDay ? Number(parsed.ragAnswers ?? 0) : 0,
      multimodalAnalyses: isSameDay ? Number(parsed.multimodalAnalyses ?? 0) : 0,
    }
  } catch {
    return emptyStats()
  }
}

function writeStats(stats: DailyStats): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
}

export function getTodayStats(): DailyStats {
  return readStats()
}

export function bumpTodayStat(key: DailyStatKey, by = 1): void {
  const stats = readStats()
  const n = Number(stats[key] ?? 0) + by
  const next = { ...stats, [key]: n } as DailyStats
  writeStats(next)
}

