import { Button, HStack, Input, NativeSelect, VStack } from '@chakra-ui/react'
import { Filter, Search } from 'lucide-react'
import type { CatalogBrand, CatalogCategory } from '@/api/endpoints/catalog'
import { SearchableSelect } from '@/components/common/SearchableSelect'

export function InventoryToolbar({
  search,
  onSearch,
  categoryId,
  onCategory,
  brandId,
  onBrand,
  status,
  onStatus,
  categories,
  brands,
}: {
  search: string
  onSearch: (value: string) => void
  categoryId: string
  onCategory: (value: string) => void
  brandId: string
  onBrand: (value: string) => void
  status: string
  onStatus: (value: string) => void
  categories: CatalogCategory[]
  brands: CatalogBrand[]
}) {
  return (
    <VStack align="stretch" gap="3">
      <HStack flexWrap="wrap" gap="2">
        <HStack flex="1" minW="220px">
          <Search size={15} />
          <Input
            size="sm"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search products, SKU or barcode..."
          />
        </HStack>
        <SearchableSelect
          options={[
            { value: '__all__', label: 'All categories' },
            ...categories.map((category) => ({ value: category.id, label: category.name })),
          ]}
          value={categoryId || '__all__'}
          onChange={(value) => onCategory(value === '__all__' ? '' : value)}
          placeholder="Search categories"
        />
        <SearchableSelect
          options={[
            { value: '__all__', label: 'All brands' },
            ...brands.map((brand) => ({ value: brand.id, label: brand.name })),
          ]}
          value={brandId || '__all__'}
          onChange={(value) => onBrand(value === '__all__' ? '' : value)}
          placeholder="Search brands"
        />
        <NativeSelect.Root size="sm" w="140px">
          <NativeSelect.Field value={status} onChange={(event) => onStatus(event.target.value)}>
            <option value="">All stock</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        <Button size="sm" variant="outline">
          <Filter size={14} />
          Filters
        </Button>
      </HStack>
    </VStack>
  )
}
