import { buildProviderConfig } from '../lib/provider.js'
import { pipeUpstreamSseToClient, setSseResponseHeaders, writeSse } from '../lib/sse.js'
import { chunkText } from '../rag/chunking.js'
import { retrieveTopChunks } from '../rag/retrieve.js'
import { createKb, loadKb, deleteKb as deleteKbFromStore } from '../rag/kbStore.js'

function getTotalChars(docs) {
  return docs.reduce((acc, d) => acc + String(d.content ?? '').length, 0)
}

export function registerRagRoutes(app) {
  app.post('/api/rag/kb/upload', async (req, res) => {
    const { name = '', docs } = req.body ?? {}
    if (!Array.isArray(docs) || !docs.length) {
      res.status(400).json({ error: 'docs 不能为空（至少 1 个文档）' })
      return
    }

    const totalChars = getTotalChars(docs)
    if (totalChars > 200000) {
      res.status(400).json({ error: `文档总字符数过大（>${200000}），请上传更小的内容` })
      return
    }

    // 逐文档切分，保留来源，便于 prompt 内引用
    const chunks = []
    let idx = 1
    for (const d of docs) {
      const filename = String(d.filename ?? 'unknown')
      const content = String(d.content ?? '')
      const parts = chunkText(content, { chunkSize: 1200, overlap: 150, maxChunks: 200 })
      for (const p of parts) {
        chunks.push({ id: idx++, source: filename, text: p })
      }
      if (chunks.length > 2000) {
        res.status(400).json({ error: '切分片段过多，请减少文档大小或文件数量' })
        return
      }
    }

    const kb = await createKb({ name, chunks })
    res.json({ kbId: kb.id, chunkCount: kb.chunkCount })
  })

  app.post('/api/rag/kb/delete', async (req, res) => {
    const { kbId } = req.body ?? {}
    if (!kbId || typeof kbId !== 'string') {
      res.status(400).json({ error: 'kbId 无效' })
      return
    }
    await deleteKbFromStore(kbId)
    res.json({ ok: true })
  })

  app.post('/api/rag/answer', async (req, res) => {
    const { apiUrl, apiKey, model } = buildProviderConfig()
    setSseResponseHeaders(res)

    const { kbId, question } = req.body ?? {}
    if (!apiKey) {
      writeSse(res, 'error', { message: 'Missing server API key. Please set TONGYI_API_KEY.' })
      res.end()
      return
    }
    if (!kbId || typeof kbId !== 'string') {
      writeSse(res, 'error', { message: 'kbId 不能为空' })
      res.end()
      return
    }
    if (!question || typeof question !== 'string') {
      writeSse(res, 'error', { message: 'question 不能为空' })
      res.end()
      return
    }

    let kb
    try {
      kb = await loadKb(kbId)
    } catch {
      writeSse(res, 'error', { message: `知识库不存在：${kbId}` })
      res.end()
      return
    }

    const retrieved = retrieveTopChunks(kb.chunks ?? [], question, { topK: 6 })
    const snippets = retrieved
      .map((c, i) => `片段 ${i + 1}（来源：${c.source}）\n${String(c.text ?? '')}`)
      .join('\n\n')

    const prompt = [
      '你是一名 RAG 知识库问答助手。',
      '请基于“片段”中的信息回答用户问题。',
      '如果片段不足以回答，请明确说明：知识库未包含足够信息，并尽量给出建议如何补充材料。',
      '',
      `用户问题：\n${question}`,
      '',
      `知识库检索片段：\n${snippets}`,
      '',
      '请输出：',
      '1. 直接答案',
      '2. 依据片段的要点（必要时可逐条引用片段编号）',
    ].join('\n')

    try {
      const upstream = await fetch(apiUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-DashScope-SSE': 'enable',
        },
        body: JSON.stringify({
          model,
          input: {
            messages: [{ role: 'user', content: prompt }],
          },
          parameters: {
            result_format: 'message',
            incremental_output: true,
          },
        }),
      })

      await pipeUpstreamSseToClient(res, upstream)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Proxy internal error.'
      writeSse(res, 'error', { message })
      res.end()
    }
  })
}

