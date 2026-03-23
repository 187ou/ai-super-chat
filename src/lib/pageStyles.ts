/**
 * 全站页面标题：浅灰深、深灰浅，避免纯黑/纯白，层次醒目
 */
export const pageTitleClassName =
  'text-balance font-semibold tracking-tight text-zinc-400 dark:text-zinc-200'

/** 一级标题（如错误页 h1） */
export const pageTitleH1ClassName = `${pageTitleClassName} text-2xl md:text-3xl`

/** 区块/卡片内标题（如工作台入口卡片） */
export const pageTitleH3ClassName = `${pageTitleClassName} text-base`

/** 底部输入区外层（渐变条） */
export const composerFooterOuterClass =
  'shrink-0 border-t border-zinc-200/70 bg-gradient-to-b from-zinc-50/50 to-zinc-100/90 px-4 py-5 dark:border-zinc-700/70 dark:from-zinc-950/40 dark:to-zinc-950/90 md:px-8 md:py-6'

/** 底部输入区内层：加宽主内容区（原 max-w-4xl → 更接近全宽） */
export const composerInnerMaxClass = 'mx-auto flex w-full max-w-6xl flex-col gap-3'

/** 底部输入白卡片容器（内边距由页面用 p-2 / p-3 叠加） */
export const composerCardClass =
  'rounded-2xl border border-zinc-200/70 bg-white/95 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] ring-1 ring-zinc-900/[0.03] backdrop-blur-sm dark:border-zinc-600/50 dark:bg-zinc-900/85 dark:shadow-[0_2px_20px_-8px_rgba(0,0,0,0.5)] dark:ring-white/[0.05]'

/** 卡片内 Textarea：去边框、加高（约 8～9 行） */
export const composerTextareaInnerClass =
  'min-h-[200px] sm:min-h-[220px] border-0 bg-zinc-50/40 shadow-none focus:bg-white focus:shadow-none dark:bg-zinc-800/30 dark:focus:bg-zinc-900/90'

/** 调试页代码框更高 */
export const composerTextareaCodeInnerClass =
  'min-h-[240px] sm:min-h-[280px] border-0 bg-zinc-50/40 font-mono text-sm shadow-none focus:bg-white focus:shadow-none dark:bg-zinc-800/30 dark:focus:bg-zinc-900/90'

/**
 * 底部输入区共用：矮框 + 内容在框内滚动（接口文档 / 图表 / 调试 / 代码生成等）
 * 与 `composerTextareaInnerClass` 或 `composerTextareaCodeInnerClass` 组合使用，覆盖其 min-h。
 */
export const composerTextareaCompactScrollClass =
  'min-h-[64px] max-h-[104px] resize-none overflow-y-auto sm:min-h-[72px] sm:max-h-[112px]'

/** 小标题「需求描述」类 */
export const composerSectionLabelClass =
  'text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500'

/** 卡片内底部操作条（分隔线 + 按钮） */
export const composerCardActionsClass =
  'mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-100/90 pt-3 dark:border-zinc-700/60'
