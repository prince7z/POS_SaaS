import { Button, Center, Text, VStack } from '@chakra-ui/react'
import { SearchX } from 'lucide-react'

export function EmptyProductState({
  hasActiveFilters,
  onClearFilters,
}: {
  hasActiveFilters: boolean
  onClearFilters: () => void
}) {
  return (
    <Center py="16" borderWidth="1px" borderStyle="dashed" borderColor="border" borderRadius="md" mt="3">
      <VStack gap="3" textAlign="center" maxW="sm" px="4">
        <SearchX size={36} color="var(--chakra-colors-fg-muted)" />
        <VStack gap="1">
          <Text fontWeight="600" fontSize="md">
            No products found
          </Text>
          <Text color="fg.subtle" fontSize="sm">
            {hasActiveFilters
              ? 'No products matched your search or category filters.'
              : 'Your product catalog is currently empty.'}
          </Text>
        </VStack>
        {hasActiveFilters && (
          <Button size="sm" variant="outline" onClick={onClearFilters}>
            Clear all filters
          </Button>
        )}
      </VStack>
    </Center>
  )
}
