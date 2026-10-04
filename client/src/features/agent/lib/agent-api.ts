import type {
  AgentBlock,
  AgentMessage,
  ConversationSummary,
  DetailedConversation,
  InteractionPayload,
  StreamAgentOptions,
} from '../types/agent'
import { streamAgent } from './agent-stream'
import {
  mockGetConversation,
  mockListConversations,
  mockStreamAgent,
  mockSubmitAgentInteraction,
} from './mock-agent-api'

const baseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api'

let conversationCache: ConversationSummary[] | null = null

export function clearConversationCache(): void {
  conversationCache = null
}

function computeGroup(dateVal: string | number | undefined): 'Today' | 'Yesterday' | 'Earlier' {
  if (!dateVal) return 'Earlier'
  const date = new Date(dateVal)
  if (isNaN(date.getTime())) return 'Earlier'

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000

  const time = date.getTime()
  if (time >= todayStart) return 'Today'
  if (time >= yesterdayStart) return 'Yesterday'
  return 'Earlier'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeConversation(item: any): ConversationSummary {
  const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : Date.now()
  const updatedAt = item.updatedAt ? new Date(item.updatedAt).getTime() : createdAt
  return {
    id: String(item.id),
    title: item.title && typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'New Conversation',
    createdAt,
    updatedAt,
    group: item.group || computeGroup(item.createdAt || item.updatedAt),
  }
}

export async function createConversation(title?: string): Promise<ConversationSummary> {
  try {
    const token = localStorage.getItem('pos-auth-token')
    const response = await fetch(`${baseUrl}/agent/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title }),
    })
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`)
    }
    const resBody = await response.json()
    const rawData = resBody?.data || resBody
    clearConversationCache()
    return normalizeConversation(rawData)
  } catch {
    const newConv: ConversationSummary = {
      id: `conv_${Date.now()}`,
      title: title || 'New Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      group: 'Today',
    }
    clearConversationCache()
    return newConv
  }
}

export async function listConversations(forceRefresh = false): Promise<ConversationSummary[]> {
  if (!forceRefresh && conversationCache !== null) {
    return conversationCache
  }

  try {
    const token = localStorage.getItem('pos-auth-token')
    const response = await fetch(`${baseUrl}/agent/conversations`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`)
    }
    const resBody = await response.json()
    const rawList = Array.isArray(resBody)
      ? resBody
      : Array.isArray(resBody?.data)
      ? resBody.data
      : []

    const list: ConversationSummary[] = rawList.map(normalizeConversation)
    conversationCache = list
    return list
  } catch {
    // Fall back to mock conversations on backend unavailability
    const mockList = await mockListConversations()
    conversationCache = mockList
    return mockList
  }
}

export async function getConversation(id: string): Promise<DetailedConversation | null> {
  try {
    const token = localStorage.getItem('pos-auth-token')
    const response = await fetch(`${baseUrl}/agent/conversations/${id}`, {
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`)
    }
    const resBody = await response.json()
    const rawData = resBody?.data || resBody
    if (!rawData) return null

    const summary = normalizeConversation(rawData)
    const rawMessages = Array.isArray(rawData.messages) ? rawData.messages : []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messages: AgentMessage[] = rawMessages.map((m: any) => {
      const blocks: AgentBlock[] = [
        {
          type: 'text',
          messageId: `txt_${m.id || Math.random()}`,
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
        },
      ]
      return {
        id: String(m.id || `msg_${Math.random()}`),
        role: m.role === 'user' ? 'user' : 'assistant',
        blocks,
        status: 'completed',
        timestamp: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
      }
    })

    return {
      ...summary,
      messages,
    }
  } catch {
    const mock = await mockGetConversation(id)
    if (!mock) return null
    return {
      ...mock,
      messages: [],
    }
  }
}

export async function submitAgentInteraction(payload: InteractionPayload): Promise<{ success: boolean; message: string }> {
  try {
    const token = localStorage.getItem('pos-auth-token')
    const response = await fetch(`${baseUrl}/agent/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`)
    }
    return (await response.json()) as { success: boolean; message: string }
  } catch {
    return mockSubmitAgentInteraction(payload)
  }
}

export async function executeAgentStream(options: StreamAgentOptions): Promise<void> {
  // Invalidate conversation list cache so fresh conversation appears in history
  clearConversationCache()

  let receivedAnyEvent = false

  const handleEvent = (event: Parameters<StreamAgentOptions['onEvent']>[0]) => {
    receivedAnyEvent = true
    options.onEvent(event)
  }

  try {
    await streamAgent({
      ...options,
      url: `${baseUrl}/agent/stream`,
      onEvent: handleEvent,
      onError: async (error) => {
        // If stream failed before any event was received from real backend, fall back to mock
        if (!receivedAnyEvent && !options.signal?.aborted) {
          await mockStreamAgent(options)
        } else {
          // Real stream already delivered partial events: do not duplicate with mock stream!
          options.onError?.(error)
        }
      },
    })
  } catch (error: unknown) {
    if (!receivedAnyEvent && !options.signal?.aborted) {
      await mockStreamAgent(options)
    } else {
      const err = error instanceof Error ? error : new Error('Agent stream execution failed')
      options.onError?.(err)
    }
  }
}
