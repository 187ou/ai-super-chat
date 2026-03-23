/** 从首条用户消息提取对话标题：首行、去多余空白、截断 */
export function extractConversationTitle(text: string, maxLen = 40): string {
  const normalized = text.replace(/\r\n/g, '\n').trim().replace(/\s+/g, ' ')
  if (!normalized) return '新对话'
  const firstLine = (normalized.split('\n')[0] ?? '').trim()
  if (!firstLine) return '新对话'
  if (firstLine.length <= maxLen) return firstLine
  return `${firstLine.slice(0, maxLen).trimEnd()}…`
}

export function firstUserMessageContent(messages: { role: string; content: string }[]): string | null {
  const u = messages.find((m) => m.role === 'user')
  return u?.content?.trim() ? u.content : null
}
