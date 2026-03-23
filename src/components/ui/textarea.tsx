import type { TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full resize-y rounded-2xl border border-zinc-200/80 bg-white px-4 py-3 text-sm leading-relaxed text-zinc-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition-[box-shadow,border-color,background-color]',
        'placeholder:text-zinc-400/90 focus:border-zinc-300 focus:bg-white focus:shadow-md focus:ring-2 focus:ring-zinc-900/[0.07]',
        'dark:border-zinc-600/70 dark:bg-zinc-950/75 dark:text-zinc-50 dark:placeholder:text-zinc-500',
        'dark:focus:border-zinc-500 dark:focus:bg-zinc-950 dark:focus:shadow-lg dark:focus:ring-white/12',
        className,
      )}
      {...props}
    />
  )
}
