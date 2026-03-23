import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Props = {
  children: ReactNode
  className?: string
}

/** 页面内区块小标题（非 h1，用于「数据概览」等分组） */
export function SectionLabel({ children, className }: Props) {
  return (
    <p
      className={cn(
        'text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500',
        className,
      )}
    >
      {children}
    </p>
  )
}
