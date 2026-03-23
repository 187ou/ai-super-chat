import type { ChatMessage } from '../types'

/** 将用户消息（含引用）拼成发给模型的单条 prompt */
export function formatUserTurnForModel(m: ChatMessage): string {
  if (m.role !== 'user') return m.content
  if (!m.quote?.content?.trim()) return m.content
  return `【引用】\n${m.quote.content.trim()}\n\n【说明】\n${m.content.trim()}`
}

/** 单条消息转为接口所需 role/content（用户消息会展开引用） */
export function messageToApiPayload(m: ChatMessage): { role: string; content: string } {
  if (m.role === 'user') {
    return { role: 'user', content: formatUserTurnForModel(m) }
  }
  return { role: m.role, content: m.content }
}

/** 复制到剪贴板用的纯文本（含引用说明） */
export function formatMessagePlainText(m: ChatMessage): string {
  if (m.role === 'user' && m.quote?.content?.trim()) {
    const who = m.quote.fromRole === 'assistant' ? 'AI' : '用户'
    return `引用（${who}）：\n${m.quote.content.trim()}\n\n${m.content.trim()}`
  }
  return m.content
}
