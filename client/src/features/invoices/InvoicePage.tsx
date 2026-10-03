import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Grid,
  HStack,
  Heading,
  IconButton,
  Input,
  NativeSelect,
  Avatar,
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
  Download,
  Eye,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react'
import QRCode from 'qrcode'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { getCompany, type Company } from '@/api/endpoints/company'
import type { Customer } from '@/api/endpoints/customers'
import type { CatalogProduct } from '@/api/endpoints/catalog'
import {
  cancelInvoice,
  completeInvoice,
  createInvoiceDraft,
  downloadInvoicePdf,
  getInvoice,
  getInvoices,
  searchInvoiceCustomers,
  searchInvoiceProducts,
  updateInvoiceDraft,
  type InvoiceDetail,
  type InvoiceFilters,
  type InvoiceItem,
} from '@/api/endpoints/invoices'
import type { SaleDiscountType, SaleSummary } from '@/api/endpoints/sales'
import { formatInvoiceTime } from './invoiceFormatting'

const money = (value: number) => value.toFixed(2)
const date = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
    : '—'

type DraftItem = InvoiceItem & { imageUrl?: string | null }

function StatusBadge({ value }: { value: string }) {
  return (
    <Badge
      colorPalette={value === 'PAID' || value === 'COMPLETED' ? 'green' : value === 'CANCELLED' ? 'red' : 'orange'}
    >
      {value.replaceAll('_', ' ')}
    </Badge>
  )
}

function InvoicePreview({
  company,
  invoice,
  items,
  customer,
  discount,
  taxRate,
  notes,
  mode,
}: {
  company?: Company
  invoice?: InvoiceDetail
  items: DraftItem[]
  customer?: Pick<Customer, 'id' | 'name' | 'phone' | 'email' | 'profileImageUrl'> | null
  discount: { type: SaleDiscountType | null; value: number }
  taxRate: number
  notes: string
  mode: 'A4' | 'THERMAL'
}) {
  const [qrCode, setQrCode] = useState('')
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const tax = (subtotal * taxRate) / 100
  const gross = subtotal + tax
  const discountAmount =
    discount.type === 'PERCENT' ? (gross * discount.value) / 100 : discount.type === 'FIXED' ? discount.value : 0
  const total = Math.max(0, gross - discountAmount)
  useEffect(() => {
    if (!invoice?.id || invoice.status !== 'COMPLETED') {
      setQrCode('')
      return
    }
    QRCode.toDataURL(`${window.location.origin}/invoice-verification/${invoice.id}`, { margin: 1, width: 96 })
      .then(setQrCode)
      .catch(() => setQrCode(''))
  }, [invoice?.id, invoice?.status])
  return (
    <Card.Root variant="outline" className={`invoice-preview invoice-preview-${mode.toLowerCase()}`}>
      <Card.Body p={{ base: '4', md: mode === 'A4' ? '8' : '4' }}>
        <VStack align="stretch" gap="5">
          <Grid
            className="invoice-preview-header"
            templateColumns={{ base: '1fr', md: '1fr auto' }}
            gap="4"
            alignItems="start"
          >
            <Box>
              {company?.logoUrl && (
                <img
                  src={company.logoUrl}
                  alt={company.name}
                  style={{ maxHeight: 42, maxWidth: 150, objectFit: 'contain' }}
                />
              )}
              <Heading size="sm" mt="2">
                {company?.name ?? 'Invoice'}
              </Heading>
              <Text fontSize="xs" color="secondary">
                {[company?.addressLine1, company?.city, company?.phone].filter(Boolean).join(' · ')}
              </Text>
              {company?.businessHours && (
                <Box fontSize="xs" color="secondary" mt="3">
                  <Text fontWeight="400" color="secondary">
                    Opening hours
                  </Text>
                  <Text>
                    Weekdays: {formatInvoiceTime(company.businessHours.weekdays.open)} –{' '}
                    {formatInvoiceTime(company.businessHours.weekdays.close)}
                  </Text>
                </Box>
              )}
            </Box>
            <VStack className="invoice-preview-meta" align={{ base: 'start', md: 'end' }} gap="1">
              <Text fontWeight="700">INVOICE</Text>

              {qrCode && <img src={qrCode} alt="Invoice verification QR code" width={76} height={76} />}
              <Text fontSize="sm">{invoice?.invoiceNumber ?? 'Draft invoice'}</Text>
              <Text fontSize="xs" color="secondary">
                {date(invoice?.soldAt ?? new Date().toISOString())}
              </Text>
            </VStack>
          </Grid>
          <Separator />
          <Box>
            <Text fontSize="xs" color="secondary">
              Bill to
            </Text>
            <Text fontWeight="600">{customer?.name ?? invoice?.customer?.name ?? 'Walk-in customer'}</Text>
            <Text fontSize="sm" color="secondary">
              {customer?.email ??
                invoice?.customer?.email ??
                customer?.phone ??
                invoice?.customer?.phone ??
                'No contact details'}
            </Text>
          </Box>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Item</Table.ColumnHeader>
                <Table.ColumnHeader>Qty</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Price</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {items.map((item) => (
                <Table.Row key={item.id || item.productId}>
                  <Table.Cell>
                    <Text fontWeight="600">{item.productName}</Text>
                    <Text fontSize="xs" color="secondary">
                      {item.sku}
                    </Text>
                  </Table.Cell>
                  <Table.Cell>{item.quantity}</Table.Cell>
                  <Table.Cell textAlign="end">{money(item.unitPrice)}</Table.Cell>
                  <Table.Cell textAlign="end">{money(item.quantity * item.unitPrice)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          <VStack align="stretch" gap="1" maxW="260px" ml="auto" w="full" mb="5">
            <HStack justify="space-between">
              <Text color="secondary">Subtotal</Text>
              <Text>{money(subtotal)}</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="secondary">Tax ({taxRate}%)</Text>
              <Text>{money(tax)}</Text>
            </HStack>
            <HStack justify="space-between">
              <Text color="secondary">Discount</Text>
              <Text>-{money(discountAmount)}</Text>
            </HStack>
            <Separator />
            <HStack justify="space-between">
              <Text fontWeight="700">Total</Text>
              <Text fontWeight="700">{money(total)}</Text>
            </HStack>
          </VStack>
          {notes && (
            <Box mt="2" mb="5">
              <Text fontSize="xs" color="secondary">
                Notes
              </Text>
              <Text fontSize="sm">{notes}</Text>
            </Box>
          )}
          {company?.invoiceTerms?.length ? (
            <Box pt="5" borderTopWidth="1px" fontSize="xs">
              <Text fontWeight="600" mb="1">
                Terms and conditions
              </Text>
              <VStack align="stretch" gap="0">
                {company.invoiceTerms.map((term) => (
                  <Text key={term}>• {term}</Text>
                ))}
              </VStack>
            </Box>
          ) : null}
         <Box textAlign="center" pt="3">
          <Separator mb="3" />
              <Text fontWeight="400">Thank you for shopping with {company?.name? company.name : 'our store'}.</Text>

            </Box>
        </VStack>
      </Card.Body>
    </Card.Root>
  )
}

function InvoiceEditor({
  open,
  invoice,
  company,
  onClose,
  onSaved,
}: {
  open: boolean
  invoice?: InvoiceDetail
  company?: Company
  onClose: () => void
  onSaved: () => void
}) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerSearch, setCustomerSearch] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [customerMatches, setCustomerMatches] = useState<Customer[]>([])
  const [productMatches, setProductMatches] = useState<CatalogProduct[]>([])
  const [items, setItems] = useState<DraftItem[]>([])
  const [taxRate, setTaxRate] = useState(0)
  const [discountType, setDiscountType] = useState<SaleDiscountType | null>(null)
  const [discountValue, setDiscountValue] = useState(0)
  const [notes, setNotes] = useState('')
  const [mode, setMode] = useState<'A4' | 'THERMAL'>('A4')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setCustomer(null)
    setCustomerMatches([])
    setProductMatches([])
    setCustomerSearch(invoice?.customer?.name ?? '')
    setItems(invoice?.items ?? [])
    setTaxRate(invoice?.taxRate ?? 0)
    setDiscountType(invoice?.discountType ?? null)
    setDiscountValue(invoice?.discountValue ?? 0)
    setNotes(invoice?.notes ?? '')
    setError('')
  }, [invoice, open])

  useEffect(() => {
    if (customerSearch.trim().length < 2) return setCustomerMatches([])
    const timer = window.setTimeout(
      () =>
        searchInvoiceCustomers(customerSearch)
          .then((result) => setCustomerMatches(result.items))
          .catch(() => setCustomerMatches([])),
      250,
    )
    return () => window.clearTimeout(timer)
  }, [customerSearch])

  useEffect(() => {
    if (productSearch.trim().length < 2) return setProductMatches([])
    const timer = window.setTimeout(
      () =>
        searchInvoiceProducts(productSearch)
          .then((result) => setProductMatches(result.items))
          .catch(() => setProductMatches([])),
      250,
    )
    return () => window.clearTimeout(timer)
  }, [productSearch])

  const addProduct = (product: CatalogProduct) => {
    setItems((current) => {
      const existing = current.find((item) => item.productId === product.id)
      if (existing)
        return current.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item))
      return [
        ...current,
        {
          id: `new-${product.id}`,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          barcode: product.barcode,
          quantity: 1,
          unitPrice: product.sellingPrice,
          lineSubtotal: product.sellingPrice,
          imageUrl: product.imageUrls?.[0],
        },
      ]
    })
    setProductSearch('')
    setProductMatches([])
  }

  const updateQuantity = (id: string, value: number) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, quantity: Math.max(1, value || 1) } : item)),
    )
  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const tax = (subtotal * taxRate) / 100
    const gross = subtotal + tax
    const discount =
      discountType === 'PERCENT' ? (gross * discountValue) / 100 : discountType === 'FIXED' ? discountValue : 0
    return { subtotal, tax, total: Math.max(0, gross - discount) }
  }, [items, taxRate, discountType, discountValue])

  const saveDraft = async () => {
    if (!items.length) return setError('Add at least one product before saving.')
    setSaving(true)
    setError('')
    try {
      const payload = {
        source: 'POS' as const,
        customerId: customer?.id ?? invoice?.customer?.id ?? null,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        taxRate,
        discountType,
        discountValue: discountType ? discountValue : null,
        notes: notes || null,
      }
      if (invoice) await updateInvoiceDraft(invoice.id, payload)
      else await createInvoiceDraft(payload)
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invoice could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const complete = async () => {
    if (!invoice) return setError('Save the draft before completing the invoice.')
    setSaving(true)
    setError('')
    try {
      await completeInvoice(invoice.id, {
        taxRate,
        discountType,
        discountValue: discountType ? discountValue : null,
        payments: [{ paymentMethod: 'CASH', amount: totals.total }],
        customerId: customer?.id ?? invoice.customer?.id ?? null,
        notes: notes || null,
      })
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invoice could not be completed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer.Root
      open={open}
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
            <HStack justify="space-between">
              <Box>
                <Heading size="md">{invoice ? 'Edit invoice draft' : 'Create invoice'}</Heading>
                <Text fontSize="sm" color="secondary">
                  Build the invoice and preview it before saving.
                </Text>
              </Box>
              <Drawer.CloseTrigger asChild>
                <IconButton size="xs" variant="ghost" aria-label="Close">
                  <X size={16} />
                </IconButton>
              </Drawer.CloseTrigger>
            </HStack>
          </Drawer.Header>
          <Drawer.Body>
            <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap="5">
              <VStack align="stretch" gap="4">
                <Box position="relative">
                  <Text fontSize="sm" fontWeight="600" mb="1">
                    <User size={14} style={{ display: 'inline', marginRight: 5 }} />
                    Customer
                  </Text>
                  <Input
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Search customer by name, phone or email"
                  />
                  {customerMatches.length > 0 && (
                    <Card.Root position="absolute" zIndex="popover" top="70px" w="full">
                      <Card.Body p="2">
                        {customerMatches.map((match) => (
                          <Button
                            key={match.id}
                            variant="ghost"
                            w="full"
                            justifyContent="flex-start"
                            onClick={() => {
                              setCustomer(match)
                              setCustomerSearch(match.name)
                              setCustomerMatches([])
                            }}
                          >
                            <HStack gap="3">
                              <Avatar.Root size="xs">
                                <Avatar.Image src={match.profileImageUrl ?? undefined} alt={match.name} />
                                <Avatar.Fallback>{match.name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
                              </Avatar.Root>
                              <Box textAlign="left">
                                <Text>{match.name}</Text>
                                <Text fontSize="xs" color="secondary">
                                  {match.phone ?? match.email ?? 'No contact'}
                                </Text>
                              </Box>
                            </HStack>
                          </Button>
                        ))}
                      </Card.Body>
                    </Card.Root>
                  )}
                </Box>
                <Box position="relative">
                  <Text fontSize="sm" fontWeight="600" mb="1">
                    <Package size={14} style={{ display: 'inline', marginRight: 5 }} />
                    Add products
                  </Text>
                  <Input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search product, SKU or barcode"
                  />
                  {productMatches.length > 0 && (
                    <Card.Root position="absolute" zIndex="popover" top="70px" w="full">
                      <Card.Body p="2">
                        {productMatches.map((product) => (
                          <Button
                            key={product.id}
                            variant="ghost"
                            w="full"
                            justifyContent="space-between"
                            onClick={() => addProduct(product)}
                          >
                            <HStack gap="3">
                              <Avatar.Root size="xs" shape="rounded">
                                <Avatar.Image src={product.imageUrls?.[0]} alt={product.name} />
                                <Avatar.Fallback>
                                  <Package size={13} />
                                </Avatar.Fallback>
                              </Avatar.Root>
                              <Text>
                                {product.name} · {product.sku}
                              </Text>
                            </HStack>
                            <Text fontSize="xs" color="secondary">
                              {money(product.sellingPrice)}
                            </Text>
                          </Button>
                        ))}
                      </Card.Body>
                    </Card.Root>
                  )}
                </Box>
                <Table.Root size="sm">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeader>Product</Table.ColumnHeader>
                      <Table.ColumnHeader>Qty</Table.ColumnHeader>
                      <Table.ColumnHeader>Price</Table.ColumnHeader>
                      <Table.ColumnHeader />
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {items.map((item) => (
                      <Table.Row key={item.id}>
                        <Table.Cell>
                          <Text fontWeight="600">{item.productName}</Text>
                          <Text fontSize="xs" color="secondary">
                            {item.sku}
                          </Text>
                        </Table.Cell>
                        <Table.Cell>
                          <Input
                            size="sm"
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(event) => updateQuantity(item.id, Number(event.target.value))}
                            w="70px"
                          />
                        </Table.Cell>
                        <Table.Cell>{money(item.unitPrice)}</Table.Cell>
                        <Table.Cell>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            aria-label={`Remove ${item.productName}`}
                            onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
                <Grid templateColumns="1fr 1fr" gap="3">
                  <Box>
                    <Text fontSize="sm">Tax rate (%)</Text>
                    <Input
                      type="number"
                      min={0}
                      value={taxRate}
                      onChange={(event) => setTaxRate(Math.max(0, Number(event.target.value) || 0))}
                    />
                  </Box>
                  <Box>
                    <Text fontSize="sm">Discount</Text>
                    <HStack>
                      <NativeSelect.Root>
                        <NativeSelect.Field
                          value={discountType ?? ''}
                          onChange={(event) => setDiscountType((event.target.value || null) as SaleDiscountType | null)}
                        >
                          <option value="">None</option>
                          <option value="PERCENT">%</option>
                          <option value="FIXED">Fixed</option>
                        </NativeSelect.Field>
                      </NativeSelect.Root>
                      <Input
                        type="number"
                        min={0}
                        value={discountValue}
                        onChange={(event) => setDiscountValue(Math.max(0, Number(event.target.value) || 0))}
                        disabled={!discountType}
                      />
                    </HStack>
                  </Box>
                </Grid>
                <Box>
                  <Text fontSize="sm" fontWeight="600" mb="1">
                    Notes
                  </Text>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional customer note"
                  />
                </Box>
                {error && (
                  <Text color="danger" fontSize="sm">
                    {error}
                  </Text>
                )}
                <HStack justify="flex-end">
                  <Button variant="outline" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button variant="outline" loading={saving} onClick={saveDraft}>
                    <Check size={15} />
                    Save draft
                  </Button>
                  {invoice && (
                    <Button loading={saving} onClick={complete}>
                      <Check size={15} />
                      Complete
                    </Button>
                  )}
                </HStack>
              </VStack>
              <VStack align="stretch" gap="3">
                <HStack justify="space-between">
                  <Heading size="sm">Live preview</Heading>
                  <HStack>
                    <Button size="sm" variant={mode === 'A4' ? 'solid' : 'outline'} onClick={() => setMode('A4')}>
                      A4
                    </Button>
                    <Button
                      size="sm"
                      variant={mode === 'THERMAL' ? 'solid' : 'outline'}
                      onClick={() => setMode('THERMAL')}
                    >
                      Thermal
                    </Button>
                  </HStack>
                </HStack>
                <InvoicePreview
                  company={company}
                  invoice={invoice}
                  items={items}
                  customer={customer}
                  discount={{ type: discountType, value: discountValue }}
                  taxRate={taxRate}
                  notes={notes}
                  mode={mode}
                />
              </VStack>
            </Grid>
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}

function InvoiceDetails({
  invoice,
  company,
  onClose,
}: {
  invoice?: InvoiceDetail
  company?: Company
  onClose: () => void
}) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const download = async () => {
    setDownloading(true)
    try {
      const blob = await downloadInvoicePdf(invoice!.id)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${invoice?.invoiceNumber ?? 'invoice'}.pdf`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'PDF could not be downloaded.')
    } finally {
      setDownloading(false)
    }
  }
  return (
    <Drawer.Root
      open={Boolean(invoice)}
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
            <HStack justify="space-between">
              <Box>
                <Heading size="md">{invoice?.invoiceNumber ?? 'Invoice details'}</Heading>
                <Text fontSize="sm" color="secondary">
                  {date(invoice?.soldAt)}
                </Text>
              </Box>
              <Drawer.CloseTrigger asChild>
                <IconButton size="xs" variant="ghost" aria-label="Close">
                  <X size={16} />
                </IconButton>
              </Drawer.CloseTrigger>
            </HStack>
          </Drawer.Header>
          <Drawer.Body>
            {invoice && (
              <VStack align="stretch" gap="5">
                <HStack justify="space-between">
                  <Box>
                    <Text fontWeight="600">{invoice.customer?.name ?? 'Walk-in customer'}</Text>
                    <Text fontSize="sm" color="secondary">
                      {invoice.customer?.email ?? invoice.customer?.phone ?? 'No contact details'}
                    </Text>
                  </Box>
                  <StatusBadge value={invoice.paymentStatus} />
                </HStack>
                <InvoicePreview
                  company={company}
                  invoice={invoice}
                  items={invoice.items}
                  customer={invoice.customer}
                  discount={{ type: invoice.discountType, value: invoice.discountValue ?? 0 }}
                  taxRate={invoice.taxRate}
                  notes={invoice.notes ?? ''}
                  mode="A4"
                />
                <Box>
                  <Heading size="sm" mb="2">
                    Payments
                  </Heading>
                  {invoice.payments.map((payment) => (
                    <HStack key={payment.id} justify="space-between">
                      <Text>{payment.paymentMethod}</Text>
                      <Text>{money(payment.amount)}</Text>
                    </HStack>
                  ))}
                </Box>
                {error && <Text color="danger">{error}</Text>}
              </VStack>
            )}
          </Drawer.Body>
          <Drawer.Footer>
            <HStack justify="flex-end" w="full">
              <Button variant="outline" onClick={() => window.print()}>
                <Printer size={15} />
                Print
              </Button>
              <Button loading={downloading} onClick={download}>
                <Download size={15} />
                Download PDF
              </Button>
            </HStack>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}

export function InvoicePage() {
  const [filters, setFilters] = useState<InvoiceFilters>({ page: 1, limit: 10, sortBy: 'soldAt', sortOrder: 'desc' })
  const [invoices, setInvoices] = useState<SaleSummary[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 })
  const [company, setCompany] = useState<Company>()
  const [selected, setSelected] = useState<InvoiceDetail>()
  const [editing, setEditing] = useState<InvoiceDetail>()
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([getInvoices(filters), getCompany()])
      .then(([result, currentCompany]) => {
        setInvoices(result.items)
        setPagination(result.pagination)
        setCompany(currentCompany)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Invoices could not be loaded.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [
    filters.page,
    filters.limit,
    filters.search,
    filters.status,
    filters.paymentStatus,
    filters.from,
    filters.to,
    filters.sortBy,
    filters.sortOrder,
  ])
  const tab =
    filters.status === 'DRAFT'
      ? 'draft'
      : filters.paymentStatus === 'PAID'
        ? 'paid'
        : filters.paymentStatus === 'PENDING'
          ? 'unpaid'
          : 'all'
  const selectTab = (value: string) =>
    setFilters((current) => ({
      ...current,
      page: 1,
      status: value === 'draft' ? 'DRAFT' : undefined,
      paymentStatus: value === 'paid' ? 'PAID' : value === 'unpaid' ? 'PENDING' : undefined,
    }))
  const openInvoice = async (id: string) => {
    try {
      setSelected(await getInvoice(id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invoice could not be loaded.')
    }
  }
  const editInvoice = async (id: string) => {
    try {
      setEditing(await getInvoice(id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invoice could not be loaded.')
    }
  }
  const cancelDraft = async (id: string) => {
    try {
      await cancelInvoice(id)
      setInvoices((current) => current.map((item) => (item.id === id ? { ...item, status: 'CANCELLED' } : item)))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Draft could not be cancelled.')
    }
  }
  return (
    <PageContainer>
      <PageHeader
        title="Invoices"
        description="Create, manage, and review completed sales invoices."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus size={15} />
            New Invoice
          </Button>
        }
      />
      <VStack align="stretch" gap="4">
        <Card.Root variant="outline">
          <Card.Body>
            <HStack flexWrap="wrap" gap="2">
              <Button size="sm" variant={tab === 'all' ? 'solid' : 'outline'} onClick={() => selectTab('all')}>
                All
              </Button>
              <Button size="sm" variant={tab === 'paid' ? 'solid' : 'outline'} onClick={() => selectTab('paid')}>
                Paid
              </Button>
              <Button size="sm" variant={tab === 'unpaid' ? 'solid' : 'outline'} onClick={() => selectTab('unpaid')}>
                Unpaid
              </Button>
              <Button size="sm" variant={tab === 'draft' ? 'solid' : 'outline'} onClick={() => selectTab('draft')}>
                Draft
              </Button>
              <HStack flex="1" minW="240px">
                <Search size={16} />
                <Input
                  size="sm"
                  value={filters.search ?? ''}
                  onChange={(event) => setFilters((current) => ({ ...current, page: 1, search: event.target.value }))}
                  placeholder="Search invoice or customer"
                />
              </HStack>
              <HStack>
                <CalendarDays size={15} />
                <Input
                  size="sm"
                  type="date"
                  value={filters.from ?? ''}
                  onChange={(event) => setFilters((current) => ({ ...current, page: 1, from: event.target.value }))}
                />
                <Input
                  size="sm"
                  type="date"
                  value={filters.to ?? ''}
                  onChange={(event) => setFilters((current) => ({ ...current, page: 1, to: event.target.value }))}
                />
              </HStack>
            </HStack>
          </Card.Body>
        </Card.Root>
        <Card.Root variant="outline">
          <Card.Body>
            {error && (
              <Text color="danger" mb="3">
                {error}
              </Text>
            )}
            {loading ? (
              <VStack align="stretch">
                <Skeleton h="10" />
                <Skeleton h="10" />
                <Skeleton h="10" />
              </VStack>
            ) : (
              <Table.Root size="sm" variant="line">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Invoice No.</Table.ColumnHeader>
                    <Table.ColumnHeader>Date</Table.ColumnHeader>
                    <Table.ColumnHeader>Customer</Table.ColumnHeader>
                    <Table.ColumnHeader>Items</Table.ColumnHeader>
                    <Table.ColumnHeader>Total</Table.ColumnHeader>
                    <Table.ColumnHeader>Payment status</Table.ColumnHeader>
                    <Table.ColumnHeader>Status</Table.ColumnHeader>
                    <Table.ColumnHeader>Actions</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {invoices.map((invoice) => (
                    <Table.Row key={invoice.id} onClick={() => openInvoice(invoice.id)} cursor="pointer">
                      <Table.Cell fontWeight="600">{invoice.invoiceNumber ?? 'Draft'}</Table.Cell>
                      <Table.Cell>{date(invoice.soldAt)}</Table.Cell>
                      <Table.Cell>{invoice.customer?.name ?? 'Walk-in customer'}</Table.Cell>
                      <Table.Cell>—</Table.Cell>
                      <Table.Cell>{money(invoice.total)}</Table.Cell>
                      <Table.Cell>
                        <StatusBadge value={invoice.paymentStatus} />
                      </Table.Cell>
                      <Table.Cell>
                        <StatusBadge value={invoice.status} />
                      </Table.Cell>
                      <Table.Cell>
                        <HStack onClick={(event) => event.stopPropagation()}>
                          <IconButton
                            size="xs"
                            variant="ghost"
                            aria-label="View invoice"
                            onClick={() => openInvoice(invoice.id)}
                          >
                            <Eye size={14} />
                          </IconButton>
                          {invoice.status === 'DRAFT' && (
                            <IconButton
                              size="xs"
                              variant="ghost"
                              aria-label="Edit draft"
                              onClick={() => editInvoice(invoice.id)}
                            >
                              <Pencil size={14} />
                            </IconButton>
                          )}
                          {invoice.status === 'DRAFT' && (
                            <IconButton
                              size="xs"
                              variant="ghost"
                              aria-label="Cancel draft"
                              onClick={() => cancelDraft(invoice.id)}
                            >
                              <X size={14} />
                            </IconButton>
                          )}
                          <IconButton size="xs" variant="ghost" aria-label="More actions">
                            <MoreHorizontal size={14} />
                          </IconButton>
                        </HStack>
                      </Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table.Root>
            )}
            {!loading && !invoices.length && (
              <Text textAlign="center" py="8" color="secondary">
                No invoices match the selected filters.
              </Text>
            )}
            <HStack justify="space-between" mt="4">
              <Text fontSize="sm" color="secondary">
                {pagination.total} invoices
              </Text>
              <HStack>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1}
                  onClick={() => setFilters((current) => ({ ...current, page: pagination.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setFilters((current) => ({ ...current, page: pagination.page + 1 }))}
                >
                  Next
                </Button>
              </HStack>
            </HStack>
          </Card.Body>
        </Card.Root>
      </VStack>
      <InvoiceEditor
        open={creating || Boolean(editing)}
        invoice={editing}
        company={company}
        onClose={() => {
          setCreating(false)
          setEditing(undefined)
        }}
        onSaved={() => {
          setCreating(false)
          setEditing(undefined)
          load()
        }}
      />
      <InvoiceDetails invoice={selected} company={company} onClose={() => setSelected(undefined)} />
    </PageContainer>
  )
}
