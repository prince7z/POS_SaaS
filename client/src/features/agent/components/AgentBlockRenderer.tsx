import type { AgentBlock, InteractionPayload } from '../types/agent'
import { ChartBatchBlock } from './ChartBatchBlock'
import { ChartBlock } from './ChartBlock'
import { ConfirmationBlock } from './ConfirmationBlock'
import { ErrorBlock } from './ErrorBlock'
import { QuestionBlock } from './QuestionBlock'
import { TableBlock } from './TableBlock'
import { TextBlock } from './TextBlock'
import { ThinkingBlock } from './ThinkingBlock'
import { TodoBlock } from './TodoBlock'
import { UploadRequiredBlock } from './UploadRequiredBlock'
import { EmailPreviewBlock } from './EmailPreviewBlock'

export function AgentBlockRenderer({
  block,
  conversationId,
  onRespond,
}: {
  block: AgentBlock
  conversationId: string
  onRespond: (payload: InteractionPayload) => void
}) {
  console.log(`[PERF][FRONTEND] +${performance.now().toFixed(1)}ms | AgentBlockRenderer::UI/block render | type:${block.type}`)

  switch (block.type) {
    case 'thinking':
      return <ThinkingBlock block={block} />
    case 'todo':
      return <TodoBlock block={block} />
    case 'text':
      return <TextBlock block={block} />
    case 'chart':
      return <ChartBlock block={block} />
    case 'chart_batch':
      return <ChartBatchBlock block={block} />
    case 'table':
      return <TableBlock block={block} />
    case 'tool_call':
    case 'tool_result':
      return null
    case 'question':
      return <QuestionBlock block={block} conversationId={conversationId} onRespond={onRespond} />
    case 'confirmation':
      return <ConfirmationBlock block={block} conversationId={conversationId} onRespond={onRespond} />
    case 'upload_required':
      return <UploadRequiredBlock block={block} conversationId={conversationId} onRespond={onRespond} />
    case 'email_preview':
      return <EmailPreviewBlock block={block} conversationId={conversationId} onRespond={onRespond} />
    case 'error':
      return <ErrorBlock block={block} />
    default:
      return null
  }
}
