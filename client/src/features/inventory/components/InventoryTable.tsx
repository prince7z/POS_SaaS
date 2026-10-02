import { Badge, Button, IconButton, Menu, Skeleton, Table } from '@chakra-ui/react'
import { ArrowDown, ArrowUp, ClipboardPlus, MoreHorizontal, Waypoints } from 'lucide-react'
import type { InventoryItem } from '@/api/endpoints/inventory'
import { InventoryProductIdentity } from './InventoryProductIdentity'

export function InventoryTable({ items, loading, onView, onAdjust, onMovements, sortBy, sortOrder, onSort }: { items: InventoryItem[]; loading: boolean; onView: (item: InventoryItem) => void; onAdjust: (item: InventoryItem) => void; onMovements: (item: InventoryItem) => void; sortBy: 'name' | 'stockQuantity' | 'createdAt'; sortOrder: 'asc' | 'desc'; onSort: (key: 'name' | 'stockQuantity' | 'createdAt') => void }) {
  const sortButton = (label: string, key: 'name' | 'stockQuantity' | 'createdAt') => <Button size="xs" variant="ghost" onClick={() => onSort(key)}>{label}{sortBy === key && (sortOrder === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</Button>
  return (
    <Table.ScrollArea maxW="full">
      <Table.Root size="sm" variant="line" minW="980px">
        <Table.Header><Table.Row><Table.ColumnHeader>{sortButton('Product', 'name')}</Table.ColumnHeader><Table.ColumnHeader>SKU</Table.ColumnHeader><Table.ColumnHeader>Category</Table.ColumnHeader><Table.ColumnHeader textAlign="end">{sortButton('Current stock', 'stockQuantity')}</Table.ColumnHeader><Table.ColumnHeader textAlign="end">Reorder level</Table.ColumnHeader><Table.ColumnHeader textAlign="end">Purchase cost</Table.ColumnHeader><Table.ColumnHeader textAlign="end">Inventory value</Table.ColumnHeader><Table.ColumnHeader>Status</Table.ColumnHeader><Table.ColumnHeader>Actions</Table.ColumnHeader></Table.Row></Table.Header>
        <Table.Body>
          {loading ? Array.from({ length: 8 }, (_, row) => <Table.Row key={row}>{Array.from({ length: 9 }, (_, cell) => <Table.Cell key={cell}><Skeleton h="4" w={cell === 0 ? '180px' : '70px'} /></Table.Cell>)}</Table.Row>) : items.map((item) => {
            const status = item.isOutOfStock ? ['Out of stock', 'red'] : item.isLowStock ? ['Low stock', 'orange'] : ['In stock', 'green']
            return <Table.Row key={item.productId}><Table.Cell><InventoryProductIdentity product={item} compact /></Table.Cell><Table.Cell>{item.sku}</Table.Cell><Table.Cell>{item.category?.name ?? '—'}</Table.Cell><Table.Cell textAlign="end" fontWeight="600">{item.stockQuantity}</Table.Cell><Table.Cell textAlign="end">{item.lowStockThreshold}</Table.Cell><Table.Cell textAlign="end">${item.purchaseCost.toFixed(2)}</Table.Cell><Table.Cell textAlign="end">${(item.stockQuantity * item.averageCost).toFixed(2)}</Table.Cell><Table.Cell><Badge colorPalette={status[1]}>{status[0]}</Badge></Table.Cell><Table.Cell><Menu.Root positioning={{ placement: 'bottom-end' }}><Menu.Trigger asChild><IconButton size="xs" variant="ghost" aria-label={`Actions for ${item.name}`}><MoreHorizontal size={16} /></IconButton></Menu.Trigger><Menu.Positioner><Menu.Content><Menu.Item value="view" onClick={() => onView(item)}>View product</Menu.Item><Menu.Item value="adjust" onClick={() => onAdjust(item)}><ClipboardPlus size={14} />Adjust stock</Menu.Item><Menu.Item value="movements" onClick={() => onMovements(item)}><Waypoints size={14} />Stock movements</Menu.Item></Menu.Content></Menu.Positioner></Menu.Root></Table.Cell></Table.Row>
          })}
        </Table.Body>
      </Table.Root>
    </Table.ScrollArea>
  )
}
