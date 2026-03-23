export type AppRouteKey =
  | 'dashboard'
  | 'chat'
  | 'codegen'
  | 'apidoc'
  | 'charts'
  | 'debug'
  | 'multimodal'
  | 'profile'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: number
  /** 引用上游气泡内容（仅用户消息展示/拼 prompt） */
  quote?: {
    content: string
    fromRole: 'user' | 'assistant'
  }
}

export interface AppSettings {
  darkMode: boolean
  codeTheme: 'github-dark' | 'github'
  authRequired: boolean
  mockMode: boolean
  model: string
}

export interface Conversation {
  id: string
  title: string
  /** 为 true 时不再随首条用户消息自动改标题 */
  titleLocked?: boolean
  updatedAt: number
  messages: ChatMessage[]
}

export interface FunctionCallResult {
  name: string
  input: Record<string, unknown>
  output: string
}
