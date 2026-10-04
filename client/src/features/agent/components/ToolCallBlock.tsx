import { Box, HStack, Text } from '@chakra-ui/react'
import { AlertCircle, CheckCircle2, Loader2, Wrench } from 'lucide-react'
import type { ToolCallBlock as ToolCallBlockType } from '../types/agent'

export function ToolCallBlock({ block }: { block: ToolCallBlockType }) {
  const isRunning = block.status === 'running'
  const isFailed = block.status === 'failed'

  return (
    <Box py="2" px="3" bg="background" borderRadius="md" borderWidth="1px" my="1.5">
      <HStack gap="2" justify="space-between">
        <HStack gap="2">
          <Wrench size={14} className="text-gray-500" />
          <Text fontSize="xs" fontWeight="semibold" color="foreground">
            {block.label || block.name}
          </Text>
        </HStack>
        <HStack gap="1.5">
          {isRunning && <Loader2 size={13} className="animate-spin text-blue-600" />}
          {!isRunning && !isFailed && <CheckCircle2 size={13} className="text-emerald-600" />}
          {isFailed && <AlertCircle size={13} className="text-rose-600" />}
          <Text fontSize="11px" color={isRunning ? 'primary' : isFailed ? 'danger' : 'secondary'} textTransform="capitalize">
            {block.status}
          </Text>
        </HStack>
      </HStack>
      {block.resultMessage && (
        <Text fontSize="11px" color="secondary" mt="1" pl="5">
          {block.resultMessage}
        </Text>
      )}
    </Box>
  )
}
