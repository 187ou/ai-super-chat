import { type KeyboardEvent, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Copy, FileText, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import {
  composerCardClass,
  composerFooterOuterClass,
  composerInnerMaxClass,
  composerSectionLabelClass,
  composerTextareaCompactScrollClass,
} from '../lib/pageStyles'
import { MarkdownMessage } from '../components/common/MarkdownMessage'
import { streamRagAnswer, uploadRagKb, deleteRagKb } from '../lib/ragStream'
import { bumpTodayStat } from '../lib/dailyStats'
import { pushAssistantContext } from '../lib/assistantContext'

type DocItem = { filename: string; content: string }

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

const MAX_DOC_FILES = 6
const MAX_DOC_BYTES = 2 * 1024 * 1024
const MAX_DOC_CHARS = 60000

export default function RagPage() {
  const [kbId, setKbId] = useState<string | null>(null)
  const [chunkCount, setChunkCount] = useState<number>(0)
  const [docs, setDocs] = useState<DocItem[]>([])
  const [kbLoading, setKbLoading] = useState(false)

  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [rawOutput, setRawOutput] = useState('')

  const streamAbortRef = useRef<AbortController | null>(null)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (!loading) return
    const el = scrollAreaRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [loading, rawOutput])

  function stopStreaming() {
    streamAbortRef.current?.abort()
  }

  function onPickFiles() {
    fileInputRef.current?.click()
  }

  async function onFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return
    if (files.length > MAX_DOC_FILES) {
      toast.error(`一次最多上传 ${MAX_DOC_FILES} 个文件`)
      return
    }

    const next: DocItem[] = []
    for (const f of Array.from(files)) {
      if (!f.type.startsWith('text/') && !f.name.toLowerCase().match(/\.(txt|md|markdown|json|csv)$/)) {
        toast.error(`不支持的文件类型：${f.name}`)
        return
      }
      if (f.size > MAX_DOC_BYTES) {
        toast.error(`文件 ${f.name} 需小于 ${Math.floor(MAX_DOC_BYTES / 1024 / 1024)}MB`)
        return
      }

      const text = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
        reader.onerror = () => reject(new Error('读取文件失败'))
        reader.readAsText(f)
      })

      if (!text.trim()) continue
      const trimmed = text.length > MAX_DOC_CHARS ? text.slice(0, MAX_DOC_CHARS) : text
      next.push({ filename: f.name, content: trimmed })
    }

    if (!next.length) {
      toast.error('未读取到有效文档内容')
      return
    }

    setDocs(next)
    setKbId(null)
    setChunkCount(0)
    toast.success(`已读取 ${next.length} 个文件，点击「建库」即可使用`)
  }

  async function buildKb() {
    if (kbLoading) return
    if (!docs.length) {
      toast.error('请先上传文档')
      return
    }
    setKbLoading(true)
    try {
      const { kbId: nextKbId, chunkCount: nextCount } = await uploadRagKb({ name: 'rag-kb', docs })
      setKbId(nextKbId)
      setChunkCount(nextCount)
      toast.success('知识库建库完成，可开始提问')
    } catch (e) {
      const message = e instanceof Error ? e.message : '未知异常'
      toast.error(`建库失败：${message}`)
    } finally {
      setKbLoading(false)
    }
  }

  async function clearKb() {
    if (kbLoading) return
    if (kbId) {
      try {
        await deleteRagKb({ kbId })
      } catch (e) {
        // 非关键：删除失败也不阻止前端清空
        console.error(e)
      }
    }
    setKbId(null)
    setChunkCount(0)
    setDocs([])
    setQuestion('')
    setRawOutput('')
    toast.success('已清空知识库')
  }

  async function generate() {
    if (loading) return
    const v = question.trim()
    if (!kbId) {
      toast.error('请先建库')
      return
    }
    if (!v) {
      toast.error('请输入你的提问')
      return
    }

    const ac = new AbortController()
    streamAbortRef.current = ac
    setLoading(true)
    setRawOutput('')

    try {
      let out = ''
      for await (const chunk of streamRagAnswer({ kbId, question: v, signal: ac.signal })) {
        out += chunk
        flushSync(() => setRawOutput(out))
      }
      toast.success('回答完成')
      bumpTodayStat('ragAnswers', 1)
      pushAssistantContext({
        source: 'rag',
        route: '/rag',
        title: `RAG 回答：${v.slice(0, 24)}`,
        content: out,
      })
    } catch (e) {
      if (isAbortError(e)) toast.message('已停止生成')
      else {
        const message = e instanceof Error ? e.message : '未知异常'
        toast.error(`RAG 请求失败：${message}`)
        setRawOutput(`[错误] ${message}`)
      }
    } finally {
      streamAbortRef.current = null
      setLoading(false)
    }
  }

  function onQuestionKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
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
              知识库检索
            </span>
            {rawOutput && !loading && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  intent="outline"
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(rawOutput)
                    toast.success('已复制回答')
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  复制回答
                </Button>
              </div>
            )}
          </div>
        </div>

        <div ref={scrollAreaRef} className={featureScrollBodyClass}>
          <div className="mx-auto flex w-full max-w-none flex-col gap-4">
            {rawOutput || loading ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/60 p-4 dark:border-zinc-700/60 dark:bg-zinc-950/40">
                  {loading ? (
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      正在基于知识库检索并生成回答...
                    </div>
                  ) : null}
                  <MarkdownMessage content={rawOutput} />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200/90 bg-white/60 px-6 py-14 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                  <FileText className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  上传文档建立知识库，然后直接提问
                </p>
                <p className="max-w-md text-xs text-zinc-400 dark:text-zinc-500">
                  当前实现先支持 <code className="rounded bg-zinc-200/80 px-1 dark:bg-zinc-800">.txt/.md</code> 等文本文件；检索采用关键词召回。
                </p>
              </div>
            )}
          </div>
        </div>

        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            <div className="flex items-center justify-between gap-3">
              <p className={composerSectionLabelClass}>上传文档</p>
              {kbId ? (
                <Button size="sm" intent="outline" type="button" onClick={clearKb} disabled={kbLoading || loading}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  清空知识库
                </Button>
              ) : null}
            </div>

            <div className={composerCardClass}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,text/plain,text/markdown"
                className="hidden"
                onChange={(e) => void onFilesSelected(e.target.files)}
              />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" intent="outline" type="button" onClick={onPickFiles} disabled={kbLoading || loading}>
                    上传文档
                  </Button>
                  {docs.length ? (
                    <span className="text-xs text-zinc-500">
                      已选择 {docs.length} 个文件 {chunkCount ? `(已建库，${chunkCount}片段)` : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">尚未选择文件</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" type="button" onClick={() => void buildKb()} disabled={kbLoading || loading || !docs.length}>
                    {kbLoading ? '建库中...' : '建库'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <p className={composerSectionLabelClass}>提问</p>
              {loading ? (
                <Button size="sm" intent="outline" type="button" onClick={stopStreaming}>
                  停止生成
                </Button>
              ) : null}
            </div>

            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onQuestionKeyDown}
              placeholder={kbId ? '输入你的问题（Enter 发送，Shift+Enter 换行）' : '请先上传文档并建库'}
              disabled={!kbId || kbLoading}
              className={composerTextareaCompactScrollClass}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <div className="text-xs text-zinc-500">
                {kbId ? `当前知识库：${kbId.slice(0, 8)}...（片段：${chunkCount}）` : '当前未加载知识库'}
              </div>
              <Button size="sm" type="button" onClick={() => void generate()} disabled={!kbId || loading || kbLoading || !question.trim()}>
                检索并回答
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}

