import { useCallback, useEffect, useRef, useState } from 'react'
import { createMessage } from '../lib/ai'
import { extractConversationTitle, firstUserMessageContent } from '../lib/conversationTitle'
import { getConversations, setConversations, syncConversationsToCloud } from '../lib/storage'
import type { ChatMessage, Conversation } from '../types'
import { uid } from '../lib/utils'

export function useConversation() {
  const [conversations, setLocalConversations] = useState<Conversation[]>(() => getConversations())
  const [activeId, setActiveId] = useState<string>(() => getConversations()[0]?.id ?? '')
  /** 与 state 同步；同一轮 async（如连续两次 appendMessage）里 state 可能未更新，必须用 ref 读到最新会话 id */
  const activeIdRef = useRef(activeId)
  useEffect(() => {
    activeIdRef.current = activeId
  }, [activeId])

  const persist = useCallback(async (next: Conversation[]) => {
    setLocalConversations(next)
    setConversations(next)
    await syncConversationsToCloud(next)
  }, [])

  const selectConversation = useCallback((id: string) => {
    activeIdRef.current = id
    setActiveId(id)
  }, [])

  const ensureConversation = useCallback(async () => {
    const list = getConversations()
    const effectiveId = activeIdRef.current
    if (effectiveId && list.some((c) => c.id === effectiveId)) {
      return effectiveId
    }
    const id = uid('conv')
    const nextConversation: Conversation = { id, title: '新对话', updatedAt: Date.now(), messages: [] }
    await persist([nextConversation, ...list])
    activeIdRef.current = id
    setActiveId(id)
    return id
  }, [persist])

  const appendMessage = useCallback(
    async (message: ChatMessage) => {
      const cid = await ensureConversation()
      const latest = getConversations()
      const target = latest.find((c) => c.id === cid)
      if (!target) {
        const merged: ChatMessage[] = [message]
        const firstUser = firstUserMessageContent(merged)
        const fresh: Conversation = {
          id: cid,
          title: firstUser ? extractConversationTitle(firstUser) : extractConversationTitle(message.content),
          updatedAt: Date.now(),
          messages: merged,
        }
        await persist([fresh, ...latest.filter((c) => c.id !== cid)])
        return
      }
      const mergedMessages = [...target.messages, message]
      const firstUser = firstUserMessageContent(mergedMessages)
      const nextTitle =
        !target.titleLocked && firstUser
          ? extractConversationTitle(firstUser)
          : target.title
      const next = latest.map((conversation) =>
        conversation.id === cid
          ? {
              ...conversation,
              title: nextTitle,
              updatedAt: Date.now(),
              messages: mergedMessages,
            }
          : conversation,
      )
      await persist(next)
    },
    [ensureConversation, persist],
  )

  const createUserMessage = useCallback(
    (content: string, quote?: ChatMessage['quote']) => createMessage('user', content, quote),
    [],
  )
  const createAssistantMessage = useCallback((content: string) => createMessage('assistant', content), [])

  /** 新建空对话并切换到该对话（不清除其它历史） */
  const createNewConversation = useCallback(async () => {
    const list = getConversations()
    const id = uid('conv')
    const conv: Conversation = { id, title: '新对话', updatedAt: Date.now(), messages: [] }
    await persist([conv, ...list])
    activeIdRef.current = id
    setActiveId(id)
  }, [persist])

  const deleteConversation = useCallback(
    async (id: string) => {
      const latest = getConversations()
      const next = latest.filter((c) => c.id !== id)
      await persist(next)
      if (activeIdRef.current === id) {
        const newActive = next[0]?.id ?? ''
        activeIdRef.current = newActive
        setActiveId(newActive)
      }
    },
    [persist],
  )

  /** 手动重命名并锁定，避免被自动标题覆盖 */
  const renameConversation = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      const latest = getConversations()
      const next = latest.map((c) =>
        c.id === id ? { ...c, title: trimmed, titleLocked: true, updatedAt: Date.now() } : c,
      )
      await persist(next)
    },
    [persist],
  )

  /** 按首条用户消息重新生成标题并恢复自动更新 */
  const regenerateConversationTitle = useCallback(
    async (id: string) => {
      const latest = getConversations()
      const target = latest.find((c) => c.id === id)
      if (!target) return
      const first = firstUserMessageContent(target.messages)
      const title = first ? extractConversationTitle(first) : '新对话'
      const next = latest.map((c) =>
        c.id === id ? { ...c, title, titleLocked: false, updatedAt: Date.now() } : c,
      )
      await persist(next)
    },
    [persist],
  )

  const clearAll = useCallback(async () => {
    await persist([])
    activeIdRef.current = ''
    setActiveId('')
  }, [persist])

  /** 替换当前会话消息列表（用于编辑/删除/重新生成） */
  const replaceActiveMessages = useCallback(
    async (messages: ChatMessage[]) => {
      const cid = activeIdRef.current
      if (!cid) return
      const latest = getConversations()
      const target = latest.find((c) => c.id === cid)
      if (!target) return
      const firstUser = firstUserMessageContent(messages)
      const nextTitle =
        !target.titleLocked && firstUser ? extractConversationTitle(firstUser) : target.title
      const next = latest.map((c) =>
        c.id === cid ? { ...c, messages, title: nextTitle, updatedAt: Date.now() } : c,
      )
      await persist(next)
    },
    [persist],
  )

  const deleteMessageInActive = useCallback(
    async (messageId: string) => {
      const cid = activeIdRef.current
      if (!cid) return
      const latest = getConversations()
      const target = latest.find((c) => c.id === cid)
      if (!target) return
      await replaceActiveMessages(target.messages.filter((m) => m.id !== messageId))
    },
    [replaceActiveMessages],
  )

  /** 修改用户消息并删除其后的所有消息 */
  const updateUserMessageInActive = useCallback(
    async (messageId: string, content: string) => {
      const cid = activeIdRef.current
      if (!cid) return
      const latest = getConversations()
      const target = latest.find((c) => c.id === cid)
      if (!target) return
      const idx = target.messages.findIndex((m) => m.id === messageId)
      if (idx === -1 || target.messages[idx].role !== 'user') return
      const trimmed = content.trim()
      if (!trimmed) return
      const prev = target.messages[idx]
      const newUser: ChatMessage = { ...prev, content: trimmed, createdAt: Date.now() }
      const messages = [...target.messages.slice(0, idx), newUser]
      await replaceActiveMessages(messages)
    },
    [replaceActiveMessages],
  )

  const current = conversations.find((c) => c.id === activeId) ?? null

  return {
    conversations,
    activeId,
    setActiveId: selectConversation,
    current,
    appendMessage,
    createUserMessage,
    createAssistantMessage,
    createNewConversation,
    deleteConversation,
    renameConversation,
    regenerateConversationTitle,
    clearAll,
    replaceActiveMessages,
    deleteMessageInActive,
    updateUserMessageInActive,
  }
}
