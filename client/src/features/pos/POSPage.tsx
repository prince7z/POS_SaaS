import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, Grid, HStack, IconButton, VStack } from '@chakra-ui/react'
import { RefreshCw, X } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { appConfig } from '@/config/app'
import { createSaleDraft, completeSale, type SaleDiscountType, type SalePaymentMethod } from '@/api/endpoints/sales'
import { fetchPOSProducts, loadPOSInitialData } from './pos.service'
import { calculateSaleTotals } from './pos.calculations'
import type { CartItem, CatalogCategory, CatalogProduct, Customer, POSFilters } from './types'

import { ProductGrid } from './components/ProductGrid'
import { ProductGridSkeleton } from './components/ProductCardSkeleton'
import { CategoryFilter } from './components/CategoryFilter'
import { ProductSearch } from './components/ProductSearch'
import { ProductSort, type SortConfig } from './components/ProductSort'
import { ProductPagination } from './components/ProductPagination'
import { CartPanel } from './components/CartPanel'
import { EmptyProductState } from './components/EmptyProductState'

const TAX_RATE = appConfig.tax.defaultRate * 100

export function POSPage() {
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 })

  const [filters, setFilters] = useState<POSFilters>({
    search: '',
    categoryId: undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    limit: 20,
  })

  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [addedProductId, setAddedProductId] = useState<string | null>(null)

  const [discountType, setDiscountType] = useState<SaleDiscountType | null>(null)
  const [discountValue, setDiscountValue] = useState(0)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('CASH')
  const [submitting, setSubmitting] = useState(false)

  const [notifyCustomer, setNotifyCustomer] = useState(false)
  const [recipientType, setRecipientType] = useState<'CUSTOMER' | 'OTHER'>('CUSTOMER')
  const [customEmail, setCustomEmail] = useState('')

  // 1. Load initial static metadata (categories and customers)
  useEffect(() => {
    let active = true
    loadPOSInitialData()
      .then(([categoryResult, customerResult]) => {
        if (!active) return
        setCategories(categoryResult.items)
        setCustomers(customerResult.items)
        setCustomerId((current) => current ?? customerResult.items.find((c) => c.isWalkIn)?.id ?? null)
      })
      .catch(() => {
        if (active) setError('Failed to load POS metadata. Please check your network connection.')
      })
      .finally(() => {
        if (active) setInitialLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  // 2. Debounce search term
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), 300)
    return () => window.clearTimeout(timer)
  }, [filters.search])

  // 3. Fetch products when filters or debounced search change
  const loadProducts = useCallback(() => {
    setLoading(true)
    setError('')
    fetchPOSProducts({
      ...filters,
      search: debouncedSearch,
    })
      .then((res) => {
        setProducts(res.items)
        setPagination(res.pagination)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Could not fetch catalog products.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [filters.page, filters.limit, filters.categoryId, filters.sortBy, filters.sortOrder, debouncedSearch])

  useEffect(() => {
    if (!initialLoading) {
      loadProducts()
    }
  }, [initialLoading, loadProducts])

  // Filter change helpers (reset page to 1 on filter/search/sort change)
  const handleSearchChange = (search: string) => {
    setFilters((prev) => ({ ...prev, search, page: 1 }))
  }

  const handleCategoryChange = (categoryId: string | undefined) => {
    setFilters((prev) => ({ ...prev, categoryId, page: 1 }))
  }

  const handleSortChange = (sort: SortConfig) => {
    setFilters((prev) => ({ ...prev, sortBy: sort.sortBy, sortOrder: sort.sortOrder, page: 1 }))
  }

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }

  const handleLimitChange = (limit: number) => {
    setFilters((prev) => ({ ...prev, limit, page: 1 }))
  }

  const handleClearFilters = () => {
    setFilters({
      search: '',
      categoryId: undefined,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      page: 1,
      limit: filters.limit,
    })
  }

  // Cart operations
  const totals = calculateSaleTotals(
    cart.reduce((total, item) => total + item.sellingPrice * item.quantity, 0),
    discountType,
    discountValue,
    TAX_RATE,
  )

  const addToCart = (product: CatalogProduct) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, item.stockQuantity) }
            : item,
        )
      }
      return [...current, { ...product, quantity: 1 }]
    })
    setAddedProductId(product.id)
    window.setTimeout(() => {
      setAddedProductId((current) => (current === product.id ? null : current))
    }, 700)
  }

  const updateQuantity = (id: string, quantity: number) => {
    setCart((current) =>
      current.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stockQuantity)) } : item,
      ),
    )
  }

  const removeItem = (id: string) => {
    setCart((current) => current.filter((item) => item.id !== id))
  }

  const clearCart = () => {
    setCart([])
  }

  const submitSale = async () => {
    if (!cart.length) return
    setSubmitting(true)
    setSuccess('')
    setError('')
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
          ? `Sale ${completed.invoiceNumber} completed successfully.${notifyCustomer ? ' Receipt email queued.' : ''}`
          : 'Sale completed successfully.',
      )
      setCart([])
      setDiscountType(null)
      setDiscountValue(0)
      setNotifyCustomer(false)
      setCustomEmail('')

      // Refresh product list to update inventory numbers after completed sale
      loadProducts()
    } catch (submissionError) {
      setError(
        submissionError instanceof Error ? submissionError.message : 'The sale could not be completed.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const hasActiveFilters = Boolean(filters.search || filters.categoryId)

  return (
    <PageContainer>
      <PageHeader
        title="Point of Sale"
        description="Search products or filter catalog to build customer sales workspace."
      />

      {error && (
        <Alert.Root status="error" mb="4">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>POS Notice</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
          <HStack gap="2">
            <Button size="xs" variant="outline" onClick={loadProducts}>
              <RefreshCw size={12} />
              Retry
            </Button>
            <IconButton aria-label="Dismiss error" size="sm" variant="ghost" onClick={() => setError('')}>
              <X size={15} />
            </IconButton>
          </HStack>
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

      <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 1fr) 350px' }} gap="5" alignItems="start">
        {/* Left Area: Catalog Toolbar, Grid & Pagination */}
        <Box minW="0">
          {/* Search Bar + Sort Dropdown */}
          <HStack gap="2.5" mb="3">
            <ProductSearch
              value={filters.search}
              onChange={handleSearchChange}
              onBarcodeScan={() => setError('Barcode scanning is ready for hardware integration.')}
            />
            <ProductSort
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onChange={handleSortChange}
            />
          </HStack>

          {/* Horizontal Category Navigation */}
          <CategoryFilter
            categories={categories}
            selectedCategoryId={filters.categoryId}
            onSelectCategory={handleCategoryChange}
          />

          {/* Product Grid / Loading Skeleton / Empty State */}
          {loading || initialLoading ? (
            <ProductGridSkeleton count={filters.limit} />
          ) : products.length > 0 ? (
            <ProductGrid
              products={products}
              addedProductId={addedProductId}
              onAdd={addToCart}
            />
          ) : (
            <EmptyProductState
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
            />
          )}

          {/* Server-Side Pagination */}
          {!loading && !initialLoading && products.length > 0 && (
            <ProductPagination
              page={pagination.page}
              limit={pagination.limit}
              total={pagination.total}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
            />
          )}
        </Box>

        {/* Right Area: Sticky Cart Panel */}
        <VStack align="stretch" gap="0">
          <CartPanel
            cart={cart}
            customers={customers}
            selectedCustomerId={customerId}
            onSelectCustomer={setCustomerId}
            discountType={discountType}
            discountValue={discountValue}
            onDiscountTypeChange={setDiscountType}
            onDiscountValueChange={setDiscountValue}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            notifyCustomer={notifyCustomer}
            onToggleNotifyCustomer={() => setNotifyCustomer(!notifyCustomer)}
            recipientType={recipientType}
            onRecipientTypeChange={setRecipientType}
            customEmail={customEmail}
            onCustomEmailChange={setCustomEmail}
            totals={totals}
            submitting={submitting}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={clearCart}
            onSubmitSale={submitSale}
          />
        </VStack>
      </Grid>
    </PageContainer>
  )
}
