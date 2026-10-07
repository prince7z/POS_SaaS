import { Box, Card, Flex, SimpleGrid, Skeleton } from '@chakra-ui/react'

export function ProductCardSkeleton() {
  return (
    <Card.Root variant="outline" size="sm" h="full" borderRadius="sm" overflow="hidden">
      {/* Square Image Skeleton */}
      <Box aspectRatio="1" overflow="hidden" position="relative">
        <Skeleton w="full" h="full" />
      </Box>

      {/* Card Body Skeleton */}
      <Card.Body display="flex" flexDirection="column" gap="1.5" p="2.5">
        <Skeleton h="14px" w="85%" />
        <Skeleton h="14px" w="60%" />
        <Flex justify="space-between" align="center" mt="auto" pt="1">
          <Skeleton h="16px" w="40%" />
          <Skeleton h="16px" w="45%" />
        </Flex>
      </Card.Body>

      {/* Card Footer Skeleton */}
      <Card.Footer p="2.5" pt="0">
        <Skeleton h="26px" w="full" borderRadius="sm" />
      </Card.Footer>
    </Card.Root>
  )
}

export function ProductGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <SimpleGrid
      mt="3"
      columns={{ base: 1, sm: 2, md: 3, lg: 4, xl: 5 }}
      gap="2.5"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </SimpleGrid>
  )
}
