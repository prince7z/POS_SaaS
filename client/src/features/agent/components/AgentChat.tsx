import { useEffect, useRef } from 'react'
import { Box, Flex, Text } from '@chakra-ui/react'
import { Bot, Sparkles } from 'lucide-react'
import type { AgentMessage as AgentMessageType, InteractionPayload } from '../types/agent'
import { AgentMessage } from './AgentMessage'

export function AgentChat({
  messages,
  conversationId,
  onRespond,
  onSuggestionClick,
}: {
  messages: AgentMessageType[]
  conversationId: string
  isStreaming?: boolean
  onRespond: (payload: InteractionPayload) => void
  onSuggestionClick: (prompt: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)

  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight)
    isNearBottomRef.current = distanceFromBottom < 80
  }

  useEffect(() => {
    if (isNearBottomRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [messages])

  const suggestions = [
    'Show me this month sales performance',
    'Which products are low on inventory?',
    'Give me top 5 customer accounts',
    'Compare quarterly branch revenue',
  ]

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      flex="1"
      overflowY="auto"
      px="4"
      py="3"
      className="scrollbar-thin scrollbar-thumb-gray-200"
    >
      {messages.length === 0 ? (
        <Flex direction="column" align="center" justify="center" h="full" py="10" textAlign="center">
          <Flex
            w="48px"
            h="48px"
            borderRadius="xl"
            bg="blue-50"
            color="primary"
            align="center"
            justify="center"
            mb="3"
            shadow="sm"
          >
            <Bot size={24} />
          </Flex>
          <Text fontSize="sm" fontWeight="semibold" color="foreground" mb="1">
            POS AI Assistant
          </Text>
          <Text fontSize="xs" color="secondary" maxW="260px" mb="6">
            Ask questions, analyze sales, generate reports, or inspect product inventory.
          </Text>

          <Box w="full" maxW="320px">
            <Text fontSize="11px" fontWeight="semibold" color="muted" textTransform="uppercase" mb="2.5" textAlign="left">
              Suggested prompts
            </Text>
            <Flex direction="column" gap="1.5">
              {suggestions.map((sugg, i) => (
                <Box
                  key={i}
                  p="2.5"
                  bg="surface"
                  borderWidth="1px"
                  borderRadius="md"
                  cursor="pointer"
                  textAlign="left"
                  transition="all 0.15s"
                  _hover={{ borderColor: 'primary', bg: 'blue-50/50' }}
                  onClick={() => onSuggestionClick(sugg)}
                >
                  <Flex align="center" gap="2">
                    <Sparkles size={13} className="text-blue-500 shrink-0" />
                    <Text fontSize="xs" color="foreground" className="truncate">
                      {sugg}
                    </Text>
                  </Flex>
                </Box>
              ))}
            </Flex>
          </Box>
        </Flex>
      ) : (
        messages.map((msg) => (
          <AgentMessage
            key={msg.id}
            message={msg}
            conversationId={conversationId}
            onRespond={onRespond}
          />
        ))
      )}
    </Box>
  )
}
