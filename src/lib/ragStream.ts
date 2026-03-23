import { parseSseBlock, pullCompleteSseBlocks } from './ai'

type RagDoc = { filename: string; content: string }

function getRagProxyUrlFor(pathname: string): string {
  const explicit = import.meta.env.VITE_RAG_PROXY_URL as string | undefined
  if (explicit) return explicit.replace(/\/$/, '') + pathname

  const ai = import.meta.env.VITE_AI_PROXY_URL as string | undefined
  const fallback = `http://localhost:8787${pathname}`
  if (!ai) return fallback

  // 兼容你现有的环境：VITE_AI_PROXY_URL 默认为 /api/chat/stream
  if (ai.includes('/api/chat/stream')) return ai.replace('/api/chat/stream', pathname)
  if (ai.includes('/api/codegen/stream')) return ai.replace('/api/codegen/stream', pathname)
  if (ai.includes('/api/rag/answer')) return ai.replace('/api/rag/answer', pathname)

  try {
    const u = new URL(ai)
    u.pathname = pathname
    return u.href
  } catch {
    return fallback
  }
}

export async function uploadRagKb(params: {
  name?: string
  docs: RagDoc[]
  signal?: AbortSignal
}): Promise<{ kbId: string; chunkCount: number }> {
  const endpoint = getRagProxyUrlFor('/api/rag/kb/upload')
  const res = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    signal: params.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: params.name ?? '',
      docs: params.docs.map((d) => ({ filename: d.filename, content: d.content })),
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`建库失败(${res.status})：${detail || '无错误详情'}`)
  }

  const data = (await res.json()) as { kbId?: string; chunkCount?: number; message?: string }
  if (!data.kbId) throw new Error(data.message || '建库失败：未返回 kbId')
  return { kbId: data.kbId, chunkCount: data.chunkCount ?? 0 }
}

export async function deleteRagKb(params: { kbId: string; signal?: AbortSignal }): Promise<void> {
  const endpoint = getRagProxyUrlFor('/api/rag/kb/delete')
  const res = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    signal: params.signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kbId: params.kbId }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`清空知识库失败(${res.status})：${detail || '无错误详情'}`)
  }
}

export async function* streamRagAnswer(params: {
  kbId: string
  question: string
  signal?: AbortSignal
}): AsyncGenerator<string> {
  const endpoint = getRagProxyUrlFor('/api/rag/answer')
  const response = await fetch(endpoint, {
    method: 'POST',
    cache: 'no-store',
    signal: params.signal,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      kbId: params.kbId,
      question: params.question,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`RAG 请求失败(${response.status})：${detail || '无错误详情'}`)
  }

  if (!response.body) {
    throw new Error('流式响应不可用，请检查接口配置。')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let streamDone = false
  let buffer = ''

  while (!streamDone) {
    if (params.signal?.aborted) {
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
        throw new Error(msg || 'RAG 流式请求失败')
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
      throw new Error(msg || 'RAG 流式请求失败')
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
}

