import { Box, HStack, Text } from '@chakra-ui/react'
import { AlertCircle } from 'lucide-react'
import type { ErrorBlock as ErrorBlockType } from '../types/agent'

export function ErrorBlock({ block }: { block: ErrorBlockType }) {
  return (
    <Box p="3" bg="red.50" borderWidth="1px" borderColor="red.200" borderRadius="md" my="2">
      <HStack gap="2" align="flex-start">
        <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
        <Box flex="1">
          {block.code && (
            <Text fontSize="11px" fontWeight="bold" color="red.700" textTransform="uppercase" mb="0.5">
              {block.code}
            </Text>
          )}
          <Text fontSize="xs" color="red.800">
            {block.message}
          </Text>
        </Box>
      </HStack>
    </Box>
  )
}
