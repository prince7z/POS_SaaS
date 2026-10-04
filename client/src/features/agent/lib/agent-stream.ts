import type { AgentEvent } from '../types/agent'

export interface StreamAgentOptions {
  url?: string
  message: string
  conversationId?: string
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
    signal,
    onEvent,
    onError,
    onComplete,
  } = options

  const token = localStorage.getItem('pos-auth-token')

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        conversationId,
      }),
      signal,
    })

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

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(/\r?\n/)
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) {
          // Ignore empty lines or SSE comments
          continue
        }

        if (trimmed.startsWith('data:')) {
          const rawData = trimmed.slice(5).trim()
          if (rawData === '[DONE]') {
            onEvent({
              id: `done_${Date.now()}`,
              type: 'done',
              data: null,
            })
            continue
          }

          try {
            const parsedEvent = JSON.parse(rawData) as AgentEvent
            if (parsedEvent && parsedEvent.type) {
              onEvent(parsedEvent)
            }
          } catch {
            // Malformed JSON event ignored to prevent UI crashes
          }
        }
      }
    }

    // Process any remaining buffered data
    if (buffer.trim().startsWith('data:')) {
      const rawData = buffer.trim().slice(5).trim()
      if (rawData !== '[DONE]') {
        try {
          const parsedEvent = JSON.parse(rawData) as AgentEvent
          if (parsedEvent && parsedEvent.type) {
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
      // Handle user cancellation gracefully
      onComplete?.()
      return
    }

    const error = err instanceof Error ? err : new Error('Unknown stream error')
    onError?.(error)
  }
}
