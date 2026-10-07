// Agent Event and State Type Definitions

export type AgentEventType =
  | 'thinking'
  | 'todo'
  | 'text'
  | 'chart'
  | 'chart_batch'
  | 'table'
  | 'tool_call'
  | 'tool_result'
  | 'question'
  | 'confirmation'
  | 'upload_required'
  | 'email_preview'
  | 'error'
  | 'done'

export interface AgentEvent<T = unknown> {
  id: string
  type: AgentEventType
  timestamp?: number
  data: T
}

export interface StreamAgentOptions {
  url?: string
  message: string
  conversationId?: string
  signal?: AbortSignal
  onEvent: (event: AgentEvent) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

// 1. Thinking
export interface ThinkingEventData {
  status: 'running' | 'completed'
  message: string
}

// 2. Todo
export interface TodoEventData {
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

// 3. Text
export interface TextEventData {
  messageId: string
  delta: string
}

// 4. Chart & Batch Chart
export interface ChartSeries {
  key: string
  label: string
  dataKey?: string
}

export interface ChartXAxis {
  key: string
  label?: string
}

export interface ChartSpec {
  id?: string
  chartType: 'line' | 'bar' | 'donut' | 'pie' | 'area'
  title?: string
  xAxis?: ChartXAxis
  xKey?: string
  series?: ChartSeries[]
  data: Record<string, unknown>[]
}

export interface ChartBatchData {
  title?: string
  charts: ChartSpec[]
}

// 5. Table
export interface TableColumn {
  key: string
  label: string
}

export interface TableData {
  title?: string
  columns: TableColumn[]
  rows: Record<string, unknown>[]
}

// 6. Tool Call & Tool Result
export interface ToolCallData {
  toolCallId: string
  name: string
  label?: string
  status: 'running' | 'completed' | 'failed'
  input?: unknown
}

export interface ToolResultData {
  toolCallId: string
  status: 'completed' | 'failed'
  result?: unknown
  message?: string
}

// 7. Human in the Loop: Question
export interface QuestionOption {
  id: string
  label: string
  value: string
}

export interface QuestionData {
  questionId: string
  message: string
  options?: QuestionOption[]
  allowTextInput?: boolean
}

// 8. Human in the Loop: Confirmation
export interface ConfirmationOption {
  id: string
  label: string
  value: boolean
}

export interface ConfirmationData {
  confirmationId: string
  message: string
  action?: {
    label: string
  }
  options?: ConfirmationOption[]
}

// 10. Email Preview HITL
export interface EmailPreviewData {
  draftId: string
  to: string[]
  subject: string
  html: string
  type: string
}

// 11. Error
export interface ErrorEventData {
  code?: string
  message: string
}

// Agent Renderable Blocks
export type ThinkingBlock = {
  type: 'thinking'
  status: 'running' | 'completed'
  message: string
}

export type TodoBlock = {
  type: 'todo'
  id: string
  title: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

export type TextBlock = {
  type: 'text'
  messageId: string
  content: string
}

export type ChartBlock = {
  type: 'chart'
  spec: ChartSpec
}

export type ChartBatchBlock = {
  type: 'chart_batch'
  title?: string
  charts: ChartSpec[]
}

export type TableBlock = {
  type: 'table'
  data: TableData
}

export type ToolCallBlock = {
  type: 'tool_call'
  toolCallId: string
  name: string
  label?: string
  status: 'running' | 'completed' | 'failed'
  input?: unknown
  result?: unknown
  resultMessage?: string
}

export type ToolResultBlock = {
  type: 'tool_result'
  toolCallId: string
  status: 'completed' | 'failed'
  result?: unknown
  message?: string
}

export type QuestionBlock = {
  type: 'question'
  data: QuestionData
  answered?: boolean
  selectedResponse?: string
}

export type ConfirmationBlock = {
  type: 'confirmation'
  data: ConfirmationData
  answered?: boolean
  approved?: boolean
}

export type UploadRequiredBlock = {
  type: 'upload_required'
  data: UploadRequiredData
  uploaded?: boolean
  uploadedKey?: string
}

export type EmailPreviewBlock = {
  type: 'email_preview'
  data: EmailPreviewData
  answered?: boolean
  actionTaken?: 'approve' | 'reject' | 'change'
  feedback?: string
}

export type ErrorBlock = {
  type: 'error'
  code?: string
  message: string
}

export type AgentBlock =
  | ThinkingBlock
  | TodoBlock
  | TextBlock
  | ChartBlock
  | ChartBatchBlock
  | TableBlock
  | ToolCallBlock
  | ToolResultBlock
  | QuestionBlock
  | ConfirmationBlock
  | UploadRequiredBlock
  | EmailPreviewBlock
  | ErrorBlock

export interface AgentMessage {
  id: string
  role: 'user' | 'assistant'
  blocks: AgentBlock[]
  status: 'streaming' | 'completed' | 'failed'
  timestamp: number
}

export interface ConversationSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  group: 'Today' | 'Yesterday' | 'Earlier'
}

export interface DetailedConversation extends ConversationSummary {
  messages: AgentMessage[]
}

export interface InteractionPayload {
  conversationId: string
  questionId?: string
  confirmationId?: string
  uploadId?: string
  draftId?: string
  response: {
    type: 'option' | 'text' | 'upload'
    value: string | boolean | Record<string, unknown>
  }
}
