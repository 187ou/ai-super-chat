import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import hljs from 'highlight.js'
import { Bug, Copy, FileUp, Loader2, Square, SquarePen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { extractCodeBlockListFromMarkdown, extractCodeBlocksFromMarkdown, streamCodegen } from '../lib/codegenStream'
import {
  loadWorkspace,
  type EditorFile,
  upsertGeneratedCodeBlocksToWorkspace,
  upsertGeneratedCodeToWorkspace,
} from '../lib/editorWorkspace'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import {
  composerCardClass,
  composerFooterOuterClass,
  composerInnerMaxClass,
  composerSectionLabelClass,
  composerTextareaCodeInnerClass,
  composerTextareaCompactScrollClass,
} from '../lib/pageStyles'
import { cn } from '../lib/utils'
import { bumpTodayStat } from '../lib/dailyStats'

const MAX_ATTACHMENT_CHARS = 20000

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

export default function DebugPage() {
  const navigate = useNavigate()

  const [code, setCode] = useState('useEffect(() => {\n  fetchData()\n}, [])')
  const [rawOutput, setRawOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const [fileAttachment, setFileAttachment] = useState<{ name: string; text: string } | null>(null)
  const [includeEditorFile, setIncludeEditorFile] = useState(false)
  const [editorAttachment, setEditorAttachment] = useState<{ path: string; text: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const codeBlockRef = useRef<HTMLElement>(null)

  const extractedBlocks = rawOutput ? extractCodeBlockListFromMarkdown(rawOutput) : []
  const extractedCode = rawOutput ? extractCodeBlocksFromMarkdown(rawOutput) : ''
  const displayForCopy = extractedCode || rawOutput

  useLayoutEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [loading, rawOutput])

  useLayoutEffect(() => {
    if (loading || !rawOutput || !codeBlockRef.current) return
    const el = codeBlockRef.current
    el.textContent = showFull ? rawOutput : displayForCopy || rawOutput
    el.removeAttribute('data-highlighted')
    el.className = cn(
      'block whitespace-pre font-mono text-xs leading-relaxed md:text-sm',
      showFull ? 'text-zinc-800 dark:text-zinc-100' : 'hljs language-typescript',
    )
    if (!showFull) {
      try {
        hljs.highlightElement(el)
      } catch {
        el.className = 'block whitespace-pre font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-sm'
      }
    }
  }, [loading, rawOutput, displayForCopy, showFull])

  function buildAttachmentsText() {
    const blocks: string[] = []
    if (fileAttachment?.text?.trim()) {
      const t =
        fileAttachment.text.length > MAX_ATTACHMENT_CHARS
          ? `${fileAttachment.text.slice(0, MAX_ATTACHMENT_CHARS)}\n\n（已截断，原始文件过长）`
          : fileAttachment.text
      blocks.push(`用户上传文件：${fileAttachment.name}\n文件内容：\n${t}`)
    }
    if (includeEditorFile && editorAttachment?.text?.trim()) {
      const t =
        editorAttachment.text.length > MAX_ATTACHMENT_CHARS
          ? `${editorAttachment.text.slice(0, MAX_ATTACHMENT_CHARS)}\n\n（已截断，代码过长）`
          : editorAttachment.text
      blocks.push(`在线编辑器当前文件：${editorAttachment.path}\n文件内容：\n${t}`)
    }
    return blocks.join('\n\n')
  }

  function onPickFile() {
    fileInputRef.current?.click()
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setFileAttachment({ name: file.name, text })
      toast.success('已读取文件内容')
    }
    reader.onerror = () => toast.error('读取文件失败')
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
      setEditorAttachment(null)
      toast.error('读取在线编辑器工作区失败')
    }
  }

  function openInEditor() {
    const codeForEditor = (displayForCopy || '').trim()
    if (!codeForEditor) {
      toast.error('当前没有可编辑的修复结果')
      return
    }
    if (extractedBlocks.length > 1) {
      upsertGeneratedCodeBlocksToWorkspace(extractedBlocks, 'debug-refactor')
      toast.success(`已拆分为 ${extractedBlocks.length} 个文件`)
    } else {
      upsertGeneratedCodeToWorkspace(codeForEditor, 'debug-refactor')
    }
    void navigate('/editor')
  }

  async function analyzeAndFix() {
    if (loading) return
    const value = code.trim()
    const attachmentsText = buildAttachmentsText()
    const effectivePrompt = value
      ? attachmentsText
        ? `${value}\n\n${attachmentsText}`
        : value
      : attachmentsText

    if (!effectivePrompt) return

    const ac = new AbortController()
    streamAbortRef.current = ac
    setLoading(true)
    setRawOutput('')
    setShowFull(false)

    let out = ''
    try {
      const prompt = `请做代码调试与修复，输出结构：\n1) 问题定位（按严重度）\n2) 修复建议\n3) 修复后代码（markdown 代码块）\n\n代码/上下文如下：\n${effectivePrompt}`
      for await (const chunk of streamCodegen({
        prompt,
        scenario: 'quality',
        signal: ac.signal,
      })) {
        out += chunk
        flushSync(() => setRawOutput(out))
      }
      toast.success('分析完成')
      bumpTodayStat('debugRuns', 1)
    } catch (error) {
      if (isAbortError(error)) {
        toast.message('已停止分析')
      } else {
        const message = error instanceof Error ? error.message : '未知异常'
        toast.error(`分析失败：${message}`)
      }
    } finally {
      streamAbortRef.current = null
      setLoading(false)
    }
  }

  function stopAnalyze() {
    streamAbortRef.current?.abort()
  }

  function onPromptKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (!loading) void analyzeAndFix()
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-zinc-700/70 dark:bg-zinc-900/90 dark:supports-[backdrop-filter]:bg-zinc-900/70 md:px-6">
          <div className="mx-auto flex w-full max-w-none flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              调试修复
            </span>
            {rawOutput && !loading && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  intent={showFull ? 'default' : 'outline'}
                  onClick={() => setShowFull((v) => !v)}
                >
                  {showFull ? '仅看代码块' : '查看完整回复'}
                </Button>
                <Button size="sm" intent="outline" type="button" onClick={openInEditor}>
                  <SquarePen className="mr-1.5 h-3.5 w-3.5" />
                  在线编辑
                </Button>
                <Button
                  size="sm"
                  intent="outline"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(displayForCopy || rawOutput)
                    toast.success(showFull ? '已复制完整内容' : '已复制修复代码')
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {showFull ? '复制全部' : '复制代码'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div ref={scrollRef} className={featureScrollBodyClass}>
          <div className="mx-auto flex w-full max-w-none flex-col gap-4">
            {rawOutput || loading ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <pre className="code-surface -mx-4 min-h-[min(360px,45vh)] flex-1 overflow-auto md:-mx-6">
                  {loading ? (
                    <code className="block whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100 md:p-6">
                      {rawOutput}
                      <span
                        className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-sm bg-violet-500 align-[-0.125em] dark:bg-violet-400"
                        aria-hidden
                      />
                    </code>
                  ) : (
                    <code ref={codeBlockRef as RefObject<HTMLElement>} className="block" />
                  )}
                </pre>
                {loading && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    流式分析中，可随时停止…
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200/90 bg-white/60 px-6 py-14 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                  <Bug className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">粘贴代码，获取检测与修复建议</p>
                <p className="max-w-md text-xs text-zinc-400 dark:text-zinc-500">
                  在下方输入源码后点击「分析并修复」
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            <p className={composerSectionLabelClass}>代码与问题</p>
            <div className={cn(composerCardClass, 'relative p-3')}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.json,.csv,.ts,.tsx,.js,.jsx"
                className="hidden"
                onChange={onFileChange}
              />
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" intent="outline" className="h-8 rounded-xl px-3" onClick={onPickFile} disabled={loading}>
                  <FileUp className="mr-1.5 h-3.5 w-3.5" />
                  上传文件
                </Button>
                {fileAttachment && (
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-200/80 bg-white/50 px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-700/70 dark:bg-zinc-900/30 dark:text-zinc-300">
                    <span className="max-w-[160px] truncate">{fileAttachment.name}</span>
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
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={onPromptKeyDown}
                placeholder="粘贴需要分析的 React/TS 代码，可附上报错信息或期望行为…"
                className={cn(
                  composerTextareaCodeInnerClass,
                  composerTextareaCompactScrollClass,
                  loading ? 'pr-28 pb-12' : 'pr-36 pb-12',
                )}
                disabled={loading}
              />

              {loading ? (
                <Button
                  type="button"
                  intent="outline"
                  className="absolute bottom-5 right-5 h-9 rounded-xl border-red-200/90 px-4 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={stopAnalyze}
                >
                  <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  停止
                </Button>
              ) : (
                <Button type="button" className="absolute bottom-5 right-5 h-9 rounded-xl px-4" onClick={() => void analyzeAndFix()}>
                  分析并修复
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}
