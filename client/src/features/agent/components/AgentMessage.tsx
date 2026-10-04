import { Box, Flex, HStack, Text } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { Bot, User } from 'lucide-react'
import type { AgentMessage as AgentMessageType, InteractionPayload } from '../types/agent'
import { AgentBlockRenderer } from './AgentBlockRenderer'

export function AgentMessage({
  message,
  conversationId,
  onRespond,
}: {
  message: AgentMessageType
  conversationId: string
  onRespond: (payload: InteractionPayload) => void
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    const textContent = message.blocks
      .filter((b) => b.type === 'text')
      .map((b) => (b as Extract<typeof b, { type: 'text' }>).content)
      .join(' ')

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        <Flex justify="flex-end" my="2">
          <HStack gap="2" maxW="85%" align="flex-start">
            <Box bg="primary" color="primaryForeground" px="3.5" py="2" borderRadius="lg" borderTopRightRadius="xs" shadow="xs">
              <Text fontSize="xs" lineHeight="relaxed">
                {textContent}
              </Text>
            </Box>
            <Flex
              w="26px"
              h="26px"
              borderRadius="full"
              bg="blue-100"
              color="primary"
              align="center"
              justify="center"
              shrink={0}
              mt="0.5"
            >
              <User size={13} />
            </Flex>
          </HStack>
        </Flex>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
    >
      <Flex justify="flex-start" my="2.5">
        <HStack gap="2.5" w="full" align="flex-start">
          <Flex
            w="28px"
            h="28px"
            borderRadius="md"
            bg="blue-600"
            color="white"
            align="center"
            justify="center"
            shrink={0}
            mt="0.5"
            shadow="xs"
          >
            <Bot size={15} />
          </Flex>
          <Box flex="1" minW="0" bg="surface" p="3" borderRadius="lg" borderWidth="1px" shadow="xs">
            {message.blocks.map((block, idx) => (
              <AgentBlockRenderer
                key={idx}
                block={block}
                conversationId={conversationId}
                onRespond={onRespond}
              />
            ))}
          </Box>
        </HStack>
      </Flex>
    </motion.div>
  )
}
