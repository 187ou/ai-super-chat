import { isRouteErrorResponse, useRouteError, Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { pageTitleH1ClassName } from '../lib/pageStyles'

export default function RouteErrorPage() {
  const error = useRouteError()

  let title = '出错了'
  let detail = '系统出现未处理错误，请返回首页重试。'

  if (isRouteErrorResponse(error)) {
    title = `请求异常 ${error.status}`
    detail = error.statusText || detail
  } else if (error instanceof Error) {
    detail = error.message
  }

  return (
    <section className="flex min-h-[50vh] flex-col items-center justify-center space-y-4 text-center">
      <h1 className={pageTitleH1ClassName}>{title}</h1>
      <p className="max-w-lg text-sm leading-relaxed text-zinc-500 dark:text-zinc-300">{detail}</p>
      <Link to="/" className="mt-2">
        <Button type="button">返回工作台</Button>
      </Link>
    </section>
  )
}
