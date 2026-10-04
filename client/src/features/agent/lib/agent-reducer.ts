import type {
  AgentBlock,
  AgentEvent,
  AgentMessage,
  ChartBatchData,
  ChartSpec,
  ConfirmationData,
  ErrorEventData,
  QuestionData,
  TableData,
  TextEventData,
  ThinkingBlock,
  ThinkingEventData,
  TodoBlock,
  TodoEventData,
  ToolCallBlock,
  ToolCallData,
  ToolResultData,
  UploadRequiredData,
} from '../types/agent'

export function reduceAgentEvent(currentMessage: AgentMessage, event: AgentEvent): AgentMessage {
  const blocks = [...currentMessage.blocks]

  switch (event.type) {
    case 'thinking': {
      const data = event.data as ThinkingEventData
      const thinkingIndex = blocks.findIndex((b) => b.type === 'thinking')
      if (thinkingIndex !== -1) {
        const thinkingBlock = blocks[thinkingIndex] as ThinkingBlock
        blocks[thinkingIndex] = {
          ...thinkingBlock,
          status: data.status,
          message: data.message || thinkingBlock.message,
        }
      } else {
        blocks.push({
          type: 'thinking',
          status: data.status,
          message: data.message,
        })
      }
      break
    }

    case 'todo': {
      const data = event.data as TodoEventData
      const existingIndex = blocks.findIndex((b) => b.type === 'todo' && b.id === data.id)
      if (existingIndex !== -1) {
        const existingTodo = blocks[existingIndex] as TodoBlock
        blocks[existingIndex] = {
          ...existingTodo,
          title: data.title || existingTodo.title,
          status: data.status,
        }
      } else {
        blocks.push({
          type: 'todo',
          id: data.id,
          title: data.title,
          status: data.status,
        })
      }
      break
    }

    case 'text': {
      const data = event.data as TextEventData
      const existingIndex = blocks.findIndex(
        (b) => b.type === 'text' && b.messageId === data.messageId,
      )
      if (existingIndex !== -1) {
        const textBlock = blocks[existingIndex] as Extract<AgentBlock, { type: 'text' }>
        blocks[existingIndex] = {
          ...textBlock,
          content: textBlock.content + data.delta,
        }
      } else {
        blocks.push({
          type: 'text',
          messageId: data.messageId,
          content: data.delta,
        })
      }
      break
    }

    case 'chart': {
      const spec = event.data as ChartSpec
      blocks.push({
        type: 'chart',
        spec,
      })
      break
    }

    case 'chart_batch': {
      const batchData = event.data as ChartBatchData
      blocks.push({
        type: 'chart_batch',
        title: batchData.title,
        charts: batchData.charts || [],
      })
      break
    }

    case 'table': {
      const data = event.data as TableData
      blocks.push({
        type: 'table',
        data,
      })
      break
    }

    case 'tool_call': {
      const data = event.data as ToolCallData
      const existingIndex = blocks.findIndex(
        (b) => b.type === 'tool_call' && b.toolCallId === data.toolCallId,
      )
      if (existingIndex !== -1) {
        const existingCall = blocks[existingIndex] as ToolCallBlock
        blocks[existingIndex] = {
          ...existingCall,
          name: data.name,
          label: data.label,
          status: data.status,
          input: data.input,
        }
      } else {
        blocks.push({
          type: 'tool_call',
          toolCallId: data.toolCallId,
          name: data.name,
          label: data.label,
          status: data.status,
          input: data.input,
        })
      }
      break
    }

    case 'tool_result': {
      const data = event.data as ToolResultData
      const existingIndex = blocks.findIndex(
        (b) => b.type === 'tool_call' && b.toolCallId === data.toolCallId,
      )
      if (existingIndex !== -1) {
        const existingCall = blocks[existingIndex] as ToolCallBlock
        blocks[existingIndex] = {
          ...existingCall,
          status: data.status,
          result: data.result,
          resultMessage: data.message,
        }
      } else {
        blocks.push({
          type: 'tool_result',
          toolCallId: data.toolCallId,
          status: data.status,
          result: data.result,
          message: data.message,
        })
      }
      break
    }

    case 'question': {
      const data = event.data as QuestionData
      blocks.push({
        type: 'question',
        data,
        answered: false,
      })
      break
    }

    case 'confirmation': {
      const data = event.data as ConfirmationData
      blocks.push({
        type: 'confirmation',
        data,
        answered: false,
      })
      break
    }

    case 'upload_required': {
      const data = event.data as UploadRequiredData
      blocks.push({
        type: 'upload_required',
        data,
        uploaded: false,
      })
      break
    }

    case 'error': {
      const data = event.data as ErrorEventData
      blocks.push({
        type: 'error',
        code: data.code,
        message: data.message || 'An unknown agent error occurred.',
      })
      return {
        ...currentMessage,
        blocks,
        status: 'failed',
      }
    }

    case 'done': {
      // Finalize thinking blocks if any were left in running state
      const finalizedBlocks = blocks.map((b) => {
        if (b.type === 'thinking' && b.status === 'running') {
          return { ...b, status: 'completed' as const }
        }
        return b
      })
      return {
        ...currentMessage,
        blocks: finalizedBlocks,
        status: 'completed',
      }
    }

    default:
      break
  }

  return {
    ...currentMessage,
    blocks,
  }
}
