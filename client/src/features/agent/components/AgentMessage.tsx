import { Box, Flex, HStack, Skeleton, Stack, Text } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { User } from 'lucide-react'
import type { AgentMessage as AgentMessageType, InteractionPayload } from '../types/agent'
import { AgentBlockRenderer } from './AgentBlockRenderer'
import { AiAvatar } from './AiAvatar'

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
            <Box bg="#2563EB" color="#FFFFFF" px="3.5" py="2" borderRadius="lg" borderTopRightRadius="xs" shadow="xs" minW="0">
              <Text fontSize="xs" lineHeight="1.6" whiteSpace="pre-wrap" overflowWrap="anywhere">
                {textContent}
              </Text>
            </Box>
            <Flex
              w="26px"
              h="26px"
              borderRadius="full"
              bg="#DBEAFE"
              color="#2563EB"
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
          <Box mt="0.5">
            <AiAvatar />
          </Box>
          <Box flex="1" minW="0" bg="surface" p="3" borderRadius="lg" borderWidth="1px" shadow="xs">
            {message.blocks.length === 0 ? (
              <Stack gap="2" role="status" aria-label="Assistant is thinking">
                <Skeleton h="10px" w="85%" />
                <Skeleton h="10px" w="60%" />
              </Stack>
            ) : (
              message.blocks.map((block, idx) => (
                <AgentBlockRenderer
                  key={idx}
                  block={block}
                  conversationId={conversationId}
                  onRespond={onRespond}
                />
              ))
            )}
          </Box>
        </HStack>
      </Flex>
    </motion.div>
  )
}
