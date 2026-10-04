import { useState } from 'react'
import { Box, Button, HStack, Textarea } from '@chakra-ui/react'
import { Send, Square } from 'lucide-react'

export function AgentComposer({
  isStreaming,
  onSend,
  onStop,
}: {
  isStreaming: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [input, setInput] = useState('')

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Box p="3" bg="surface" borderTopWidth="1px" borderColor="border">
      <form onSubmit={handleSubmit}>
        <HStack gap="2" align="flex-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Assistant..."
            rows={1}
            resize="none"
            size="sm"
            borderRadius="md"
            className="text-xs py-2 px-3 focus:ring-1 focus:ring-blue-500 min-h-[38px] max-h-[100px]"
          />
          {isStreaming ? (
            <Button
              size="sm"
              colorPalette="red"
              variant="subtle"
              onClick={onStop}
              aria-label="Stop generating"
              px="3"
            >
              <Square size={13} className="mr-1 fill-current" />
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              colorScheme="blue"
              disabled={!input.trim()}
              aria-label="Send message"
              px="3.5"
            >
              <Send size={14} />
            </Button>
          )}
        </HStack>
      </form>
    </Box>
  )
}
