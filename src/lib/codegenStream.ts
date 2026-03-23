import { generateReact19Code, generateSwaggerDoc, parseSseBlock, pullCompleteSseBlocks } from './ai'
import type { CodegenScenarioId } from './codegenScenarios'
import { streamTextChunks } from './utils'

export function getCodegenProxyUrl(): string {
  const explicit = import.meta.env.VITE_CODEGEN_PROXY_URL as string | undefined
  if (explicit) return explicit
  const chat =
    (import.meta.env.VITE_AI_PROXY_URL as string | undefined) || 'http://localhost:8787/api/chat/stream'
  if (chat.includes('/api/chat/stream')) {
    return chat.replace('/api/chat/stream', '/api/codegen/stream')
  }
  try {
    const u = new URL(chat)
    u.pathname = '/api/codegen/stream'
    return u.href
  } catch {
    return 'http://localhost:8787/api/codegen/stream'
  }
}

/** 提取 markdown 中所有代码块（按出现顺序） */
export function extractCodeBlockListFromMarkdown(text: string): string[] {
  const trimmed = text.trim()
  const re = /```(?:[\w-]+)?\s*\n?([\s\S]*?)```/g
  const blocks: string[] = []
  let m: RegExpExecArray | null = null
  while ((m = re.exec(trimmed)) !== null) {
    const code = m[1]?.trim()
    if (code) blocks.push(code)
  }
  return blocks
}

/**
 * 从模型回复中提取所有 markdown 代码块内容并拼接展示；无代码块则返回全文 trim。
 */
export function extractCodeBlocksFromMarkdown(text: string): string {
  const trimmed = text.trim()
  const blocks = extractCodeBlockListFromMarkdown(trimmed)
  if (!blocks.length) return trimmed
  return blocks.join('\n\n\n')
}

/** 兼容旧调用名 */
export const extractCodeBlockFromMarkdown = extractCodeBlocksFromMarkdown

interface CodegenRequest {
  prompt: string
  /** 代码生成场景，与后端 `/api/codegen/stream` 的 `scenario` 一致 */
  scenario?: CodegenScenarioId
  /** UI 截图模式：data URL（如 `data:image/png;base64,...`） */
  imageBase64?: string | null
  /**
   * 是否在请求失败时使用本地降级模板并继续“模拟输出”。
   * 多模态场景为了排查错误，建议关闭该项。
   */
  enableLocalFallback?: boolean
  signal?: AbortSignal
}

/**
 * 流式生成代码（SSE，与聊天共用代理形态；后端 /api/codegen/stream）
 */
export async function* streamCodegen(req: CodegenRequest): AsyncGenerator<string> {
  const proxyEndpoint = getCodegenProxyUrl()

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
        scenario: req.scenario ?? 'natural',
        ...(req.imageBase64 ? { imageBase64: req.imageBase64 } : {}),
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`代码生成请求失败(${response.status})：${detail || '无错误详情'}`)
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
          throw new Error(msg || '代码生成流式请求失败')
        }
        if (parsed.event === 'token') {
          try {
            const obj = JSON.parse(parsed.data) as { token?: string }
            const t = obj.token
            if (t != null && t !== '') yield String(t)
          } catch {
            /* ignore */
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
        throw new Error(msg || '代码生成流式请求失败')
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
    if (req.enableLocalFallback === false) {
      throw new Error(reason)
    }
    const scenario = req.scenario ?? 'natural'
    const code = scenario === 'apidoc' ? generateSwaggerDoc(req.prompt) : generateReact19Code(req.prompt)
    const fallbackLang = scenario === 'apidoc' ? 'json' : 'tsx'
    const fallback = `以下为本地降级示例（无法连接后端或请求失败时）：\n\n失败原因：${reason}\n\n\`\`\`${fallbackLang}\n${code}\n\`\`\``
    yield* streamTextChunks(fallback, 14, req.signal)
  }
}
