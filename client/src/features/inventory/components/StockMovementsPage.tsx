import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Button, Card, HStack, Heading, Input, NativeSelect, Skeleton, Table, Text, VStack } from '@chakra-ui/react'
import { Search } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import { getInventory, getProductInventory, getProductMovements, type InventoryItem, type InventoryMovement } from '@/api/endpoints/inventory'
import { EChart } from '@/components/charts/EChart'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { InventoryProductDetails, InventoryProductIdentity } from './InventoryProductIdentity'

const movementTypes: InventoryMovement['movementType'][] = ['OPENING', 'PURCHASE_RECEIPT', 'SALE', 'RETURN', 'ADJUSTMENT', 'SALE_REVERSAL', 'RETURN_REVERSAL']

function formatChartDate(value: string) {
  const date = new Date(value)
  const day = date.getDate()
  const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : day % 10 === 1 ? 'st' : day % 10 === 2 ? 'nd' : day % 10 === 3 ? 'rd' : 'th'
  return `${day}${suffix} ${date.toLocaleString('en-US', { month: 'long' })}`
}

export function StockMovementsPage() {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<InventoryItem[]>([])
  const [product, setProduct] = useState<InventoryItem>()
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [movementType, setMovementType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const productId = new URLSearchParams(location.search).get('productId')
    if (!productId) return
    getProductInventory(productId).then((item) => { setProduct(item); setSearch(item.name) }).catch(() => setError('The selected product could not be loaded.'))
  }, [location.search])

  useEffect(() => {
    if (!search.trim()) { setProducts([]); return }
    let active = true
    setLoadingProducts(true)
    getInventory({ page: 1, limit: 8, search: search.trim() }).then((result) => { if (active) setProducts(result.items) }).catch(() => { if (active) setError('Products could not be searched.') }).finally(() => { if (active) setLoadingProducts(false) })
    return () => { active = false }
  }, [search])

  useEffect(() => {
    if (!product) { setMovements([]); return }
    let active = true
    setLoadingMovements(true); setError('')
    getProductMovements(product.productId, { page, limit: 20, movementType: movementType ? movementType as InventoryMovement['movementType'] : undefined, from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined, to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined })
      .then((result) => { if (active) { setMovements(result.items); setPages(result.pagination.totalPages) } })
      .catch(() => { if (active) setError('Movement history could not be loaded.') })
      .finally(() => { if (active) setLoadingMovements(false) })
    return () => { active = false }
  }, [product, page, movementType, from, to])

  const chartOption = useMemo<EChartsOption>(() => {
    const chronologicalMovements = [...movements].sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    return { animationDuration: 300, grid: { left: 8, right: 18, top: 12, bottom: 20, containLabel: true }, tooltip: { trigger: 'axis' }, xAxis: { type: 'category', data: chronologicalMovements.map((movement) => formatChartDate(movement.createdAt)) }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: chronologicalMovements.map((movement) => movement.quantityChange) }] }
  }, [movements])

  return <PageContainer><PageHeader title="Stock Movements" description="Review the movement history for a selected inventory product." /><VStack align="stretch" gap="5"><Card.Root variant="outline" size="sm"><Card.Body><VStack align="stretch" gap="3"><HStack><Search size={16} /><Input size="sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU or barcode..." /></HStack>{(loadingProducts || products.length > 0) && <Box borderWidth="1px" borderColor="border" borderRadius="md" overflow="hidden">{loadingProducts ? <VStack p="3" align="stretch"><Skeleton h="8" /><Skeleton h="8" /></VStack> : products.map((item) => <Button key={item.productId} variant="ghost" size="sm" justifyContent="flex-start" w="full" onClick={() => { setProduct(item); setSearch(item.name); setProducts([]); setPage(1) }}><InventoryProductIdentity product={item} compact /></Button>)}</Box>}</VStack></Card.Body></Card.Root>{product ? <><Card.Root variant="outline" size="sm"><Card.Body><InventoryProductDetails product={product} /></Card.Body></Card.Root><Card.Root variant="outline" size="sm"><Card.Header><Heading size="sm">Movement activity</Heading></Card.Header><Card.Body>{loadingMovements ? <Skeleton h="220px" /> : movements.length ? <EChart option={chartOption} height="220px" ariaLabel="Stock movement activity chart" /> : <Text py="12" textAlign="center" color="secondary">No movement history for the selected filters.</Text>}</Card.Body></Card.Root><Card.Root variant="outline" size="sm"><Card.Header><HStack justify="space-between"><Heading size="sm">Movement history</Heading><HStack><NativeSelect.Root size="sm" w="180px"><NativeSelect.Field value={movementType} onChange={(event) => { setMovementType(event.target.value); setPage(1) }}><option value="">All movement types</option>{movementTypes.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</NativeSelect.Field></NativeSelect.Root><Input size="sm" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1) }} /><Input size="sm" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1) }} /></HStack></HStack></Card.Header><Card.Body>{error ? <Text color="danger" fontSize="sm">{error}</Text> : loadingMovements ? <Skeleton h="240px" /> : <Table.ScrollArea maxW="full"><Table.Root size="sm" minW="760px"><Table.Header><Table.Row><Table.ColumnHeader>Date & time</Table.ColumnHeader><Table.ColumnHeader>Type</Table.ColumnHeader><Table.ColumnHeader>Quantity</Table.ColumnHeader><Table.ColumnHeader>Reference</Table.ColumnHeader><Table.ColumnHeader>User</Table.ColumnHeader><Table.ColumnHeader>Note</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{movements.map((movement) => <Table.Row key={movement.id}><Table.Cell>{new Date(movement.createdAt).toLocaleString()}</Table.Cell><Table.Cell>{movement.movementType.replaceAll('_', ' ')}</Table.Cell><Table.Cell fontWeight="700" color={movement.quantityChange >= 0 ? 'success' : 'danger'}>{movement.quantityChange >= 0 ? '+' : ''}{movement.quantityChange}</Table.Cell><Table.Cell>{movement.referenceType ?? movement.operationId}</Table.Cell><Table.Cell>{movement.createdBy.name}</Table.Cell><Table.Cell>{movement.note ?? movement.reason ?? '—'}</Table.Cell></Table.Row>)}</Table.Body></Table.Root></Table.ScrollArea>}<HStack justify="space-between" mt="4"><Text fontSize="sm" color="secondary">Page {page} of {pages}</Text><HStack><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</Button></HStack></HStack></Card.Body></Card.Root></> : <Card.Root variant="outline" size="sm"><Card.Body><Text py="8" textAlign="center" color="secondary">Select a product to view its stock movements.</Text></Card.Body></Card.Root>}</VStack></PageContainer>
}
