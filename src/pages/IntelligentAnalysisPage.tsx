import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { AlertTriangle, Brain, Copy, Download, Loader2, RefreshCw, SearchCheck, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import { MarkdownMessage } from '../components/common/MarkdownMessage'
import { streamChat } from '../lib/ai'
import { composerCardClass, composerFooterOuterClass, composerInnerMaxClass, composerSectionLabelClass, composerTextareaCompactScrollClass } from '../lib/pageStyles'
import { buildForecastChartOption, detectAlerts, mockLast30Days } from '../lib/intelligentAnalysis'
import { pushAssistantContext } from '../lib/assistantContext'

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

export default function IntelligentAnalysisPage() {
  const [history, setHistory] = useState(() => mockLast30Days())
  const forecastOption = useMemo(() => buildForecastChartOption(history), [history])
  const [alerts, setAlerts] = useState(() => detectAlerts(history))
  const [alertFilter, setAlertFilter] = useState<'all' | 'critical' | 'warning'>('all')
  const [prompt, setPrompt] = useState('昨天调用量下降明显，且响应时间升高，请给出根因分析与归因报告。')
  const [analysis, setAnalysis] = useState('')
  const [loading, setLoading] = useState(false)
  const [abortRef, setAbortRef] = useState<AbortController | null>(null)

  const quickPrompts = [
    '为什么昨天调用量下降？请给出根因和可验证证据。',
    '请分析最近一周高延迟的主因，并给出修复优先级。',
    '对比不同用户来源，找出导致错误率上升的关键归因因素。',
    '预测下周峰值调用量并给出容量规划建议。',
  ]

  const filteredAlerts = useMemo(() => {
    if (alertFilter === 'all') return alerts
    return alerts.filter((a) => a.level === alertFilter)
  }, [alerts, alertFilter])

  function refreshSampleData() {
    if (loading) return
    const next = mockLast30Days()
    setHistory(next)
    setAlerts(detectAlerts(next))
    toast.success('已刷新历史样本数据')
  }

  function copyAnalysis() {
    if (!analysis.trim()) {
      toast.error('暂无可复制的分析报告')
      return
    }
    void navigator.clipboard.writeText(analysis)
    toast.success('已复制分析报告')
  }

  function downloadAnalysis() {
    if (!analysis.trim()) {
      toast.error('暂无可下载的分析报告')
      return
    }
    const content = `# 智能预测与分析报告\n\n生成时间：${new Date().toLocaleString()}\n\n${analysis}\n`
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `intelligent-analysis-${Date.now()}.md`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('已下载分析报告')
  }

  async function runAnalysis() {
    if (loading) return
    const q = prompt.trim()
    if (!q) {
      toast.error('请输入分析问题')
      return
    }
    const ac = new AbortController()
    setAbortRef(ac)
    setLoading(true)
    setAnalysis('')

    const metricsText = history
      .map((d) => `${d.day}: calls=${d.calls}, latency=${d.latencyMs}ms, error=${d.errorRate}%`)
      .join('\n')
    const alertText = alerts.map((a) => `[${a.level}] ${a.day} ${a.title}: ${a.detail}`).join('\n')

    const ask = [
      '你是 SRE + 数据分析专家。请基于以下指标完成：',
      '1) 根因分析（按概率排序）',
      '2) 智能归因分析（时间段、接口类型、用户来源等维度的可疑因素）',
      '3) 修复建议（立即/短期/长期）',
      '',
      `用户问题：${q}`,
      '',
      '历史指标（最近30天）：',
      metricsText,
      '',
      '检测到的异常：',
      alertText || '无',
      '',
      '请用中文、结构化小标题输出。',
    ].join('\n')

    try {
      let out = ''
      for await (const chunk of streamChat({ prompt: ask, history: [], signal: ac.signal })) {
        out += chunk
        setAnalysis(out)
      }
      const nextAlerts = detectAlerts(history)
      setAlerts(nextAlerts)
      pushAssistantContext({
        source: 'intelligent-analysis',
        route: '/intelligent-analysis',
        title: `智能分析：${q.slice(0, 24)}`,
        content: out,
      })
      toast.success('分析完成')
    } catch (e) {
      if (isAbortError(e)) toast.message('已停止分析')
      else {
        const msg = e instanceof Error ? e.message : '未知异常'
        toast.error(`分析失败：${msg}`)
      }
    } finally {
      setAbortRef(null)
      setLoading(false)
    }
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 px-4 py-2 dark:border-zinc-700/70 dark:bg-zinc-900/90 md:px-6">
          <div className="mx-auto flex w-full max-w-none items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              智能预测与分析
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" intent="outline" type="button" onClick={refreshSampleData} disabled={loading}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                刷新样本
              </Button>
              <Button size="sm" intent="outline" type="button" onClick={copyAnalysis}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                复制报告
              </Button>
              <Button size="sm" intent="outline" type="button" onClick={downloadAnalysis}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                下载报告
              </Button>
            </div>
          </div>
        </div>

        <div className={featureScrollBodyClass}>
          <div className="mx-auto flex w-full max-w-none flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-2 -mx-4 dark:border-zinc-800/80 dark:bg-zinc-950/40 md:-mx-6">
              <ReactECharts option={forecastOption} notMerge style={{ height: 380, width: '100%' }} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    异常检测与告警
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border border-zinc-200/80 bg-white/70 p-1 dark:border-zinc-700/70 dark:bg-zinc-900/40">
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-[11px] ${alertFilter === 'all' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-300'}`}
                      onClick={() => setAlertFilter('all')}
                    >
                      全部
                    </button>
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-[11px] ${alertFilter === 'critical' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-300'}`}
                      onClick={() => setAlertFilter('critical')}
                    >
                      严重
                    </button>
                    <button
                      type="button"
                      className={`rounded px-2 py-1 text-[11px] ${alertFilter === 'warning' ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-300'}`}
                      onClick={() => setAlertFilter('warning')}
                    >
                      警告
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {filteredAlerts.length === 0 ? (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">暂无异常</p>
                  ) : (
                    filteredAlerts.map((a) => (
                      <div
                        key={a.id}
                        className={`rounded-lg border px-3 py-2 text-xs ${
                          a.level === 'critical'
                            ? 'border-red-200 bg-red-50/60 text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'
                            : 'border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300'
                        }`}
                      >
                        <p className="font-semibold">{a.day} · {a.title}</p>
                        <p className="mt-1">{a.detail}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <Brain className="h-4 w-4 text-violet-500" />
                  根因分析 + 智能归因
                </div>
                <div className="max-h-[320px] overflow-auto rounded-lg border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-700/70 dark:bg-zinc-900/40">
                  {analysis ? (
                    <MarkdownMessage content={analysis} />
                  ) : (
                    <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                      点击下方“开始分析”，AI 会基于异常与历史指标给出根因和归因报告。
                    </p>
                  )}
                </div>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <TrendingUp className="h-4 w-4 text-indigo-500" />
                  趋势预测
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  基于过去 30 天指标预测未来 7 天走势，图中叠加预测中位线与置信区间，辅助容量规划。
                </p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  <SearchCheck className="h-4 w-4 text-emerald-500" />
                  异常时段快速定位
                </div>
                <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                  当响应时间飙升、错误率上升、调用量骤降时，系统自动给出告警和初步原因提示。
                </p>
              </Card>
            </div>
          </div>
        </div>

        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            <p className={composerSectionLabelClass}>分析问题</p>
            <div className="flex flex-wrap gap-2">
              {quickPrompts.map((q) => (
                <button
                  key={q}
                  type="button"
                  className="rounded-lg border border-zinc-200/80 bg-white/70 px-2.5 py-1.5 text-[11px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700/70 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                  onClick={() => setPrompt(q)}
                  disabled={loading}
                >
                  {q}
                </button>
              ))}
            </div>
            <div className={`${composerCardClass} relative p-3`}>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                  e.preventDefault()
                  if (!loading) void runAnalysis()
                }}
                className={`${composerTextareaCompactScrollClass} ${loading ? 'pr-28 pb-12' : 'pr-36 pb-12'}`}
                placeholder="例如：为什么昨天调用量下降？根因是什么？如何修复？"
              />
              {loading ? (
                <Button
                  type="button"
                  intent="outline"
                  className="absolute bottom-5 right-5 h-9 rounded-xl border-red-200/90 px-4 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={() => abortRef?.abort()}
                >
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  停止分析
                </Button>
              ) : (
                <Button
                  type="button"
                  className="absolute bottom-5 right-5 h-9 rounded-xl px-4"
                  onClick={() => void runAnalysis()}
                >
                  开始分析
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}

