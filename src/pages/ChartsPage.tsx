import { useRef, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import type { EChartsOption } from 'echarts'
import { toast } from 'sonner'
import { Copy, Download, FileUp, Loader2, Trash2 } from 'lucide-react'
import { streamChat } from '../lib/ai'
import { beautifyChartOption, fromNaturalLanguageToChartOption } from '../lib/echarts'
import {
  composerCardClass,
  composerFooterOuterClass,
  composerInnerMaxClass,
  composerSectionLabelClass,
  composerTextareaCompactScrollClass,
  composerTextareaInnerClass,
} from '../lib/pageStyles'
import { cn } from '../lib/utils'
import { loadWorkspace, type EditorFile } from '../lib/editorWorkspace'

export default function ChartsPage() {
  const [input, setInput] = useState('生成一张展示本周访问趋势的折线图')
  const [option, setOption] = useState<EChartsOption>(fromNaturalLanguageToChartOption(input))
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const chartRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_ATTACHMENT_CHARS = 20000
  const [fileAttachment, setFileAttachment] = useState<{ name: string; text: string } | null>(null)
  const [includeEditorFile, setIncludeEditorFile] = useState(false)
  const [editorAttachment, setEditorAttachment] = useState<{ path: string; text: string } | null>(null)

  function extractJsonOption(text: string): EChartsOption | null {
    const re = /```(?:json)?\s*\n?([\s\S]*?)```/i
    const m = text.trim().match(re)
    const candidate = (m?.[1]?.trim() ?? text.trim()).trim()
    try {
      return JSON.parse(candidate) as EChartsOption
    } catch {
      return null
    }
  }

  async function generateChart() {
    const value = input.trim()
    if (!value || loading) return

    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)

    const attachments: string[] = []
    if (fileAttachment?.text?.trim()) {
      const t =
        fileAttachment.text.length > MAX_ATTACHMENT_CHARS
          ? `${fileAttachment.text.slice(0, MAX_ATTACHMENT_CHARS)}\n\n（已截断，原始文件过长）`
          : fileAttachment.text
      attachments.push(`用户上传文件：${fileAttachment.name}\n文件内容：\n${t}`)
    }
    if (includeEditorFile && editorAttachment?.text?.trim()) {
      const t =
        editorAttachment.text.length > MAX_ATTACHMENT_CHARS
          ? `${editorAttachment.text.slice(0, MAX_ATTACHMENT_CHARS)}\n\n（已截断，代码过长）`
          : editorAttachment.text
      attachments.push(`在线编辑器当前文件：${editorAttachment.path}\n文件内容：\n${t}`)
    }

    let out = ''
    try {
      const prompt = `请将下面需求转换成 ECharts 的 option 配置 JSON（ECharts 5）。
要求：
1. 只输出一个 \`\`\`json ... \`\`\` 代码块。
2. JSON 内容必须是可直接传给 echarts 的 option 对象（不要包含额外字段）。
3. 不要输出任何解释性文字。
4. 可根据需求选择合适图表：甘特图、燃尽图、看板流转图、累积流量图(CFD)、代码覆盖率柱状图、缺陷趋势折线图、代码复杂度雷达图，以及折线/柱状/饼图/雷达/结构关系图/高级分析图/性能监控图。
5. 如果附件提供了数据/指标/任务/缺陷等信息，请优先从附件中提取并生成图表。
需求：${value}${attachments.length ? `\n\n${attachments.join('\n\n')}` : ''}`

      for await (const chunk of streamChat({
        prompt,
        history: [],
        signal: ac.signal,
      })) {
        out += chunk
      }

      const parsed = extractJsonOption(out)
      if (parsed) {
        setOption(beautifyChartOption(parsed))
        toast.success('生成图表完成')
      } else {
        toast.error('解析 option JSON 失败，将使用本地示例')
        setOption(fromNaturalLanguageToChartOption(value))
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        toast.message('已停止生成')
      } else {
        const msg = e instanceof Error ? e.message : '未知异常'
        toast.error(`生成失败：${msg}`)
        setOption(fromNaturalLanguageToChartOption(value))
      }
    } finally {
      abortRef.current = null
      setLoading(false)
    }
  }

  function stopGenerate() {
    abortRef.current?.abort()
  }

  function downloadPng() {
    try {
      const ins = chartRef.current?.getEchartsInstance?.()
      if (!ins?.getDataURL) throw new Error('ECharts 实例不可用')
      const url = ins.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' })
      const a = document.createElement('a')
      a.href = url
      a.download = 'chart.png'
      a.click()
      toast.success('已下载图片')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '导出失败'
      toast.error(msg)
    }
  }

  function copyOptionJson() {
    try {
      void navigator.clipboard.writeText(JSON.stringify(option ?? {}, null, 2))
      toast.success('已复制 option JSON')
    } catch {
      toast.error('复制失败')
    }
  }

  function onPickFile() {
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // allow re-pick same file
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setFileAttachment({ name: file.name, text })
      toast.success('已读取文件内容')
    }
    reader.onerror = () => toast.error('读取文件失败')
    // Only text-based attachments are supported in this UI.
    reader.readAsText(file)
  }

  function clearFileAttachment() {
    setFileAttachment(null)
  }

  function toggleEditorAttachment(next: boolean) {
    setIncludeEditorFile(next)
    if (!next) {
      setEditorAttachment(null)
      return
    }
    try {
      const ws = loadWorkspace()
      const active: EditorFile | undefined = ws.files.find((f) => f.id === ws.activeId)
      if (!active) {
        setEditorAttachment(null)
        toast.error('在线编辑器没有可用的激活文件')
        return
      }
      setEditorAttachment({ path: active.path, text: active.content })
      toast.success('已附加在线编辑器当前文件')
    } catch {
      toast.error('读取在线编辑器工作区失败')
    }
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-zinc-700/70 dark:bg-zinc-900/90 dark:supports-[backdrop-filter]:bg-zinc-900/70 md:px-6">
          <div className="mx-auto flex w-full max-w-none flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              可视化
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                intent="outline"
                className="h-8 rounded-xl px-3"
                onClick={downloadPng}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                导出 PNG
              </Button>
              <Button
                type="button"
                size="sm"
                intent="outline"
                className="h-8 rounded-xl px-3"
                onClick={copyOptionJson}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                复制 JSON
              </Button>
            </div>
          </div>
        </div>
        <div className={featureScrollBodyClass}>
          <div className="mx-auto flex w-full max-w-none flex-col gap-3">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-2 -mx-4 dark:border-zinc-800/80 dark:bg-zinc-950/40 md:-mx-6">
                <ReactECharts
                  ref={chartRef}
                  option={option}
                  notMerge
                  style={{ height: 400, minHeight: 280, width: '100%' }}
                />
              </div>

              {loading ? (
                <p className="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  流式生成图表中，可随时停止…
                </p>
              ) : (
                <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
                  支持甘特/燃尽/看板/累积流量/覆盖率/缺陷趋势/复杂度雷达等工程管理与质量分析图
                </p>
              )}
            </div>
          </div>
        </div>
        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            <p className={composerSectionLabelClass}>图表描述</p>
            <div className={cn(composerCardClass, 'relative p-3')}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx"
                className="hidden"
                onChange={onFileChange}
              />
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  intent="outline"
                  className="h-8 rounded-xl px-3"
                  onClick={onPickFile}
                  disabled={loading}
                >
                  <FileUp className="mr-1.5 h-3.5 w-3.5" />
                  上传文件
                </Button>
                {fileAttachment && (
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white/50 px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-700/70 dark:bg-zinc-900/30 dark:text-zinc-300">
                    <span className="max-w-[180px] truncate">{fileAttachment.name}</span>
                    <Button
                      type="button"
                      size="sm"
                      intent="ghost"
                      className="h-7 rounded-lg px-2"
                      onClick={clearFileAttachment}
                      disabled={loading}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <Button
                  type="button"
                  size="sm"
                  intent={includeEditorFile ? 'default' : 'outline'}
                  className="h-8 rounded-xl px-3"
                  onClick={() => toggleEditorAttachment(!includeEditorFile)}
                  disabled={loading}
                >
                  {includeEditorFile ? '已附加编辑器文件' : '附加编辑器文件'}
                </Button>
              </div>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                  e.preventDefault()
                  void generateChart()
                }}
                placeholder="用自然语言描述图表类型、数据维度、标题与配色偏好…"
                className={cn(
                  composerTextareaInnerClass,
                  composerTextareaCompactScrollClass,
                  'pr-32 pb-12',
                )}
                disabled={loading}
              />
              {loading ? (
                <Button
                  type="button"
                  intent="outline"
                  className="absolute bottom-5 right-5 h-9 rounded-xl border-red-200/90 px-4 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={stopGenerate}
                >
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  停止
                </Button>
              ) : (
                <Button
                  type="button"
                  className="absolute bottom-5 right-5 h-9 rounded-xl px-4"
                  onClick={() => void generateChart()}
                >
                  生成图表
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}
