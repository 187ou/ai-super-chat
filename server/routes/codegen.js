import { buildCodegenMessages, CODEGEN_SCENARIO_SUFFIX } from '../codegen/messages.js'
import { buildProviderConfig } from '../lib/provider.js'
import { pipeUpstreamSseToClient, setSseResponseHeaders, writeSse } from '../lib/sse.js'

export function registerCodegenRoutes(app) {
  app.post('/api/codegen/stream', async (req, res) => {
    const { apiUrl, visionApiUrl, apiKey, model } = buildProviderConfig()
    const visionModel =
      process.env.VISION_MODEL || process.env.VITE_VISION_MODEL || 'qwen-vl-plus'
    const { prompt, scenario: rawScenario = 'natural', imageBase64 } = req.body ?? {}
    const scenario =
      typeof rawScenario === 'string' && CODEGEN_SCENARIO_SUFFIX[rawScenario] ? rawScenario : 'natural'

    setSseResponseHeaders(res)

    if (!apiKey) {
      writeSse(res, 'error', {
        message:
          'Missing server API key. Please set TONGYI_API_KEY (or VITE_TONGYI_API_KEY for compatibility).',
      })
      res.end()
      return
    }

    const textPrompt = typeof prompt === 'string' ? prompt.trim() : ''
    const hasImage =
      !!(scenario === 'screenshot' && typeof imageBase64 === 'string' && imageBase64.length > 80)

    if (!textPrompt && !hasImage) {
      writeSse(res, 'error', { message: '请填写描述或上传截图。' })
      res.end()
      return
    }

    const effectivePrompt = textPrompt || (hasImage ? '请根据截图生成前端代码。' : '')
    const messages = buildCodegenMessages(scenario, effectivePrompt, imageBase64)
    const useVision = scenario === 'screenshot' && hasImage
    const modelName = useVision ? visionModel : model
    const endpointUrl = useVision ? visionApiUrl : apiUrl

    try {
      const upstream = await fetch(endpointUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'X-DashScope-SSE': 'enable',
        },
        body: JSON.stringify({
          model: modelName,
          input: {
            messages,
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
