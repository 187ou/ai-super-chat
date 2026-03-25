import { Loader2 } from 'lucide-react'

/** 懒加载页面尚未就绪时在主内容区展示，占满 flex 高度便于感知加载态 */
export function RoutePageFallback() {
  return (
    <div
      className="flex min-h-[min(60vh,480px)] w-full flex-1 flex-col items-center justify-center gap-3 px-6 py-16"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-9 w-9 shrink-0 animate-spin text-zinc-400 dark:text-zinc-500" strokeWidth={1.75} aria-hidden />
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">页面加载中…</p>
      <p className="max-w-xs text-center text-xs text-zinc-400 dark:text-zinc-500">首次打开某页时会下载脚本，稍候即可</p>
    </div>
  )
}
