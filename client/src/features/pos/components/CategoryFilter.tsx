import { Box, Button, HStack } from '@chakra-ui/react'
import type { CatalogCategory } from '@/api/endpoints/catalog'

export function CategoryFilter({
  categories,
  selectedCategoryId,
  onSelectCategory,
}: {
  categories: CatalogCategory[]
  selectedCategoryId: string | undefined
  onSelectCategory: (categoryId: string | undefined) => void
}) {
  return (
    <Box
      w="full"
      overflowX="auto"
      py="1"
      css={{
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      }}
    >
      <HStack gap="1.5" minW="max-content">
        <Button
          size="sm"
          variant={!selectedCategoryId ? 'solid' : 'outline'}
          colorPalette={!selectedCategoryId ? 'blue' : undefined}
          onClick={() => onSelectCategory(undefined)}
          borderRadius="sm"
        >
          All
        </Button>
        {categories.map((category) => {
          const isSelected = selectedCategoryId === category.id
          return (
            <Button
              key={category.id}
              size="sm"
              variant={isSelected ? 'solid' : 'outline'}
              colorPalette={isSelected ? 'blue' : undefined}
              onClick={() => onSelectCategory(category.id)}
              whiteSpace="nowrap"
              borderRadius="sm"
            >
              {category.name}
            </Button>
          )
        })}
      </HStack>
    </Box>
  )
}
