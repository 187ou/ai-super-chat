import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import hljs from 'highlight.js'
import { Copy, FileCode2, FileUp, ImagePlus, Loader2, Square, SquarePen, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { extractCodeBlockListFromMarkdown, extractCodeBlocksFromMarkdown, streamCodegen } from '../lib/codegenStream'
import { CODEGEN_SCENARIOS, getScenarioMeta, type CodegenScenarioId } from '../lib/codegenScenarios'
import { upsertGeneratedCodeBlocksToWorkspace, upsertGeneratedCodeToWorkspace } from '../lib/editorWorkspace'
import { bumpTodayStat } from '../lib/dailyStats'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
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

/** 与后端 express.json limit 协调；单张截图不宜过大 */
const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

export default function CodeGenPage() {
  const navigate = useNavigate()
  const [scenario, setScenario] = useState<CodegenScenarioId>('natural')
  const [prompt, setPrompt] = useState('生成一个带 Suspense 与 use() 的用户信息卡片组件，含加载态与错误边界说明')
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null)
  const [rawOutput, setRawOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFull, setShowFull] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const codeBlockRef = useRef<HTMLElement>(null)
  const screenshotInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_ATTACHMENT_CHARS = 20000
  const [fileAttachment, setFileAttachment] = useState<{ name: string; text: string } | null>(null)
  const [includeEditorFile, setIncludeEditorFile] = useState(false)
  const [editorAttachment, setEditorAttachment] = useState<{ path: string; text: string } | null>(null)

  const scenarioMeta = getScenarioMeta(scenario)

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

  function stopStreaming() {
    streamAbortRef.current?.abort()
  }

  function onPickScreenshotClick() {
    screenshotInputRef.current?.click()
  }

  function onScreenshotFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件（PNG / JPG / WebP / GIF）')
      return
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error(`图片需小于 ${Math.floor(MAX_SCREENSHOT_BYTES / 1024 / 1024)}MB`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') setScreenshotDataUrl(result)
      else toast.error('读取图片失败')
    }
    reader.onerror = () => toast.error('读取图片失败')
    reader.readAsDataURL(file)
  }

  function clearScreenshot() {
    setScreenshotDataUrl(null)
  }

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
    const code = (displayForCopy || '').trim()
    if (!code) {
      toast.error('当前没有可编辑的代码')
      return
    }
    const baseName = scenario === 'quality' ? 'quality-refactor' : scenario === 'explain' ? 'explained-code' : 'codegen-result'
    if (extractedBlocks.length > 1) {
      upsertGeneratedCodeBlocksToWorkspace(extractedBlocks, baseName)
      toast.success(`已拆分为 ${extractedBlocks.length} 个文件`)
    } else {
      upsertGeneratedCodeToWorkspace(code, baseName)
    }
    void navigate('/editor')
  }

  async function generate() {
    if (loading) return
    const value = prompt.trim()
    const attachmentsText = buildAttachmentsText()
    const effectivePrompt = value
      ? attachmentsText
        ? `${value}\n\n${attachmentsText}`
        : value
      : attachmentsText
    const isScreenshot = scenario === 'screenshot'
    if (isScreenshot) {
      if (!effectivePrompt && !screenshotDataUrl) {
        toast.error('请上传截图或附加文件/补充说明')
        return
      }
    } else if (!effectivePrompt) {
      return
    }

    const ac = new AbortController()
    streamAbortRef.current = ac
    setLoading(true)
    setRawOutput('')
    setShowFull(false)
    let out = ''
    try {
      for await (const chunk of streamCodegen({
        prompt: effectivePrompt,
        scenario,
        imageBase64: isScreenshot && screenshotDataUrl ? screenshotDataUrl : undefined,
        signal: ac.signal,
      })) {
        out += chunk
        flushSync(() => setRawOutput(out))
      }
      toast.success('生成完成')
      bumpTodayStat('codegenRuns', 1)
    } catch (error) {
      if (isAbortError(error)) {
        toast.message('已停止生成')
      } else {
        const message = error instanceof Error ? error.message : '未知异常'
        toast.error(`生成失败：${message}`)
      }
    } finally {
      streamAbortRef.current = null
      setLoading(false)
    }
  }

  function onPromptKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (!loading) void generate()
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-zinc-700/70 dark:bg-zinc-900/90 dark:supports-[backdrop-filter]:bg-zinc-900/70 md:px-6">
          <div className="mx-auto flex w-full max-w-none flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              AI 代码生成
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
                <Button
                  size="sm"
                  intent="outline"
                  type="button"
                  onClick={openInEditor}
                >
                  <SquarePen className="mr-1.5 h-3.5 w-3.5" />
                  在线编辑
                </Button>
                <Button
                  size="sm"
                  intent="outline"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(displayForCopy || rawOutput)
                    toast.success(showFull ? '已复制完整内容' : '已复制代码')
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {showFull ? '复制全部' : '复制代码'}
                </Button>
              </div>
            )}
          </div>
        </div>
        <div
          ref={scrollRef}
          className={featureScrollBodyClass}
        >
          <div className="mx-auto flex w-full max-w-none flex-col gap-4">
            {rawOutput || loading ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <pre className="code-surface -mx-4 min-h-[min(420px,50vh)] flex-1 overflow-auto md:-mx-6">
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
                  <p className="flex items-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    流式生成中，可随时停止…
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200/90 bg-white/60 px-6 py-14 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                  <FileCode2 className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">通义千问流式生成 React / TS 代码</p>
                <p className="max-w-md text-xs text-zinc-400 dark:text-zinc-500">
                  需本地启动代理 <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">pnpm dev:server</code> 并配置{' '}
                  <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">TONGYI_API_KEY</code>
                  ；失败时将使用本地降级模板。
                </p>
              </div>
            )}
          </div>
        </div>
        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            <p className={composerSectionLabelClass}>生成场景</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {CODEGEN_SCENARIOS.map((s) => {
                const Icon = s.icon
                const active = scenario === s.id
                return (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    intent={active ? 'default' : 'outline'}
                    className={cn(
                      'h-9 gap-1.5 rounded-xl px-3 text-xs',
                      active && 'shadow-sm',
                    )}
                    disabled={loading}
                    onClick={() => {
                      setScenario(s.id)
                      if (s.id !== 'screenshot') setScreenshotDataUrl(null)
                    }}
                    title={s.description}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {s.label}
                  </Button>
                )
              })}
            </div>
            <p className="mb-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {scenarioMeta.description}
            </p>

            {scenario === 'screenshot' && (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <input
                  ref={screenshotInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={onScreenshotFileChange}
                />
                <Button
                  type="button"
                  size="sm"
                  intent="outline"
                  className="h-9 gap-1.5 rounded-xl"
                  disabled={loading}
                  onClick={onPickScreenshotClick}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  {screenshotDataUrl ? '更换截图' : '上传 UI 截图'}
                </Button>
                {screenshotDataUrl && (
                  <div className="relative inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-1.5 pr-8 dark:border-zinc-600 dark:bg-zinc-900/50">
                    <img
                      src={screenshotDataUrl}
                      alt="截图预览"
                      className="max-h-20 max-w-[200px] rounded-lg object-contain"
                    />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-md p-0.5 text-zinc-500 hover:bg-zinc-200/80 hover:text-zinc-800 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                      onClick={clearScreenshot}
                      aria-label="移除截图"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className={composerSectionLabelClass}>
              {scenario === 'screenshot' ? '补充说明（可选）' : '需求描述'}
            </p>
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
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onPromptKeyDown}
                placeholder={scenarioMeta.placeholder}
                className={cn(
                  composerTextareaInnerClass,
                  composerTextareaCompactScrollClass,
                  loading ? 'pr-28 pb-12' : 'pr-32 pb-12',
                )}
                disabled={loading}
              />
              {loading ? (
                <Button
                  type="button"
                  intent="outline"
                  className="absolute bottom-5 right-5 h-9 rounded-xl border-red-200/90 px-4 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40"
                  onClick={stopStreaming}
                >
                  <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  停止
                </Button>
              ) : (
                <Button type="button" className="absolute bottom-5 right-5 h-9 rounded-xl px-4" onClick={() => void generate()}>
                  生成代码
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}
