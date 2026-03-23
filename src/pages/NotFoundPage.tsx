import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { pageTitleClassName } from '../lib/pageStyles'

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">404</p>
      <h1 className={`${pageTitleClassName} text-3xl`}>页面未找到</h1>
      <p className="max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-300">该地址不存在或已被移动，请返回工作台继续。</p>
      <Link to="/" className="mt-2">
        <Button type="button">返回首页</Button>
      </Link>
    </section>
  )
}
