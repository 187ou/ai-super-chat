import { useMemo, useState } from 'react'
import { MessageSquarePlus, PanelLeftClose, Pencil, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import type { Conversation } from '../../types'
import { cn } from '../../lib/utils'

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d} 天前`
  return new Date(ts).toLocaleDateString()
}

type Props = {
  conversations: Conversation[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void | Promise<void>
  onRename: (id: string, title: string) => void | Promise<void>
  onRegenerateTitle: (id: string) => void | Promise<void>
  onClearAll?: () => void
  /** 提供后显示「收起」按钮，用于隐藏侧栏 */
  onCollapse?: () => void
  disabled?: boolean
  className?: string
}

export function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onRegenerateTitle,
  onClearAll,
  onCollapse,
  disabled,
  className,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const sorted = useMemo(
    () => [...conversations].sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations],
  )

  function startEdit(c: Conversation, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingId(c.id)
    setEditValue(c.title)
  }

  function commitEdit() {
    if (!editingId) return
    const v = editValue.trim()
    if (v) onRename(editingId, v)
    setEditingId(null)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (typeof window !== 'undefined' && !window.confirm('确定删除该对话？')) return
    await Promise.resolve(onDelete(id))
    toast.success('已删除对话')
  }

  function handleRegenerate(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    onRegenerateTitle(id)
    toast.message('已按首条消息更新标题')
  }

  return (
    <aside
      className={cn(
        'flex min-h-0 w-full max-h-[40vh] shrink-0 flex-col border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-700/80 dark:bg-zinc-950/40',
        'border-b md:max-h-none md:w-[272px] md:border-b-0 md:border-r',
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-200/70 p-3 dark:border-zinc-700/70">
        {onCollapse && (
          <button
            type="button"
            aria-label="收起对话列表"
            title="收起对话列表"
            className="shrink-0 rounded-xl p-2 text-zinc-500 transition-colors hover:bg-zinc-200/70 hover:text-zinc-800 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-200"
            onClick={onCollapse}
          >
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
        <Button
          type="button"
          className="min-w-0 flex-1 gap-2"
          disabled={disabled}
          onClick={() => {
            void onNew()
          }}
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0" />
          新建对话
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">历史对话</p>
        {sorted.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-zinc-400">暂无对话，点击上方新建</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {sorted.map((c) => {
              const isActive = c.id === activeId
              const isEditing = editingId === c.id
              return (
                <li key={c.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !disabled && !isEditing && onSelect(c.id)}
                    onKeyDown={(e) => {
                      if (disabled || isEditing) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(c.id)
                      }
                    }}
                    className={cn(
                      'group rounded-xl border border-transparent px-2 py-2 transition-colors',
                      isActive
                        ? 'bg-white shadow-sm ring-1 ring-zinc-200/90 dark:bg-zinc-900/90 dark:ring-zinc-600/80'
                        : 'hover:bg-white/80 dark:hover:bg-zinc-900/50',
                      disabled && 'pointer-events-none opacity-50',
                    )}
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              commitEdit()
                            }
                            if (e.key === 'Escape') setEditingId(null)
                          }}
                          className="h-8 text-xs"
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <Button type="button" size="sm" className="h-7 flex-1 text-xs" onClick={commitEdit}>
                            保存
                          </Button>
                          <Button
                            type="button"
                            intent="ghost"
                            size="sm"
                            className="h-7 flex-1 text-xs"
                            onClick={() => setEditingId(null)}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-1">
                          <p className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                            {c.title}
                          </p>
                          <div className="flex shrink-0 items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                            <button
                              type="button"
                              title="重命名"
                              disabled={disabled}
                              className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                              onClick={(e) => startEdit(c, e)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="按首条用户消息自动提取标题"
                              disabled={disabled}
                              className="rounded-lg p-1 text-zinc-400 hover:bg-violet-100 hover:text-violet-700 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-violet-950/60 dark:hover:text-violet-300"
                              onClick={(e) => handleRegenerate(c.id, e)}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="删除"
                              disabled={disabled}
                              className="rounded-lg p-1 text-zinc-400 hover:bg-red-100 hover:text-red-600 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-red-950/50 dark:hover:text-red-400"
                              onClick={(e) => void handleDelete(c.id, e)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <p className="mt-0.5 truncate text-left text-[10px] text-zinc-400">{formatRelativeTime(c.updatedAt)}</p>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {onClearAll && sorted.length > 0 && (
        <div className="shrink-0 border-t border-zinc-200/70 p-2 dark:border-zinc-700/70">
          <Button
            type="button"
            intent="ghost"
            size="sm"
            className="h-8 w-full text-xs text-zinc-500"
            disabled={disabled}
            onClick={() => {
              if (typeof window !== 'undefined' && window.confirm('确定清空全部对话？此操作不可恢复。')) {
                void onClearAll()
                toast.success('已清空全部对话')
              }
            }}
          >
            清空全部对话
          </Button>
        </div>
      )}
    </aside>
  )
}
