import { Box, HStack, Text } from '@chakra-ui/react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ToolResultBlock as ToolResultBlockType } from '../types/agent'

export function ToolResultBlock({ block }: { block: ToolResultBlockType }) {
  const isFailed = block.status === 'failed'

  return (
    <Box py="1.5" px="3" bg="background" borderRadius="md" borderWidth="1px" my="1">
      <HStack gap="2">
        {isFailed ? <AlertCircle size={14} className="text-rose-600" /> : <CheckCircle2 size={14} className="text-emerald-600" />}
        <Text fontSize="xs" color="secondary">
          {block.message || (isFailed ? 'Tool failed' : 'Tool completed successfully')}
        </Text>
      </HStack>
    </Box>
  )
}
