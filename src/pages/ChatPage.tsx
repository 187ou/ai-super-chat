import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Bot, Download, PanelLeftClose, PanelLeftOpen, Sparkles, Square, User, X } from 'lucide-react'
import { toast } from 'sonner'
import { MessageActions } from '../components/chat/MessageActions'
import { ConversationSidebar } from '../components/chat/ConversationSidebar'
import { featureScrollBodyClass, PageShell } from '../components/layout/PageShell'
import { Card } from '../components/ui/card'
import { Textarea } from '../components/ui/textarea'
import { Button } from '../components/ui/button'
import { MarkdownMessage } from '../components/common/MarkdownMessage'
import { streamChat } from '../lib/ai'
import { downloadConversationPdf } from '../lib/downloadConversationPdf'
import { formatMessagePlainText, formatUserTurnForModel } from '../lib/chatMessageFormat'
import { useConversation } from '../hooks/useConversation'
import { bumpTodayStat } from '../lib/dailyStats'
import {
  composerCardClass,
  composerFooterOuterClass,
  composerInnerMaxClass,
  composerTextareaCompactScrollClass,
} from '../lib/pageStyles'
import { cn } from '../lib/utils'
import type { ChatMessage } from '../types'

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

const CHAT_CONV_SIDEBAR_HIDDEN_KEY = 'ai_dev_assistant_chat_conv_sidebar_hidden'

type PendingQuote = { content: string; fromRole: 'user' | 'assistant' }

export default function ChatPage() {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [liveOutput, setLiveOutput] = useState('')
  const [pendingQuote, setPendingQuote] = useState<PendingQuote | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')
  const [convSidebarHidden, setConvSidebarHidden] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(CHAT_CONV_SIDEBAR_HIDDEN_KEY) === '1'
  })

  useEffect(() => {
    localStorage.setItem(CHAT_CONV_SIDEBAR_HIDDEN_KEY, convSidebarHidden ? '1' : '0')
  }, [convSidebarHidden])
  const {
    conversations,
    activeId,
    setActiveId,
    current,
    appendMessage,
    createUserMessage,
    createAssistantMessage,
    createNewConversation,
    deleteConversation,
    renameConversation,
    regenerateConversationTitle,
    clearAll,
    replaceActiveMessages,
    deleteMessageInActive,
  } = useConversation()
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const streamAbortRef = useRef<AbortController | null>(null)

  /** 生成中：随 token 与消息列表变化滚到底部，便于盯着流式输出 */
  useLayoutEffect(() => {
    if (!loading) return
    const el = scrollAreaRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [loading, liveOutput, current?.messages])

  function stopStreaming() {
    streamAbortRef.current?.abort()
  }

  async function runAssistantStream(historyBefore: ChatMessage[], userMsg: ChatMessage) {
    const ac = new AbortController()
    streamAbortRef.current = ac
    setLoading(true)
    setLiveOutput('')
    let output = ''
    try {
      for await (const chunk of streamChat({
        prompt: formatUserTurnForModel(userMsg),
        history: historyBefore,
        signal: ac.signal,
      })) {
        output += chunk
        flushSync(() => {
          setLiveOutput(output)
        })
      }
      await appendMessage(createAssistantMessage(output))
      bumpTodayStat('chatSessions', 1)
      setLiveOutput('')
    } catch (error) {
      if (isAbortError(error)) {
        const text =
          output.trim().length > 0 ? `${output.trim()}\n\n*（已停止生成）*` : '*（已停止生成）*'
        await appendMessage(createAssistantMessage(text))
        setLiveOutput('')
        toast.message('已停止生成')
      } else {
        const message = error instanceof Error ? error.message : '未知异常'
        await appendMessage(createAssistantMessage(`请求失败：${message}`))
        toast.error('AI 请求失败，已写入错误信息。')
        setLiveOutput('')
      }
    } finally {
      streamAbortRef.current = null
      setLoading(false)
    }
  }

  async function runChat() {
    const value = prompt.trim()
    if (!value || loading) return
    const historySnapshot = current?.messages ?? []
    const quoteArg = pendingQuote
      ? { content: pendingQuote.content, fromRole: pendingQuote.fromRole }
      : undefined
    setPendingQuote(null)
    const userMsg = createUserMessage(value, quoteArg)
    await appendMessage(userMsg)
    setPrompt('')
    await runAssistantStream(historySnapshot, userMsg)
  }

  async function handleRegenerateAssistant(assistantMessageId: string) {
    const msgs = current?.messages ?? []
    const idx = msgs.findIndex((m) => m.id === assistantMessageId)
    if (idx < 1) return
    const assistant = msgs[idx]
    const userMsg = msgs[idx - 1]
    if (assistant.role !== 'assistant' || userMsg.role !== 'user') return
    const historyBefore = msgs.slice(0, idx - 1)
    await replaceActiveMessages(msgs.slice(0, idx))
    await runAssistantStream(historyBefore, userMsg)
  }

  function copyMessage(msg: ChatMessage) {
    void navigator.clipboard.writeText(formatMessagePlainText(msg))
    toast.success('已复制到剪贴板')
  }

  async function handleDeleteMessage(msgId: string) {
    if (loading) stopStreaming()
    if (typeof window !== 'undefined' && !window.confirm('确定删除这条消息？')) return
    await deleteMessageInActive(msgId)
    toast.success('已删除消息')
  }

  function startEditUserMessage(msg: ChatMessage) {
    if (msg.role !== 'user') return
    setEditingMessageId(msg.id)
    setEditDraft(msg.content)
  }

  function cancelEdit() {
    setEditingMessageId(null)
    setEditDraft('')
  }

  async function commitEditUserMessage() {
    if (!editingMessageId) return
    const trimmed = editDraft.trim()
    if (!trimmed) {
      toast.error('内容不能为空')
      return
    }
    const msgs = current?.messages ?? []
    const idx = msgs.findIndex((m) => m.id === editingMessageId)
    if (idx === -1 || msgs[idx].role !== 'user') {
      cancelEdit()
      return
    }
    const historyBefore = msgs.slice(0, idx)
    const newUser: ChatMessage = { ...msgs[idx], content: trimmed, createdAt: Date.now() }
    cancelEdit()
    await replaceActiveMessages([...historyBefore, newUser])
    await runAssistantStream(historyBefore, newUser)
  }

  async function handleDownloadPdf() {
    if (!current?.messages?.length) {
      toast.error('当前没有可导出的消息')
      return
    }
    try {
      await downloadConversationPdf(current)
      toast.success('PDF 已下载')
    } catch (e) {
      console.error(e)
      toast.error('PDF 导出失败，请重试')
    }
  }

  async function handleDeleteConversation(id: string) {
    if (loading && id === activeId) stopStreaming()
    await deleteConversation(id)
  }

  return (
    <PageShell fullBleed edgeToEdge>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-zinc-200/90 border-x-0 border-t-0 p-0 shadow-none dark:border-zinc-700/80 md:flex-row">
        {!convSidebarHidden && (
          <ConversationSidebar
            conversations={conversations}
            activeId={activeId}
            disabled={loading}
            onSelect={(id) => setActiveId(id)}
            onNew={() => void createNewConversation()}
            onDelete={handleDeleteConversation}
            onRename={(id, title) => void renameConversation(id, title)}
            onRegenerateTitle={(id) => void regenerateConversationTitle(id)}
            onClearAll={() => void clearAll()}
            onCollapse={() => setConvSidebarHidden(true)}
          />
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            ref={scrollAreaRef}
            className={featureScrollBodyClass}
          >
          <div className="mx-auto flex w-full max-w-none flex-col gap-5">
            {(current?.messages ?? []).map((msg) => {
              const isUser = msg.role === 'user'
              const isEditing = editingMessageId === msg.id
              return (
                <div
                  key={msg.id}
                  className={cn('group flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}
                >
                  <div
                    className="mt-0.5 shrink-0"
                    aria-hidden
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-2xl shadow-sm ring-1 ring-inset',
                        isUser
                          ? 'bg-zinc-200/90 text-zinc-600 ring-zinc-300/80 dark:bg-zinc-700/80 dark:text-zinc-300 dark:ring-zinc-600/70'
                          : 'bg-white text-zinc-600 ring-zinc-200/90 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-600/80',
                      )}
                    >
                      {isUser ? <User className="h-5 w-5" strokeWidth={2} /> : <Bot className="h-5 w-5" strokeWidth={2} />}
                    </div>
                  </div>
                  <div
                    className={cn(
                      'flex min-w-0 max-w-[min(100%,28rem)] flex-col gap-1.5',
                      isUser ? 'items-end' : 'items-start',
                    )}
                  >
                    <div className="flex items-center gap-2 px-0.5">
                      <span
                        className={cn(
                          'text-[11px] font-semibold tracking-wide',
                          isUser ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-500 dark:text-zinc-400',
                        )}
                      >
                        {isUser ? '我' : 'AI 助手'}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        {isUser ? '发送' : '回复'}
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="w-full space-y-2 rounded-2xl border border-zinc-200/90 bg-white p-3 dark:border-zinc-700/80 dark:bg-zinc-900/90">
                        <Textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          className="min-h-24 text-sm"
                          placeholder="编辑问题…"
                        />
                        <div className="flex justify-end gap-2">
                          <Button type="button" intent="ghost" size="sm" onClick={cancelEdit}>
                            取消
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            disabled={loading}
                            onClick={() => void commitEditUserMessage()}
                          >
                            保存并重新生成
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className={cn(
                            'w-full rounded-2xl px-4 py-3 shadow-sm ring-1 ring-inset',
                            isUser
                              ? 'rounded-tr-md bg-zinc-100/95 text-zinc-800 ring-zinc-200/90 dark:bg-zinc-800/85 dark:text-zinc-100 dark:ring-zinc-600/70'
                              : 'rounded-tl-md bg-white/95 ring-zinc-200/80 dark:bg-zinc-900/90 dark:ring-zinc-700/80',
                          )}
                        >
                          {isUser && msg.quote?.content && (
                            <div
                              className={cn(
                                'mb-3 border-l-2 border-zinc-300/90 pl-3 text-xs leading-relaxed text-zinc-600 dark:border-zinc-500 dark:text-zinc-400',
                              )}
                            >
                              <p className="mb-1 font-medium text-zinc-500 dark:text-zinc-400">
                                引用{msg.quote.fromRole === 'assistant' ? ' AI' : ' 用户'}
                              </p>
                              <div className="max-h-32 overflow-y-auto whitespace-pre-wrap break-words opacity-95">
                                {msg.quote.content}
                              </div>
                            </div>
                          )}
                          <MarkdownMessage content={msg.content} tone={isUser ? 'user' : 'assistant'} />
                        </div>
                        <MessageActions
                          message={msg}
                          align={isUser ? 'right' : 'left'}
                          disabled={loading}
                          onCopy={() => copyMessage(msg)}
                          onDelete={() => void handleDeleteMessage(msg.id)}
                          onQuote={() => {
                            setPendingQuote({
                              content: msg.content,
                              fromRole: msg.role === 'assistant' ? 'assistant' : 'user',
                            })
                            toast.message('已引用，在下方输入补充说明后发送')
                          }}
                          onEdit={isUser ? () => startEditUserMessage(msg) : undefined}
                          onRegenerate={
                            !isUser ? () => void handleRegenerateAssistant(msg.id) : undefined
                          }
                        />
                      </>
                    )}
                  </div>
                </div>
              )
            })}
            {loading && (
              <div className="flex gap-3 flex-row">
                <div className="mt-0.5 shrink-0" aria-hidden>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm ring-1 ring-inset ring-white/20">
                    <Sparkles className="h-5 w-5" strokeWidth={2} />
                  </div>
                </div>
                <div className="flex min-w-0 max-w-[min(100%,28rem)] flex-col gap-1.5 items-start">
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-[11px] font-semibold tracking-wide text-violet-600 dark:text-violet-400">
                      AI 助手
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">正在输入…</span>
                  </div>
                  <div className="w-full rounded-2xl rounded-tl-md border border-violet-200/60 bg-violet-50/90 px-4 py-3 shadow-sm dark:border-violet-500/25 dark:bg-violet-950/40">
                    <div className="min-h-[1.25rem] whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
                      {liveOutput}
                      <span
                        className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-sm bg-violet-600 align-[-0.125em] dark:bg-violet-400"
                        aria-hidden
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!(current?.messages?.length) && !loading && (
              <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-zinc-200/90 bg-white/60 px-6 py-14 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                  <Sparkles className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">开始你的第一个 AI 开发对话</p>
                <p className="max-w-xs text-xs text-zinc-400 dark:text-zinc-500">你的消息会出现在右侧绿色气泡，AI 回复在左侧</p>
              </div>
            )}
          </div>
          </div>
        <div className={composerFooterOuterClass}>
          <div className={composerInnerMaxClass}>
            {pendingQuote && (
              <div className="flex items-start gap-2 rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/95 to-white px-3.5 py-2.5 shadow-sm dark:border-violet-500/25 dark:from-violet-950/50 dark:to-zinc-900/80">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    引用 {pendingQuote.fromRole === 'assistant' ? 'AI' : '用户'}
                  </p>
                  <p className="mt-1 line-clamp-4 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                    {pendingQuote.content}
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-xl p-1.5 text-zinc-400 transition-colors hover:bg-violet-100/80 hover:text-zinc-800 dark:hover:bg-violet-950/60 dark:hover:text-zinc-200"
                  aria-label="取消引用"
                  onClick={() => setPendingQuote(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className={cn(composerCardClass, 'p-2')}>
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={(e) => {
                  e.preventDefault()
                  void runChat()
                }}
              >
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="输入消息：Enter 发送，Shift+Enter 换行…"
                  disabled={loading}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    if (e.shiftKey || e.nativeEvent.isComposing) return
                    e.preventDefault()
                    void runChat()
                  }}
                  className={
                    composerTextareaCompactScrollClass +
                    ' flex-1 border-zinc-200/60 bg-zinc-50/50 shadow-none dark:border-zinc-600/50 dark:bg-zinc-800/40 dark:focus:bg-zinc-900/90'
                  }
                />
                {loading ? (
                  <Button
                    type="button"
                    intent="outline"
                    className="h-11 shrink-0 rounded-2xl border-red-200/90 px-5 text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/40 sm:min-w-[104px]"
                    onClick={stopStreaming}
                  >
                    <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                    停止
                  </Button>
                ) : (
                  <Button type="submit" className="h-11 shrink-0 rounded-2xl px-6 sm:min-w-[104px]">
                    发送
                  </Button>
                )}
              </form>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-2 sm:justify-center">
              <Button
                type="button"
                intent="outline"
                className="h-10 min-h-10 w-full justify-center gap-2 rounded-xl border-zinc-200/80 bg-white/70 text-zinc-700 shadow-sm hover:bg-white dark:border-zinc-600/60 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-1"
                onClick={() => setConvSidebarHidden((v) => !v)}
              >
                {convSidebarHidden ? (
                  <>
                    <PanelLeftOpen className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    显示对话列表
                  </>
                ) : (
                  <>
                    <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                    隐藏对话列表
                  </>
                )}
              </Button>
              <Button
                type="button"
                intent="outline"
                className="h-10 min-h-10 w-full justify-center gap-2 rounded-xl border-zinc-200/80 bg-white/70 text-zinc-700 shadow-sm hover:bg-white dark:border-zinc-600/60 dark:bg-zinc-900/60 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:flex-1"
                disabled={loading}
                onClick={() => void handleDownloadPdf()}
              >
                <Download className="mr-1.5 h-3.5 w-3.5 shrink-0" /> 下载 PDF
              </Button>
            </div>
          </div>
        </div>
        </div>
      </Card>
    </PageShell>
  )
}
