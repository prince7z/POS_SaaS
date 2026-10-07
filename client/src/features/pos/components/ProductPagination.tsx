import { Button, Flex, HStack, Menu, Text } from '@chakra-ui/react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

export function ProductPagination({
  page,
  limit,
  total,
  totalPages,
  onPageChange,
  onLimitChange,
}: {
  page: number
  limit: number
  total: number
  totalPages: number
  onPageChange: (newPage: number) => void
  onLimitChange: (newLimit: number) => void
}) {
  if (total <= 0) return null

  const startItem = (page - 1) * limit + 1
  const endItem = Math.min(page * limit, total)

  return (
    <Flex
      direction={{ base: 'column', sm: 'row' }}
      align="center"
      justify="space-between"
      gap="3"
      pt="4"
      pb="2"
      borderTopWidth="1px"
      borderColor="border"
      mt="4"
    >
      <HStack gap="3" align="center">
        <Text fontSize="xs" color="fg.subtle">
          Showing <Text as="span" fontWeight="600" color="fg.default">{startItem}–{endItem}</Text> of{' '}
          <Text as="span" fontWeight="600" color="fg.default">{total}</Text> products
        </Text>

        {/* Page Size Selector */}
        <HStack gap="1.5" align="center">
          <Text fontSize="xs" color="fg.subtle">
            Per page:
          </Text>
          <Menu.Root positioning={{ placement: 'bottom-start' }}>
            <Menu.Trigger asChild>
              <Button size="xs" variant="outline" h="26px">
                {limit}
                <ChevronDown size={12} />
              </Button>
            </Menu.Trigger>
            <Menu.Positioner>
              <Menu.Content minW="80px">
                {[20, 40, 60].map((size) => (
                  <Menu.Item
                    key={size}
                    value={String(size)}
                    onClick={() => onLimitChange(size)}
                    fontWeight={limit === size ? '600' : 'normal'}
                  >
                    {size}
                  </Menu.Item>
                ))}
              </Menu.Content>
            </Menu.Positioner>
          </Menu.Root>
        </HStack>
      </HStack>

      {/* Pagination Actions */}
      <HStack gap="1.5" align="center">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft size={14} />
          Previous
        </Button>

        <Text fontSize="xs" color="fg.subtle" px="2" fontWeight="500">
          Page {page} of {Math.max(totalPages, 1)}
        </Text>

        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight size={14} />
        </Button>
      </HStack>
    </Flex>
  )
}
