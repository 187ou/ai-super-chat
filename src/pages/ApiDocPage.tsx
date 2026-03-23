import { useLayoutEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import hljs from 'highlight.js'
import { Copy, Download, FileText, FileUp, Loader2, Square, SquarePen, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import { extractCodeBlocksFromMarkdown, streamCodegen } from '../lib/codegenStream'
import { loadWorkspace, upsertGeneratedCodeToWorkspace, type EditorFile } from '../lib/editorWorkspace'
import {
  composerCardClass,
  composerFooterOuterClass,
  composerInnerMaxClass,
  composerSectionLabelClass,
  composerTextareaCompactScrollClass,
  composerTextareaInnerClass,
} from '../lib/pageStyles'
import { cn } from '../lib/utils'

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

function normalizeDoc(raw: string): string {
  const extracted = extractCodeBlocksFromMarkdown(raw).trim()
  if (!extracted) return ''
  try {
    const obj = JSON.parse(extracted)
    return JSON.stringify(obj, null, 2)
  } catch {
    return extracted
  }
}

function toMarkdownFromOpenapi(doc: string): string {
  if (!doc) return ''
  let endpoints: Array<{
    method: string
    path: string
    summary: string
    operationId?: string
    params: string[]
    requestBodySchema?: string
  }> = []
  try {
    const obj = JSON.parse(doc) as { paths?: Record<string, Record<string, any>> }
    if (obj.paths && typeof obj.paths === 'object') {
      for (const [path, methods] of Object.entries(obj.paths)) {
        if (!methods || typeof methods !== 'object') continue
        for (const [method, op] of Object.entries(methods)) {
          if (!op || typeof op !== 'object') continue
          const operation = op as Record<string, any>
          const params = Array.isArray(operation.parameters)
            ? operation.parameters
                .map((p) => `${p?.name ?? 'unknown'}(${p?.in ?? 'query'})`)
                .filter(Boolean)
            : []
          const reqSchema = operation.requestBody?.content?.['application/json']?.schema
          endpoints.push({
            method: method.toUpperCase(),
            path,
            summary: operation.summary ?? operation.description ?? '',
            operationId: operation.operationId,
            params,
            requestBodySchema: reqSchema ? JSON.stringify(reqSchema, null, 2) : undefined,
          })
        }
      }
    }
  } catch {
    return doc
  }
  if (!endpoints.length) return doc
  let title = 'API 文档'
  let description = ''
  try {
    const obj = JSON.parse(doc) as { info?: { title?: string; description?: string; version?: string } }
    title = obj.info?.title || title
    description = obj.info?.description || ''
  } catch {
    /* ignore */
  }
  const lines: string[] = [`# ${title}`, '']
  if (description) {
    lines.push(description, '')
  }
  lines.push('## 接口列表', '')
  for (const ep of endpoints) {
    lines.push(`### \`${ep.method} ${ep.path}\``)
    if (ep.summary) lines.push(`- 说明：${ep.summary}`)
    if (ep.operationId) lines.push(`- OperationId：\`${ep.operationId}\``)
    lines.push(`- 参数：${ep.params.length ? ep.params.join('、') : '无'}`)
    if (ep.requestBodySchema) {
      lines.push('- 请求体 schema：', '```json', ep.requestBodySchema, '```')
    }
    lines.push('')
  }
  return lines.join('\n')
}

export default function ApiDocPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('任务管理系统，支持任务增删改查与状态流转。')
  const [rawOutput, setRawOutput] = useState('')
  const [loading, setLoading] = useState(false)
  const [fileAttachment, setFileAttachment] = useState<{ name: string; text: string } | null>(null)
  const [includeEditorFile, setIncludeEditorFile] = useState(false)
  const [editorAttachment, setEditorAttachment] = useState<{ path: string; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_ATTACHMENT_CHARS = 20000
  const scrollRef = useRef<HTMLDivElement>(null)
  const codeBlockRef = useRef<HTMLElement>(null)
  const streamAbortRef = useRef<AbortController | null>(null)

  const doc = normalizeDoc(rawOutput)

  useLayoutEffect(() => {
    if (!loading && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [loading, rawOutput])

  useLayoutEffect(() => {
    if (loading || !doc || !codeBlockRef.current) return
    const el = codeBlockRef.current
    el.textContent = doc
    el.removeAttribute('data-highlighted')
    el.className = 'hljs language-json block whitespace-pre font-mono text-xs leading-relaxed md:text-sm'
    try {
      hljs.highlightElement(el)
    } catch {
      el.className = 'block whitespace-pre font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100 md:text-sm'
    }
  }, [loading, doc])

  async function generateDoc() {
    const value = input.trim()
    const attachmentsText = (() => {
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
    })()

    const effectivePrompt = value
      ? attachmentsText
        ? `${value}\n\n${attachmentsText}`
        : value
      : attachmentsText

    if (!effectivePrompt || loading) return
    const ac = new AbortController()
    streamAbortRef.current = ac
    setLoading(true)
    setRawOutput('')
    let out = ''
    try {
      for await (const chunk of streamCodegen({
        prompt: effectivePrompt,
        scenario: 'apidoc',
        signal: ac.signal,
      })) {
        out += chunk
        flushSync(() => setRawOutput(out))
      }
      toast.success('文档生成完成')
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

  function stopGenerate() {
    streamAbortRef.current?.abort()
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

  function onPromptKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (!loading) void generateDoc()
  }

  function copyDoc() {
    if (!doc) return
    void navigator.clipboard.writeText(doc)
    toast.success('已复制文档')
  }

  function downloadDoc() {
    if (!doc) return
    const blob = new Blob([doc], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openapi.generated.json'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('已下载 JSON')
  }

  function downloadMarkdown() {
    const md = toMarkdownFromOpenapi(doc)
    if (!md.trim()) return
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'openapi.generated.md'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('已下载 Markdown')
  }

  function openInEditor() {
    if (!doc) return
    upsertGeneratedCodeToWorkspace(doc, 'openapi-generated')
    void navigate('/editor')
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80">
        <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:border-zinc-700/70 dark:bg-zinc-900/90 dark:supports-[backdrop-filter]:bg-zinc-900/70 md:px-6">
          <div className="mx-auto flex w-full max-w-none flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              接口文档生成
            </span>
            {doc && !loading && (
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" intent="outline" type="button" onClick={openInEditor}>
                  <SquarePen className="mr-1.5 h-3.5 w-3.5" />
                  在线编辑
                </Button>
                <Button size="sm" intent="outline" type="button" onClick={copyDoc}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  复制文档
                </Button>
                <Button size="sm" intent="outline" type="button" onClick={downloadDoc}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  下载 JSON
                </Button>
                <Button size="sm" intent="outline" type="button" onClick={downloadMarkdown}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  导出 Markdown
                </Button>
              </div>
            )}
          </div>
        </div>
        <div ref={scrollRef} className={featureScrollBodyClass}>
          <div className="mx-auto flex w-full max-w-none flex-col">
            {doc || loading ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <pre className="code-surface -mx-4 min-h-[min(360px,45vh)] flex-1 overflow-auto text-xs leading-relaxed md:-mx-6">
                  {loading ? (
                    <code className="block whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-zinc-800 dark:text-zinc-100 md:p-6">
                      {rawOutput}
                      <span
                        className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-sm bg-violet-500 align-[-0.125em] dark:bg-violet-400"
                        aria-hidden
                      />
                    </code>
                  ) : (
                    <code ref={codeBlockRef} className="block" />
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
                  <FileText className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">输入业务描述，生成 RESTful 与 Swagger 结构</p>
                <p className="max-w-md text-xs text-zinc-400 dark:text-zinc-500">在下方填写需求后点击「生成文档」</p>
              </div>
            )}
          </div>
        </div>
        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            <p className={composerSectionLabelClass}>接口与业务描述</p>
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onPromptKeyDown}
                placeholder="描述业务领域、资源、字段、鉴权与典型接口…"
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
                  onClick={stopGenerate}
                >
                  <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                  停止
                </Button>
              ) : (
                <Button type="button" className="absolute bottom-5 right-5 h-9 rounded-xl px-4" onClick={() => void generateDoc()}>
                  生成文档
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>
    </PageShell>
  )
}
