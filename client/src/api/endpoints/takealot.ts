import { apiRequest, apiRequestWithMeta, type ApiPagination } from '../client'

export interface TakealotSummaryPeriod {
  date_range: string
  total: number
  quantity: number
}

export interface TakealotOverview {
  salesSummary: {
    periods: TakealotSummaryPeriod[]
    requestedRange: { from: string; to: string } | null
    requestedRangeApplied: false
    limitation: string
  }
  inventory: {
    stockCounts: Record<string, unknown>
    stockHealth: Record<string, unknown>
  }
}

export interface TakealotTrendPoint {
  date: string
  revenue: number
  totalFee: number | null
  units: number
  orders: number
}

export interface TakealotTrends {
  interval: 'day' | 'week' | 'month'
  metric: 'revenue' | 'units' | 'orders'
  series: TakealotTrendPoint[]
  revenueDefinition: string
}

export interface TakealotBreakdownPoint {
  key: string
  revenue: number
  units: number
  orders: number
}

export type TakealotBreakdownGroup =
  | 'promotion'
  | 'saleStatus'
  | 'dc'
  | 'customerDc'
  | 'stockSourceRegion'

export interface TakealotBreakdown {
  groupBy: TakealotBreakdownGroup
  breakdown: TakealotBreakdownPoint[]
  revenueDefinition: string
}

export interface TakealotProduct {
  sku?: string
  tsin?: number
  title?: string
  unitCost: number | null
  totalCost: number | null
  costedUnits: number
  uncostedUnits: number
  totalFee: number | null
  feePerUnit: number | null
  profit: number | null
  profitPerUnit: number | null
  revenue: number
  units: number
  orders: number
  averagePrice: number
}

export interface TakealotProductSummary {
  revenue: number
  averagePrice: number
  units: number
  orders: number
  totalFee: number | null
  feePerUnit: number | null
  totalCost: number | null
  costedUnits: number
  uncostedUnits: number
  profit: number | null
  profitPerUnit: number | null
  unitsPerOrder: number
}

export interface TakealotProducts {
  products: TakealotProduct[]
  pagination: ApiPagination
  summary: TakealotProductSummary
  revenueDefinition: string
}

export interface TakealotSale {
  shipment_id?: number
  shipment_state_id?: number
  po_number?: number
  shipment_name?: string
  offer_id?: number
  product_title?: string
  takealot_url_mobi?: string
  sku?: string
  tsin?: number
  order_id: number
  order_item_id: number
  quantity: number
  selling_price: number
  dc?: string
  customer_dc?: string
  order_date: string
  sale_status: string | boolean
  promotion?: boolean
  stock_source_region?: string
}

export interface TakealotOrderItem {
  order_item_id?: number
  merchant_sku?: string
  title?: string
  tsin_id?: number
  takealot_url?: string
}

export interface TakealotOrder {
  order_id: number
  date_authed: string
  order_items: TakealotOrderItem[]
}

export type TakealotOrderRecord = TakealotSale | TakealotOrder

export interface TakealotOrders {
  orders: TakealotOrderRecord[]
  pagination: ApiPagination
}

export interface TakealotInventorySnapshot {
  capturedAt: string
  stockCounts: Record<string, unknown>
  stockHealth: Record<string, unknown>
}

export interface TakealotInventorySummary {
  stockCounts: Record<string, unknown>
  stockHealth: Record<string, unknown>
  capturedAt: string
}

export interface TakealotInventoryHistory {
  interval: 'day' | 'week' | 'month'
  series: Array<TakealotInventorySnapshot & { date: string }>
}

export interface TakealotDateFilters {
  from: string
  to: string
  interval?: 'day' | 'week' | 'month'
  sku?: string
  productTitle?: string
  tsin?: number
}

export interface TakealotPageFilters extends TakealotDateFilters {
  page?: number
  limit?: number
  sortBy?: 'revenue' | 'units' | 'orders' | 'averagePrice'
  order?: 'asc' | 'desc'
  orderId?: number
}

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!record(value)) throw new Error(`Takealot returned an invalid ${label} response.`)
  return value
}

const requireNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Takealot returned an invalid ${label} value.`)
  }
  return value
}

const requireNullableNumber = (value: unknown, label: string): number | null => {
  if (value === null) return null
  return requireNumber(value, label)
}

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== 'string') throw new Error(`Takealot returned an invalid ${label} value.`)
  return value
}

const requirePagination = (value: ApiPagination | undefined): ApiPagination => {
  if (
    !value ||
    !Number.isInteger(value.page) ||
    !Number.isInteger(value.limit) ||
    !Number.isInteger(value.total) ||
    !Number.isInteger(value.totalPages)
  ) throw new Error('Takealot returned invalid pagination metadata.')
  return value
}

function query(filters: object) {
  const params = new URLSearchParams()
  Object.entries(filters as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString() ? `?${params.toString()}` : ''
}

function assertOverview(value: TakealotOverview): TakealotOverview {
  const summary = requireRecord(value.salesSummary, 'overview summary')
  if (
    !Array.isArray(summary.periods) ||
    !summary.periods.every((period: unknown) => {
      if (!record(period)) return false
      return typeof period.date_range === 'string' &&
        typeof period.total === 'number' && Number.isFinite(period.total) &&
        typeof period.quantity === 'number' && Number.isFinite(period.quantity)
    })
  ) throw new Error('Takealot returned invalid overview sales periods.')
  const inventory = requireRecord(value.inventory, 'overview inventory')
  requireRecord(inventory.stockCounts, 'stock counts')
  requireRecord(inventory.stockHealth, 'stock health')
  return value
}

function assertTrends(value: TakealotTrends): TakealotTrends {
  const response = requireRecord(value, 'sales trends')
  if (!Array.isArray(response.series)) throw new Error('Takealot returned invalid sales trend data.')
  response.series.forEach((point: unknown) => {
    const row = requireRecord(point, 'sales trend point')
    requireString(row.date, 'trend date')
    requireNumber(row.revenue, 'trend sales value')
    requireNullableNumber(row.totalFee, 'trend total fee')
    requireNumber(row.units, 'trend units')
    requireNumber(row.orders, 'trend orders')
  })
  return value
}

function assertBreakdown(value: TakealotBreakdown): TakealotBreakdown {
  const response = requireRecord(value, 'sales breakdown')
  if (!Array.isArray(response.breakdown)) throw new Error('Takealot returned invalid sales breakdown data.')
  response.breakdown.forEach((point: unknown) => {
    const row = requireRecord(point, 'sales breakdown point')
    requireString(row.key, 'breakdown key')
    requireNumber(row.revenue, 'breakdown sales value')
    requireNumber(row.units, 'breakdown units')
    requireNumber(row.orders, 'breakdown orders')
  })
  return value
}

function assertProducts(value: { data: { products: TakealotProduct[]; summary: TakealotProductSummary }; pagination?: ApiPagination }): TakealotProducts {
  const response = requireRecord(value.data, 'product performance')
  if (!Array.isArray(response.products)) throw new Error('Takealot returned invalid product data.')
  response.products.forEach((product: unknown) => {
    const row = requireRecord(product, 'product')
    requireNumber(row.revenue, 'product sales value')
    requireNumber(row.units, 'product units')
    requireNumber(row.orders, 'product orders')
    requireNumber(row.averagePrice, 'product average selling price')
    requireNullableNumber(row.unitCost, 'product unit cost')
    requireNullableNumber(row.totalCost, 'product total cost')
    requireNumber(row.costedUnits, 'product costed units')
    requireNumber(row.uncostedUnits, 'product uncosted units')
    requireNullableNumber(row.totalFee, 'product total fee')
    requireNullableNumber(row.feePerUnit, 'product fee per unit')
    requireNullableNumber(row.profit, 'product profit/loss')
    requireNullableNumber(row.profitPerUnit, 'product profit/loss per unit')
  })
  const summary = requireRecord(response.summary, 'product summary')
  requireNumber(summary.revenue, 'summary sales value')
  requireNumber(summary.averagePrice, 'summary average product price')
  requireNumber(summary.units, 'summary units')
  requireNumber(summary.orders, 'summary orders')
  requireNullableNumber(summary.totalFee, 'summary total fee')
  requireNullableNumber(summary.feePerUnit, 'summary fee per unit')
  requireNullableNumber(summary.totalCost, 'summary total product cost')
  requireNumber(summary.costedUnits, 'summary costed units')
  requireNumber(summary.uncostedUnits, 'summary uncosted units')
  requireNullableNumber(summary.profit, 'summary profit/loss')
  requireNullableNumber(summary.profitPerUnit, 'summary profit/loss per unit')
  requireNumber(summary.unitsPerOrder, 'summary units per order')
  return {
    products: response.products as TakealotProduct[],
    pagination: requirePagination(value.pagination),
    summary: response.summary as TakealotProductSummary,
    revenueDefinition: requireString(response.revenueDefinition, 'revenue definition'),
  }
}

function assertOrders(value: { data: { orders: TakealotOrderRecord[] }; pagination?: ApiPagination }): TakealotOrders {
  const response = requireRecord(value.data, 'orders')
  if (!Array.isArray(response.orders)) throw new Error('Takealot returned invalid orders.')
  response.orders.forEach((order: unknown) => {
    const row = requireRecord(order, 'order')
    requireNumber(row.order_id, 'order identifier')
    if (Array.isArray(row.order_items)) {
      requireString(row.date_authed, 'order date')
      row.order_items.forEach((item: unknown) => requireRecord(item, 'order item'))
    } else {
      requireNumber(row.order_item_id, 'order item identifier')
      requireNumber(row.quantity, 'order item quantity')
      requireNumber(row.selling_price, 'order item selling price')
      requireString(row.order_date, 'order item date')
    }
  })
  return { orders: response.orders as TakealotOrderRecord[], pagination: requirePagination(value.pagination) }
}

export function getTakealotOverview(signal?: AbortSignal) {
  return apiRequest<TakealotOverview>('/takealot/overview', { signal }).then(assertOverview)
}

export function getTakealotTrends(filters: TakealotDateFilters, signal?: AbortSignal) {
  const params = { ...filters, metric: 'revenue' }
  return apiRequest<TakealotTrends>(`/takealot/sales/trends${query(params)}`, { signal }).then(assertTrends)
}

export function getTakealotBreakdown(
  filters: Pick<TakealotDateFilters, 'from' | 'to'>,
  groupBy: TakealotBreakdownGroup,
  signal?: AbortSignal,
) {
  return apiRequest<TakealotBreakdown>(
    `/takealot/sales/breakdown${query({ ...filters, groupBy })}`,
    { signal },
  ).then(assertBreakdown)
}

export async function getTakealotProducts(filters: TakealotPageFilters, signal?: AbortSignal) {
  const response = await apiRequestWithMeta<{ products: TakealotProduct[]; summary: TakealotProductSummary; revenueDefinition: string }>(
    `/takealot/products/performance${query({
      ...filters,
      page: filters.page ?? 1,
      limit: filters.limit ?? 10,
      sortBy: filters.sortBy ?? 'revenue',
      order: filters.order ?? 'desc',
    })}`,
    { signal },
  )
  return assertProducts(response)
}

export async function getTakealotOrders(filters: TakealotPageFilters, signal?: AbortSignal) {
  const response = await apiRequestWithMeta<{ orders: TakealotOrderRecord[] }>(
    `/takealot/orders${query({
      from: filters.from,
      to: filters.to,
      sku: filters.sku,
      productTitle: filters.productTitle,
      tsin: filters.tsin,
      orderId: filters.orderId,
      page: filters.page ?? 1,
      limit: filters.limit ?? 10,
    })}`,
    { signal },
  )
  return assertOrders(response)
}

export function getTakealotInventorySummary(signal?: AbortSignal) {
  return apiRequest<TakealotInventorySummary>('/takealot/inventory/summary', { signal })
}

export function getTakealotInventoryHistory(filters: TakealotDateFilters, signal?: AbortSignal) {
  return apiRequest<TakealotInventoryHistory>(
    `/takealot/inventory/snapshots${query({
      from: filters.from,
      to: filters.to,
      interval: filters.interval ?? 'day',
    })}`,
    { signal },
  )
}
