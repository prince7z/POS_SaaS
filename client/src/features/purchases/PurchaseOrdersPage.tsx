import { useEffect, useState } from 'react'
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
  Skeleton,
  Table,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Eye,
  Filter,
  Package,
  Plus,
  Search,
  Truck,
  WalletCards,
  X,
} from 'lucide-react'
import { getProducts, type CatalogProduct } from '@/api/endpoints/catalog'
import {
  addPurchasePayment,
  cancelPurchaseOrder,
  createPurchaseOrder,
  getPurchaseOrder,
  getPurchaseOrderSummary,
  getPurchaseOrders,
  getSuppliers,
  receivePurchaseOrder,
  type PurchaseOrderDetail,
  type PurchaseOrderPayload,
  type PurchaseOrderSummary,
  type Supplier,
} from '@/api/endpoints/purchases'
import { EmptyState } from '@/components/common/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'

const money = (value = 0) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value)
const date = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
    : '—'
const statusColor = (status: string) =>
  status === 'RECEIVED' ? 'green' : status === 'CANCELLED' ? 'red' : status === 'DRAFT' ? 'gray' : 'blue'

function OrderForm({
  suppliers,
  products,
  initial,
  onSaved,
  onCancel,
}: {
  suppliers: Supplier[]
  products: CatalogProduct[]
  initial?: PurchaseOrderDetail
  onSaved: () => void
  onCancel: () => void
}) {
  const [supplierId, setSupplierId] = useState(initial?.supplier?.id ?? '')
  const [expectedDate, setExpectedDate] = useState(initial?.expectedDate?.slice(0, 10) ?? '')
  const [taxRate, setTaxRate] = useState(0)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [productId, setProductId] = useState(initial?.items[0]?.productId ?? '')
  const [quantity, setQuantity] = useState(initial?.items[0]?.orderedQuantity ?? 1)
  const [unitCost, setUnitCost] = useState(initial?.items[0]?.unitCost ?? 0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [productOpen, setProductOpen] = useState(false)
  const selectedProduct = products.find((product) => product.id === productId)
  const submit = async () => {
    if (!supplierId || !productId || quantity <= 0 || unitCost < 0)
      return setError('Supplier, product, quantity, and unit cost are required.')
    setSaving(true)
    setError('')
    try {
      const payload: PurchaseOrderPayload = {
        supplierId,
        expectedDate: expectedDate || undefined,
        taxRate,
        notes: notes || null,
        items: [{ productId, quantity: Number(quantity), unitCost: Number(unitCost) }],
      }
      if (initial) await createPurchaseOrder(payload)
      else await createPurchaseOrder(payload)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Purchase order could not be saved.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <VStack align="stretch" gap="4">
      <Box>
        <Heading size="sm">{initial ? 'Edit purchase order' : 'Create purchase order'}</Heading>
        <Text fontSize="sm" color="secondary">
          Every amount is calculated from quantity × unit cost, plus the tax rate.
        </Text>
      </Box>
      <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)' }} gap="3">
        <Box>
          <Text fontSize="xs" mb="1">
            <Truck size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
            Supplier
          </Text>
          <NativeSelect.Root>
            <NativeSelect.Field value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Box>
        <Box>
          <Text fontSize="xs" mb="1">
            <CalendarDays size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
            Expected delivery date
          </Text>
          <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
        </Box>
        <Box position="relative">
          <Text fontSize="xs" mb="1">
            <Package size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
            Product
          </Text>
          <Button
            variant="outline"
            w="full"
            justifyContent="flex-start"
            onClick={() => setProductOpen((value) => !value)}
          >
            <ProductThumb product={selectedProduct} />
            {selectedProduct ? `${selectedProduct.name} (${selectedProduct.sku})` : 'Select product'}
          </Button>
          {productOpen && (
            <VStack
              position="absolute"
              zIndex="dropdown"
              top="68px"
              left="0"
              right="0"
              align="stretch"
              bg="bg.panel"
              borderWidth="1px"
              borderRadius="md"
              shadow="lg"
              maxH="260px"
              overflowY="auto"
              gap="0"
            >
              {products.map((product) => (
                <Button
                  key={product.id}
                  variant="ghost"
                  justifyContent="flex-start"
                  borderRadius="none"
                  onClick={() => {
                    setProductId(product.id)
                    setUnitCost(product.purchaseCost ?? 0)
                    setProductOpen(false)
                  }}
                >
                  <ProductThumb product={product} />{' '}
                  <Box textAlign="left">
                    <Text fontSize="sm">{product.name}</Text>
                    <Text fontSize="xs" color="secondary">
                      {product.sku}
                    </Text>
                  </Box>
                </Button>
              ))}
            </VStack>
          )}
        </Box>
        <Box>
          <Text fontSize="xs" mb="1">
            Quantity
          </Text>
          <Input
            type="number"
            min="0.001"
            step="0.001"
            aria-label="Ordered quantity"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
          <Text fontSize="xs" color="secondary" mt="1">
            Units to order{selectedProduct ? ` · current stock ${selectedProduct.stockQuantity}` : ''}.
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" mb="1">
            <CreditCard size={13} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }} />
            Unit cost
          </Text>
          <Input
            type="number"
            min="0"
            step="0.01"
            aria-label="Unit cost"
            value={unitCost}
            onChange={(event) => setUnitCost(Number(event.target.value))}
          />
          <Text fontSize="xs" color="secondary" mt="1">
            Line total = quantity × unit cost.
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" mb="1">
            Tax rate (%)
          </Text>
          <Input
            type="number"
            min="0"
            step="0.01"
            aria-label="Tax rate percentage"
            value={taxRate}
            onChange={(event) => setTaxRate(Number(event.target.value))}
          />
        </Box>
      </Grid>
      <Box>
        <Text fontSize="xs" mb="1">
          Notes
        </Text>
        <Textarea
          placeholder="Delivery or supplier notes"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </Box>
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
          <CheckCircle2 size={15} />
          {initial ? 'Save changes' : 'Create order'}
        </Button>
      </HStack>
    </VStack>
  )
}

function ProductThumb({ product, imageUrl }: { product?: CatalogProduct; imageUrl?: string | null }) {
  const src = imageUrl ?? product?.imageUrls?.[0]
  return src ? (
    <img src={src} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
  ) : (
    <Box boxSize="32px" borderRadius="sm" bg="bg.subtle" display="grid" placeItems="center" flexShrink={0}>
      <Package size={15} />
    </Box>
  )
}

function OrderDetails({ id, onClose, onChanged }: { id?: string; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<PurchaseOrderDetail>()
  const [loading, setLoading] = useState(false)
  const [payment, setPayment] = useState('')
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getPurchaseOrder(id)
      .then(setOrder)
      .finally(() => setLoading(false))
  }, [id])
  const receive = async () => {
    if (!order) return
    const items = order.items
      .filter((item) => item.remainingQuantity > 0)
      .map((item) => ({ purchaseOrderItemId: item.id, quantityReceived: item.remainingQuantity }))
    if (items.length) {
      await receivePurchaseOrder(order.id, items)
      onChanged()
      onClose()
    }
  }
  const pay = async () => {
    if (!order || Number(payment) <= 0) return
    await addPurchasePayment(order.id, { amount: Number(payment), paymentMethod: 'BANK_TRANSFER' })
    onChanged()
    setPayment('')
    const refreshed = await getPurchaseOrder(order.id)
    setOrder(refreshed)
  }
  return (
    <Drawer.Root
      open={Boolean(id)}
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
              <Heading size="md">Purchase order details</Heading>
              <Drawer.CloseTrigger asChild>
                <IconButton size="xs" variant="ghost" aria-label="Close order details">
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
              </VStack>
            ) : order ? (
              <VStack align="stretch" gap="5">
                <HStack justify="space-between">
                  <Box>
                    <Heading size="sm">{order.poNumber}</Heading>
                    <Text color="secondary">
                      {order.supplier?.name} · ordered {date(order.orderDate)}
                    </Text>
                  </Box>
                  <Badge colorPalette={statusColor(order.status)}>{order.status.replaceAll('_', ' ')}</Badge>
                </HStack>
                <Grid templateColumns="repeat(3, 1fr)" gap="3">
                  <Card.Root>
                    <Card.Body>
                      <Text fontSize="xs" color="secondary">
                        Subtotal
                      </Text>
                      <Heading size="sm">{money(order.subtotal)}</Heading>
                      <Text fontSize="xs" color="secondary">
                        sum of line totals
                      </Text>
                    </Card.Body>
                  </Card.Root>
                  <Card.Root>
                    <Card.Body>
                      <Text fontSize="xs" color="secondary">
                        Tax
                      </Text>
                      <Heading size="sm">{money(order.taxAmount)}</Heading>
                      <Text fontSize="xs" color="secondary">
                        subtotal × tax rate
                      </Text>
                    </Card.Body>
                  </Card.Root>
                  <Card.Root>
                    <Card.Body>
                      <Text fontSize="xs" color="secondary">
                        Balance due
                      </Text>
                      <Heading size="sm">{money(order.balanceDue)}</Heading>
                      <Text fontSize="xs" color="secondary">
                        total − paid amount
                      </Text>
                    </Card.Body>
                  </Card.Root>
                </Grid>
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Product</Table.ColumnHeader>
                      <Table.ColumnHeader>Ordered</Table.ColumnHeader>
                      <Table.ColumnHeader>Received</Table.ColumnHeader>
                      <Table.ColumnHeader textAlign="right">Line total</Table.ColumnHeader>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {order.items.map((item) => (
                      <Table.Row key={item.id}>
                        <Table.Cell>
                          <HStack>
                            <ProductThumb imageUrl={item.imageUrl} />
                            <Box>
                              <Text fontWeight="medium">{item.productName}</Text>
                              <Text fontSize="xs" color="secondary">
                                {item.sku} · {money(item.unitCost)} each
                              </Text>
                            </Box>
                          </HStack>
                        </Table.Cell>
                        <Table.Cell>{item.orderedQuantity}</Table.Cell>
                        <Table.Cell>{item.receivedQuantity}</Table.Cell>
                        <Table.Cell textAlign="right">{money(item.lineTotal)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
                <HStack>
                  <Button
                    size="sm"
                    onClick={receive}
                    disabled={order.status === 'RECEIVED' || order.status === 'CANCELLED'}
                  >
                    <CheckCircle2 size={14} />
                    Receive remaining
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await cancelPurchaseOrder(order.id)
                      onChanged()
                      onClose()
                    }}
                    disabled={!['DRAFT', 'PENDING'].includes(order.status)}
                  >
                    <X size={14} />
                    Cancel order
                  </Button>
                </HStack>
                <Box>
                  <Text fontSize="xs" mb="1">
                    <WalletCards
                      size={13}
                      style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: 5 }}
                    />
                    Add payment
                  </Text>
                  <HStack>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder={`Maximum ${money(order.balanceDue)}`}
                      value={payment}
                      onChange={(event) => setPayment(event.target.value)}
                    />
                    <Button onClick={pay} disabled={!payment}>
                      <CreditCard size={14} />
                      Record payment
                    </Button>
                  </HStack>
                </Box>
              </VStack>
            ) : (
              <EmptyState title="Order not found" description="This purchase order is no longer available." />
            )}
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}

export function PurchaseOrdersPage() {
  const [items, setItems] = useState<PurchaseOrderSummary[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [summary, setSummary] = useState<{ totalOrders: number; totalSpend: number; pendingAmount: number }>()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>()
  const [formOpen, setFormOpen] = useState(false)
  const [sort, setSort] = useState({ field: 'orderDate', order: 'desc' as 'asc' | 'desc' })
  const load = () => {
    setLoading(true)
    Promise.all([
      getPurchaseOrders({ page, limit: 10, search, status, sortBy: sort.field, sortOrder: sort.order }),
      getPurchaseOrderSummary(),
    ])
      .then(([result, totals]) => {
        setItems(result.items)
        setSummary(totals)
      })
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    Promise.all([
      getSuppliers({ page: 1, limit: 100, includeStats: false }),
      getProducts({ page: 1, limit: 100, includeInactive: false }),
    ]).then(([supplierPage, productPage]) => {
      setSuppliers(supplierPage.items)
      setProducts(productPage.items)
    })
  }, [])
  useEffect(() => {
    load()
  }, [page, search, status, sort])
  const sortBy = (field: string) =>
    setSort((current) => ({ field, order: current.field === field && current.order === 'asc' ? 'desc' : 'asc' }))
  const sortHeader = (label: string, field: string) => {
    const active = sort.field === field
    const Icon = active ? (sort.order === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
    return (
      <Button size="xs" variant="ghost" px="1" onClick={() => sortBy(field)}>
        {label}
        <Icon size={13} />
      </Button>
    )
  }
  return (
    <PageContainer>
      <PageHeader
        title="Purchase orders"
        description="Create, receive, track, and settle supplier purchase orders."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} />
            Create order
          </Button>
        }
      />
      <Grid templateColumns={{ base: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }} gap="4" mb="6">
        <Card.Root>
          <Card.Body>
            <HStack>
              <ClipboardList size={18} />
              <Box>
                <Text fontSize="xs" color="secondary">
                  Total orders
                </Text>
                <Heading size="md">{summary?.totalOrders ?? 0}</Heading>
                <Text fontSize="xs" color="secondary">
                  all order statuses
                </Text>
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
                  Committed spend
                </Text>
                <Heading size="md">{money(summary?.totalSpend)}</Heading>
                <Text fontSize="xs" color="secondary">
                  non-cancelled order totals
                </Text>
              </Box>
            </HStack>
          </Card.Body>
        </Card.Root>
        <Card.Root>
          <Card.Body>
            <HStack>
              <CreditCard size={18} />
              <Box>
                <Text fontSize="xs" color="secondary">
                  Pending payments
                </Text>
                <Heading size="md">{money(summary?.pendingAmount)}</Heading>
                <Text fontSize="xs" color="secondary">
                  pending + partially received balances
                </Text>
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
                placeholder="Search PO number or supplier..."
                value={search}
                onChange={(event) => {
                  setPage(1)
                  setSearch(event.target.value)
                }}
                w={{ base: 'full', sm: '280px' }}
              />
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={status}
                  onChange={(event) => {
                    setPage(1)
                    setStatus(event.target.value)
                  }}
                >
                  <option value="">All statuses</option>
                  {['DRAFT', 'PENDING', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'].map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
              <Filter size={15} />
            </HStack>
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
                  <Table.ColumnHeader>{sortHeader('PO number', 'poNumber')}</Table.ColumnHeader>
                  <Table.ColumnHeader>Supplier</Table.ColumnHeader>
                  <Table.ColumnHeader>{sortHeader('Order date', 'orderDate')}</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader>{sortHeader('Total', 'total')}</Table.ColumnHeader>
                  <Table.ColumnHeader>Balance due</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="right">Actions</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map((order) => (
                  <Table.Row key={order.id}>
                    <Table.Cell fontWeight="medium">{order.poNumber}</Table.Cell>
                    <Table.Cell>{order.supplier?.name ?? '—'}</Table.Cell>
                    <Table.Cell>{date(order.orderDate)}</Table.Cell>
                    <Table.Cell>
                      <Badge colorPalette={statusColor(order.status)}>{order.status.replaceAll('_', ' ')}</Badge>
                    </Table.Cell>
                    <Table.Cell>{money(order.total)}</Table.Cell>
                    <Table.Cell>{money(order.balanceDue)}</Table.Cell>
                    <Table.Cell textAlign="right">
                      <IconButton
                        size="xs"
                        variant="ghost"
                        aria-label="View purchase order"
                        onClick={() => setSelectedId(order.id)}
                      >
                        <Eye size={15} />
                      </IconButton>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          ) : (
            <EmptyState
              title="No purchase orders found"
              description="Create an order or adjust the search and status filters."
            />
          )}
        </Card.Body>
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
              <Heading size="md">Create purchase order</Heading>
            </Drawer.Header>
            <Drawer.Body>
              <OrderForm
                suppliers={suppliers}
                products={products}
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
      <OrderDetails id={selectedId} onClose={() => setSelectedId(undefined)} onChanged={load} />
    </PageContainer>
  )
}

export default PurchaseOrdersPage
