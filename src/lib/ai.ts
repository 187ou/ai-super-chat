import { streamTextChunks, uid } from './utils'
import { messageToApiPayload } from './chatMessageFormat'
import type { ChatMessage, FunctionCallResult } from '../types'

interface ChatRequest {
  prompt: string
  history: ChatMessage[]
  /** 传入后可在任意时刻 abort，以停止流式输出 */
  signal?: AbortSignal
}

export function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split(/\r?\n/)
  let event = 'message'
  const dataParts: string[] = []
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    if (line.startsWith('data:')) dataParts.push(line.slice(5).trimStart())
  }
  const data = dataParts.join('\n').trim()
  if (!data) return null
  return { event, data }
}

/** 规范换行后按空行分帧；仅 `\n\n` 分块会在上游使用 `\r\n\r\n` 时整块卡住、前端只能最后一次性解析 */
export function pullCompleteSseBlocks(buffer: string): { blocks: string[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const rest = parts.pop() ?? ''
  return { blocks: parts, rest }
}

export async function* streamChat(req: ChatRequest): AsyncGenerator<string> {
  const proxyEndpoint =
    (import.meta.env.VITE_AI_PROXY_URL as string | undefined) || 'http://localhost:8787/api/chat/stream'
  const useMock = !proxyEndpoint

  if (useMock) {
    const mocked = `已分析你的问题：${req.prompt}\n\n建议：\n1. 拆分业务为可复用 Hooks。\n2. 使用 Suspense + use 提升异步加载体验。\n3. 通过 Actions + form action 实现声明式提交流程。`
    yield* streamTextChunks(mocked, 7, req.signal)
    return
  }

  try {
    const response = await fetch(proxyEndpoint, {
      method: 'POST',
      cache: 'no-store',
      signal: req.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        prompt: req.prompt,
        history: req.history.map((m) => messageToApiPayload(m)),
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`代理请求失败(${response.status})：${detail || '无错误详情'}`)
    }

    if (!response.body) {
      throw new Error('流式响应不可用，请检查接口配置。')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let streamDone = false
    let buffer = ''
    while (!streamDone) {
      if (req.signal?.aborted) {
        await reader.cancel().catch(() => {})
        throw new DOMException('Aborted', 'AbortError')
      }
      const result = await reader.read()
      streamDone = result.done
      if (!result.value) continue
      buffer += decoder.decode(result.value, { stream: true })

      const { blocks, rest } = pullCompleteSseBlocks(buffer)
      buffer = rest

      for (const block of blocks) {
        const parsed = parseSseBlock(block.trim())
        if (!parsed) continue
        if (parsed.event === 'done') return
        if (parsed.event === 'error') {
          let msg = parsed.data
          try {
            const obj = JSON.parse(parsed.data) as { message?: string }
            if (typeof obj?.message === 'string' && obj.message) msg = obj.message
          } catch {
            /* 使用原始 data */
          }
          throw new Error(msg || '代理流式请求失败')
        }
        if (parsed.event === 'token') {
          try {
            const obj = JSON.parse(parsed.data) as { token?: string }
            const t = obj.token
            if (t != null && t !== '') yield String(t)
          } catch {
            // ignore malformed token events
          }
        }
      }
    }

    if (buffer.trim()) {
      const tail = parseSseBlock(buffer.trim())
      if (tail?.event === 'done') return
      if (tail?.event === 'error') {
        let msg = tail.data
        try {
          const obj = JSON.parse(tail.data) as { message?: string }
          if (typeof obj?.message === 'string' && obj.message) msg = obj.message
        } catch {
          /* 使用原始 data */
        }
        throw new Error(msg || '代理流式请求失败')
      }
      if (tail?.event === 'token') {
        try {
          const obj = JSON.parse(tail.data) as { token?: string }
          const t = obj.token
          if (t != null && t !== '') yield String(t)
        } catch {
          /* ignore */
        }
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof Error && error.name === 'AbortError') throw error
    const reason = error instanceof Error ? error.message : '未知错误'
    const fallback = `实时 AI 请求失败，已自动切换本地降级回复。\n\n问题：${req.prompt}\n\n失败原因：${reason}\n\n建议：\n1. 确认后端代理服务正在运行（http://localhost:8787/health）。\n2. 在后端环境变量中配置 TONGYI_API_KEY。\n3. 若仍失败，检查 Key 配额与模型权限。`
    yield* streamTextChunks(fallback, 7, req.signal)
  }
}

export function generateReact19Code(prompt: string): string {
  return `import { Suspense, use } from "react";

type Props = { title: string };

async function getData() {
  return Promise.resolve("${prompt}");
}

function Content() {
  const text = use(getData());
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

export default function SmartPanel({ title }: Props) {
  async function submitAction(formData: FormData) {
    "use server";
    console.log("Action payload:", formData.get("query"));
  }

  return (
    <section className="rounded-xl border p-4">
      <h2 className="font-semibold">{title}</h2>
      <Suspense fallback={<p>Loading...</p>}>
        <Content />
      </Suspense>
      <form action={submitAction} className="mt-3 flex gap-2">
        <input name="query" className="border rounded px-2 py-1" />
        <button className="border rounded px-3 py-1">提交</button>
      </form>
    </section>
  );
}`
}

export function generateSwaggerDoc(apiDescription: string): string {
  return JSON.stringify(
    {
      openapi: '3.0.0',
      info: {
        title: 'AI Generated API',
        version: '1.0.0',
        description: apiDescription,
      },
      paths: {
        '/tasks': {
          get: {
            summary: '查询任务列表',
            responses: { 200: { description: 'OK' } },
          },
          post: {
            summary: '创建任务',
            responses: { 201: { description: 'Created' } },
          },
        },
      },
    },
    null,
    2,
  )
}

export function runFunctionCalling(prompt: string): FunctionCallResult {
  return {
    name: 'analyzePerformance',
    input: { prompt, timestamp: Date.now() },
    output: '已识别 3 个性能优化点：拆分代码块、减少重渲染、开启资源懒加载。',
  }
}

export function createMessage(
  role: ChatMessage['role'],
  content: string,
  quote?: ChatMessage['quote'],
): ChatMessage {
  const base: ChatMessage = { id: uid('msg'), role, content, createdAt: Date.now() }
  if (quote && quote.content.trim()) {
    return { ...base, quote: { content: quote.content.trim(), fromRole: quote.fromRole } }
  }
  return base
}
