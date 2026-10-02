import { HStack, Text, Box } from '@chakra-ui/react'
import { Store } from 'lucide-react'

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <HStack gap="2">
      <Box bg="primary" color="white" p="2" borderRadius="md">
        <Store size={16} />
      </Box>
      {!collapsed && (
        <Box>
          <Text fontWeight="700" lineHeight="1">
            POS SaaS
          </Text>
          <Text fontSize="xs" color="secondary" mt="1">
            Point of Sale Suite
          </Text>
        </Box>
      )}
    </HStack>
  )
}
