/**
 * 服务端模块统一导出（测试、脚本或二次封装时从这里 import，勿用 index.js）
 */
export { createApp } from './app.js'
export { loadEnv } from './loadEnv.js'
export {
  buildCodegenMessages,
  buildCodegenUserText,
  CODEGEN_SCENARIO_SUFFIX,
  CODEGEN_SYSTEM_BASE,
} from './codegen/messages.js'
export * from './lib/index.js'
export { registerCodegenRoutes, registerChatRoutes, registerRagRoutes, registerRoutes } from './routes/index.js'
