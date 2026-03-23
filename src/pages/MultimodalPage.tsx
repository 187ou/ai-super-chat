import { useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import hljs from 'highlight.js'
import {
  Copy,
  FileCode2,
  ImagePlus,
  Loader2,
  Square,
  SquarePen,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { extractCodeBlockListFromMarkdown, streamCodegen } from '../lib/codegenStream'
import type { CodegenScenarioId } from '../lib/codegenScenarios'
import { upsertGeneratedCodeBlocksToWorkspace } from '../lib/editorWorkspace'
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
import { bumpTodayStat } from '../lib/dailyStats'

/** 单张图片 base64 体积控制，避免超出后端 express.json limit */
const MAX_SCREENSHOT_BYTES = 6 * 1024 * 1024

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

export default function MultimodalPage() {
  const navigate = useNavigate()

  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const [prompt, setPrompt] = useState(
    '分析该截图的布局、配色、字号层次与组件结构；给出实现步骤与可直接使用的 React + TypeScript + Tailwind 代码（可包含多个方案，分别用代码块输出）。',
  )

  const [scenario] = useState<CodegenScenarioId>('screenshot')
  const [rawOutput, setRawOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showFull, setShowFull] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const streamAbortRef = useRef<AbortController | null>(null)
  const codeBlockRef = useRef<HTMLElement>(null)
  const blocksWrapRef = useRef<HTMLDivElement>(null)
  const screenshotInputRef = useRef<HTMLInputElement>(null)

  const extractedBlocks = useMemo(() => {
    if (!rawOutput) return []
    return extractCodeBlockListFromMarkdown(rawOutput)
  }, [rawOutput])

  const extractedCode = useMemo(() => extractedBlocks.join('\n\n\n').trim(), [extractedBlocks])
  const displayForCopy = extractedCode || rawOutput.trim()

  useLayoutEffect(() => {
    if (!loading && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [loading, rawOutput])

  useLayoutEffect(() => {
    if (loading || showFull || !rawOutput || !blocksWrapRef.current) return
    const nodes = Array.from(blocksWrapRef.current.querySelectorAll('code[data-code-block="true"]'))
    for (const el of nodes) {
      ;(el as HTMLElement).removeAttribute('data-highlighted')
      try {
        hljs.highlightElement(el as HTMLElement)
      } catch {
        ;(el as HTMLElement).className = 'block whitespace-pre font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-sm'
      }
    }
  }, [loading, rawOutput, extractedBlocks, showFull])

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
      toast.error('请选择图片文件')
      return
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error(`图片需小于 ${Math.floor(MAX_SCREENSHOT_BYTES / 1024 / 1024)}MB`)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') setImageDataUrl(result)
      else toast.error('读取图片失败')
    }
    reader.onerror = () => toast.error('读取图片失败')
    reader.readAsDataURL(file)
  }

  function clearScreenshot() {
    setImageDataUrl(null)
  }

  function openInEditor() {
    if (!extractedBlocks.length) {
      toast.error('未检测到可用代码块，无法进入编辑器')
      return
    }
    upsertGeneratedCodeBlocksToWorkspace(extractedBlocks, 'multimodal-result')
    void navigate('/editor')
  }

  async function generate() {
    if (loading) return
    if (!imageDataUrl) {
      toast.error('请先上传截图')
      return
    }
    const value = prompt.trim()
    if (!value) {
      toast.error('请填写需要分析的要求（可简短）')
      return
    }

    const ac = new AbortController()
    streamAbortRef.current = ac
    setLoading(true)
    setRawOutput('')
    setShowFull(false)

    try {
      let out = ''
      for await (const chunk of streamCodegen({
        prompt: value,
        scenario,
        imageBase64: imageDataUrl,
        signal: ac.signal,
        enableLocalFallback: false,
      })) {
        out += chunk
        flushSync(() => setRawOutput(out))
      }
      toast.success('分析完成')
      bumpTodayStat('multimodalAnalyses', 1)
    } catch (error) {
      if (isAbortError(error)) toast.message('已停止生成')
      else {
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
        <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-zinc-700/70 dark:bg-zinc-900/90 md:px-6">
          <div className="mx-auto flex w-full max-w-none flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              多模态（截图分析）
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
                <Button type="button" size="sm" intent="outline" onClick={openInEditor}>
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

        <div ref={scrollRef} className={featureScrollBodyClass}>
          <div className="mx-auto flex w-full max-w-none flex-col gap-4">
            {rawOutput || loading ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <pre className="code-surface -mx-4 min-h-[min(420px,50vh)] flex-1 overflow-auto md:-mx-6">
                  {loading ? (
                    <code className="block whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100 md:p-6">
                      {rawOutput}
                      <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-sm bg-violet-500 align-[-0.125em] dark:bg-violet-400" />
                    </code>
                  ) : showFull ? (
                    <code ref={codeBlockRef as RefObject<HTMLElement>} className="block" />
                  ) : (
                    <div ref={blocksWrapRef} className="space-y-3 p-4 md:p-6">
                      {(extractedBlocks.length ? extractedBlocks : [rawOutput]).map((block, idx) => (
                        <div
                          key={`${idx}-${block.slice(0, 16)}`}
                          className="rounded-xl border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-700/70 dark:bg-zinc-900/40"
                        >
                          {extractedBlocks.length > 1 && (
                            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                              代码块 {idx + 1}
                            </p>
                          )}
                          <code data-code-block="true" className="hljs language-typescript block whitespace-pre font-mono text-xs leading-relaxed md:text-sm">
                            {block}
                          </code>
                        </div>
                      ))}
                    </div>
                  )}
                </pre>
                {loading && (
                  <p className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
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
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">上传截图后生成分析与代码</p>
                <p className="max-w-md text-xs text-zinc-400 dark:text-zinc-500">
                  需本地启动代理，并在服务端配置视觉模型（如 `qwen-vl-plus`）。
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            <p className={composerSectionLabelClass}>截图与分析要求</p>

            <div className={cn(composerCardClass, 'p-3')}>
              <input
                ref={screenshotInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={onScreenshotFileChange}
              />

              <div className="mb-3 flex flex-wrap items-center gap-3">
                <Button type="button" size="sm" intent="outline" className="h-9 gap-1.5 rounded-xl" disabled={loading} onClick={onPickScreenshotClick}>
                  <ImagePlus className="h-3.5 w-3.5" />
                  {imageDataUrl ? '更换截图' : '上传 UI 截图'}
                </Button>
                {imageDataUrl && (
                  <div className="relative inline-flex items-center gap-2 rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-1.5 pr-8 dark:border-zinc-600 dark:bg-zinc-900/50">
                    <img src={imageDataUrl} alt="截图预览" className="max-h-16 max-w-[180px] rounded-lg object-contain" />
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

              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={onPromptKeyDown}
                placeholder="告诉模型：你希望它分析什么，并希望输出哪些内容（如结构、组件拆分、Tailwind 样式、代码块等）…"
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
