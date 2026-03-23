import { buildProviderConfig } from '../lib/provider.js'
import { pipeUpstreamSseToClient, setSseResponseHeaders, writeSse } from '../lib/sse.js'

export function registerChatRoutes(app) {
  app.post('/api/chat/stream', async (req, res) => {
    const { apiUrl, apiKey, model } = buildProviderConfig()
    const { prompt, history = [] } = req.body ?? {}

    setSseResponseHeaders(res)

    if (!apiKey) {
      writeSse(res, 'error', {
        message:
          'Missing server API key. Please set TONGYI_API_KEY (or VITE_TONGYI_API_KEY for compatibility).',
      })
      res.end()
      return
    }

    if (!prompt || typeof prompt !== 'string') {
      writeSse(res, 'error', { message: 'Invalid prompt.' })
      res.end()
      return
    }

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
            messages: [
              ...(Array.isArray(history) ? history : []),
              { role: 'user', content: prompt },
            ],
          },
          parameters: {
            result_format: 'message',
            incremental_output: true,
          },
        }),
      })

      await pipeUpstreamSseToClient(res, upstream)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Proxy internal error.'
      writeSse(res, 'error', { message })
      res.end()
    }
  })
}
