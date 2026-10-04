import { useCallback, useRef, useState } from 'react'
import type { AgentEvent, AgentMessage, ConversationSummary, InteractionPayload } from '../types/agent'
import { createConversation, executeAgentStream, getConversation, submitAgentInteraction } from '../lib/agent-api'
import { reduceAgentEvent } from '../lib/agent-reducer'

export interface UseAgentStreamReturn {
  messages: AgentMessage[]
  isStreaming: boolean
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  loadConversation: (id: string) => Promise<void>
  createNewConversation: () => Promise<void>
  sendMessage: (text: string) => Promise<void>
  stopStream: () => void
  handleInteraction: (payload: InteractionPayload) => Promise<void>
  clearMessages: () => void
}

import { FrontendPerfTracker } from '../lib/perfTracker'

export function useAgentStream(initialConversation?: ConversationSummary | null): UseAgentStreamReturn {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversation?.id || null,
  )

  const abortControllerRef = useRef<AbortController | null>(null)

  const loadConversation = useCallback(async (id: string) => {
    setActiveConversationId(id)
    try {
      const detailed = await getConversation(id)
      if (detailed && Array.isArray(detailed.messages)) {
        setMessages(detailed.messages)
      } else {
        setMessages([])
      }
    } catch {
      setMessages([])
    }
  }, [])

  const createNewConversation = useCallback(async () => {
    if (messages.length === 0 && activeConversationId) {
      return
    }

    try {
      const newConv = await createConversation()
      setActiveConversationId(newConv.id)
      setMessages([])
    } catch {
      setActiveConversationId(null)
      setMessages([])
    }
  }, [messages.length, activeConversationId])

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return

      const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const userMessageId = `user_${Date.now()}`
      const assistantMessageId = `asst_${Date.now()}`
      let convId = activeConversationId

      if (!convId) {
        try {
          const newConv = await createConversation()
          convId = newConv.id
          setActiveConversationId(convId)
        } catch {
          convId = `conv_${Date.now()}`
          setActiveConversationId(convId)
        }
      }

      const tracker = new FrontendPerfTracker(requestId, convId)
      tracker.log({ module: 'useAgentStream.ts', operation: 'user submit' })

      const userMsg: AgentMessage = {
        id: userMessageId,
        role: 'user',
        blocks: [{ type: 'text', messageId: `txt_${userMessageId}`, content: text }],
        status: 'completed',
        timestamp: Date.now(),
      }

      const assistantMsg: AgentMessage = {
        id: assistantMessageId,
        role: 'assistant',
        blocks: [],
        status: 'streaming',
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setIsStreaming(true)

      const controller = new AbortController()
      abortControllerRef.current = controller

      await executeAgentStream({
        message: text,
        conversationId: convId,
        requestId,
        tracker,
        signal: controller.signal,
        onEvent: (event: AgentEvent) => {
          tracker.log({
            module: 'useAgentStream.ts',
            operation: 'reducer',
            eventId: event.id,
            eventType: event.type,
          })
          setMessages((prev) => {
            tracker.log({
              module: 'useAgentStream.ts',
              operation: 'state update',
              eventId: event.id,
              eventType: event.type,
            })
            const lastIndex = prev.length - 1
            if (lastIndex < 0 || prev[lastIndex].id !== assistantMessageId) {
              return prev
            }
            const updatedAsst = reduceAgentEvent(prev[lastIndex], event)
            const updated = [...prev]
            updated[lastIndex] = updatedAsst
            return updated
          })
        },
        onError: (err: Error) => {
          tracker.log({ module: 'useAgentStream.ts', operation: 'onError', extra: { message: err.message } })
          setMessages((prev) => {
            const lastIndex = prev.length - 1
            if (lastIndex < 0 || prev[lastIndex].id !== assistantMessageId) {
              return prev
            }
            const currentAsst = prev[lastIndex]
            const updated: AgentMessage = {
              ...currentAsst,
              status: 'failed',
              blocks: [
                ...currentAsst.blocks,
                {
                  type: 'error',
                  message: err.message || 'Stream encountered an error.',
                },
              ],
            }
            const list = [...prev]
            list[lastIndex] = updated
            return list
          })
          setIsStreaming(false)
          tracker.printTimeline()
        },
        onComplete: () => {
          tracker.log({ module: 'useAgentStream.ts', operation: 'onComplete' })
          setMessages((prev) => {
            const lastIndex = prev.length - 1
            if (lastIndex < 0 || prev[lastIndex].id !== assistantMessageId) {
              return prev
            }
            const currentAsst = prev[lastIndex]
            if (currentAsst.status === 'streaming') {
              const updated: AgentMessage = {
                ...currentAsst,
                status: 'completed',
              }
              const list = [...prev]
              list[lastIndex] = updated
              return list
            }
            return prev
          })
          setIsStreaming(false)
          tracker.printTimeline()
        },
      })
    },
    [activeConversationId, isStreaming],
  )

  const handleInteraction = useCallback(
    async (payload: InteractionPayload) => {
      // 1. Mark the corresponding block as answered/uploaded in state
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.role !== 'assistant') return msg
          const updatedBlocks = msg.blocks.map((block) => {
            if (
              block.type === 'question' &&
              payload.questionId &&
              block.data.questionId === payload.questionId
            ) {
              return {
                ...block,
                answered: true,
                selectedResponse: String(payload.response.value),
              }
            }
            if (
              block.type === 'confirmation' &&
              payload.confirmationId &&
              block.data.confirmationId === payload.confirmationId
            ) {
              return {
                ...block,
                answered: true,
                approved: Boolean(payload.response.value),
              }
            }
            if (
              block.type === 'upload_required' &&
              payload.uploadId &&
              block.data.uploadId === payload.uploadId
            ) {
              const val = payload.response.value as { key?: string }
              return {
                ...block,
                uploaded: true,
                uploadedKey: val?.key || 'uploaded_image',
              }
            }
            return block
          })
          return { ...msg, blocks: updatedBlocks }
        }),
      )

      // 2. Prepare new assistant message to receive graph stream after resume
      const responseVal = String(payload.response.value || '')
      const assistantMessageId = `asst_${Date.now()}`
      let receivedStreamEvent = false
      setIsStreaming(true)

      const assistantMsg: AgentMessage = {
        id: assistantMessageId,
        role: 'assistant',
        blocks: [],
        status: 'streaming',
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMsg])

      await submitAgentInteraction(
        payload,
        (event) => {
          receivedStreamEvent = true
          setMessages((prev) => {
            const lastIndex = prev.length - 1
            if (lastIndex < 0 || prev[lastIndex].id !== assistantMessageId) return prev
            const updatedAsst = reduceAgentEvent(prev[lastIndex], event)
            const list = [...prev]
            list[lastIndex] = updatedAsst
            return list
          })
        },
        () => {
          setIsStreaming(false)
          setMessages((prev) => {
            const lastIndex = prev.length - 1
            if (lastIndex < 0 || prev[lastIndex].id !== assistantMessageId) return prev
            const currentAsst = prev[lastIndex]
            if (currentAsst.status === 'streaming') {
              const list = [...prev]
              list[lastIndex] = { ...currentAsst, status: 'completed' }
              return list
            }
            return prev
          })
        },
      )

      // 3. Fallback: if no active graph interrupt received events, process as standard message
      if (!receivedStreamEvent && responseVal) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantMessageId))
        setIsStreaming(false)
        await sendMessage(responseVal)
      }
    },
    [sendMessage],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setActiveConversationId(null)
  }, [])

  return {
    messages,
    isStreaming,
    activeConversationId,
    setActiveConversationId,
    loadConversation,
    createNewConversation,
    sendMessage,
    stopStream,
    handleInteraction,
    clearMessages,
  }
}
