import type { AgentEvent } from '../types/agent'
import type { FrontendPerfTracker } from './perfTracker'

export interface StreamAgentOptions {
  url?: string
  message: string
  conversationId?: string
  requestId?: string
  tracker?: FrontendPerfTracker
  signal?: AbortSignal
  onEvent: (event: AgentEvent) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

export async function streamAgent(options: StreamAgentOptions): Promise<void> {
  const {
    url = '/api/agent/stream',
    message,
    conversationId,
    requestId,
    tracker,
    signal,
    onEvent,
    onError,
    onComplete,
  } = options

  const token = localStorage.getItem('pos-auth-token')

  try {
    tracker?.log({ module: 'agent-stream.ts', operation: 'fetch start' })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(requestId ? { 'x-request-id': requestId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        conversationId,
        requestId,
      }),
      signal,
    })

    tracker?.log({ module: 'agent-stream.ts', operation: 'response headers received' })

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('ReadableStream not supported or empty response body.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      tracker?.log({
        module: 'agent-stream.ts',
        operation: 'raw stream chunk received',
        chunkLength: value?.length,
      })

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) {
          continue
        }

        if (trimmed.startsWith('data:')) {
          const rawData = trimmed.slice(5).trim()
          if (rawData === '[DONE]') {
            const doneEvt: AgentEvent = {
              id: `done_${Date.now()}`,
              type: 'done',
              data: null,
            }
            tracker?.log({ module: 'agent-stream.ts', operation: 'SSE event parsed', eventId: doneEvt.id, eventType: 'done' })
            tracker?.log({ module: 'agent-stream.ts', operation: 'event-received', eventId: doneEvt.id, eventType: 'done' })
            onEvent(doneEvt)
            continue
          }

          try {
            const parsedEvent = JSON.parse(rawData) as AgentEvent
            if (parsedEvent && parsedEvent.type) {
              tracker?.log({
                module: 'agent-stream.ts',
                operation: 'SSE event parsed',
                eventId: parsedEvent.id,
                eventType: parsedEvent.type,
              })
              tracker?.log({
                module: 'agent-stream.ts',
                operation: 'event-received',
                eventId: parsedEvent.id,
                eventType: parsedEvent.type,
              })
              onEvent(parsedEvent)
            }
          } catch {
            // Malformed JSON event ignored
          }
        }
      }
    }

    if (buffer.trim().startsWith('data:')) {
      const rawData = buffer.trim().slice(5).trim()
      if (rawData !== '[DONE]') {
        try {
          const parsedEvent = JSON.parse(rawData) as AgentEvent
          if (parsedEvent && parsedEvent.type) {
            tracker?.log({
              module: 'agent-stream.ts',
              operation: 'SSE event parsed',
              eventId: parsedEvent.id,
              eventType: parsedEvent.type,
            })
            tracker?.log({
              module: 'agent-stream.ts',
              operation: 'event-received',
              eventId: parsedEvent.id,
              eventType: parsedEvent.type,
            })
            onEvent(parsedEvent)
          }
        } catch {
          // Ignore trailing malformed JSON
        }
      }
    }

    onComplete?.()
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      onComplete?.()
      return
    }

    const error = err instanceof Error ? err : new Error('Unknown stream error')
    onError?.(error)
  }
}
