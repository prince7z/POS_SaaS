import { useLayoutEffect, useRef, useState } from 'react'
import { Box, Button, Flex, Textarea } from '@chakra-ui/react'
import { Send, Square } from 'lucide-react'

const MAX_HEIGHT = 180

export function AgentComposer({
  isStreaming,
  disabled = false,
  onSend,
  onStop,
}: {
  isStreaming: boolean
  disabled?: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [input])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming || disabled) return
    onSend(input.trim())
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Box p="3" bg="surface" borderTopWidth="1px" borderColor="border">
      <form onSubmit={handleSubmit}>
        <Flex gap="2" align="flex-end">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Assistant..."
            aria-label="Message the AI assistant"
            rows={1}
            resize="none"
            size="sm"
            borderRadius="lg"
            minH="40px"
            lineHeight="1.5"
            fontSize="sm"
            px="3"
            py="2"
            flex="1"
            overflowY="hidden"
          />
          {isStreaming ? (
            <Button
              size="sm"
              h="40px"
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
              h="40px"
              bg="#2563EB"
              color="#FFFFFF"
              _hover={{ bg: '#1D4ED8' }}
              disabled={!input.trim() || disabled}
              aria-label="Send message"
              px="3.5"
            >
              <Send size={15} />
            </Button>
          )}
        </Flex>
      </form>
    </Box>
  )
}
