import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Props = {
  title: string
  /** 右侧操作区（如按钮） */
  action?: ReactNode
  className?: string
}

/** 卡片内顶栏：分区标题，偏企业级工作台风格 */
export function PanelHeader({ title, action, className }: Props) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-zinc-200/70 bg-zinc-50/60 px-6 py-3.5 dark:border-zinc-700/70 dark:bg-zinc-950/35',
        className,
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">{title}</span>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
