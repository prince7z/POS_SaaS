import { Box, HStack, Text } from '@chakra-ui/react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { ThinkingBlock as ThinkingBlockType } from '../types/agent'

export function ThinkingBlock({ block }: { block: ThinkingBlockType }) {
  const isRunning = block.status === 'running'

  return (
    <Box py="1.5" px="3" bg="background" borderRadius="md" borderWidth="1px" my="1.5">
      <HStack gap="2">
        {isRunning ? (
          <Loader2 size={15} className="animate-spin text-blue-600" />
        ) : (
          <CheckCircle2 size={15} className="text-emerald-600" />
        )}
        <Text fontSize="xs" fontWeight="medium" color={isRunning ? 'foreground' : 'secondary'}>
          {block.message || (isRunning ? 'Thinking...' : 'Analysis completed')}
        </Text>
      </HStack>
    </Box>
  )
}
