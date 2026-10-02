import { Grid, Skeleton, Stat } from '@chakra-ui/react'
import { AlertTriangle, Boxes, CircleX, Package, WalletCards } from 'lucide-react'
import type { InventorySummary } from '@/api/endpoints/inventory'

const statItems = [
  ['Inventory value', 'inventoryValue', WalletCards],
  ['Total units', 'totalUnits', Boxes],
  ['Total products', 'totalProducts', Package],
  ['Low stock', 'lowStockProducts', AlertTriangle],
  ['Out of stock', 'outOfStockProducts', CircleX],
] as const

export function InventoryStats({ summary, loading }: { summary?: InventorySummary; loading: boolean }) {
  return (
    <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(5, 1fr)' }} gap="3">
      {statItems.map(([label, key, Icon]) => (
        <Stat.Root key={label} size="sm" borderWidth="1px" borderColor="border" borderRadius="lg" bg="surface" p="4">
          <Stat.Label display="flex" alignItems="center" justifyContent="space-between" color="secondary">
            {label}
            <Icon size={17} />
          </Stat.Label>
          {loading ? <Skeleton mt="3" h="7" w="24" /> : <Stat.ValueText mt="2">{key === 'inventoryValue' ? `$${summary?.[key].toFixed(2) ?? '—'}` : summary?.[key].toLocaleString() ?? '—'}</Stat.ValueText>}
        </Stat.Root>
      ))}
    </Grid>
  )
}

