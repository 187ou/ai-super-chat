import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Props = {
  children: ReactNode
  className?: string
  /** 无标题区：抵消 AppLayout 主区域 padding，铺满可用高度（全功能页与 AI 聊天一致） */
  fullBleed?: boolean
  /** 父级已无 padding（如聊天页）：不加负 margin，避免溢出裁剪 */
  edgeToEdge?: boolean
}

const fullBleedOuter = 'flex min-h-0 flex-1 flex-col gap-0 !space-y-0 -mx-6 -my-10 md:-mx-10 md:-my-12'
const fullBleedEdgeToEdge = 'flex min-h-0 flex-1 flex-col gap-0 !space-y-0 w-full'

/** 功能页滚动内容区：透明背景铺满，与主布局融为一体 */
export const featureScrollBodyClass =
  'min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6'

export function FeaturePageScroll({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(featureScrollBodyClass, className)}>{children}</div>
}

export function PageShell({ children, className, fullBleed = false, edgeToEdge = false }: Props) {
  if (fullBleed) {
    const outer = edgeToEdge ? fullBleedEdgeToEdge : fullBleedOuter
    return (
      <div className={cn(outer, className)}>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    )
  }
  return <div className={cn('w-full space-y-10 md:space-y-12', className)}>{children}</div>
}
