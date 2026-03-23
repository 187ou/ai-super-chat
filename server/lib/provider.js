/** 通义 / DashScope 文本与视觉接口配置 */
export function buildProviderConfig() {
  const apiUrl =
    process.env.TONGYI_API_URL ||
    process.env.VITE_TONGYI_API_URL ||
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
  /** 视觉模型（多模态）若与纯文本不同 endpoint，可显式配置；未配置则与 apiUrl 相同 */
  const visionApiUrl =
    process.env.VISION_API_URL || process.env.VITE_VISION_API_URL || apiUrl
  const apiKey = process.env.TONGYI_API_KEY || process.env.VITE_TONGYI_API_KEY
  const model = process.env.MODEL_NAME || process.env.VITE_MODEL_NAME || 'qwen-plus'
  return { apiUrl, visionApiUrl, apiKey, model }
}
