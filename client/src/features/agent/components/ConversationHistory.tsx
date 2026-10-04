import { useCallback, useEffect, useState } from 'react'
import { Box, Button, Flex, Text, VStack } from '@chakra-ui/react'
import { MessageSquare, RotateCw } from 'lucide-react'
import type { ConversationSummary } from '../types/agent'
import { listConversations } from '../lib/agent-api'

export function ConversationHistory({
  activeId,
  onSelectConversation,
}: {
  activeId: string | null
  onSelectConversation: (summary: ConversationSummary) => void
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchConversations = useCallback(async (forceRefresh = false) => {
    setIsLoading(true)
    try {
      const data = await listConversations(forceRefresh)
      setConversations(data)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversations(false)
  }, [fetchConversations])

  const groups: Array<'Today' | 'Yesterday' | 'Earlier'> = ['Today', 'Yesterday', 'Earlier']

  return (
    <Box
      w="full"
      bg="background"
      borderBottomWidth="1px"
      borderColor="border"
      p="3"
      maxH="240px"
      overflowY="auto"
      className="scrollbar-thin scrollbar-thumb-gray-200"
    >
      <Flex align="center" justify="space-between" mb="2">
        <Text fontSize="11px" fontWeight="bold" color="muted" textTransform="uppercase">
          Conversation History
        </Text>
        <Button
          size="xs"
          variant="ghost"
          onClick={() => fetchConversations(true)}
          aria-label="Refresh History"
          title="Refresh History"
          disabled={isLoading}
          px="1.5"
          h="20px"
        >
          <RotateCw size={12} className={isLoading ? 'animate-spin text-blue-600' : 'text-gray-500'} />
        </Button>
      </Flex>

      {isLoading && conversations.length === 0 ? (
        <Text fontSize="xs" color="secondary" py="2">
          Loading history...
        </Text>
      ) : conversations.length === 0 ? (
        <Text fontSize="xs" color="secondary" py="2">
          No previous conversations found.
        </Text>
      ) : (
        <VStack gap="3" align="stretch">
          {groups.map((group) => {
            const items = conversations.filter((c) => c.group === group)
            if (items.length === 0) return null

            return (
              <Box key={group}>
                <Text fontSize="10px" fontWeight="semibold" color="secondary" mb="1">
                  {group}
                </Text>
                <VStack gap="1" align="stretch">
                  {items.map((item) => {
                    const isSelected = item.id === activeId
                    return (
                      <Flex
                        key={item.id}
                        p="2"
                        borderRadius="md"
                        bg={isSelected ? 'surface' : 'transparent'}
                        borderWidth={isSelected ? '1px' : '0'}
                        borderColor={isSelected ? 'primary' : 'transparent'}
                        cursor="pointer"
                        align="center"
                        gap="2"
                        _hover={{ bg: 'surface' }}
                        onClick={() => onSelectConversation(item)}
                      >
                        <MessageSquare size={13} className={isSelected ? 'text-blue-600' : 'text-gray-400'} />
                        <Text
                          fontSize="xs"
                          fontWeight={isSelected ? 'semibold' : 'normal'}
                          color={isSelected ? 'primary' : 'foreground'}
                          className="truncate flex-1"
                        >
                          {item.title}
                        </Text>
                      </Flex>
                    )
                  })}
                </VStack>
              </Box>
            )
          })}
        </VStack>
      )}
    </Box>
  )
}
