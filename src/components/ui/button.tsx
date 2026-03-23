import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

const variants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      intent: {
        default:
          'bg-zinc-900 text-white shadow-sm hover:bg-zinc-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white',
        outline:
          'border border-zinc-200 bg-white/50 text-zinc-800 hover:bg-zinc-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:bg-zinc-800/90',
        ghost:
          'text-zinc-800 hover:bg-zinc-100/90 active:scale-[0.98] dark:text-zinc-200 dark:hover:bg-zinc-800/80',
      },
      size: {
        md: 'h-10 px-4',
        sm: 'h-8 px-3 text-xs',
      },
    },
    defaultVariants: {
      intent: 'default',
      size: 'md',
    },
  },
)

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>

export function Button({ className, intent, size, ...props }: Props) {
  return <button className={cn(variants({ intent, size }), className)} {...props} />
}
