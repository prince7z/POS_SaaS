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
  Skeleton,
  Table,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  CalendarDays,
  CreditCard,
  Eye,
  Filter,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import {
  createSupplier,
  deleteSupplier,
  getPurchaseOrders,
  getSupplier,
  getSupplierPayments,
  getSupplierSummary,
  getSuppliers,
  updateSupplier,
  type Supplier,
  type SupplierPayload,
} from '@/api/endpoints/purchases'
import { EmptyState } from '@/components/common/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'

const money = (value = 0) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?'

function SupplierForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Supplier
  onSaved: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<SupplierPayload>({
    name: initial?.name ?? '',
    contactPerson: initial?.contactPerson ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    website: initial?.website ?? '',
    addressLine1: initial?.addressLine1 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    postalCode: initial?.postalCode ?? '',
    paymentTermsDays: initial?.paymentTermsDays ?? 0,
    creditLimit: initial?.creditLimit ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof SupplierPayload, value: string) =>
    setForm((current) => ({
      ...current,
      [key]: key === 'paymentTermsDays' || key === 'creditLimit' ? Number(value) : value,
    }))
  const submit = async () => {
    if (!form.name?.trim()) return setError('Supplier name is required.')
    setSaving(true)
    setError('')
    try {
      if (initial) await updateSupplier(initial.id, form)
      else await createSupplier(form)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Supplier could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const fields = [
    { key: 'name', label: 'Supplier name', icon: Building2 },
    { key: 'contactPerson', label: 'Contact person', icon: Users },
    { key: 'phone', label: 'Phone number', icon: Phone },
    { key: 'email', label: 'Email address', icon: Mail },
    { key: 'website', label: 'Website', icon: Globe },
    { key: 'addressLine1', label: 'Address line 1', icon: MapPin },
    { key: 'city', label: 'City', icon: MapPin },
    { key: 'state', label: 'State / province', icon: MapPin },
    { key: 'postalCode', label: 'Postal code', icon: MapPin },
  ] as const
  return (
    <VStack align="stretch" gap="4">
      <Box>
        <Heading size="sm">{initial ? 'Edit supplier' : 'Add supplier'}</Heading>
        <Text fontSize="sm" color="secondary">
          Keep supplier contact and payment terms current for accurate purchasing.
        </Text>
      </Box>
      <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }} gap="3">
        {fields.map(({ key, label, icon: Icon }) => (
          <Box key={key}>
            <Text fontSize="xs" mb="1" color="secondary">
              <Icon size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
              {label}
            </Text>
            <Input
              placeholder={label}
              value={String(form[key] ?? '')}
              onChange={(event) => set(key, event.target.value)}
            />
          </Box>
        ))}
        <Box>
          <Text fontSize="xs" mb="1" color="secondary">
            <CalendarDays size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
            Payment terms
          </Text>
          <Input
            type="number"
            min="0"
            step="1"
            aria-label="Payment terms in days"
            placeholder="Number of days, e.g. 30"
            value={String(form.paymentTermsDays ?? 0)}
            onChange={(event) => set('paymentTermsDays', event.target.value)}
          />
          <Text fontSize="xs" color="secondary" mt="1">
            Number of days allowed before payment is due.
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" mb="1" color="secondary">
            <CreditCard size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
            Credit limit
          </Text>
          <Input
            type="number"
            min="0"
            step="0.01"
            aria-label="Credit limit amount"
            placeholder="Amount, e.g. 5000"
            value={String(form.creditLimit ?? 0)}
            onChange={(event) => set('creditLimit', event.target.value)}
          />
          <Text fontSize="xs" color="secondary" mt="1">
            Maximum outstanding balance for this supplier.
          </Text>
        </Box>
      </Grid>
      {error && (
        <Text color="danger" fontSize="sm">
          {error}
        </Text>
      )}
      <HStack justify="flex-end">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button loading={saving} onClick={submit}>
          {initial ? 'Save changes' : 'Create supplier'}
        </Button>
      </HStack>
    </VStack>
  )
}

function SupplierDetails({
  supplierId,
  onClose,
  onEdit,
}: {
  supplierId?: string
  onClose: () => void
  onEdit: (supplier: Supplier) => void
}) {
  const [supplier, setSupplier] = useState<Supplier>()
  const [payments, setPayments] = useState<
    Array<{ id: string; amount: number; paymentMethod: string; paidAt: string }>
  >([])
  const [orders, setOrders] = useState<
    Array<{ id: string; poNumber: string; status: string; orderDate: string; total: number }>
  >([])
  const [tab, setTab] = useState<'overview' | 'orders' | 'payments' | 'products'>('overview')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (!supplierId) return
    setLoading(true)
    Promise.all([
      getSupplier(supplierId),
      getSupplierPayments(supplierId),
      getPurchaseOrders({ page: 1, limit: 20, supplierId }),
    ])
      .then(([details, paymentPage, orderPage]) => {
        setSupplier(details)
        setPayments(paymentPage.items)
        setOrders(orderPage.items)
      })
      .finally(() => setLoading(false))
  }, [supplierId])
  return (
    <Drawer.Root
      open={Boolean(supplierId)}
      onOpenChange={(event) => !event.open && onClose()}
      placement="end"
      size="xl"
      lazyMount
      unmountOnExit
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <HStack justify="space-between" w="full">
              <Heading size="md">Supplier details</Heading>
              <Drawer.CloseTrigger asChild>
                <IconButton size="xs" variant="ghost" aria-label="Close supplier details">
                  <X size={16} />
                </IconButton>
              </Drawer.CloseTrigger>
            </HStack>
          </Drawer.Header>
          <Drawer.Body>
            {loading ? (
              <VStack align="stretch">
                <Skeleton h="12" />
                <Skeleton h="32" />
                <Skeleton h="48" />
              </VStack>
            ) : supplier ? (
              <VStack align="stretch" gap="5">
                <HStack justify="space-between">
                  <HStack>
                    <Box bg="colorPalette.subtle" color="colorPalette.fg" borderRadius="full" p="3" fontWeight="bold">
                      {initials(supplier.name)}
                    </Box>
                    <Box>
                      <Heading size="sm">{supplier.name}</Heading>
                      <Text color="secondary">{supplier.contactPerson || supplier.email || 'No contact details'}</Text>
                    </Box>
                  </HStack>
                  <Button size="sm" variant="outline" onClick={() => onEdit(supplier)}>
                    <Pencil size={14} />
                    Edit
                  </Button>
                </HStack>
                <Grid templateColumns="repeat(3, 1fr)" gap="3">
                  <Card.Root>
                    <Card.Body>
                      <Text fontSize="xs" color="secondary">
                        Orders
                      </Text>
                      <Heading size="md">{supplier.stats?.totalOrders ?? 0}</Heading>
                      <Text fontSize="xs" color="secondary">
                        non-cancelled orders
                      </Text>
                    </Card.Body>
                  </Card.Root>
                  <Card.Root>
                    <Card.Body>
                      <Text fontSize="xs" color="secondary">
                        Purchase value
                      </Text>
                      <Heading size="md">{money(supplier.totalPurchaseValue)}</Heading>
                      <Text fontSize="xs" color="secondary">
                        sum of order totals
                      </Text>
                    </Card.Body>
                  </Card.Root>
                  <Card.Root>
                    <Card.Body>
                      <Text fontSize="xs" color="secondary">
                        Outstanding
                      </Text>
                      <Heading size="md">{money(supplier.outstandingBalance)}</Heading>
                      <Text fontSize="xs" color="secondary">
                        purchases minus payments
                      </Text>
                    </Card.Body>
                  </Card.Root>
                </Grid>
                <HStack borderBottomWidth="1px" gap="1">
                  {(['overview', 'orders', 'payments', 'products'] as const).map((value) => (
                    <Button
                      key={value}
                      size="sm"
                      variant={tab === value ? 'subtle' : 'ghost'}
                      onClick={() => setTab(value)}
                    >
                      {value[0].toUpperCase() + value.slice(1)}
                    </Button>
                  ))}
                </HStack>
                {tab === 'overview' && (
                  <Box>
                    <Heading size="sm" mb="3">
                      Overview
                    </Heading>
                    <Text fontSize="sm">
                      {[supplier.addressLine1, supplier.city, supplier.state, supplier.postalCode]
                        .filter(Boolean)
                        .join(', ') || 'No address saved.'}
                    </Text>
                    <Text fontSize="sm" color="secondary" mt="1">
                      {supplier.phone || 'No phone'} {supplier.email ? `• ${supplier.email}` : ''}
                    </Text>
                    <Text fontSize="sm" color="secondary" mt="4">
                      Payment terms: {supplier.paymentTermsDays} days · Credit limit: {money(supplier.creditLimit)}
                    </Text>
                  </Box>
                )}
                {tab === 'orders' &&
                  (orders.length ? (
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>PO number</Table.ColumnHeader>
                          <Table.ColumnHeader>Date</Table.ColumnHeader>
                          <Table.ColumnHeader>Status</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="right">Total</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {orders.map((order) => (
                          <Table.Row key={order.id}>
                            <Table.Cell>{order.poNumber}</Table.Cell>
                            <Table.Cell>{date(order.orderDate)}</Table.Cell>
                            <Table.Cell>
                              <Badge>{order.status}</Badge>
                            </Table.Cell>
                            <Table.Cell textAlign="right">{money(order.total)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  ) : (
                    <Text fontSize="sm" color="secondary">
                      No purchase orders recorded for this supplier.
                    </Text>
                  ))}
                {tab === 'payments' &&
                  (payments.length ? (
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Date</Table.ColumnHeader>
                          <Table.ColumnHeader>Method</Table.ColumnHeader>
                          <Table.ColumnHeader textAlign="right">Amount</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {payments.map((payment) => (
                          <Table.Row key={payment.id}>
                            <Table.Cell>{date(payment.paidAt)}</Table.Cell>
                            <Table.Cell>{payment.paymentMethod}</Table.Cell>
                            <Table.Cell textAlign="right">{money(payment.amount)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  ) : (
                    <Text fontSize="sm" color="secondary">
                      No payments recorded for this supplier.
                    </Text>
                  ))}
                {tab === 'products' && (
                  <Text fontSize="sm" color="secondary">
                    Products linked to this supplier will appear here once the catalog supplier relationship is
                    populated.
                  </Text>
                )}
              </VStack>
            ) : (
              <EmptyState title="Supplier not found" description="This supplier may have been removed." />
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}

export function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([])
  const [summary, setSummary] = useState<{
    totalSuppliers: number
    activeSuppliers: number
    totalPurchaseValue: number
    pendingPayments: number
  }>()
  const [search, setSearch] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 })
  const [selectedId, setSelectedId] = useState<string>()
  const [editing, setEditing] = useState<Supplier>()
  const [formOpen, setFormOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<{ field: 'name' | 'orders' | 'value' | 'pending'; order: 'asc' | 'desc' }>({
    field: 'name',
    order: 'asc',
  })
  const load = () => {
    setLoading(true)
    Promise.all([getSuppliers({ page, limit: 10, search, includeInactive, includeStats: true }), getSupplierSummary()])
      .then(([result, totals]) => {
        setItems(result.items)
        setPagination(result.pagination)
        setSummary(totals)
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [page, search, includeInactive])
  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const values = {
          name: [a.name, b.name],
          orders: [a.stats?.totalOrders ?? 0, b.stats?.totalOrders ?? 0],
          value: [a.stats?.totalPurchaseValue ?? 0, b.stats?.totalPurchaseValue ?? 0],
          pending: [a.stats?.pendingAmount ?? 0, b.stats?.pendingAmount ?? 0],
        }[sort.field]
        const comparison =
          typeof values[0] === 'string'
            ? String(values[0]).localeCompare(String(values[1]))
            : Number(values[0]) - Number(values[1])
        return sort.order === 'asc' ? comparison : -comparison
      }),
    [items, sort],
  )
  const sortBy = (field: typeof sort.field) =>
    setSort((current) => ({ field, order: current.field === field && current.order === 'asc' ? 'desc' : 'asc' }))
  const sortHeader = (label: string, field: typeof sort.field) => {
    const active = sort.field === field
    const Icon = active ? (sort.order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
    return (
      <Button size="xs" variant="ghost" px="1" onClick={() => sortBy(field)}>
        <Text>{label}</Text>
        <Icon size={13} />
      </Button>
    )
  }
  const remove = async (supplier: Supplier) => {
    if (!window.confirm(`Deactivate ${supplier.name}?`)) return
    await deleteSupplier(supplier.id)
    load()
  }
  return (
    <PageContainer>
      <PageHeader
        title="Suppliers"
        description="Manage supplier relationships, purchasing history, and outstanding balances."
        actions={
          <Button
            onClick={() => {
              setEditing(undefined)
              setFormOpen(true)
            }}
          >
            <Plus size={16} />
            Add supplier
          </Button>
        }
      />
      <Grid templateColumns={{ base: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }} gap="4" mb="6">
        <Card.Root>
          <Card.Body>
            <HStack>
              <Users size={18} />
              <Box>
                <Text fontSize="xs" color="secondary">
                  Total suppliers
                </Text>
                <Heading size="md">{summary?.totalSuppliers ?? 0}</Heading>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Body>
            <HStack>
              <Building2 size={18} />
              <Box>
                <Text fontSize="xs" color="secondary">
                  Active suppliers
                </Text>
                <Heading size="md">{summary?.activeSuppliers ?? 0}</Heading>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Body>
            <HStack>
              <WalletCards size={18} />
              <Box>
                <Text fontSize="xs" color="secondary">
                  Purchase value
                </Text>
                <Heading size="md">{money(summary?.totalPurchaseValue)}</Heading>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Body>
            <HStack>
              <WalletCards size={18} />
              <Box>
                <Text fontSize="xs" color="secondary">
                  Pending payments
                </Text>
                <Heading size="md">{money(summary?.pendingPayments)}</Heading>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>
      </Grid>
      <Card.Root>
        <Card.Header>
          <HStack justify="space-between" wrap="wrap">
            <HStack>
              <Search size={16} />
              <Input
                size="sm"
                placeholder="Search suppliers..."
                value={search}
                onChange={(event) => {
                  setPage(1)
                  setSearch(event.target.value)
                }}
                w={{ base: 'full', sm: '280px' }}
              />
            </HStack>
            <Button
              size="sm"
              variant={includeInactive ? 'solid' : 'outline'}
              onClick={() => {
                setPage(1)
                setIncludeInactive((value) => !value)
              }}
            >
              <Filter size={14} />
              {includeInactive ? 'Showing all' : 'Active only'}
            </Button>
          </HStack>
        </Card.Header>
        <Card.Body p="0">
          {loading ? (
            <VStack p="6">
              <Skeleton h="10" w="full" />
              <Skeleton h="10" w="full" />
              <Skeleton h="10" w="full" />
            </VStack>
          ) : items.length ? (
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>{sortHeader('Supplier', 'name')}</Table.ColumnHeader>
                  <Table.ColumnHeader>Contact</Table.ColumnHeader>
                  <Table.ColumnHeader>{sortHeader('Orders', 'orders')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{sortHeader('Purchase value', 'value')}</Table.ColumnHeader>
                  <Table.ColumnHeader>{sortHeader('Pending', 'pending')}</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedItems.map((supplier) => (
                  <Table.Row key={supplier.id}>
                    <Table.Cell>
                      <HStack>
                        <Box bg="colorPalette.subtle" borderRadius="full" p="2" fontSize="xs" fontWeight="bold">
                          {initials(supplier.name)}
                        </Box>
                        <Box>
                          <Text fontWeight="medium">{supplier.name}</Text>
                          <Text fontSize="xs" color="secondary">
                            {supplier.email || supplier.phone || 'No contact'}
                          </Text>
                        </Box>
                      </HStack>
                    </Table.Cell>
                    <Table.Cell>{supplier.contactPerson || '—'}</Table.Cell>
                    <Table.Cell>{supplier.stats?.totalOrders ?? 0}</Table.Cell>
                    <Table.Cell>{money(supplier.stats?.totalPurchaseValue)}</Table.Cell>
                    <Table.Cell>{money(supplier.stats?.pendingAmount)}</Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={supplier.isActive ? 'green' : 'gray'}>
                        {supplier.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <HStack justify="flex-end">
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="View supplier"
                          onClick={() => setSelectedId(supplier.id)}
                        >
                          <Eye size={15} />
                        </IconButton>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="Edit supplier"
                          onClick={() => {
                            setEditing(supplier)
                            setFormOpen(true)
                          }}
                        >
                          <Pencil size={15} />
                        </IconButton>
                        <IconButton
                          size="xs"
                          variant="ghost"
                          aria-label="Deactivate supplier"
                          onClick={() => remove(supplier)}
                        >
                          <Trash2 size={15} />
                        </IconButton>
                      </HStack>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          ) : (
            <EmptyState
              title="No suppliers found"
              description="Add your first supplier or adjust the search filters."
            />
          )}
        </Card.Body>
        <Card.Footer justifyContent="space-between">
          <Text fontSize="sm" color="secondary">
            {pagination.total} suppliers
          </Text>
          <HStack>
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Text fontSize="sm">
              Page {page} of {pagination.totalPages}
            </Text>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </HStack>
        </Card.Footer>
      </Card.Root>
      <Drawer.Root
        open={formOpen}
        onOpenChange={(event) => !event.open && setFormOpen(false)}
        placement="end"
        size="xl"
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Heading size="md">{editing ? 'Edit supplier' : 'Add supplier'}</Heading>
            </Drawer.Header>
            <Drawer.Body>
              <SupplierForm
                initial={editing}
                onSaved={() => {
                  setFormOpen(false)
                  load()
                }}
                onCancel={() => setFormOpen(false)}
              />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
      <SupplierDetails
        supplierId={selectedId}
        onClose={() => setSelectedId(undefined)}
        onEdit={(supplier) => {
          setSelectedId(undefined)
          setEditing(supplier)
          setFormOpen(true)
        }}
      />
    </PageContainer>
  )
}

export default SuppliersPage
