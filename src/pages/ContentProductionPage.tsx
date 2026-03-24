import { useState } from 'react'
import { Copy, Download, FileText, Loader2, Square } from 'lucide-react'
import { jsPDF } from 'jspdf'
import { toast } from 'sonner'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import { streamChat } from '../lib/ai'
import { pushAssistantContext } from '../lib/assistantContext'
import {
  composerCardClass,
  composerFooterOuterClass,
  composerInnerMaxClass,
  composerSectionLabelClass,
  composerTextareaCompactScrollClass,
} from '../lib/pageStyles'

type Mode = 'tech-doc' | 'blog' | 'comment' | 'ppt' | 'tutorial'

type ModeConfig = {
  id: Mode
  label: string
  promptHeader: string
  placeholder: string
}

const MODES: ModeConfig[] = [
  {
    id: 'tech-doc',
    label: 'AI 写技术文档',
    promptHeader: '请生成结构化技术文档，包含背景、设计、实现细节、风险、验收标准。',
    placeholder: '输入项目背景、技术栈、目标读者、文档重点...',
  },
  {
    id: 'blog',
    label: 'AI 生成博客',
    promptHeader: '请生成技术博客，包含标题建议、摘要、小节结构和结论。',
    placeholder: '输入博客主题、受众、语气、示例素材...',
  },
  {
    id: 'comment',
    label: 'AI 生成注释',
    promptHeader: '请为给定代码生成清晰注释，优先解释意图、边界条件和关键逻辑。',
    placeholder: '粘贴代码并说明需要注释的语言风格（如 JSDoc / 行内注释）...',
  },
  {
    id: 'ppt',
    label: 'AI 生成 PPT 大纲',
    promptHeader: '请生成可演讲的 PPT 大纲，包含封面、目录、每页核心要点与备注。',
    placeholder: '输入汇报主题、对象、时长、重点结论...',
  },
  {
    id: 'tutorial',
    label: 'AI 生成教程、手册',
    promptHeader: '请生成教程/手册，包含前置条件、步骤、常见问题、排障和最佳实践。',
    placeholder: '输入产品/工具名称、读者层级、教学目标...',
  },
]

function toPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, (m) => m.replace(/`{3}.*\n?/g, '').replace(/`{3}/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, (s) => s)
    .trim()
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function ContentProductionPage() {
  const [mode, setMode] = useState<Mode>('tech-doc')
  const [prompt, setPrompt] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [abortRef, setAbortRef] = useState<AbortController | null>(null)

  const active = MODES.find((m) => m.id === mode) ?? MODES[0]
  const plainOutput = toPlainText(output)

  async function generate() {
    if (loading) return
    const q = prompt.trim()
    if (!q) {
      toast.error('请输入内容需求')
      return
    }
    const ac = new AbortController()
    setAbortRef(ac)
    setLoading(true)
    setOutput('')
    const ask = `${active.promptHeader}\n\n用户需求：${q}\n\n请输出中文 Markdown。`

    try {
      let out = ''
      for await (const chunk of streamChat({ prompt: ask, history: [], signal: ac.signal })) {
        out += chunk
        setOutput(out)
      }
      pushAssistantContext({
        source: 'content-production',
        route: '/content-production',
        title: active.label,
        content: out,
      })
      toast.success('内容生成完成')
    } catch (e) {
      if (isAbortError(e)) toast.message('已停止生成')
      else {
        const msg = e instanceof Error ? e.message : '未知异常'
        toast.error(`生成失败：${msg}`)
      }
    } finally {
      setAbortRef(null)
      setLoading(false)
    }
  }

  function exportMarkdown() {
    if (!output.trim()) return toast.error('暂无可导出的内容')
    downloadBlob(output, `content-${mode}-${Date.now()}.md`, 'text/markdown;charset=utf-8')
    toast.success('已导出 Markdown')
  }

  function exportWord() {
    if (!output.trim()) return toast.error('暂无可导出的内容')
    const word = `<!doctype html><html><head><meta charset="utf-8"/></head><body><pre>${output
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')}</pre></body></html>`
    downloadBlob(word, `content-${mode}-${Date.now()}.doc`, 'application/msword;charset=utf-8')
    toast.success('已导出 Word')
  }

  function exportPdf() {
    if (!output.trim()) return toast.error('暂无可导出的内容')
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    const lines = doc.splitTextToSize(output, 520)
    let y = 48
    for (const line of lines) {
      if (y > 790) {
        doc.addPage()
        y = 48
      }
      doc.text(String(line), 40, y)
      y += 18
    }
    doc.save(`content-${mode}-${Date.now()}.pdf`)
    toast.success('已导出 PDF')
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 px-4 py-2 dark:border-zinc-700/70 dark:bg-zinc-900/90 md:px-6">
          <div className="mx-auto flex w-full max-w-none items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              内容生产
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" intent="outline" type="button" onClick={() => void navigator.clipboard.writeText(output)} disabled={!output.trim()}>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                复制
              </Button>
              <Button size="sm" intent="outline" type="button" onClick={exportMarkdown} disabled={!output.trim()}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                导出 Markdown
              </Button>
              <Button size="sm" intent="outline" type="button" onClick={exportWord} disabled={!output.trim()}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                导出 Word
              </Button>
              <Button size="sm" intent="outline" type="button" onClick={exportPdf} disabled={!output.trim()}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                导出 PDF
              </Button>
            </div>
          </div>
        </div>

        <div className={featureScrollBodyClass}>
          <div className="mx-auto flex w-full max-w-none flex-col gap-4">
            {output || loading ? (
              <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-700/60 dark:bg-zinc-950/40">
                {loading && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    正在生成...
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
                  {plainOutput}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200/90 bg-white/60 px-6 py-14 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">选择内容类型并输入需求，AI 自动生成可导出文档</p>
              </div>
            )}
          </div>
        </div>

        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            <p className={composerSectionLabelClass}>内容类型</p>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => (
                <Button
                  key={m.id}
                  type="button"
                  size="sm"
                  intent={m.id === mode ? 'default' : 'outline'}
                  onClick={() => setMode(m.id)}
                  disabled={loading}
                >
                  {m.label}
                </Button>
              ))}
            </div>
            <p className={composerSectionLabelClass}>需求描述</p>
            <div className={`${composerCardClass} relative p-3`}>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
                  e.preventDefault()
                  if (!loading) void generate()
                }}
                className={`${composerTextareaCompactScrollClass} ${loading ? 'pr-28 pb-12' : 'pr-32 pb-12'}`}
                placeholder={active.placeholder}
                disabled={loading}
              />
              {loading ? (
                <Button
                  type="button"
                  intent="outline"
                  className="absolute bottom-5 right-5 h-9 rounded-xl border-red-200/90 px-4 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={() => abortRef?.abort()}
                >
                  <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  停止
                </Button>
              ) : (
                <Button type="button" className="absolute bottom-5 right-5 h-9 rounded-xl px-4" onClick={() => void generate()}>
                  生成内容
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}
