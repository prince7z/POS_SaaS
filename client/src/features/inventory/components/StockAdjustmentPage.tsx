import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Button, Card, Grid, Heading, HStack, Input, NativeSelect, Skeleton, Stat, Table, Text, VStack } from '@chakra-ui/react'
import { Search, Trash2 } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { getInventory, getProductInventory, adjustStock, type InventoryItem } from '@/api/endpoints/inventory'
import { InventoryProductDetails, InventoryProductIdentity } from './InventoryProductIdentity'

type AdjustmentAction = 'ADD' | 'REMOVE'
type AdjustmentRow = { product: InventoryItem; action: AdjustmentAction; quantity: string; unitCost: string; reason: string; note: string }

export function StockAdjustmentPage() {
  const location = useLocation()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [results, setResults] = useState<InventoryItem[]>([])
  const [rows, setRows] = useState<AdjustmentRow[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const productId = new URLSearchParams(location.search).get('productId')
    if (!productId) return
    getProductInventory(productId).then((product) => setRows([{ product, action: 'ADD', quantity: '', unitCost: product.averageCost ? String(product.averageCost) : '', reason: '', note: '' }])).catch(() => setError('The selected product could not be loaded.'))
  }, [location.search])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!debouncedSearch) {
      setResults([])
      return
    }
    let active = true
    setLoading(true)
    getInventory({ page: 1, limit: 8, search: debouncedSearch })
      .then((result) => { if (active) setResults(result.items) })
      .catch(() => { if (active) setError('Products could not be searched.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [debouncedSearch])

  const addProduct = (product: InventoryItem) => {
    setMessage('')
    setError('')
    setRows((current) => current.some((row) => row.product.productId === product.productId) ? current : [...current, { product, action: 'ADD', quantity: '', unitCost: product.averageCost ? String(product.averageCost) : '', reason: '', note: '' }])
    setSearch('')
  }

  const updateRow = (productId: string, patch: Partial<Omit<AdjustmentRow, 'product'>>) => {
    setRows((current) => current.map((row) => row.product.productId === productId ? { ...row, ...patch } : row))
  }

  const removeRow = (productId: string) => setRows((current) => current.filter((row) => row.product.productId !== productId))
  const unitsAdded = useMemo(() => rows.reduce((sum, row) => sum + (row.action === 'ADD' ? Number(row.quantity) || 0 : 0), 0), [rows])
  const unitsRemoved = useMemo(() => rows.reduce((sum, row) => sum + (row.action === 'REMOVE' ? Number(row.quantity) || 0 : 0), 0), [rows])

  const submit = async () => {
    setError('')
    setMessage('')
    if (!rows.length) return setError('Add at least one product before saving.')
    if (rows.some((row) => !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0 || (row.action === 'REMOVE' && Number(row.quantity) > row.product.stockQuantity))) return setError('Enter a positive quantity and do not remove more than the current stock.')
    setSubmitting(true)
    try {
      await adjustStock({ items: rows.map((row) => ({ productId: row.product.productId, action: row.action, quantity: Number(row.quantity), unitCost: row.unitCost ? Number(row.unitCost) : undefined, reason: row.reason || undefined, note: row.note || undefined })) })
      setRows([])
      setMessage('Stock adjustment saved successfully.')
    } catch {
      setError('Stock adjustment could not be saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return <PageContainer><PageHeader title="Stock Adjustments" description="Correct inventory quantities with a clear, auditable operation." /><VStack align="stretch" gap="5"><Card.Root variant="outline" size="sm"><Card.Header><Heading size="sm">Adjustment details</Heading><Text fontSize="sm" color="secondary">Search inventory products, then choose the quantity and action.</Text></Card.Header><Card.Body><VStack align="stretch" gap="4"><Box position="relative"><HStack><Search size={16} /><Input size="sm" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products, SKU or barcode..." /></HStack>{(loading || results.length > 0) && <Box position="absolute" zIndex="dropdown" top="12" insetX="0" bg="surface" borderWidth="1px" borderColor="border" borderRadius="md" shadow="sm">{loading ? <VStack p="3" align="stretch"><Skeleton h="8" /><Skeleton h="8" /></VStack> : results.map((product) => <Button key={product.productId} variant="ghost" size="sm" justifyContent="flex-start" w="full" onClick={() => addProduct(product)}><InventoryProductIdentity product={product} compact /></Button>)}</Box>}</Box>{error && <Text color="danger" fontSize="sm">{error}</Text>}{message && <Text color="success" fontSize="sm">{message}</Text>}</VStack></Card.Body></Card.Root>{rows.length > 0 && <Card.Root variant="outline" size="sm"><Card.Body><InventoryProductDetails product={rows[0].product} /></Card.Body></Card.Root>}<Card.Root variant="outline" size="sm"><Card.Header><Heading size="sm">Products to adjust</Heading></Card.Header><Card.Body>{rows.length ? <Table.ScrollArea maxW="full"><Table.Root size="sm" minW="1050px"><Table.Header><Table.Row><Table.ColumnHeader>Product</Table.ColumnHeader><Table.ColumnHeader>Current stock</Table.ColumnHeader><Table.ColumnHeader>Action</Table.ColumnHeader><Table.ColumnHeader>Quantity</Table.ColumnHeader><Table.ColumnHeader>New stock</Table.ColumnHeader><Table.ColumnHeader>Unit cost</Table.ColumnHeader><Table.ColumnHeader>Reason</Table.ColumnHeader><Table.ColumnHeader>Actions</Table.ColumnHeader></Table.Row></Table.Header><Table.Body>{rows.map((row) => { const quantity = Number(row.quantity) || 0; const newStock = row.action === 'ADD' ? row.product.stockQuantity + quantity : row.product.stockQuantity - quantity; return <Table.Row key={row.product.productId}><Table.Cell><InventoryProductIdentity product={row.product} compact /></Table.Cell><Table.Cell>{row.product.stockQuantity}</Table.Cell><Table.Cell><NativeSelect.Root size="sm"><NativeSelect.Field value={row.action} onChange={(event) => updateRow(row.product.productId, { action: event.target.value as AdjustmentAction })}><option value="ADD">Add</option><option value="REMOVE">Remove</option></NativeSelect.Field></NativeSelect.Root></Table.Cell><Table.Cell><Input size="sm" type="number" min="1" value={row.quantity} onChange={(event) => updateRow(row.product.productId, { quantity: event.target.value })} /></Table.Cell><Table.Cell fontWeight="600" color={newStock < 0 ? 'danger' : undefined}>{newStock}</Table.Cell><Table.Cell><Input size="sm" type="number" min="0" step="0.01" value={row.unitCost} onChange={(event) => updateRow(row.product.productId, { unitCost: event.target.value })} /></Table.Cell><Table.Cell><Input size="sm" value={row.reason} onChange={(event) => updateRow(row.product.productId, { reason: event.target.value })} placeholder="Optional" /></Table.Cell><Table.Cell><Button size="xs" variant="ghost" colorPalette="danger" aria-label={`Remove ${row.product.name}`} onClick={() => removeRow(row.product.productId)}><Trash2 size={14} /></Button></Table.Cell></Table.Row> })}</Table.Body></Table.Root></Table.ScrollArea> : <Text py="8" textAlign="center" color="secondary">Search for a product above to add it to this adjustment.</Text>}</Card.Body></Card.Root><Grid templateColumns={{ base: '1fr', sm: 'repeat(3, 1fr)' }} gap="3"><Stat.Root borderWidth="1px" borderColor="border" borderRadius="lg" p="4"><Stat.Label>Products affected</Stat.Label><Stat.ValueText>{rows.length}</Stat.ValueText></Stat.Root><Stat.Root borderWidth="1px" borderColor="border" borderRadius="lg" p="4"><Stat.Label>Units added</Stat.Label><Stat.ValueText>{unitsAdded}</Stat.ValueText></Stat.Root><Stat.Root borderWidth="1px" borderColor="border" borderRadius="lg" p="4"><Stat.Label>Units removed</Stat.Label><Stat.ValueText>{unitsRemoved}</Stat.ValueText></Stat.Root></Grid><HStack justify="flex-end"><Button size="sm" loading={submitting} loadingText="Saving..." onClick={submit}>Save Adjustment</Button></HStack></VStack></PageContainer>
}
