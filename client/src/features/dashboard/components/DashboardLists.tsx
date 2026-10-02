import { Badge, Box, Button, HStack, Menu, Table, Text, VStack } from '@chakra-ui/react'
import { Image as ImageIcon, MoreHorizontal } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { LowStockAlert, RecentInvoice, RecentTransaction, TopSellingProduct } from '../types'
import { DashboardSection } from './DashboardSection'

function statusColor(status: string) {
  if (status === 'Completed' || status === 'Paid' || status === 'Issued') return 'green'
  if (status === 'Out of stock' || status === 'Overdue' || status === 'Cancelled') return 'red'
  return 'orange'
}

export function RecentTransactions({ items }: { items: RecentTransaction[] }) {
  return (
    <DashboardSection
      title="Recent Transactions"
      action={
        <Button variant="ghost" size="xs">
          View all
        </Button>
      }
    >
      <Table.ScrollArea maxW="full">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Invoice</Table.ColumnHeader>
              <Table.ColumnHeader>Customer</Table.ColumnHeader>
              <Table.ColumnHeader>Items</Table.ColumnHeader>
              <Table.ColumnHeader>Total</Table.ColumnHeader>
              <Table.ColumnHeader>Payment</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.id}>
                <Table.Cell fontWeight="600">{item.id}</Table.Cell>
                <Table.Cell>{item.customer}</Table.Cell>
                <Table.Cell>{item.itemCount}</Table.Cell>
                <Table.Cell>{formatCurrency(item.total)}</Table.Cell>
                <Table.Cell>{item.paymentMethod}</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={statusColor(item.status)}>{item.status}</Badge>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
    </DashboardSection>
  )
}

export function TopSellingProducts({ items }: { items: TopSellingProduct[] }) {
  return (
    <DashboardSection
      title="Top Selling Products"
      action={
        <Button variant="ghost" size="xs">
          View all
        </Button>
      }
    >
      <VStack align="stretch" gap="0" px="4" pb="2">
        {items.map((item) => (
          <HStack key={item.productId} py="3" borderBottomWidth="1px" borderColor="border">
            <Text w="6" color="muted" fontSize="sm">
              {item.rank}
            </Text>
            <Box
              w="32px"
              h="32px"
              borderRadius="sm"
              bg="background"
              overflow="hidden"
              display="grid"
              placeItems="center"
            >
              {item.imageKeys[0] ? (
                <img
                  src={item.imageKeys[0]}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <ImageIcon size={16} color="var(--chakra-colors-muted)" />
              )}
            </Box>
            <Box flex="1" minW="0">
              <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                {item.productName}
              </Text>
              <Text fontSize="xs" color="secondary">
                {item.unitsSold} units sold
              </Text>
            </Box>
            <Text fontSize="sm" fontWeight="600">
              {formatCurrency(item.revenue)}
            </Text>
          </HStack>
        ))}
      </VStack>
    </DashboardSection>
  )
}

export function LowStockAlerts({ items }: { items: LowStockAlert[] }) {
  return (
    <DashboardSection
      title="Low Stock Alerts"
      action={
        <Button variant="ghost" size="xs">
          View all
        </Button>
      }
    >
      <VStack align="stretch" gap="0" px="4" pb="2">
        {items.map((item) => (
          <HStack key={item.productId} py="3" borderBottomWidth="1px" borderColor="border">
            <Box
              w="32px"
              h="32px"
              borderRadius="sm"
              bg="background"
              overflow="hidden"
              display="grid"
              placeItems="center"
              flexShrink="0"
            >
              {item.imageKeys[0] ? (
                <img
                  src={item.imageKeys[0]}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <ImageIcon size={16} color="var(--chakra-colors-muted)" />
              )}
            </Box>
            <Box flex="1" minW="0">
              <Text fontSize="sm" fontWeight="600" lineClamp={1}>
                {item.productName}
              </Text>
              <Text fontSize="xs" color="secondary">
                Only {item.currentStock} left · threshold {item.threshold}
              </Text>
            </Box>
            <Badge colorPalette={statusColor(item.status)}>{item.status}</Badge>
          </HStack>
        ))}
      </VStack>
    </DashboardSection>
  )
}

export function RecentInvoices({ items }: { items: RecentInvoice[] }) {
  return (
    <DashboardSection
      title="Recent Invoices"
      action={
        <Button variant="ghost" size="xs">
          View all
        </Button>
      }
    >
      <Table.ScrollArea maxW="full">
        <Table.Root size="sm" variant="line">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Invoice</Table.ColumnHeader>
              <Table.ColumnHeader>Customer</Table.ColumnHeader>
              <Table.ColumnHeader>Date</Table.ColumnHeader>
              <Table.ColumnHeader>Items</Table.ColumnHeader>
              <Table.ColumnHeader>Subtotal</Table.ColumnHeader>
              <Table.ColumnHeader>Tax</Table.ColumnHeader>
              <Table.ColumnHeader>Total</Table.ColumnHeader>
              <Table.ColumnHeader>Payment</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader>Actions</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items.map((item) => (
              <Table.Row key={item.invoiceNumber}>
                <Table.Cell fontWeight="600">{item.invoiceNumber}</Table.Cell>
                <Table.Cell>{item.customer}</Table.Cell>
                <Table.Cell>{formatDate(item.date)}</Table.Cell>
                <Table.Cell>{item.itemCount}</Table.Cell>
                <Table.Cell>{formatCurrency(item.subtotal)}</Table.Cell>
                <Table.Cell>{formatCurrency(item.tax)}</Table.Cell>
                <Table.Cell fontWeight="600">{formatCurrency(item.total)}</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={statusColor(item.paymentStatus)}>{item.paymentStatus}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={statusColor(item.status)}>{item.status}</Badge>
                </Table.Cell>
                <Table.Cell>
                  <Menu.Root>
                    <Menu.Trigger asChild>
                      <Button variant="ghost" size="xs" aria-label={`Actions for ${item.invoiceNumber}`}>
                        <MoreHorizontal size={15} />
                      </Button>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="view">View invoice</Menu.Item>
                        <Menu.Item value="download">Download</Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Root>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
    </DashboardSection>
  )
}
