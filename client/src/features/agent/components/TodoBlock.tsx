import { Box, HStack, Text } from '@chakra-ui/react'
import { AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react'
import type { TodoBlock as TodoBlockType } from '../types/agent'

export function TodoBlock({ block }: { block: TodoBlockType }) {
  const getIcon = () => {
    switch (block.status) {
      case 'running':
        return <Loader2 size={15} className="animate-spin text-blue-600" />
      case 'completed':
        return <CheckCircle2 size={15} className="text-emerald-600" />
      case 'failed':
        return <AlertCircle size={15} className="text-rose-600" />
      case 'pending':
      default:
        return <Circle size={15} className="text-gray-400" />
    }
  }

  return (
    <Box py="1.5" px="3" bg="surface" borderRadius="md" borderWidth="1px" my="1">
      <HStack gap="2.5">
        {getIcon()}
        <Text
          fontSize="xs"
          fontWeight="medium"
          color={block.status === 'completed' ? 'secondary' : 'foreground'}
        >
          {block.title}
        </Text>
      </HStack>
    </Box>
  )
}
