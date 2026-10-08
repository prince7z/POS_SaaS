import { useEffect, useRef, useState } from 'react'
import { Box, Button, Drawer, Heading, HStack, Separator, Skeleton, Text, VStack } from '@chakra-ui/react'
import { useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { getBrands, getCategoriesPage, type CatalogBrand, type CatalogCategory } from '@/api/endpoints/catalog'
import {
  getInventory,
  getInventorySummary,
  getProductInventory,
  getProductMovements,
  type InventoryItem,
  type InventoryMovement,
  type InventorySummary,
} from '@/api/endpoints/inventory'
import { InventoryAnalytics } from './InventoryAnalytics'
import { InventoryStats } from './InventoryStats'
import { InventoryTable } from './InventoryTable'
import { InventoryToolbar } from './InventoryToolbar'
import { InventoryProductDetails } from './InventoryProductIdentity'
import { formatCurrency } from '@/lib/formatters'

function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <HStack justify="space-between" borderWidth="1px" borderColor="danger" borderRadius="md" p="3" color="danger">
      <Text fontSize="sm">{message}</Text>
      <Button size="sm" variant="outline" onClick={retry}>
        Retry
      </Button>
    </HStack>
  )
}

function ProductDrawer({ item, onClose }: { item?: InventoryItem; onClose: () => void }) {
  const [product, setProduct] = useState<InventoryItem>()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  useEffect(() => {
    if (!item) return
    setProduct(undefined)
    setLoading(true)
    setError('')
    Promise.all([getProductInventory(item.productId), getProductMovements(item.productId, { page: 1, limit: 8 })])
      .then(([details, history]) => {
        setProduct(details)
        setMovements(history.items)
      })
      .catch(() => setError('Product details could not be loaded.'))
      .finally(() => setLoading(false))
  }, [item, reloadKey])
  return (
    <Drawer.Root
      open={Boolean(item)}
      onOpenChange={(event) => !event.open && onClose()}
      placement="end"
      size="md"
      lazyMount
      unmountOnExit
    >
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <HStack justify="space-between" w="full">
              <Heading fontSize="lg">Product details</Heading>
              <Drawer.CloseTrigger asChild>
                <Button size="xs" variant="ghost" aria-label="Close details">
                  <X size={16} />
                </Button>
              </Drawer.CloseTrigger>
            </HStack>
          </Drawer.Header>
          <Drawer.Body>
            {loading ? (
              <VStack align="stretch" gap="3">
                <Skeleton h="20" />
                <Skeleton h="28" />
                <Skeleton h="40" />
              </VStack>
            ) : error ? (
              <ErrorState message={error} retry={() => setReloadKey((value) => value + 1)} />
            ) : product ? (
              <VStack align="stretch" gap="5">
                <InventoryProductDetails product={product} />
                <HStack gap="3">
                  {[
                    ['Current stock', product.stockQuantity],
                    ['Reorder level', product.lowStockThreshold],
                    ['Inventory value', formatCurrency(product.stockQuantity * product.averageCost)],
                  ].map(([label, value]) => (
                    <Box key={String(label)} flex="1" borderWidth="1px" borderColor="border" borderRadius="md" p="3">
                      <Text fontSize="xs" color="secondary">
                        {label}
                      </Text>
                      <Text mt="1" fontWeight="700">
                        {value}
                      </Text>
                    </Box>
                  ))}
                </HStack>
                <Separator />
                <Box>
                  <Heading fontSize="sm" mb="3">
                    Recent stock history
                  </Heading>
                  <VStack align="stretch" gap="2">
                    {movements.length ? (
                      movements.map((movement) => (
                        <HStack
                          key={movement.id}
                          justify="space-between"
                          borderWidth="1px"
                          borderColor="border"
                          borderRadius="md"
                          p="3"
                        >
                          <Box>
                            <Text fontSize="sm" fontWeight="600">
                              {movement.movementType.replaceAll('_', ' ')}
                            </Text>
                            <Text fontSize="xs" color="secondary">
                              {new Date(movement.createdAt).toLocaleString()}
                            </Text>
                          </Box>
                          <HStack gap="1" fontWeight="700" color={movement.quantityChange >= 0 ? 'success' : 'danger'}>
                            {movement.quantityChange >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                            {Math.abs(movement.quantityChange)}
                          </HStack>
                        </HStack>
                      ))
                    ) : (
                      <Text fontSize="sm" color="secondary">
                        No stock movements recorded.
                      </Text>
                    )}
                  </VStack>
                </Box>
              </VStack>
            ) : null}
          </Drawer.Body>
          <Drawer.Footer>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}

export function InventoryDashboard() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<InventorySummary>()
  const [items, setItems] = useState<InventoryItem[]>([])
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [brands, setBrands] = useState<CatalogBrand[]>([])
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [inventoryLoading, setInventoryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [inventoryError, setInventoryError] = useState('')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brandId, setBrandId] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [sortBy, setSortBy] = useState<'name' | 'stockQuantity' | 'createdAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<InventoryItem>()
  const queryId = useRef(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search])
  const loadSummary = () => {
    setSummaryLoading(true)
    setSummaryError('')
    getInventorySummary()
      .then(setSummary)
      .catch(() => setSummaryError('Inventory summary could not be loaded.'))
      .finally(() => setSummaryLoading(false))
  }
  const loadInventory = () => {
    const requestId = ++queryId.current
    setInventoryLoading(true)
    setAnalyticsLoading(true)
    setInventoryError('')
    const filters = {
      page,
      limit: 20,
      search: debouncedSearch || undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      lowStock: status === 'low' ? true : undefined,
      outOfStock: status === 'out' ? true : undefined,
      sortBy,
      sortOrder,
    } as const
    Promise.all([
      getInventory(filters),
      getInventory({ page: 1, limit: 8, lowStock: true, sortBy: 'stockQuantity', sortOrder: 'asc' }),
    ])
      .then(([result, lowStock]) => {
        if (requestId !== queryId.current) return
        setItems(result.items)
        setPages(result.pagination.totalPages)
        setLowStockItems(lowStock.items)
      })
      .catch(() => {
        if (requestId === queryId.current) setInventoryError('Inventory could not be loaded.')
      })
      .finally(() => {
        if (requestId === queryId.current) {
          setInventoryLoading(false)
          setAnalyticsLoading(false)
        }
      })
  }
  useEffect(() => {
    void Promise.all([getCategoriesPage({ page: 1, limit: 100 }), getBrands({ page: 1, limit: 100 })]).then(
      ([categoryResult, brandResult]) => {
        setCategories(categoryResult.items)
        setBrands(brandResult.items)
      },
    )
  }, [])
  useEffect(() => {
    loadSummary()
  }, [])
  useEffect(() => {
    loadInventory()
  }, [page, debouncedSearch, categoryId, brandId, status, sortBy, sortOrder])
  const sort = (key: 'name' | 'stockQuantity' | 'createdAt') => {
    setPage(1)
    if (sortBy === key) setSortOrder((value) => (value === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(key)
      setSortOrder('asc')
    }
  }

  return (
    <PageContainer>
      <PageHeader title="Inventory" description="Monitor stock health, value, and product availability." />
      <VStack align="stretch" gap="5">
        <InventoryStats summary={summary} loading={summaryLoading} />
        {summaryError && <ErrorState message={summaryError} retry={loadSummary} />}
        <InventoryAnalytics summary={summary} lowStockItems={lowStockItems} loading={analyticsLoading} />
        <Box borderWidth="1px" borderColor="border" borderRadius="lg" bg="surface" overflow="hidden">
          <Box p="4" borderBottomWidth="1px" borderColor="border">
            <InventoryToolbar
              search={search}
              onSearch={setSearch}
              categoryId={categoryId}
              onCategory={(value) => {
                setCategoryId(value)
                setPage(1)
              }}
              brandId={brandId}
              onBrand={(value) => {
                setBrandId(value)
                setPage(1)
              }}
              status={status}
              onStatus={(value) => {
                setStatus(value)
                setPage(1)
              }}
              categories={categories}
              brands={brands}
            />
          </Box>
          {inventoryError ? (
            <Box p="4">
              <ErrorState message={inventoryError} retry={loadInventory} />
            </Box>
          ) : inventoryLoading || items.length ? (
            <InventoryTable
              items={items}
              loading={inventoryLoading}
              onView={setSelected}
              onAdjust={(item) => navigate(`/inventory/adjustments?productId=${item.productId}`)}
              onMovements={(item) => navigate(`/inventory/movements?productId=${item.productId}`)}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={sort}
            />
          ) : (
            <Box p="10" textAlign="center">
              <Text fontWeight="600">No inventory items found</Text>
              <Text mt="1" fontSize="sm" color="secondary">
                Try changing your search or filters.
              </Text>
            </Box>
          )}
          <HStack justify="space-between" p="3" borderTopWidth="1px" borderColor="border">
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
        </Box>
      </VStack>
      <ProductDrawer item={selected} onClose={() => setSelected(undefined)} />
    </PageContainer>
  )
}
