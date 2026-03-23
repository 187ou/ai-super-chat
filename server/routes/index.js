import { registerChatRoutes } from './chat.js'
import { registerCodegenRoutes } from './codegen.js'
import { registerRagRoutes } from './rag.js'

/** 挂载所有 API 路由 */
export function registerRoutes(app) {
  registerChatRoutes(app)
  registerCodegenRoutes(app)
  registerRagRoutes(app)
}

export { registerChatRoutes } from './chat.js'
export { registerCodegenRoutes } from './codegen.js'
export { registerRagRoutes } from './rag.js'
