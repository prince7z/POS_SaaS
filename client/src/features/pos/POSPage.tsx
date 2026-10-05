import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Flex,
  Grid,
  HStack,
  IconButton,
  Input,
  Menu,
  Separator,
  Skeleton,
  Text,
  VStack,
} from '@chakra-ui/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Banknote,
  Barcode,
  Check,
  ChevronDown,
  CreditCard,
  Mail,
  Minus,
  Percent,
  Plus,
  ShoppingCart,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { SearchInput } from '@/components/common/SearchInput'
import { appConfig } from '@/config/app'
import { createSaleDraft, completeSale, type SaleDiscountType, type SalePaymentMethod } from '@/api/endpoints/sales'
import { loadPOSData } from './pos.service'
import { calculateSaleTotals } from './pos.calculations'
import type { CartItem, CatalogCategory, CatalogProduct, Customer } from './types'
import { ProductCard12 } from '@/components/shadcn-studio/card/card-12'

const MotionBox = motion.create(Box)
const TAX_RATE = appConfig.tax.defaultRate * 100

function ProductSkeleton() {
  return (
    <Card.Root variant="outline" size="sm">
      <Card.Body p="3">
        <Skeleton h="84px" borderRadius="sm" />
        <Skeleton h="16px" mt="3" />
        <Skeleton h="13px" mt="2" w="55%" />
        <Skeleton h="28px" mt="3" />
      </Card.Body>
    </Card.Root>
  )
}

function CartRow({
  item,
  onQuantity,
  onRemove,
}: {
  item: CartItem
  onQuantity: (quantity: number) => void
  onRemove: () => void
}) {
  return (
    <MotionBox
      layout
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      overflow="hidden"
    >
      <Flex align="start" gap="2" py="2.5" borderBottomWidth="1px" borderColor="border">
        <Box
          w="42px"
          h="42px"
          borderRadius="sm"
          bg="background"
          overflow="hidden"
          display="grid"
          placeItems="center"
          flexShrink="0"
        >
          {item.imageUrls?.[0] || item.imageKeys?.[0] ? (
            <img
              src={item.imageUrls?.[0] || item.imageKeys[0]}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <ShoppingCart size={16} color="var(--chakra-colors-muted)" />
          )}
        </Box>
        <Box flex="1" minW="0">
          <Text fontSize="sm" fontWeight="600" lineClamp={1}>
            {item.name}
          </Text>
          <Text fontSize="xs" color="secondary">
            ${item.sellingPrice.toFixed(2)} each
          </Text>
          <HStack mt="1.5" gap="1">
            <IconButton
              aria-label="Decrease quantity"
              size="xs"
              variant="outline"
              onClick={() => onQuantity(item.quantity - 1)}
              disabled={item.quantity <= 1}
            >
              <Minus size={12} />
            </IconButton>
            <Text minW="6" textAlign="center" fontSize="sm">
              {item.quantity}
            </Text>
            <IconButton
              aria-label="Increase quantity"
              size="xs"
              variant="outline"
              onClick={() => onQuantity(item.quantity + 1)}
              disabled={item.quantity >= item.stockQuantity}
            >
              <Plus size={12} />
            </IconButton>
          </HStack>
        </Box>
        <VStack align="end" gap="1">
          <Text fontWeight="600" fontSize="sm">
            ${(item.sellingPrice * item.quantity).toFixed(2)}
          </Text>
          <IconButton
            aria-label={`Remove ${item.name}`}
            size="xs"
            variant="ghost"
            colorPalette="red"
            onClick={onRemove}
          >
            <Trash2 size={14} />
          </IconButton>
        </VStack>
      </Flex>
    </MotionBox>
  )
}

function DiscountSelector({
  value,
  onChange,
}: {
  value: SaleDiscountType | null
  onChange: (value: SaleDiscountType | null) => void
}) {
  const label = value === 'PERCENT' ? 'Percentage' : value === 'FIXED' ? 'Fixed amount' : 'Add discount'
  return (
    <HStack gap="2">
      <Button size="sm" variant="outline" onClick={() => onChange(value ? null : 'PERCENT')}>
        <Percent size={14} />
        {label}
      </Button>
      <Menu.Root positioning={{ placement: 'bottom-start' }}>
        <Menu.Trigger asChild>
          <Button size="sm" variant="outline" aria-label="Choose discount type">
            {value === 'PERCENT' ? '%' : value === 'FIXED' ? '$' : 'Type'}
            <ChevronDown size={14} />
          </Button>
        </Menu.Trigger>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="percent" onClick={() => onChange('PERCENT')}>
              Percentage
            </Menu.Item>
            <Menu.Item value="fixed" onClick={() => onChange('FIXED')}>
              Fixed amount
            </Menu.Item>
            <Menu.Item value="none" onClick={() => onChange(null)}>
              No discount
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Menu.Root>
    </HStack>
  )
}

function CustomerSelector({
  customers,
  value,
  onChange,
}: {
  customers: Customer[]
  value: string | null
  onChange: (value: string | null) => void
}) {
  const selected = customers.find((customer) => customer.id === value)
  return (
    <Menu.Root positioning={{ placement: 'bottom-start' }}>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline" justifyContent="space-between" w="full">
          <HStack gap="2">
            <UserRound size={14} />
            <Text>{selected?.name ?? 'Walk-in customer'}</Text>
          </HStack>
          <ChevronDown size={14} />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="240px">
          {customers.map((customer) => (
            <Menu.Item key={customer.id} value={customer.id} onClick={() => onChange(customer.id)}>
              {customer.name}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}

function PaymentMethodSelector({
  value,
  onChange,
}: {
  value: SalePaymentMethod
  onChange: (value: SalePaymentMethod) => void
}) {
  const methods: Array<[SalePaymentMethod, typeof Banknote]> = [
    ['CASH', Banknote],
    ['CARD', CreditCard],
    ['STORE_CREDIT', Wallet],
  ]
  return (
    <HStack gap="1">
      {methods.map(([method, Icon]) => (
        <Button
          key={method}
          size="sm"
          flex="1"
          variant={value === method ? 'solid' : 'outline'}
          colorPalette={value === method ? 'blue' : undefined}
          onClick={() => onChange(method)}
        >
          <Icon size={14} />
          {method === 'STORE_CREDIT' ? 'Credit' : method[0] + method.slice(1).toLowerCase()}
        </Button>
      ))}
    </HStack>
  )
}

function SaleSummary({ totals }: { totals: ReturnType<typeof calculateSaleTotals> }) {
  const prefersReducedMotion = useReducedMotion()
  return (
    <VStack align="stretch" gap="2">
      <HStack justify="space-between" fontSize="sm">
        <Text color="secondary">Subtotal</Text>
        <Text>${totals.subtotal.toFixed(2)}</Text>
      </HStack>
      <HStack justify="space-between" fontSize="sm">
        <Text color="secondary">Discount</Text>
        <Text>-${totals.discount.toFixed(2)}</Text>
      </HStack>
      <HStack justify="space-between" fontSize="sm">
        <Text color="secondary">Tax</Text>
        <Text>${totals.tax.toFixed(2)}</Text>
      </HStack>
      <Separator />
      <HStack justify="space-between" fontWeight="700" fontSize="lg">
        <Text>Total</Text>
        <motion.span
          key={totals.total}
          initial={prefersReducedMotion ? false : { opacity: 0.5 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          ${totals.total.toFixed(2)}
        </motion.span>
      </HStack>
    </VStack>
  )
}

export function POSPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [discountType, setDiscountType] = useState<SaleDiscountType | null>(null)
  const [discountValue, setDiscountValue] = useState(0)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [addedProductId, setAddedProductId] = useState<string | null>(null)

  const [notifyCustomer, setNotifyCustomer] = useState(false)
  const [recipientType, setRecipientType] = useState<'CUSTOMER' | 'OTHER'>('CUSTOMER')
  const [customEmail, setCustomEmail] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])
  useEffect(() => {
    let active = true
    setLoading(true)
    loadPOSData({ search: debouncedSearch, categoryId: categoryId ?? null, page: 1 })
      .then(([categoryResult, productResult, customerResult]) => {
        if (!active) return
        setCategories(categoryResult.items)
        setProducts(productResult.items)
        setCustomers(customerResult.items)
        setCustomerId((current) => current ?? customerResult.items.find((customer) => customer.isWalkIn)?.id ?? null)
        setError('')
      })
      .catch(() => {
        if (active) setError('POS data could not be loaded. Please check your session and try again.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [debouncedSearch, categoryId])

  const totals = calculateSaleTotals(
    cart.reduce((total, item) => total + item.sellingPrice * item.quantity, 0),
    discountType,
    discountValue,
    TAX_RATE,
  )
  const addToCart = (product: CatalogProduct) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing)
        return current.map((item) =>
          item.id === product.id ? { ...item, quantity: Math.min(item.quantity + 1, item.stockQuantity) } : item,
        )
      return [...current, { ...product, quantity: 1 }]
    })
    setAddedProductId(product.id)
    window.setTimeout(() => setAddedProductId((current) => (current === product.id ? null : current)), 700)
  }
  const updateQuantity = (id: string, quantity: number) =>
    setCart((current) =>
      current.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stockQuantity)) } : item,
      ),
    )
  const submitSale = async () => {
    if (!cart.length) return
    setSubmitting(true)
    setSuccess('')
    try {
      const draft = await createSaleDraft({
        source: 'POS',
        customerId,
        items: cart.map((item) => ({ productId: item.id, quantity: item.quantity })),
        taxRate: TAX_RATE,
        discountType,
        discountValue: discountType ? discountValue : null,
      })
      const completed = await completeSale(draft.id, {
        taxRate: TAX_RATE,
        discountType,
        discountValue: discountType ? discountValue : null,
        customerId,
        payments: [{ paymentMethod, amount: totals.total }],
        notifyCustomer,
        notificationEmail: notifyCustomer && recipientType === 'OTHER' ? customEmail : undefined,
      })
      setSuccess(
        completed.invoiceNumber
          ? `Sale ${completed.invoiceNumber} completed.${notifyCustomer ? ' Receipt email queued.' : ''}`
          : 'Sale completed successfully.',
      )
      setCart([])
      setDiscountType(null)
      setDiscountValue(0)
      setNotifyCustomer(false)
      setCustomEmail('')
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'The sale could not be completed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Point of Sale" description="Search products or scan a barcode to add items to the sale." />
      {error && (
        <Alert.Root status="error" mb="4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>POS unavailable</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
          <IconButton aria-label="Dismiss error" size="sm" variant="ghost" onClick={() => setError('')}>
            <X size={15} />
          </IconButton>
        </Alert.Root>
      )}
      {success && (
        <Alert.Root status="success" mb="4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{success}</Alert.Description>
          </Alert.Content>
          <IconButton aria-label="Dismiss success" size="sm" variant="ghost" onClick={() => setSuccess('')}>
            <X size={15} />
          </IconButton>
        </Alert.Root>
      )}
      <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1fr) 340px' }} gap="4" alignItems="start">
        <Box minW="0">
          <HStack gap="2">
            <Box flex="1">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search products by name, SKU or barcode..."
              />
            </Box>
            <IconButton
              size="sm"
              variant="outline"
              aria-label="Scan barcode"
              onClick={() => setError('Barcode scanning is ready for scanner integration.')}
            >
              <Barcode size={17} />
            </IconButton>
          </HStack>
          <HStack mt="3" gap="1.5" overflowX="auto" pb="1">
            <Button
              size="sm"
              variant={!categoryId ? 'solid' : 'outline'}
              colorPalette={!categoryId ? 'blue' : undefined}
              onClick={() => setCategoryId(undefined)}
            >
              All
            </Button>
            {categories.map((category) => (
              <Button
                key={category.id}
                size="sm"
                variant={categoryId === category.id ? 'solid' : 'outline'}
                colorPalette={categoryId === category.id ? 'blue' : undefined}
                onClick={() => setCategoryId(category.id)}
                whiteSpace="nowrap"
              >
                {category.name}
              </Button>
            ))}
          </HStack>
          {loading ? (
            <Grid
              mt="3"
              templateColumns={{
                base: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                lg: 'repeat(4, minmax(0, 1fr))',
              }}
              gap="2.5"
            >
              {Array.from({ length: 8 }, (_, index) => (
                <ProductSkeleton key={index} />
              ))}
            </Grid>
          ) : (
            <AnimatePresence mode="popLayout">
              <Grid
                mt="3"
                templateColumns={{
                  base: 'repeat(2, minmax(0, 1fr))',
                  md: 'repeat(3, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                }}
                gap="2.5"
              >
                {products.map((product) => (
                  <MotionBox
                    key={product.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <ProductCard12 product={product} added={addedProductId === product.id} onAdd={addToCart} />
                  </MotionBox>
                ))}
              </Grid>
              {!products.length && (
                <Box py="12" textAlign="center">
                  <Text fontWeight="600">No products found.</Text>
                  <Text color="secondary" fontSize="sm" mt="1">
                    Try a different search or category.
                  </Text>
                </Box>
              )}
            </AnimatePresence>
          )}
        </Box>
        <Card.Root variant="outline" borderRadius="sm" position={{ base: 'static', xl: 'sticky' }} top="80px">
          <Card.Header py="3">
            <Flex justify="space-between" align="center">
              <Box>
                <Text fontWeight="700">Current Cart</Text>
                <Text fontSize="xs" color="secondary">
                  {cart.reduce((count, item) => count + item.quantity, 0)} items
                </Text>
              </Box>
              {cart.length > 0 && (
                <Button size="xs" variant="ghost" colorPalette="red" onClick={() => setCart([])}>
                  Clear cart
                </Button>
              )}
            </Flex>
          </Card.Header>
          <Card.Body pt="0" pb="3">
            {!cart.length ? (
              <VStack py="10" gap="2">
                <ShoppingCart size={26} color="var(--chakra-colors-muted)" />
                <Text fontWeight="600">Your cart is empty</Text>
                <Text color="secondary" fontSize="sm" textAlign="center">
                  Search for a product to start a sale.
                </Text>
              </VStack>
            ) : (
              <>
                <VStack align="stretch" gap="0">
                  <AnimatePresence initial={false}>
                    {cart.map((item) => (
                      <CartRow
                        key={item.id}
                        item={item}
                        onQuantity={(quantity) => updateQuantity(item.id, quantity)}
                        onRemove={() => setCart((current) => current.filter((entry) => entry.id !== item.id))}
                      />
                    ))}
                  </AnimatePresence>
                </VStack>
                <VStack align="stretch" gap="2.5" mt="3">
                  <Text fontSize="sm" fontWeight="600">
                    Discount
                  </Text>
                  <HStack>
                    <DiscountSelector value={discountType} onChange={setDiscountType} />
                    <Input
                      size="sm"
                      type="number"
                      min="0"
                      value={discountValue}
                      disabled={!discountType}
                      onChange={(event) => setDiscountValue(Number(event.target.value))}
                    />
                  </HStack>
                  <Text fontSize="sm" fontWeight="600" mt="1">
                    Customer
                  </Text>
                  <CustomerSelector customers={customers} value={customerId} onChange={setCustomerId} />
                  <Text fontSize="sm" fontWeight="600" mt="1">
                    Payment method
                  </Text>
                  <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />

                  <Box py="1" borderTopWidth="1px" borderBottomWidth="1px" borderColor="border" my="1">
                    <HStack justify="space-between" cursor="pointer" onClick={() => setNotifyCustomer(!notifyCustomer)}>
                      <HStack gap="2">
                        <Mail size={15} color="var(--chakra-colors-blue-solid)" />
                        <Text fontSize="sm" fontWeight="600">
                          Email Receipt / Invoice
                        </Text>
                      </HStack>
                      <Button size="xs" variant={notifyCustomer ? 'solid' : 'outline'} colorPalette={notifyCustomer ? 'blue' : undefined}>
                        {notifyCustomer ? 'Enabled' : 'Off'}
                      </Button>
                    </HStack>

                    <AnimatePresence>
                      {notifyCustomer && (
                        <MotionBox
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          overflow="hidden"
                          mt="2"
                        >
                          <VStack align="stretch" gap="2">
                            <HStack gap="1.5">
                              <Button
                                size="xs"
                                flex="1"
                                variant={recipientType === 'CUSTOMER' ? 'solid' : 'outline'}
                                onClick={() => setRecipientType('CUSTOMER')}
                              >
                                Customer Mail
                              </Button>
                              <Button
                                size="xs"
                                flex="1"
                                variant={recipientType === 'OTHER' ? 'solid' : 'outline'}
                                onClick={() => setRecipientType('OTHER')}
                              >
                                Other Mail
                              </Button>
                            </HStack>
                            {recipientType === 'OTHER' && (
                              <Input
                                size="sm"
                                type="email"
                                placeholder="Enter recipient email address..."
                                value={customEmail}
                                onChange={(e) => setCustomEmail(e.target.value)}
                              />
                            )}
                          </VStack>
                        </MotionBox>
                      )}
                    </AnimatePresence>
                  </Box>

                  <SaleSummary totals={totals} />
                  <Button size="md" colorPalette="blue" loading={submitting} onClick={submitSale}>
                    <Check size={16} />
                    Complete Sale
                  </Button>
                </VStack>
              </>
            )}
          </Card.Body>
        </Card.Root>
      </Grid>
    </PageContainer>
  )
}
