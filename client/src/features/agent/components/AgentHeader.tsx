import { Button, Flex, HStack, Text } from '@chakra-ui/react'
import { Bot, History, Plus, X } from 'lucide-react'

export function AgentHeader({
  historyOpen,
  onToggleHistory,
  onNewChat,
  onClose,
}: {
  historyOpen: boolean
  onToggleHistory: () => void
  onNewChat: () => void
  onClose: () => void
}) {
  return (
    <Flex
      h="52px"
      px="3.5"
      align="center"
      justify="space-between"
      borderBottomWidth="1px"
      borderColor="border"
      bg="surface"
      shrink={0}
    >
      <HStack gap="2">
        <Flex
          w="24px"
          h="24px"
          borderRadius="md"
          bg="blue-600"
          color="white"
          align="center"
          justify="center"
        >
          <Bot size={14} />
        </Flex>
        <Text fontSize="sm" fontWeight="bold" color="foreground">
          AI Assistant
        </Text>
      </HStack>

      <HStack gap="1">
        <Button
          size="xs"
          variant={historyOpen ? 'subtle' : 'ghost'}
          onClick={onToggleHistory}
          aria-label="Conversation History"
          title="Conversation History"
        >
          <History size={15} />
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={onNewChat}
          aria-label="New Chat"
          title="New Chat"
        >
          <Plus size={16} />
        </Button>
        <Button
          size="xs"
          variant="ghost"
          onClick={onClose}
          aria-label="Close Assistant"
          title="Close Assistant"
        >
          <X size={16} />
        </Button>
      </HStack>
    </Flex>
  )
}
