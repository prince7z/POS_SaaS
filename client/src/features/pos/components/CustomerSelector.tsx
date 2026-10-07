import { Button, HStack, Menu, Text } from '@chakra-ui/react'
import { ChevronDown, UserRound } from 'lucide-react'
import type { Customer } from '../types'

export function CustomerSelector({
  customers,
  selectedCustomerId,
  onSelectCustomer,
}: {
  customers: Customer[]
  selectedCustomerId: string | null
  onSelectCustomer: (customerId: string | null) => void
}) {
  const selected = customers.find((c) => c.id === selectedCustomerId)
  const displayName = selected ? selected.name : 'Walk-in Customer'

  return (
    <Menu.Root positioning={{ placement: 'bottom-start' }}>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline" justifyContent="space-between" w="full">
          <HStack gap="2" minW="0">
            <UserRound size={14} style={{ flexShrink: 0 }} />
            <Text lineClamp={1}>{displayName}</Text>
          </HStack>
          <ChevronDown size={14} style={{ flexShrink: 0 }} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="240px" maxH="280px" overflowY="auto">
          {/* Walk-in Customer default option */}
          <Menu.Item
            value="walk-in"
            onClick={() => onSelectCustomer(null)}
            fontWeight={!selectedCustomerId ? '600' : 'normal'}
          >
            Walk-in Customer
          </Menu.Item>
          {customers.map((customer) => (
            <Menu.Item
              key={customer.id}
              value={customer.id}
              onClick={() => onSelectCustomer(customer.id)}
              fontWeight={selectedCustomerId === customer.id ? '600' : 'normal'}
            >
              {customer.name} {customer.phone ? `(${customer.phone})` : ''}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
