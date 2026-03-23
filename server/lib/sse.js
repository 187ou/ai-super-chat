/**
 * DashScope SSE 解析与回写前端（与 ai.ts 分帧逻辑一致）
 */

export function readTextFromPayload(payload) {
  if (!payload || typeof payload !== 'object') return ''

  /**
   * 更通用的文本提取：递归收集对象/数组里出现的 string 片段（优先 text/content/value）。
   * 用于兼容 vision/多模态实现中 message.content 可能是数组或对象的情况。
   */
  function toText(v) {
    if (v == null) return ''
    const out = []
    const visit = (node) => {
      if (node == null) return
      if (typeof node === 'string') {
        if (node) out.push(node)
        return
      }
      if (typeof node === 'number') {
        if (!Number.isNaN(node)) out.push(String(node))
        return
      }
      if (Array.isArray(node)) {
        for (const it of node) visit(it)
        return
      }
      if (typeof node === 'object') {
        // 常见键优先
        if (typeof node.text === 'string' && node.text) out.push(node.text)
        if (typeof node.content === 'string' && node.content) out.push(node.content)
        if (typeof node.value === 'string' && node.value) out.push(node.value)
        if (typeof node.type === 'string' && node.type === 'text' && typeof node.text === 'string' && node.text) out.push(node.text)
        // 常见数组容器
        if (Array.isArray(node.content)) visit(node.content)
        if (Array.isArray(node.parts)) visit(node.parts)
        return
      }
    }
    visit(v)
    return out.join('')
  }

  const candidates = [
    payload?.output?.choices?.[0]?.message?.content,
    payload?.output?.choices?.[0]?.delta?.content,
    payload?.output?.choices?.[0]?.delta?.text,
    payload?.output?.choices?.[0]?.message?.content?.text,
    payload?.output?.choices?.[0]?.message?.content?.[0]?.text,
    payload?.output?.choices?.[0]?.delta?.content?.[0]?.text,
    payload?.output?.text,
    payload?.choices?.[0]?.delta?.content,
    payload?.choices?.[0]?.delta?.text,
    payload?.choices?.[0]?.message?.content,
  ]

  for (const c of candidates) {
    const t = toText(c)
    if (t) return t
  }

  // 兜底：全 payload 深度扫描常见文本键，兼容 choices 为空但内容在其它字段的实现
  const deepTexts = []
  const visited = new Set()
  const allowKeys = new Set(['text', 'content', 'value', 'output_text', 'answer', 'message', 'delta'])
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  const walk = (node, parentKey = '') => {
    if (node == null) return
    if (typeof node === 'string') {
      const s = node.trim()
      // 过滤 UUID / request_id / 各类 *_id，避免把非内容字段拼进“回答文本”
      if (!s) return
      if (uuidRegex.test(s)) return
      if (parentKey.endsWith('_id') || parentKey === 'id') return
      if (allowKeys.has(parentKey) || s.length > 20) deepTexts.push(s)
      return
    }
    if (typeof node !== 'object') return
    if (visited.has(node)) return
    visited.add(node)
    if (Array.isArray(node)) {
      for (const it of node) walk(it, parentKey)
      return
    }
    for (const [k, v] of Object.entries(node)) walk(v, k)
  }
  walk(payload)
  if (deepTexts.length) return deepTexts.join('')

  return ''
}

/** 与前端一致：\r\n 规范成 \n 再按空行分帧 */
export function pullSseFrames(buffer) {
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  const incomplete = parts.pop() ?? ''
  return { frames: parts, incomplete }
}

export function jsonFromSseFrame(frame) {
  const lines = frame.split('\n')
  const dataLines = []
  for (const raw of lines) {
    const line = raw.trimEnd()
    const t = line.trim()
    if (!t) continue
    if (t.startsWith('data:')) dataLines.push(line.slice(line.indexOf(':') + 1).trimStart())
  }
  if (!dataLines.length) return null
  const joined = dataLines.join('\n')
  try {
    return JSON.parse(joined)
  } catch {
    return null
  }
}

export function writeSse(res, event, data) {
  res.write(`event: ${event}\n`)
  res.write(`data: ${JSON.stringify(data)}\n\n`)
  if (typeof res.flush === 'function') res.flush()
}

export function setSseResponseHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
}

/**
 * 将 DashScope 流式响应转为前端 SSE token 事件；成功结束时已 res.end()
 * @returns {Promise<boolean>} 是否成功完成流式输出（false 表示已写 error 并 end）
 */
export async function pipeUpstreamSseToClient(res, upstream) {
  if (!upstream.ok) {
    const text = await upstream.text()
    writeSse(res, 'error', { message: text || `Upstream request failed (${upstream.status}).` })
    res.end()
    return false
  }

  if (!upstream.body) {
    writeSse(res, 'error', { message: 'Upstream stream body is empty.' })
    res.end()
    return false
  }

  if (res.socket) res.socket.setNoDelay(true)
  res.write(': stream\n\n')

  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let done = false
  let buffer = ''
  let fullText = ''
  let sentAnyToken = false
  const sseDebug = process.env.SSE_DEBUG === '1'
  let debugFrames = 0

  while (!done) {
    const chunk = await reader.read()
    done = chunk.done
    if (!chunk.value) continue
    buffer += decoder.decode(chunk.value, { stream: true })

    const { frames, incomplete } = pullSseFrames(buffer)
    buffer = incomplete

    for (const frame of frames) {
      const trimmed = frame.trim()
      if (!trimmed) continue
      const parsed = jsonFromSseFrame(trimmed)
      if (!parsed) continue
      const upstreamCode = typeof parsed?.code === 'string' ? parsed.code : ''
      const upstreamMessage = typeof parsed?.message === 'string' ? parsed.message : ''
      // DashScope 有些错误会以 SSE data 帧下发（HTTP 仍可能是 200）
      if (upstreamCode && upstreamCode !== 'Success' && upstreamCode !== '200') {
        writeSse(res, 'error', {
          message: upstreamMessage || `Upstream error: ${upstreamCode}`,
          code: upstreamCode,
          request_id: parsed?.request_id,
        })
        res.end()
        return false
      }
      const text = readTextFromPayload(parsed)
      if (sseDebug && debugFrames < 3) {
        debugFrames += 1
        const choice0 = parsed?.output?.choices?.[0] ?? parsed?.choices?.[0]
        // eslint-disable-next-line no-console
        console.log(
          '[SSE_DEBUG] frame',
          debugFrames,
          'textLen=',
          text?.length ?? 0,
          'choiceKeys=',
          Object.keys(choice0 ?? {}),
        )
        // eslint-disable-next-line no-console
        console.log(
          '[SSE_DEBUG] topKeys=',
          Object.keys(parsed ?? {}),
          'outputKeys=',
          Object.keys(parsed?.output ?? {}),
        )
        // eslint-disable-next-line no-console
        console.log(
          '[SSE_DEBUG] choice0 sample=',
          JSON.stringify(
            {
              output: parsed?.output,
              delta: choice0?.delta,
              message: choice0?.message,
              text: choice0?.delta?.text,
              content: choice0?.delta?.content,
            },
            null,
            2,
          ).slice(0, 5000),
        )
      }
      if (!text) continue

      const delta = text.startsWith(fullText) ? text.slice(fullText.length) : text
      fullText = text
      if (delta) {
        sentAnyToken = true
        writeSse(res, 'token', { token: delta })
      }
    }
  }

  if (buffer.trim()) {
    let parsed = jsonFromSseFrame(buffer)
    if (!parsed) {
      const tail = buffer.trim()
      const stripped = tail.replace(/^data:\s*/m, '').trim()
      try {
        parsed = JSON.parse(stripped)
      } catch {
        parsed = null
      }
    }
    if (parsed) {
      const upstreamCode = typeof parsed?.code === 'string' ? parsed.code : ''
      const upstreamMessage = typeof parsed?.message === 'string' ? parsed.message : ''
      if (upstreamCode && upstreamCode !== 'Success' && upstreamCode !== '200') {
        writeSse(res, 'error', {
          message: upstreamMessage || `Upstream error: ${upstreamCode}`,
          code: upstreamCode,
          request_id: parsed?.request_id,
        })
        res.end()
        return false
      }
      const text = readTextFromPayload(parsed)
      const delta = text ? (text.startsWith(fullText) ? text.slice(fullText.length) : text) : ''
      if (!sentAnyToken && delta) writeSse(res, 'token', { token: delta })
    }
  }

  writeSse(res, 'done', { done: true })
  res.end()
  return true
}
