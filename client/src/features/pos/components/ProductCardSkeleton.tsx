import { Box, Card, SimpleGrid, Skeleton } from '@chakra-ui/react'

export function ProductCardSkeleton() {
  return (
    <Card.Root variant="outline" size="sm" h="full" borderRadius="sm" overflow="hidden">
      {/* Square Image Skeleton */}
      <Box aspectRatio="1" overflow="hidden" position="relative">
        <Skeleton w="full" h="full" />
      </Box>

      {/* Card Body Skeleton */}
      <Card.Body display="flex" flexDirection="column" gap="2" p="3">
        {/* Brand */}
        <Skeleton h="12px" w="35%" />
        {/* Product Name (2 lines) */}
        <Skeleton h="16px" w="85%" />
        <Skeleton h="16px" w="60%" />
        {/* SKU */}
        <Skeleton h="12px" w="40%" />
        {/* Price & Stock Badge */}
        <Box mt="auto" pt="1">
          <Skeleton h="20px" w="50%" mb="2" />
          <Skeleton h="18px" w="65%" />
        </Box>
      </Card.Body>

      {/* Card Footer Skeleton */}
      <Card.Footer p="3" pt="0">
        <Skeleton h="32px" w="full" borderRadius="sm" />
      </Card.Footer>
    </Card.Root>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <SimpleGrid
      mt="3"
      columns={{ base: 1, sm: 2, md: 3, xl: 4 }}
      gap="3"
    >
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </SimpleGrid>
  )
}
