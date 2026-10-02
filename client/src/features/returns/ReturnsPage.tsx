import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Grid,
  Heading,
  HStack,
  IconButton,
  Input,
  NativeSelect,
  Separator,
  Skeleton,
  Table,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import {
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  FileText,
  Filter,
  Hash,
  ListFilter,
  Package,
  Receipt,
  RotateCcw,
  Search,
  WalletCards,
  X,
} from 'lucide-react'
import {
  createReturn,
  getReturnableItems,
  getReturnSummary,
  getReturns,
  searchSales,
  type ReturnFilters,
  type ReturnRow,
  type ReturnSummary,
  type ReturnableSale,
  type SaleSummary,
} from '@/api/endpoints/sales'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'

const money = (value: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const initials = (value: string) =>
  value
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
function Label({ icon: Icon, children }: { icon: typeof Search; children: string }) {
  return (
    <Text fontSize="xs" mb="1" color="secondary">
      <Icon size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
      {children}
    </Text>
  )
}
function Avatar({ name, src }: { name: string; src?: string | null }) {
  return src ? (
    <img src={src} alt={`${name} profile`} width="42" height="42" style={{ borderRadius: '50%', objectFit: 'cover' }} />
  ) : (
    <Box
      boxSize="42px"
      borderRadius="full"
      bg="colorPalette.subtle"
      display="grid"
      placeItems="center"
      fontSize="xs"
      fontWeight="bold"
    >
      {initials(name)}
    </Box>
  )
}
function StatCard({
  title,
  value,
  detail,
  icon: Icon,
  format = true,
}: {
  title: string
  value: number
  detail: string
  icon: typeof Receipt
  format?: boolean
}) {
  return (
    <Card.Root variant="outline" size="sm">
      <Card.Body>
        <HStack justify="space-between">
          <Box>
            <Text fontSize="xs" color="secondary">
              {title}
            </Text>
            <Heading size="lg">{format ? money(value) : value}</Heading>
            <Text fontSize="xs" color="secondary">
              {detail}
            </Text>
          </Box>
          <Icon size={20} />
        </HStack>
      </Card.Body>
    </Card.Root>
  )
}

function CreateReturn({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [invoice, setInvoice] = useState('')
  const [matches, setMatches] = useState<SaleSummary[]>([])
  const [sale, setSale] = useState<ReturnableSale>()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [refundType, setRefundType] = useState<'CASH' | 'STORE_CREDIT'>('CASH')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (invoice.trim().length < 2) {
      setMatches([])
      return
    }
    const timer = window.setTimeout(() => {
      setLoading(true)
      searchSales(invoice.trim())
        .then((result) => setMatches(result.items))
        .catch(() => setMatches([]))
        .finally(() => setLoading(false))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [invoice])
  const selectSale = async (item: SaleSummary) => {
    setLoading(true)
    setError('')
    try {
      const result = await getReturnableItems(item.id)
      setSale(result)
      setInvoice(result.invoiceNumber)
      setMatches([])
      setQuantities(Object.fromEntries(result.items.map((entry) => [entry.saleItemId, 0])))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invoice items could not be loaded.')
    } finally {
      setLoading(false)
    }
  }
  const submit = async () => {
    const items =
      sale?.items
        .filter((item) => (quantities[item.saleItemId] ?? 0) > 0)
        .map((item) => ({ saleItemId: item.saleItemId, quantity: quantities[item.saleItemId] })) ?? []
    if (!sale) return setError('Search for and select a completed invoice first.')
    if (!items.length) return setError('Select at least one item and enter a return quantity.')
    if (!reason) return setError('Select a reason for the return.')
    setSaving(true)
    setError('')
    setMessage('')
    try {
      await createReturn(sale.saleId, { refundType, reason, notes: notes || undefined, items })
      setMessage('Return processed successfully.')
      setSale(undefined)
      setInvoice('')
      setReason('')
      setNotes('')
      setQuantities({})
      onCreated()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Return could not be processed.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Drawer.Root open={open} onOpenChange={(event) => !event.open && onClose()} placement="end" size="lg">
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <HStack justify="space-between" w="full">
              <Box>
                <Heading size="md">Create Return</Heading>
                <Text fontSize="sm" color="secondary">
                  Search a completed invoice and select returned items.
                </Text>
              </Box>
              <Drawer.CloseTrigger asChild>
                <IconButton size="xs" variant="ghost" aria-label="Close create return">
                  <X size={16} />
                </IconButton>
              </Drawer.CloseTrigger>
            </HStack>
          </Drawer.Header>
          <Drawer.Body>
            <VStack align="stretch" gap="4">
              <Box position="relative">
                <Label icon={Hash}>Invoice number</Label>
                <Input
                  value={invoice}
                  onChange={(e) => {
                    setInvoice(e.target.value)
                    setSale(undefined)
                  }}
                  placeholder="e.g. INV-00124"
                />
                <Search size={16} style={{ position: 'absolute', right: 10, bottom: 9 }} />
                {matches.length > 0 && (
                  <Card.Root position="absolute" zIndex="popover" top="70px" w="full" variant="outline">
                    <Card.Body p="2">
                      {matches.map((item) => (
                        <Button
                          key={item.id}
                          w="full"
                          justifyContent="space-between"
                          variant="ghost"
                          onClick={() => selectSale(item)}
                        >
                          <Text>{item.invoiceNumber}</Text>
                          <Text fontSize="xs" color="secondary">
                            {date(item.soldAt)} · {money(item.total)}
                          </Text>
                        </Button>
                      ))}
                    </Card.Body>
                  </Card.Root>
                )}
              </Box>
              {loading && <Skeleton h="10" />}
              {sale && (
                <>
                  <Card.Root variant="subtle">
                    <Card.Body>
                      <Grid templateColumns="1fr 1fr" gap="2">
                        <Text fontSize="xs" color="secondary">
                          Customer
                        </Text>
                        <Text fontSize="xs" color="secondary">
                          Sale details
                        </Text>{' '}
                        <HStack>
                          <Avatar name={sale.customer?.name ?? 'Walk-in customer'} src={sale.customer?.imageUrl} />
                          <Text fontWeight="600">{sale.customer?.name ?? 'Walk-in customer'}</Text>
                        </HStack>
                        <Text fontSize="sm">
                          {date(sale.soldAt)} · {money(sale.total)}
                        </Text>
                      </Grid>
                    </Card.Body>
                  </Card.Root>
                  <Box>
                    <Text fontSize="sm" fontWeight="600" mb="2">
                      <Package size={14} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
                      Select items to return
                    </Text>
                    <VStack align="stretch" gap="2">
                      {sale.items.map((item) => (
                        <HStack key={item.saleItemId} justify="space-between" borderWidth="1px" borderRadius="md" p="2">
                          {' '}
                          <HStack minW="0" flex="1">
                            <Box
                              boxSize="38px"
                              borderRadius="md"
                              overflow="hidden"
                              bg="bg.muted"
                              display="grid"
                              placeItems="center"
                              flexShrink={0}
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.productName}
                                  width="38"
                                  height="38"
                                  style={{ objectFit: 'cover' }}
                                />
                              ) : (
                                <Package size={16} />
                              )}
                            </Box>
                            <Box minW="0">
                              <Text fontSize="sm" truncate>
                                {item.productName}
                              </Text>
                              <Text fontSize="xs" color="secondary">
                                SKU {item.sku} · Sold {item.soldQuantity} · Returned {item.returnedQuantity} · Remaining{' '}
                                {item.returnableQuantity}
                              </Text>
                            </Box>
                          </HStack>
                          <Box w="90px">
                            <Label icon={Receipt}>Return qty</Label>
                            <Input
                              size="sm"
                              type="number"
                              min="0"
                              max={item.returnableQuantity}
                              value={quantities[item.saleItemId] ?? 0}
                              onChange={(e) =>
                                setQuantities({
                                  ...quantities,
                                  [item.saleItemId]: Math.min(
                                    item.returnableQuantity,
                                    Math.max(0, Number(e.target.value) || 0),
                                  ),
                                })
                              }
                            />
                          </Box>
                        </HStack>
                      ))}
                    </VStack>
                  </Box>
                  <Separator />
                  <Box>
                    <Label icon={ListFilter}>Reason</Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field value={reason} onChange={(e) => setReason(e.target.value)}>
                        <option value="">Select return reason</option>
                        <option value="Damaged Product">Damaged Product</option>
                        <option value="Wrong Item">Wrong Item</option>
                        <option value="Changed Mind">Changed Mind</option>
                        <option value="Other">Other</option>
                      </NativeSelect.Field>
                    </NativeSelect.Root>
                  </Box>
                  <Box>
                    <Label icon={FileText}>Notes</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add return notes or packaging details..."
                      rows={3}
                    />
                  </Box>
                  <Box>
                    <Label icon={WalletCards}>Refund type</Label>
                    <HStack>
                      <Button
                        size="sm"
                        variant={refundType === 'CASH' ? 'solid' : 'outline'}
                        onClick={() => setRefundType('CASH')}
                      >
                        <WalletCards size={14} />
                        Cash refund
                      </Button>
                      <Button
                        size="sm"
                        variant={refundType === 'STORE_CREDIT' ? 'solid' : 'outline'}
                        onClick={() => setRefundType('STORE_CREDIT')}
                      >
                        <Receipt size={14} />
                        Store credit
                      </Button>
                    </HStack>
                  </Box>
                </>
              )}
              {message && (
                <Text color="success" fontSize="sm">
                  {message}
                </Text>
              )}
              {error && (
                <Text color="danger" fontSize="sm">
                  {error}
                </Text>
              )}
              <HStack justify="flex-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSale(undefined)
                    setInvoice('')
                    setError('')
                  }}
                >
                  Clear
                </Button>
                <Button loading={saving} onClick={submit}>
                  <Check size={15} />
                  Process Return
                </Button>
              </HStack>{' '}
            </VStack>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}

function ReturnDetails({ row, onClose }: { row?: ReturnRow; onClose: () => void }) {
  return (
    <Drawer.Root open={Boolean(row)} onOpenChange={(event) => !event.open && onClose()} placement="end" size="lg">
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <HStack justify="space-between" w="full">
              <Box>
                <Heading size="md">Return details</Heading>
                <Text fontSize="sm" color="secondary">
                  {row?.returnNumber}
                </Text>
              </Box>
              <Drawer.CloseTrigger asChild>
                <IconButton size="xs" variant="ghost" aria-label="Close return details">
                  <X size={16} />
                </IconButton>
              </Drawer.CloseTrigger>
            </HStack>
          </Drawer.Header>
          <Drawer.Body>
            {row && (
              <VStack align="stretch" gap="5">
                <HStack>
                  <Avatar name={row.customer?.name ?? 'Walk-in customer'} src={row.customer?.imageUrl} />
                  <Box>
                    <Text fontWeight="700">{row.customer?.name ?? 'Walk-in customer'}</Text>
                    <Text fontSize="sm" color="secondary">
                      {row.invoiceNumber ?? 'No invoice'}
                    </Text>
                  </Box>
                </HStack>
                <Box>
                  <Heading size="sm" mb="3">
                    Returned items
                  </Heading>
                  <VStack align="stretch">
                    {row.items.map((item) => (
                      <HStack key={`${row.id}-${item.productId}`} justify="space-between">
                        <Text>
                          {item.productName ?? 'Product'} · {item.quantity} unit{item.quantity === 1 ? '' : 's'}
                        </Text>
                        <Text fontWeight="600">{money(item.refundAmount)}</Text>
                      </HStack>
                    ))}
                  </VStack>
                </Box>
                <Card.Root variant="outline">
                  <Card.Body>
                    <VStack align="stretch">
                      <HStack justify="space-between">
                        <Text color="secondary">Refund</Text>
                        <Text fontWeight="700">{money(row.refundAmount)}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text color="secondary">Reason</Text>
                        <Text>{row.reason ?? '—'}</Text>
                      </HStack>
                      <HStack justify="space-between">
                        <Text color="secondary">Status</Text>
                        <Badge>{row.status}</Badge>
                      </HStack>
                      {row.notes && <Text fontSize="sm">{row.notes}</Text>}
                    </VStack>
                  </Card.Body>
                </Card.Root>
              </VStack>
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}

export function ReturnsPage() {
  const [filters, setFilters] = useState<ReturnFilters>({ page: 1, limit: 10 })
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [summary, setSummary] = useState<ReturnSummary>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<ReturnRow>()
  const [createOpen, setCreateOpen] = useState(false)
  const [sort, setSort] = useState<{ field: 'number' | 'date' | 'amount' | 'items'; order: 'asc' | 'desc' }>({
    field: 'date',
    order: 'desc',
  })
  const load = () => {
    setLoading(true)
    Promise.all([getReturns(filters), getReturnSummary(filters)])
      .then(([result, stats]) => {
        setRows(result.items)
        setPagination(result.pagination)
        setSummary(stats)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Returns could not be loaded.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [filters.page, filters.limit, filters.search, filters.refundType, filters.from, filters.to])
  const setFilter = (patch: Partial<ReturnFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))
  const toggleSort = (field: typeof sort.field) =>
    setSort((current) => ({ field, order: current.field === field && current.order === 'asc' ? 'desc' : 'asc' }))
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const d = sort.order === 'asc' ? 1 : -1
        if (sort.field === 'number') return d * a.returnNumber.localeCompare(b.returnNumber)
        if (sort.field === 'amount') return d * (a.refundAmount - b.refundAmount)
        if (sort.field === 'items')
          return d * (a.items.reduce((s, i) => s + i.quantity, 0) - b.items.reduce((s, i) => s + i.quantity, 0))
        return d * (new Date(a.processedAt).getTime() - new Date(b.processedAt).getTime())
      }),
    [rows, sort],
  )
  return (
    <PageContainer>
      <PageHeader title="Returns" description="Manage product returns and refunds." />
      <VStack align="stretch" gap="5">
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }} gap="4">
          <StatCard
            title="Total returns"
            value={summary?.totalReturns ?? 0}
            detail="completed and rejected records"
            icon={RotateCcw}
            format={false}
          />
          <StatCard
            title="Refunded amount"
            value={summary?.totalRefunded ?? 0}
            detail="sum of refund amounts"
            icon={WalletCards}
          />
          <StatCard
            title="Items returned"
            value={summary?.totalItemsReturned ?? 0}
            detail="sum of returned quantities"
            icon={Package}
            format={false}
          />
          <StatCard
            title="Pending returns"
            value={summary?.pendingReturns ?? 0}
            detail="not marked completed"
            icon={Receipt}
            format={false}
          />
        </Grid>{' '}
        <Grid templateColumns="1fr" gap="5">
          <Card.Root variant="outline">
            <Card.Body>
              <HStack justify="space-between">
                <Box>
                  <Heading size="sm">Return processing</Heading>
                  <Text fontSize="sm" color="secondary">
                    Create a return from a completed invoice.
                  </Text>
                </Box>
                <Button onClick={() => setCreateOpen(true)}>
                  <RotateCcw size={15} />
                  Create Return
                </Button>
              </HStack>
            </Card.Body>
          </Card.Root>
          <CreateReturn
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onCreated={() => {
              setCreateOpen(false)
              load()
            }}
          />
          <Card.Root variant="outline">
            <Card.Header>
              <HStack justify="space-between">
                <Box>
                  <Heading size="sm">Returns History</Heading>
                  <Text fontSize="sm" color="secondary">
                    Filter and sort return records.
                  </Text>
                </Box>
                {error && (
                  <Text color="danger" fontSize="sm">
                    {error}
                  </Text>
                )}
              </HStack>
            </Card.Header>
            <Card.Body>
              <Grid templateColumns={{ base: '1fr', md: '2fr repeat(3, 1fr) auto' }} gap="3" mb="4">
                <Box>
                  <Label icon={Search}>Search</Label>
                  <Input
                    value={filters.search ?? ''}
                    onChange={(e) => setFilter({ search: e.target.value })}
                    placeholder="Return no., invoice, customer"
                  />
                </Box>
                <Box>
                  <Label icon={Filter}>Refund type</Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={filters.refundType ?? ''}
                      onChange={(e) =>
                        setFilter({
                          refundType: e.target.value ? (e.target.value as ReturnFilters['refundType']) : undefined,
                        })
                      }
                    >
                      <option value="">All types</option>
                      <option value="CASH">Cash refund</option>
                      <option value="STORE_CREDIT">Store credit</option>
                    </NativeSelect.Field>
                  </NativeSelect.Root>
                </Box>
                <Box>
                  <Label icon={CalendarDays}>From</Label>
                  <Input type="date" value={filters.from ?? ''} onChange={(e) => setFilter({ from: e.target.value })} />
                </Box>
                <Box>
                  <Label icon={CalendarDays}>To</Label>
                  <Input type="date" value={filters.to ?? ''} onChange={(e) => setFilter({ to: e.target.value })} />
                </Box>
                <Button variant="ghost" alignSelf="end" onClick={() => setFilters({ page: 1, limit: 10 })}>
                  <X size={14} />
                  Clear
                </Button>
              </Grid>
              {loading ? (
                <VStack align="stretch">
                  <Skeleton h="10" />
                  <Skeleton h="10" />
                  <Skeleton h="10" />
                </VStack>
              ) : (
                <Table.ScrollArea>
                  <Table.Root size="sm" variant="line" minW="900px">
                    <Table.Header>
                      <Table.Row>
                        {(['number', 'date', 'items', 'amount'] as const).map((field) => (
                          <Table.ColumnHeader key={field}>
                            <Button size="xs" variant="ghost" px="0" onClick={() => toggleSort(field)}>
                              {field === 'number'
                                ? 'Return No.'
                                : field === 'date'
                                  ? 'Date'
                                  : field === 'items'
                                    ? 'Items'
                                    : 'Refund amount'}{' '}
                              <ChevronDown
                                size={13}
                                style={{
                                  transform:
                                    sort.field === field && sort.order === 'asc' ? 'rotate(180deg)' : undefined,
                                }}
                              />
                            </Button>
                          </Table.ColumnHeader>
                        ))}
                        <Table.ColumnHeader>Customer</Table.ColumnHeader>
                        <Table.ColumnHeader>Refund type</Table.ColumnHeader>
                        <Table.ColumnHeader>Reason</Table.ColumnHeader>
                        <Table.ColumnHeader>Status</Table.ColumnHeader>
                        <Table.ColumnHeader>Actions</Table.ColumnHeader>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {sortedRows.map((row) => (
                        <Table.Row key={row.id}>
                          <Table.Cell fontWeight="600">{row.returnNumber}</Table.Cell>
                          <Table.Cell>{date(row.processedAt)}</Table.Cell>
                          <Table.Cell>
                            {row.items.reduce((total, item) => total + item.quantity, 0)} unit
                            {row.items.reduce((total, item) => total + item.quantity, 0) === 1 ? '' : 's'} ·{' '}
                            {row.items.length} product{row.items.length === 1 ? '' : 's'}
                          </Table.Cell>
                          <Table.Cell fontWeight="700">{money(row.refundAmount)}</Table.Cell>
                          <Table.Cell>{row.customer?.name ?? 'Walk-in customer'}</Table.Cell>
                          <Table.Cell>
                            <Badge>{row.refundType === 'STORE_CREDIT' ? 'Store credit' : 'Cash refund'}</Badge>
                          </Table.Cell>
                          <Table.Cell>{row.reason ?? '—'}</Table.Cell>
                          <Table.Cell>
                            <Badge colorPalette={row.status === 'COMPLETED' ? 'green' : 'orange'}>{row.status}</Badge>
                          </Table.Cell>
                          <Table.Cell>
                            <Button size="xs" variant="ghost" onClick={() => setSelected(row)}>
                              <Eye size={14} />
                              View
                            </Button>
                          </Table.Cell>
                        </Table.Row>
                      ))}
                    </Table.Body>
                  </Table.Root>
                </Table.ScrollArea>
              )}
              {!loading && !rows.length && (
                <Text py="8" textAlign="center" color="secondary">
                  No returns match the selected filters.
                </Text>
              )}
              <HStack justify="space-between" mt="4">
                <Text fontSize="sm" color="secondary">
                  {pagination.total} return{pagination.total === 1 ? '' : 's'}
                </Text>
                <HStack>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pagination.page <= 1}
                    onClick={() => setFilter({ page: pagination.page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setFilter({ page: pagination.page + 1 })}
                  >
                    Next
                  </Button>
                </HStack>
              </HStack>
            </Card.Body>
          </Card.Root>
        </Grid>
      </VStack>
      <ReturnDetails row={selected} onClose={() => setSelected(undefined)} />
    </PageContainer>
  )
}
export default ReturnsPage
