import { Box, Flex, Skeleton, Stack } from '@chakra-ui/react'
import { AiAvatar } from './AiAvatar'

export function AssistantMessageSkeleton() {
  return (
    <Flex gap="2.5" align="flex-start" my="2.5" aria-label="Assistant is responding" role="status">
      <AiAvatar />
      <Box flex="1" minW="0" bg="white" p="3" borderRadius="lg" borderWidth="1px" borderColor="#E5E7EB">
        <Stack gap="2">
          <Skeleton h="10px" w="85%" />
          <Skeleton h="10px" w="65%" />
          <Skeleton h="10px" w="40%" />
        </Stack>
      </Box>
    </Flex>
  )
}

function UserSkeleton({ width }: { width: string }) {
  return (
    <Flex justify="flex-end" my="2">
      <Skeleton h="34px" w={width} borderRadius="lg" />
    </Flex>
  )
}

export function ConversationSkeleton() {
  return (
    <Box role="status" aria-label="Loading conversation">
      <UserSkeleton width="55%" />
      <AssistantMessageSkeleton />
      <UserSkeleton width="40%" />
      <AssistantMessageSkeleton />
    </Box>
  )
}

export function HistorySkeleton() {
  return (
    <Stack gap="2" role="status" aria-label="Loading history">
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} h="28px" borderRadius="md" />
      ))}
    </Stack>
  )
}
