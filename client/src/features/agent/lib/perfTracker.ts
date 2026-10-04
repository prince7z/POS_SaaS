export interface FrontendLogEntry {
  requestId: string
  timestamp: string
  elapsedMs: number
  layer: 'frontend'
  module: string
  operation: string
  eventId?: string
  eventType?: string
  conversationId?: string
  messageId?: string
  toolCallId?: string
  todoId?: string
  chunkIndex?: number
  chunkLength?: number
  extra?: Record<string, unknown>
}

export class FrontendPerfTracker {
  public requestId: string
  public startWallTime: string
  public startPerfTime: number
  public conversationId?: string
  private entries: FrontendLogEntry[] = []

  constructor(requestId?: string, conversationId?: string) {
    this.requestId = requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    this.conversationId = conversationId
    this.startWallTime = new Date().toISOString()
    this.startPerfTime = performance.now()
  }

  public log(details: {
    module: string
    operation: string
    eventId?: string
    eventType?: string
    conversationId?: string
    messageId?: string
    toolCallId?: string
    todoId?: string
    chunkIndex?: number
    chunkLength?: number
    extra?: Record<string, unknown>
  }): FrontendLogEntry {
    const nowPerf = performance.now()
    const elapsedMs = Math.round((nowPerf - this.startPerfTime) * 100) / 100
    const timestamp = new Date().toISOString()

    const entry: FrontendLogEntry = {
      requestId: this.requestId,
      timestamp,
      elapsedMs,
      layer: 'frontend',
      module: details.module,
      operation: details.operation,
      eventId: details.eventId,
      eventType: details.eventType,
      conversationId: details.conversationId || this.conversationId,
      messageId: details.messageId,
      toolCallId: details.toolCallId,
      todoId: details.todoId,
      chunkIndex: details.chunkIndex,
      chunkLength: details.chunkLength,
      extra: details.extra,
    }

    this.entries.push(entry)

    const evtStr = entry.eventType ? ` | evt:${entry.eventType}(${entry.eventId || ''})` : ''
    const chunkStr = entry.chunkIndex !== undefined ? ` | chunk #${entry.chunkIndex} (len:${entry.chunkLength})` : ''

    console.log(
      `[PERF][FRONTEND] +${entry.elapsedMs.toFixed(1)}ms | req:${entry.requestId} | ${entry.module}::${entry.operation}${evtStr}${chunkStr}`,
    )

    return entry
  }

  public getEntries(): FrontendLogEntry[] {
    return [...this.entries]
  }

  public printTimeline(): void {
    console.log(`\n=================== FRONTEND AGENT PERFORMANCE TIMELINE (req: ${this.requestId}) ===================`)
    console.log(`Start ISO: ${this.startWallTime}`)
    for (const entry of this.entries) {
      const elapsedStr = `${entry.elapsedMs.toFixed(1)}ms`.padEnd(10)
      const opStr = `${entry.module}::${entry.operation}`
      const evtStr = entry.eventType ? ` (${entry.eventType})` : ''
      const chunkStr = entry.chunkIndex !== undefined ? ` [chunk #${entry.chunkIndex}, len: ${entry.chunkLength}]` : ''
      console.log(`${elapsedStr} [frontend]  ${opStr}${evtStr}${chunkStr}`)
    }
    console.log(`====================================================================================================\n`)
  }
}
