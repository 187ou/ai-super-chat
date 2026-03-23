import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { cn } from '../../lib/utils'

interface Props {
  content: string
  /** 用户气泡内：浅色字 + 代码块对比 */
  tone?: 'assistant' | 'user'
}

const assistantArticle =
  'prose prose-sm max-w-none text-zinc-800 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-zinc-900 prose-p:leading-relaxed prose-p:text-zinc-700 prose-li:text-zinc-700 prose-strong:text-zinc-900 prose-a:text-zinc-900 prose-a:underline-offset-4 hover:prose-a:text-zinc-700 prose-pre:rounded-xl prose-pre:border prose-pre:border-zinc-200/90 prose-pre:bg-zinc-50/90 prose-pre:text-zinc-800 dark:text-zinc-200 dark:prose-headings:text-zinc-50 dark:prose-p:text-zinc-300 dark:prose-li:text-zinc-300 dark:prose-strong:text-zinc-100 dark:prose-a:text-sky-400 dark:hover:prose-a:text-sky-300 dark:prose-pre:border-zinc-600 dark:prose-pre:bg-zinc-950/90 dark:prose-pre:text-zinc-200 dark:prose-code:text-sky-300 dark:prose-code:bg-zinc-900/80 [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] dark:[&_code]:bg-zinc-800/90'

/** 用户气泡：低调灰底，与 ChatPage 用户气泡配色一致 */
const userArticle =
  'prose prose-sm max-w-none text-zinc-700 prose-headings:font-semibold prose-headings:text-zinc-800 prose-p:leading-relaxed prose-p:text-zinc-700 prose-li:text-zinc-700 prose-strong:text-zinc-900 prose-a:text-zinc-700 prose-a:underline-offset-4 hover:prose-a:text-zinc-900 prose-pre:rounded-xl prose-pre:border prose-pre:border-zinc-200/90 prose-pre:bg-zinc-50/95 prose-pre:text-zinc-800 prose-code:text-zinc-800 [&_code]:rounded [&_code]:bg-zinc-200/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] dark:text-zinc-200 dark:prose-headings:text-zinc-100 dark:prose-p:text-zinc-300 dark:prose-li:text-zinc-300 dark:prose-strong:text-zinc-100 dark:prose-a:text-zinc-400 dark:hover:prose-a:text-zinc-300 dark:prose-pre:border-zinc-600 dark:prose-pre:bg-zinc-950/80 dark:prose-pre:text-zinc-200 dark:prose-code:text-zinc-300 dark:[&_code]:bg-zinc-700/70'

export function MarkdownMessage({ content, tone = 'assistant' }: Props) {
  return (
    <article className={cn(tone === 'user' ? userArticle : assistantArticle)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </article>
  )
}
