import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Gauge, Layers, TextSearch, Wand2 } from 'lucide-react'
import { Card } from '../components/ui/card'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { SectionLabel } from '../components/common/SectionLabel'
import { pageTitleH3ClassName } from '../lib/pageStyles'
import { loadWorkspace } from '../lib/editorWorkspace'
import { getTodayStats } from '../lib/dailyStats'

function RingGauge({ value, max, color }: { value: number; max: number; color: string }) {
  const percent = Math.max(0, Math.min(1, value / max))
  const r = 30
  const c = 2 * Math.PI * r
  const dash = c * percent
  const gap = c - dash
  return (
    <div className="relative h-[92px] w-[92px]">
      <svg className="absolute inset-0" viewBox="0 0 80 80" role="img" aria-label={`${value}/${max}`}>
        <circle cx="40" cy="40" r={r} stroke="rgba(0,0,0,0.06)" strokeWidth="7" fill="none" />
        <circle
          cx="40"
          cy="40"
          r={r}
          stroke={color}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{value}</div>
        <div className="text-[10px] text-zinc-500 dark:text-zinc-400">/ {max}</div>
      </div>
    </div>
  )
}

function QuickStats({
  editorFiles,
  snapshotCount,
  chatSessions,
  codegenRuns,
  debugRuns,
  ragAnswers,
  multimodalAnalyses,
}: {
  editorFiles: number | null
  snapshotCount: number | null
  chatSessions: number
  codegenRuns: number
  debugRuns: number
  ragAnswers: number
  multimodalAnalyses: number
}) {
  const stats = [
    { label: '今日会话', value: chatSessions, max: 30, color: '#8b5cf6' },
    { label: '生成代码片段', value: codegenRuns, max: 60, color: '#6366f1' },
    { label: '自动修复建议', value: debugRuns, max: 25, color: '#22c55e' },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <Card className="relative overflow-hidden rounded-3xl border-zinc-200/80 bg-gradient-to-b from-white/70 via-white/55 to-white/40 p-7 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.25)] backdrop-blur dark:border-zinc-700/60 dark:from-zinc-950/60 dark:via-zinc-950/45 dark:to-zinc-950/30">
        <div className="pointer-events-none absolute -right-28 -top-20 h-72 w-72 rounded-full bg-zinc-900/[0.06] blur-2xl dark:bg-white/[0.05]" aria-hidden />
        <div className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-zinc-900/[0.04] blur-2xl dark:bg-white/[0.035]" aria-hidden />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {/*系统概览*/}
            <p className="mt-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">今日运行指标</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-300">基于本地使用记录自动统计（刷新不丢失）</p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/60 px-4 py-2 text-xs text-zinc-600 dark:border-zinc-700/60 dark:bg-zinc-900/40 dark:text-zinc-300">
            <Gauge className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
            <span>状态：良好</span>
          </div>
        </div>

        <div className="relative mt-6 grid gap-6 sm:grid-cols-3">
          {stats.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-2">
              <RingGauge value={item.value} max={item.max} color={item.color} />
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{item.label}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 content-start">
        <MiniStat
          icon={<Wand2 className="h-5 w-5" />}
          title="在线编辑器文件"
          value={editorFiles ?? '-'}
          hint="来自本地工作区"
        />
        <MiniStat
          icon={<Activity className="h-5 w-5" />}
          title="编辑器快照"
          value={snapshotCount ?? '-'}
          hint="用于回滚恢复"
        />
        <MiniStat
          icon={<TextSearch className="h-5 w-5" />}
          title="RAG 回答次数"
          value={ragAnswers}
          hint="今日知识库问答"
        />
        <MiniStat
          icon={<Layers className="h-5 w-5" />}
          title="多模态分析次数"
          value={multimodalAnalyses}
          hint="今日截图理解"
        />
      </div>
    </div>
  )
}

function MiniStat({
  icon,
  title,
  value,
  hint,
}: {
  icon: ReactNode
  title: string
  value: number | string
  hint: string
}) {
  return (
    <Card className="rounded-2xl border-zinc-200/80 bg-white/60 p-5 dark:border-zinc-700/60 dark:bg-zinc-900/40">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{title}</p>
          <p className="mt-2 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{value}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
        </div>
      </div>
    </Card>
  )
}

const entries = [
  { to: '/chat', title: 'AI 智能聊天', desc: '流式对话 + 代码/建议输出' },
  { to: '/rag', title: 'RAG 知识库检索', desc: '上传文档 · 基于内容问答' },
  { to: '/codegen', title: 'React 19 代码生成', desc: '组件 / Hook / 页面模板' },
  { to: '/editor', title: '在线编辑器', desc: 'Monaco · 多文件 · 快照 · 格式化' },
  { to: '/apidoc', title: '接口文档自动生成', desc: 'RESTful + Swagger 规范' },
  { to: '/charts', title: 'NLP 转 ECharts', desc: '折线 / 柱状 / 饼图 / 雷达图' },
  { to: '/debug', title: '调试修复', desc: '质量保证 · 分析并给出修复方案' },
  { to: '/multimodal', title: '多模态', desc: '上传截图 · 视觉理解与输出' },
]

export default function DashboardPage() {
  const ws = useMemo(() => {
    try {
      return loadWorkspace()
    } catch {
      return null
    }
  }, [])

  const todayStats = useMemo(() => {
    try {
      return getTodayStats()
    } catch {
      return null
    }
  }, [])

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <div className={featureScrollBodyClass}>
          <div className="mx-auto w-full max-w-none space-y-8 pb-2">
            <section className="space-y-5">
              <SectionLabel>数据概览</SectionLabel>
              <QuickStats
                editorFiles={ws ? ws.files.length : null}
                snapshotCount={ws ? ws.history.length : null}
                chatSessions={todayStats?.chatSessions ?? 0}
                codegenRuns={todayStats?.codegenRuns ?? 0}
                debugRuns={todayStats?.debugRuns ?? 0}
                ragAnswers={todayStats?.ragAnswers ?? 0}
                multimodalAnalyses={todayStats?.multimodalAnalyses ?? 0}
              />
            </section>
            <section className="space-y-5">
              <SectionLabel>快捷入口</SectionLabel>
              <div className="grid gap-4 md:grid-cols-2">
                {entries.map((entry) => (
                  <Link
                    key={entry.to}
                    to={entry.to}
                    className="group block outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 dark:focus-visible:ring-white/20"
                  >
                    <Card className="h-full p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-300/90 hover:shadow-md dark:hover:border-zinc-600/90">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className={pageTitleH3ClassName}>{entry.title}</h3>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-300">{entry.desc}</p>
                        </div>
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900/[0.04] text-zinc-500 transition-colors group-hover:bg-zinc-900/[0.06] dark:bg-white/[0.05]">
                          <span className="text-lg font-semibold">→</span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}
