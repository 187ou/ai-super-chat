import { Copy, MessageSquareQuote, Pencil, RefreshCw, Trash2 } from 'lucide-react'
import type { ChatMessage } from '../../types'
import { cn } from '../../lib/utils'

type Props = {
  message: ChatMessage
  disabled?: boolean
  onCopy: () => void
  onDelete: () => void
  onQuote: () => void
  /** 仅用户消息 */
  onEdit?: () => void
  /** 仅助手消息 */
  onRegenerate?: () => void
  align: 'left' | 'right'
}

export function MessageActions({
  message,
  disabled,
  onCopy,
  onDelete,
  onQuote,
  onEdit,
  onRegenerate,
  align,
}: Props) {
  const isUser = message.role === 'user'
  const btnClass =
    'rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-800 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-zinc-800/90 dark:hover:text-zinc-200'

  return (
    <div
      className={cn(
        'mt-1 flex flex-wrap items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100',
        align === 'right' && 'justify-end',
        align === 'left' && 'justify-start',
      )}
    >
      <button type="button" className={btnClass} title="复制" disabled={disabled} onClick={onCopy}>
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      <button type="button" className={btnClass} title="引用" disabled={disabled} onClick={onQuote}>
        <MessageSquareQuote className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {isUser && onEdit && (
        <button type="button" className={btnClass} title="编辑" disabled={disabled} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      )}
      {!isUser && onRegenerate && (
        <button type="button" className={btnClass} title="重新生成" disabled={disabled} onClick={onRegenerate}>
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      )}
      <button
        type="button"
        className={cn(btnClass, 'hover:text-red-600 dark:hover:text-red-400')}
        title="删除"
        disabled={disabled}
        onClick={onDelete}
      >
        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    </div>
  )
}
