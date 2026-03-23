import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-zinc-200/80 bg-white/85 p-6 text-zinc-900 shadow-[0_1px_0_0_rgb(0_0_0_/0.03)] backdrop-blur-sm',
        'dark:border-zinc-600/70 dark:bg-zinc-950/55 dark:text-zinc-100 dark:shadow-[0_1px_0_0_rgb(255_255_255_/0.05)]',
        className,
      )}
      {...props}
    />
  )
}
