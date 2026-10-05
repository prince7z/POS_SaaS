import { useEffect, useMemo, useState } from 'react'
import {
  Avatar,
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
  Skeleton,
  Stat,
  Table,
  Text,
  VStack,
} from '@chakra-ui/react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  ImagePlus,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  attachCustomerProfile,
  createCustomer,
  deleteCustomer,
  getCustomerSummaryDetails,
  getCustomerSummary,
  getCustomers,
  requestCustomerProfileUpload,
  updateCustomer,
  type Customer,
  type CustomerPayload,
  type CustomerSummary,
} from '@/api/endpoints/customers'
import { PageContainer } from '@/components/layout/PageContainer'
import { QrImageUploader } from '@/components/common/QrImageUploader'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function CustomerAvatar({ customer, size = 'sm' }: { customer: Customer; size?: 'sm' | 'md' }) {
  return (
    <Avatar.Root size={size}>
      <Avatar.Image src={customer.profileImageUrl ?? undefined} alt={customer.name} />
      <Avatar.Fallback>{getInitials(customer.name)}</Avatar.Fallback>
    </Avatar.Root>
  )
}

type CustomerSort = 'name' | 'creditBalance' | 'totalPurchases' | 'lastPurchaseAt'

function SortHeader({
  label,
  field,
  sort,
  onSort,
}: {
  label: string
  field: CustomerSort
  sort: { field: CustomerSort; order: 'asc' | 'desc' }
  onSort: (field: CustomerSort) => void
}) {
  const active = sort.field === field
  const Icon = active ? (sort.order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <Table.ColumnHeader>
      <Button
        size="xs"
        variant="ghost"
        px="1"
        onClick={() => onSort(field)}
        aria-label={`Sort by ${label}`}
        aria-pressed={active}
      >
        <Text>{label}</Text>
        <Icon size={13} />
      </Button>
    </Table.ColumnHeader>
  )
}

function CustomerForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Customer
  onSaved: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<CustomerPayload>({
    name: initial?.name ?? '',
    phone: initial?.phone ?? '',
    email: initial?.email ?? '',
    customerType: initial?.customerType ?? '',
    addressLine1: initial?.addressLine1 ?? '',
    addressLine2: initial?.addressLine2 ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    postalCode: initial?.postalCode ?? '',
    creditLimit: initial?.creditLimit ?? 0,
  })
  const [profileFile, setProfileFile] = useState<File>()
  const [profilePreview, setProfilePreview] = useState(initial?.profileImageUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (key: keyof CustomerPayload, value: string) =>
    setForm((current) => ({ ...current, [key]: key === 'creditLimit' ? Number(value) : value }))
  const submit = async () => {
    if (!form.name?.trim()) return setError('Customer name is required.')
    setSaving(true)
    setError('')
    try {
      const customer = initial ? await updateCustomer(initial.id, form) : await createCustomer(form)
      if (profileFile) {
        const upload = await requestCustomerProfileUpload(customer.id, profileFile.type)
        const response = await fetch(upload.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': profileFile.type },
          body: profileFile,
        })
        if (!response.ok) throw new Error('Profile image upload failed.')
        await attachCustomerProfile(customer.id, upload.key)
      }
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Customer could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  const fields = [
    { key: 'name', label: 'Full name', icon: Users, type: 'text' },
    { key: 'phone', label: 'Phone number', icon: Phone, type: 'text' },
    { key: 'email', label: 'Email address', icon: Mail, type: 'email' },
    { key: 'customerType', label: 'Customer type', icon: Users, type: 'text' },
    { key: 'addressLine1', label: 'Address line 1', icon: MapPin, type: 'text' },
    { key: 'addressLine2', label: 'Address line 2', icon: MapPin, type: 'text' },
    { key: 'city', label: 'City', icon: MapPin, type: 'text' },
    { key: 'state', label: 'State / province', icon: MapPin, type: 'text' },
    { key: 'postalCode', label: 'Postal code', icon: MapPin, type: 'text' },
  ] as const
  return (
    <VStack align="stretch" gap="4">
      <Box>
        <Heading size="sm">Customer information</Heading>
        <Text fontSize="sm" color="secondary">
          Store contact and account information for this customer.
        </Text>
      </Box>
      <QrImageUploader
        label="Customer profile picture"
        purpose="CUSTOMER_PROFILE"
        multiple={false}
        value={profilePreview ? [{ key: (form as any).profileImageKey || '', previewUrl: profilePreview }] : []}
        onChange={(images) => {
          if (images[0]) {
            setForm((prev) => ({ ...prev, profileImageKey: images[0].key }))
            setProfilePreview(images[0].previewUrl)
          } else {
            setForm((prev) => ({ ...prev, profileImageKey: undefined }))
            setProfilePreview('')
          }
        }}
        onRemove={() => {
          setForm((prev) => ({ ...prev, profileImageKey: undefined }))
          setProfilePreview('')
          setProfileFile(undefined)
        }}
        onManualFileSelect={(selected) => {
          const file = selected[0]
          if (file) {
            setProfileFile(file)
            setProfilePreview(URL.createObjectURL(file))
          }
        }}
      />
      <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }} gap="3">
        {fields.map(({ key, label, icon: Icon, type }) => (
          <Box key={key}>
            <Text fontSize="xs" mb="1" color="secondary">
              <Icon size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
              {label}
            </Text>
            <Input
              type={type}
              placeholder={label}
              value={String(form[key] ?? '')}
              onChange={(event) => set(key, event.target.value)}
            />
          </Box>
        ))}
        <Box>
          <Text fontSize="xs" mb="1" color="secondary">
            <WalletCards size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
            Credit limit
          </Text>
          <Input
            type="number"
            min="0"
            step="0.01"
            aria-label="Credit limit amount"
            placeholder="Maximum credit amount"
            value={String(form.creditLimit ?? 0)}
            onChange={(event) => set('creditLimit', event.target.value)}
          />
          <Text fontSize="xs" color="secondary" mt="1">
            Maximum unpaid balance allowed.
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" mb="1" color="secondary">
            <CalendarDays size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
            Initial credit balance
          </Text>
          <Input value="0.00" readOnly disabled />
          <Text fontSize="xs" color="secondary" mt="1">
            New customers start with no balance.
          </Text>
        </Box>
      </Grid>
      {error && (
        <Text color="danger" fontSize="sm">
          {error}
        </Text>
      )}
      <HStack justify="flex-end">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" loading={saving} loadingText="Saving..." onClick={submit}>
          <UserPlus size={15} />
          {initial ? 'Save changes' : 'Create customer'}
        </Button>
      </HStack>
    </VStack>
  )
}

function CustomerDetails({
  customerId,
  onClose,
  onEdit,
}: {
  customerId?: string
  onClose: () => void
  onEdit: (customer: Customer) => void
}) {
  const navigate = useNavigate()
  const [details, setDetails] = useState<CustomerSummary>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!customerId) return
    setLoading(true)
    setError('')
    setDetails(undefined)
    getCustomerSummaryDetails(customerId)
      .then(setDetails)
      .catch(() => setError('Customer details could not be loaded.'))
      .finally(() => setLoading(false))
  }, [customerId])
  const customer = details?.customer
  const maxTrend = Math.max(...(details?.trend.map((point) => point.amount) ?? [1]), 1)
  return (
    <Drawer.Root
      open={Boolean(customerId)}
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
              <Heading size="md">Customer details</Heading>
              <Drawer.CloseTrigger asChild>
                <IconButton size="xs" variant="ghost" aria-label="Close customer details">
                  <X size={16} />
                </IconButton>
              </Drawer.CloseTrigger>
            </HStack>
          </Drawer.Header>
          <Drawer.Body>
            {loading ? (
              <VStack align="stretch" gap="3">
                <Skeleton h="12" />
                <Skeleton h="32" />
                <Skeleton h="48" />
              </VStack>
            ) : error ? (
              <Text color="danger">{error}</Text>
            ) : customer && details ? (
              <VStack align="stretch" gap="5">
                <HStack justify="space-between" align="start">
                  <HStack>
                    <CustomerAvatar customer={customer} size="md" />
                    <Box>
                      <Heading size="sm">{customer.name}</Heading>
                      <Text fontSize="sm" color="secondary">
                        {customer.email || customer.phone || 'No contact details'}
                      </Text>
                      <HStack mt="2">
                        <Badge colorPalette={customer.isActive ? 'green' : 'gray'}>
                          {customer.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        {customer.customerType && <Badge variant="outline">{customer.customerType}</Badge>}
                      </HStack>
                    </Box>
                  </HStack>
                  <HStack>
                    <Button size="sm" variant="outline" onClick={() => onEdit(customer)}>
                      <Pencil size={14} />
                      Edit
                    </Button>
                    <Button size="sm" onClick={() => navigate(`/pos?customerId=${customer.id}`)}>
                      <ShoppingCart size={14} />
                      New sale
                    </Button>
                  </HStack>
                </HStack>{' '}
                <Grid templateColumns={{ base: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap="3">
                  {[
                    ['Total purchases', details.stats.totalPurchases.toFixed(2)],
                    ['Orders', String(details.stats.totalOrders)],
                    ['Credit limit', details.stats.creditLimit.toFixed(2)],
                    ['Store credit', details.stats.storeCreditBalance.toFixed(2)],
                  ].map(([label, value]) => (
                    <Stat.Root key={label} borderWidth="1px" borderColor="border" borderRadius="md" p="3">
                      <Stat.Label>{label}</Stat.Label>
                      <Stat.ValueText>{value}</Stat.ValueText>
                      {label === 'Store credit' && (
                        <Text fontSize="xs" color="secondary" mt="1">
                          available from returns
                        </Text>
                      )}
                    </Stat.Root>
                  ))}
                </Grid>
                <Box>
                  <Heading size="sm" mb="3">
                    Purchase trend
                  </Heading>
                  {details.trend.length ? (
                    <Box borderWidth="1px" borderColor="border" borderRadius="md" p="3">
                      <svg
                        viewBox="0 0 600 150"
                        width="100%"
                        height="150"
                        role="img"
                        aria-label="Customer purchase trend"
                      >
                        <polyline
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          points={details.trend
                            .map(
                              (point, index) =>
                                `${details.trend.length === 1 ? 300 : (index / (details.trend.length - 1)) * 560 + 20},${135 - (point.amount / maxTrend) * 115}`,
                            )
                            .join(' ')}
                        />
                      </svg>
                      <HStack justify="space-between" fontSize="xs" color="secondary">
                        <Text>{new Date(details.trend[0].date).toLocaleDateString()}</Text>
                        <Text>{new Date(details.trend.at(-1)!.date).toLocaleDateString()}</Text>
                      </HStack>
                    </Box>
                  ) : (
                    <Text fontSize="sm" color="secondary">
                      No purchase trend yet.
                    </Text>
                  )}
                </Box>
                <Box>
                  <Heading size="sm" mb="3">
                    Products purchased
                  </Heading>
                  {details.products.length ? (
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Product</Table.ColumnHeader>
                          <Table.ColumnHeader>Quantity</Table.ColumnHeader>
                          <Table.ColumnHeader>Total</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {details.products.map((product) => (
                          <Table.Row key={product.productId}>
                            <Table.Cell>
                              <HStack>
                                <Avatar.Root size="xs">
                                  <Avatar.Image src={product.imageUrl ?? undefined} />
                                  <Avatar.Fallback>{getInitials(product.name)}</Avatar.Fallback>
                                </Avatar.Root>
                                <Box>
                                  <Text>{product.name}</Text>
                                  <Text fontSize="xs" color="secondary">
                                    {product.sku}
                                  </Text>
                                </Box>
                              </HStack>
                            </Table.Cell>
                            <Table.Cell>{product.quantity}</Table.Cell>
                            <Table.Cell>{product.total.toFixed(2)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  ) : (
                    <Text fontSize="sm" color="secondary">
                      No products purchased.
                    </Text>
                  )}
                </Box>
                <Box>
                  <Heading size="sm" mb="3">
                    Purchase history
                  </Heading>
                  {details.purchases.length ? (
                    <Table.Root size="sm">
                      <Table.Header>
                        <Table.Row>
                          <Table.ColumnHeader>Invoice</Table.ColumnHeader>
                          <Table.ColumnHeader>Date</Table.ColumnHeader>
                          <Table.ColumnHeader>Total</Table.ColumnHeader>
                          <Table.ColumnHeader>Due</Table.ColumnHeader>
                        </Table.Row>
                      </Table.Header>
                      <Table.Body>
                        {details.purchases.map((sale) => (
                          <Table.Row key={sale.id}>
                            <Table.Cell>{sale.invoiceNumber}</Table.Cell>
                            <Table.Cell>{new Date(sale.soldAt).toLocaleDateString()}</Table.Cell>
                            <Table.Cell>{sale.total.toFixed(2)}</Table.Cell>
                            <Table.Cell>{sale.balanceDue.toFixed(2)}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table.Root>
                  ) : (
                    <Text fontSize="sm" color="secondary">
                      No completed purchases found.
                    </Text>
                  )}
                </Box>
                <Box>
                  <Heading size="sm" mb="3">
                    Payment history
                  </Heading>
                  {details.payments.length ? (
                    details.payments.map((payment) => (
                      <HStack
                        key={payment.id}
                        justify="space-between"
                        borderBottomWidth="1px"
                        borderColor="border"
                        py="2"
                      >
                        <Text fontSize="sm">
                          {new Date(payment.paidAt).toLocaleDateString()} · {payment.paymentMethod}
                        </Text>
                        <Text fontWeight="600">{payment.amount.toFixed(2)}</Text>
                      </HStack>
                    ))
                  ) : (
                    <Text fontSize="sm" color="secondary">
                      No payments recorded.
                    </Text>
                  )}
                </Box>
              </VStack>
            ) : null}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [summary, setSummary] = useState<{
    totalCustomers: number
    activeCustomers: number
    newCustomers: number
    totalCustomerSales: number
  }>()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [balance, setBalance] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string>()
  const [editing, setEditing] = useState<Customer | null | undefined>()
  const [refresh, setRefresh] = useState(0)
  const [sort, setSort] = useState<{ field: CustomerSort; order: 'asc' | 'desc' }>({ field: 'name', order: 'asc' })
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])
  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([
      getCustomers({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        includeInactive: status !== 'active',
        isActive: status === 'inactive' ? false : status === 'active' ? true : undefined,
        customerType: customerType || undefined,
        hasBalance: balance ? balance === 'balance' : undefined,
        sortBy: sort.field === 'creditBalance' ? 'creditBalance' : 'name',
        sortOrder: sort.order,
        includeStats: true,
      }),
      getCustomerSummary(),
    ])
      .then(([result, nextSummary]) => {
        setCustomers(result.items)
        setPages(result.pagination.totalPages || 1)
        setSummary(nextSummary)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Customers could not be loaded.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    load()
  }, [page, debouncedSearch, status, balance, customerType, refresh, sort.field, sort.order])
  const handleSort = (field: CustomerSort) => {
    setPage(1)
    setSort((current) =>
      current.field === field ? { field, order: current.order === 'asc' ? 'desc' : 'asc' } : { field, order: 'asc' },
    )
  }
  const visibleCustomers = useMemo(() => {
    if (sort.field === 'name' || sort.field === 'creditBalance') return customers
    return [...customers].sort((left, right) => {
      const leftValue =
        sort.field === 'totalPurchases'
          ? (left.stats?.totalPurchases ?? 0)
          : left.stats?.lastPurchaseAt
            ? new Date(left.stats.lastPurchaseAt).getTime()
            : 0
      const rightValue =
        sort.field === 'totalPurchases'
          ? (right.stats?.totalPurchases ?? 0)
          : right.stats?.lastPurchaseAt
            ? new Date(right.stats.lastPurchaseAt).getTime()
            : 0
      return (leftValue - rightValue) * (sort.order === 'asc' ? 1 : -1)
    })
  }, [customers, sort])
  const types = useMemo(
    () => [
      ...new Set(customers.map((customer) => customer.customerType).filter((type): type is string => Boolean(type))),
    ],
    [customers],
  )
  const remove = async (customer: Customer) => {
    if (!window.confirm(`Delete ${customer.name}?`)) return
    try {
      await deleteCustomer(customer.id)
      setRefresh((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Customer could not be deleted.')
    }
  }
  const statItems = [
    { label: 'Total customers', value: summary?.totalCustomers, detail: 'all customer profiles', icon: Users },
    {
      label: 'Active customers',
      value: summary?.activeCustomers,
      detail: 'customers available for transactions',
      icon: Users,
    },
    {
      label: 'New customers',
      value: summary?.newCustomers,
      detail: 'profiles created in the selected period',
      icon: UserPlus,
    },
    {
      label: 'Customer sales',
      value: summary?.totalCustomerSales,
      detail: 'sum of completed customer sales',
      icon: WalletCards,
    },
  ]
  return (
    <PageContainer>
      <PageHeader title="Customers" description="Manage customer accounts, balances, and purchase relationships." />
      <VStack align="stretch" gap="5">
        <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' }} gap="3">
          {statItems.map(({ label, value, detail, icon: Icon }) => (
            <Stat.Root key={label} borderWidth="1px" borderColor="border" borderRadius="lg" p="4">
              <Stat.Label>
                <HStack justify="space-between">
                  <Text>{label}</Text>
                  <Icon size={16} />
                </HStack>
              </Stat.Label>
              {summary ? (
                <>
                  <Stat.ValueText mt="2">
                    {label === 'Customer sales' ? Number(value).toFixed(2) : value}
                  </Stat.ValueText>
                  <Text mt="1" fontSize="xs" color="secondary">
                    {detail}
                  </Text>
                </>
              ) : (
                <Skeleton mt="3" h="7" w="20" />
              )}
            </Stat.Root>
          ))}
        </Grid>
        <Card.Root variant="outline" size="sm">
          <Card.Body>
            <VStack align="stretch" gap="4">
              <HStack flexWrap="wrap" gap="2">
                <HStack flex="1" minW="240px">
                  <Search size={16} />
                  <Input
                    size="sm"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by name, phone or email"
                  />
                </HStack>
                <NativeSelect.Root size="sm" w="140px">
                  <NativeSelect.Field
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="active">Active</option>
                    <option value="all">All customers</option>
                    <option value="inactive">Inactive</option>
                  </NativeSelect.Field>
                </NativeSelect.Root>
                <NativeSelect.Root size="sm" w="160px">
                  <NativeSelect.Field
                    value={customerType}
                    onChange={(event) => {
                      setCustomerType(event.target.value)
                      setPage(1)
                    }}
                  >
                    <option value="">All customer types</option>
                    {types.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
                <NativeSelect.Root size="sm" w="140px">
                  <NativeSelect.Field value={balance} onChange={(event) => setBalance(event.target.value)}>
                    <option value="">All balances</option>
                    <option value="balance">Has balance</option>
                    <option value="clear">No balance</option>
                  </NativeSelect.Field>
                </NativeSelect.Root>
                <Button size="sm" onClick={() => setEditing(null)}>
                  <Plus size={15} />
                  Add customer
                </Button>
              </HStack>
            </VStack>
          </Card.Body>
        </Card.Root>
        {error ? (
          <Card.Root variant="outline">
            <Card.Body>
              <Text color="danger">{error}</Text>
              <Button mt="3" size="sm" variant="outline" onClick={load}>
                Retry
              </Button>
            </Card.Body>
          </Card.Root>
        ) : (
          <Card.Root variant="outline" overflow="hidden">
            <Table.ScrollArea maxW="full">
              <Table.Root size="sm" variant="line" minW="850px">
                <Table.Header>
                  <Table.Row>
                    <SortHeader label="Customer" field="name" sort={sort} onSort={handleSort} />
                    <Table.ColumnHeader>Phone</Table.ColumnHeader>
                    <Table.ColumnHeader>Email</Table.ColumnHeader>
                    <Table.ColumnHeader>Type</Table.ColumnHeader>
                    <SortHeader label="Total purchases" field="totalPurchases" sort={sort} onSort={handleSort} />
                    <SortHeader label="Last purchase" field="lastPurchaseAt" sort={sort} onSort={handleSort} />
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {loading ? (
                    Array.from({ length: 8 }, (_, index) => (
                      <Table.Row key={index}>
                        {Array.from({ length: 8 }, (_, cell) => (
                          <Table.Cell key={cell}>
                            <Skeleton h="4" w="70px" />
                          </Table.Cell>
                        ))}
                      </Table.Row>
                    ))
                  ) : visibleCustomers.length ? (
                    visibleCustomers.map((customer) => (
                      <Table.Row key={customer.id}>
                        <Table.Cell>
                          <HStack>
                            <CustomerAvatar customer={customer} />
                            <Box>
                              <Text fontWeight="600">{customer.name}</Text>
                              <Text fontSize="xs" color="secondary">
                                {customer.phone || 'No phone'}
                              </Text>
                            </Box>
                          </HStack>
                        </Table.Cell>
                        <Table.Cell>{customer.phone || '—'}</Table.Cell>
                        <Table.Cell>{customer.email || '—'}</Table.Cell>
                        <Table.Cell>{customer.customerType || '—'}</Table.Cell>
                        <Table.Cell>{customer.stats ? customer.stats.totalPurchases.toFixed(2) : '—'}</Table.Cell>
                        <Table.Cell>
                          {customer.stats?.lastPurchaseAt
                            ? new Date(customer.stats.lastPurchaseAt).toLocaleDateString()
                            : '—'}
                        </Table.Cell>
                        <Table.Cell>
                          <Badge colorPalette={customer.isActive ? 'green' : 'gray'}>
                            {customer.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </Table.Cell>
                        <Table.Cell>
                          <HStack>
                            <Button size="xs" variant="ghost" onClick={() => setSelected(customer.id)}>
                              View
                            </Button>
                            <IconButton
                              size="xs"
                              variant="ghost"
                              aria-label={`Edit ${customer.name}`}
                              onClick={() => setEditing(customer)}
                            >
                              <Pencil size={14} />
                            </IconButton>
                            <IconButton
                              size="xs"
                              variant="ghost"
                              colorPalette="danger"
                              aria-label={`Delete ${customer.name}`}
                              onClick={() => remove(customer)}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          </HStack>
                        </Table.Cell>
                      </Table.Row>
                    ))
                  ) : (
                    <Table.Row>
                      <Table.Cell colSpan={8}>
                        <EmptyState title="No customers found" description="Try changing your search or filters." />
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </Table.ScrollArea>
            <HStack justify="space-between" p="3">
              <Text fontSize="sm" color="secondary">
                Page {page} of {pages}
              </Text>
              <HStack>
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= pages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </HStack>
            </HStack>
          </Card.Root>
        )}
        <CustomerDetails
          customerId={selected}
          onClose={() => setSelected(undefined)}
          onEdit={(customer) => {
            setSelected(undefined)
            setEditing(customer)
          }}
        />
        <Drawer.Root
          open={editing !== undefined}
          onOpenChange={(event) => !event.open && setEditing(undefined)}
          placement="end"
          size="lg"
          lazyMount
          unmountOnExit
        >
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content>
              <Drawer.Header>
                <Heading size="md">{editing ? 'Edit customer' : 'Add customer'}</Heading>
                <Drawer.CloseTrigger asChild>
                  <IconButton size="xs" variant="ghost" aria-label="Close form">
                    <X size={16} />
                  </IconButton>
                </Drawer.CloseTrigger>
              </Drawer.Header>
              <Drawer.Body>
                {editing !== undefined && (
                  <CustomerForm
                    initial={editing ?? undefined}
                    onSaved={() => {
                      setEditing(undefined)
                      setRefresh((value) => value + 1)
                    }}
                    onCancel={() => setEditing(undefined)}
                  />
                )}
              </Drawer.Body>
            </Drawer.Content>
          </Drawer.Positioner>
        </Drawer.Root>
      </VStack>
    </PageContainer>
  )
}
