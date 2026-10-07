import { Button, Menu } from '@chakra-ui/react'
import { ArrowUpDown, ChevronDown } from 'lucide-react'

export type SortOptionKey =
  | 'newest'
  | 'name-asc'
  | 'price-asc'
  | 'price-desc'
  | 'stock-asc'

export interface SortConfig {
  sortBy: 'name' | 'sellingPrice' | 'stockQuantity' | 'createdAt'
  sortOrder: 'asc' | 'desc'
}

const SORT_OPTIONS: Array<{ key: SortOptionKey; label: string; config: SortConfig }> = [
  { key: 'newest', label: 'Newest', config: { sortBy: 'createdAt', sortOrder: 'desc' } },
  { key: 'name-asc', label: 'Name A–Z', config: { sortBy: 'name', sortOrder: 'asc' } },
  { key: 'price-asc', label: 'Price Low → High', config: { sortBy: 'sellingPrice', sortOrder: 'asc' } },
  { key: 'price-desc', label: 'Price High → Low', config: { sortBy: 'sellingPrice', sortOrder: 'desc' } },
  { key: 'stock-asc', label: 'Stock Low → High', config: { sortBy: 'stockQuantity', sortOrder: 'asc' } },
]

export function ProductSort({
  sortBy,
  sortOrder,
  onChange,
}: {
  sortBy: SortConfig['sortBy']
  sortOrder: SortConfig['sortOrder']
  onChange: (config: SortConfig) => void
}) {
  const currentOption =
    SORT_OPTIONS.find(
      (opt) => opt.config.sortBy === sortBy && opt.config.sortOrder === sortOrder,
    ) || SORT_OPTIONS[0]

  return (
    <Menu.Root positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline" borderRadius="sm" flexShrink={0}>
          <ArrowUpDown size={14} />
          {currentOption.label}
          <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="170px">
          {SORT_OPTIONS.map((option) => {
            const isSelected =
              option.config.sortBy === sortBy && option.config.sortOrder === sortOrder
            return (
              <Menu.Item
                key={option.key}
                value={option.key}
                onClick={() => onChange(option.config)}
                fontWeight={isSelected ? '600' : 'normal'}
              >
                {option.label}
              </Menu.Item>
            )
          })}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
