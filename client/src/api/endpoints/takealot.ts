import { apiEventStream, apiRequest, apiRequestWithMeta, type ApiPagination } from '../client'

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

export type TakealotBreakdownGroup = 'promotion' | 'saleStatus' | 'dc' | 'customerDc' | 'stockSourceRegion'

export interface TakealotBreakdown {
  groupBy: TakealotBreakdownGroup
  breakdown: TakealotBreakdownPoint[]
  revenueDefinition: string
}

export interface TakealotProduct {
  sku?: string
  tsin?: number
  title?: string
  imageUrl: string | null
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
  image_url?: string | null
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
  image_url?: string | null
  quantity?: number
  selling_price?: number
  sale_status?: string | boolean
  dc?: string
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
  analytics: {
    trend: Array<{ date: string; revenue: number; units: number }>
    statusCounts: Array<{ name: string; value: number }>
  }
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

export const TAKEALOT_TRANSACTION_TYPES = [
  'charge-subscription-fee',
  'charge-fulfilment-fee',
  'charge-storage-fee',
  'charge-success-fee',
  'reversal-success-fee',
  'payment-customer-order',
  'reversal-customer-order',
  'disbursement-disbursement',
  'reversal-disbursement',
  'payment-eft-payment',
  'charge-manual',
  'disbursement-manual',
  'reversal-manual',
  'payment-manual',
  'payment-debit-order',
  'reversal-debit-order',
  'payment-storage-fee-rebate',
  'reversal-storage-fee-rebate-reversal',
  'charge-order-cancellation-penalty',
  'charge-courier-collection-fee',
  'charge-removal-order',
  'charge-stock-transfer-fee',
  'charge-ad-credit-purchase',
  'reversal-fulfilment-fee',
  'reversal-courier-collection-fee',
  'reversal-removal-order-fee-reversal',
  'payment-stock-loss-payment',
  'reversal-stock-loss-reversal',
  'charge-stock-loss-success-fee',
  'reversal-stock-loss-success-fee-reversal',
  'charge-stock-loss-fulfilment-fee',
  'reversal-stock-loss-fulfilment-fee-reversal',
  'payment-return-dispute-payment',
  'charge-removal-order-fee',
  'charge-takealot-removal-order-fee',
  'charge-returns-removal-order-fee',
  'funding-repayment-funding-repayment-seller-capital',
] as const

export type TakealotTransactionType = (typeof TAKEALOT_TRANSACTION_TYPES)[number]

const parseTransactionType = (value: unknown): TakealotTransactionType => {
  const type = requireString(value, 'transaction type')
  const match = TAKEALOT_TRANSACTION_TYPES.find((candidate) => candidate === type)
  if (!match) throw new Error('Takealot returned an unsupported transaction type.')
  return match
}

export interface TakealotTransaction {
  transaction_id: number
  transaction_type: TakealotTransactionType
  amount_incl_vat: number
  vat_multiplier: number
  created_at: string
  references?: Record<string, unknown>
}

export interface TakealotTransactionsReport {
  transactions: TakealotTransaction[]
  summary: {
    count: number
    inflow: number
    outflow: number
    net: number
    averageTransaction: number
    byType: Array<{ type: TakealotTransactionType; count: number; amount: number; inflow: number; outflow: number }>
    trend: Array<{ date: string; inflow: number; outflow: number; net: number; count: number }>
  }
  balance: { current: number; available: number; held_back: number }
  balanceRetrievedAt: string
  availableTypes: TakealotTransactionType[]
  currency: string
  timeZone: string
  reportedCount: number | null
  definitions: { inflow: string; outflow: string; net: string; balance: string }
  pagination: ApiPagination
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
  sortBy?: TakealotProductSortBy
  order?: 'asc' | 'desc'
  orderId?: number
}

export type TakealotProductSortBy =
  'revenue' | 'units' | 'orders' | 'averagePrice' | 'title' | 'totalFee' | 'totalCost' | 'profit'

export type TakealotOrderSortBy = 'orderId' | 'date' | 'title' | 'quantity' | 'price' | 'status' | 'dc'

export interface TakealotOrderFilters extends TakealotDateFilters {
  page?: number
  limit?: number
  orderId?: number
  sortBy?: TakealotOrderSortBy
  sortOrder?: 'asc' | 'desc'
}

export interface TakealotPageInfo {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore?: boolean
}

export interface TakealotDashboardOverview {
  totalOffers: number
  listingStatusCounts: {
    buyable: number
    notBuyable: number
    disabledByTakealot: number
    disabledBySeller: number
    other: number
  }
  totalStock: number
  totalIncomingStock: number
  inventoryCostValue: number
  potentialRetailInventoryValue: number
  potentialGrossProfit: number
  potentialGrossMarginPercent: number | null
  outOfStockOffers: number
  lowStockOffers: number
  excessStockOffers: number
  missingCostOffers: number
  missingRrpOffers: number
  stockByWarehouse: Record<string, number>
  incomingByWarehouse: Record<string, number>
  lastSuccessfulSyncAt: string | null
  isStale: boolean
  currency: string
  financialNote: string
}

export interface TakealotOffer {
  offerId: string
  title: string | null
  sku: string | null
  status: string | null
  imageUrl: string | null
  offerUrl: string | null
  sellingPrice: number | null
  rrp: number | null
  costPrice: number | null
  stockCpt: number | null
  stockJhb: number | null
  stockDbn: number | null
  stockOnWayCpt: number | null
  stockOnWayJhb: number | null
  stockOnWayDbn: number | null
  totalExcessStock: number | null
  totalStock: number
  totalIncomingStock: number
  potentialGrossProfitPerUnit: number | null
  grossMarginPercent: number | null
  lastSyncedAt: string | null
}

export type TakealotOfferSortBy =
  | 'title'
  | 'sku'
  | 'status'
  | 'sellingPrice'
  | 'costPrice'
  | 'stockCpt'
  | 'stockJhb'
  | 'stockDbn'
  | 'potentialGrossProfitPerUnit'
  | 'totalStock'

export interface TakealotOffersResult {
  items: TakealotOffer[]
  pagination: TakealotPageInfo
  summary: TakealotOfferAccountSummary
  lastSuccessfulSyncAt: string | null
}

export interface TakealotOfferAccountSummary {
  totalOffers: number
  positiveProfitOffers: number
  negativeProfitOffers: number
  breakEvenOffers: number
  unavailableProfitOffers: number
  stockByWarehouse: {
    capeTown: number
    johannesburg: number
    durban: number
  }
  potentialRetailValue: number
  inventoryCostValue: number
  potentialGrossProfitOnCurrentStock: number
}

export interface TakealotInventoryWarehouse {
  warehouse: string
  stockUnits: number
  incomingUnits: number
  inventoryCostValue: number
  potentialRetailValue: number
  potentialGrossProfit: number
  outOfStockOffers: number
  lowStockOffers: number
  excessStockOffers: number
  shareOfInventoryPercent: number
  reportedSalesUnits?: number
}

export interface TakealotInventoryAnalytics {
  warehouses: TakealotInventoryWarehouse[]
  stockVsIncoming?: Array<{ warehouse: string; stockUnits: number; incomingUnits: number }>
  currency: string
  financialNote: string
}

export type TakealotWarehouseSortBy =
  | 'warehouse'
  | 'stockUnits'
  | 'incomingUnits'
  | 'inventoryCostValue'
  | 'potentialRetailValue'
  | 'potentialGrossProfit'
  | 'outOfStockOffers'
  | 'lowStockOffers'
  | 'excessStockOffers'
  | 'shareOfInventoryPercent'
  | 'reportedSalesUnits'

export type TakealotTopOfferSortBy =
  | 'offerId'
  | 'title'
  | 'sku'
  | 'sellingPrice'
  | 'rrp'
  | 'costPrice'
  | 'potentialGrossProfitPerUnit'
  | 'grossMarginPercent'
  | 'reportedSalesUnits'

export interface TakealotPricingSalesAnalytics {
  reportedSalesUnitsByWarehouse: Array<{ warehouse: string; units: number }>
  topOffersByReportedSales: Array<{
    offerId: string
    title: string | null
    imageUrl: string | null
    sku: string | null
    sellingPrice: number | null
    rrp: number | null
    costPrice: number | null
    potentialGrossProfitPerUnit: number | null
    grossMarginPercent: number | null
    reportedSalesUnits: number
  }>
  pricing: {
    missingCostOffers: number
    missingRrpOffers: number
    sellingBelowCostOffers: number
    positivePotentialMarginOffers: number
    negativePotentialMarginOffers: number
    zeroPotentialMarginOffers: number
  }
  salesSemantics: string
  currency: string
}

export interface TakealotAlert {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
  title: string | null
  sku: string | null
  offerId: string
  imageUrl: string | null
  offerUrl: string | null
  warehouse: string | null
  quantity: number | null
  sellingPrice: number | null
  costPrice: number | null
}

export type TakealotAlertSortBy =
  'severity' | 'type' | 'title' | 'sku' | 'warehouse' | 'quantity' | 'sellingPrice' | 'costPrice'

export interface TakealotAlertsResult {
  items: TakealotAlert[]
  pagination: TakealotPageInfo
  summary: {
    total: number
    critical: number
    high: number
    medium: number
    low: number
  }
  lastSuccessfulSyncAt: string | null
  isStale: boolean
}

export interface TakealotSyncStatus {
  status: 'IDLE' | 'QUEUED' | 'RUNNING' | 'CANCEL_REQUESTED' | 'CANCELLED' | 'SUCCEEDED' | 'FAILED'
  jobId: string | null
  startedAt: string | null
  completedAt: string | null
  lastSuccessfulSyncAt: string | null
  pagesProcessed: number
  totalPages: number
  offersProcessed: number
  missingCostCount: number
  errorMessage: string | null
  isStale: boolean
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
  )
    throw new Error('Takealot returned invalid pagination metadata.')
  return value
}

function query(filters: object) {
  const params = new URLSearchParams()
  Object.entries(filters as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString() ? `?${params.toString()}` : ''
}

const integrationPath = (integrationId: string, path: string) =>
  `/integrations/${encodeURIComponent(integrationId)}/takealot${path}`

function assertOverview(value: TakealotOverview): TakealotOverview {
  const summary = requireRecord(value.salesSummary, 'overview summary')
  if (
    !Array.isArray(summary.periods) ||
    !summary.periods.every((period: unknown) => {
      if (!record(period)) return false
      return (
        typeof period.date_range === 'string' &&
        typeof period.total === 'number' &&
        Number.isFinite(period.total) &&
        typeof period.quantity === 'number' &&
        Number.isFinite(period.quantity)
      )
    })
  )
    throw new Error('Takealot returned invalid overview sales periods.')
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

function assertProducts(value: {
  data: { products: TakealotProduct[]; summary: TakealotProductSummary }
  pagination?: ApiPagination
}): TakealotProducts {
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

function assertOrders(value: {
  data: {
    orders: TakealotOrderRecord[]
    analytics: TakealotOrders['analytics']
  }
  pagination?: ApiPagination
}): TakealotOrders {
  const response = requireRecord(value.data, 'orders')
  if (!Array.isArray(response.orders)) throw new Error('Takealot returned invalid orders.')
  response.orders.forEach((order: unknown) => {
    const row = requireRecord(order, 'order')
    requireNumber(row.order_id, 'order identifier')
    if (Array.isArray(row.order_items)) {
      requireString(row.date_authed, 'order date')
      row.order_items.forEach((item: unknown) => {
        const orderItem = requireRecord(item, 'order item')
        if (orderItem.quantity !== undefined) requireNumber(orderItem.quantity, 'order item quantity')
        if (orderItem.selling_price !== undefined) requireNumber(orderItem.selling_price, 'order item selling price')
        if (
          orderItem.sale_status !== undefined &&
          typeof orderItem.sale_status !== 'string' &&
          typeof orderItem.sale_status !== 'boolean'
        ) {
          throw new Error('Takealot returned an invalid order item status.')
        }
        if (orderItem.dc !== undefined) requireString(orderItem.dc, 'order item distribution center')
      })
    } else {
      requireNumber(row.order_item_id, 'order item identifier')
      requireNumber(row.quantity, 'order item quantity')
      requireNumber(row.selling_price, 'order item selling price')
      requireString(row.order_date, 'order item date')
    }
  })
  const analytics = requireRecord(response.analytics, 'order analytics')
  if (!Array.isArray(analytics.trend) || !Array.isArray(analytics.statusCounts)) {
    throw new Error('Takealot returned invalid order analytics.')
  }
  const trend = analytics.trend.map((entry: unknown) => {
    const point = requireRecord(entry, 'order trend point')
    return {
      date: requireString(point.date, 'order trend date'),
      revenue: requireNumber(point.revenue, 'order trend revenue'),
      units: requireNumber(point.units, 'order trend units'),
    }
  })
  const statusCounts = analytics.statusCounts.map((entry: unknown) => {
    const status = requireRecord(entry, 'order status count')
    return {
      name: requireString(status.name, 'order status'),
      value: requireNumber(status.value, 'order status count'),
    }
  })
  return {
    orders: response.orders as TakealotOrderRecord[],
    pagination: requirePagination(value.pagination),
    analytics: { trend, statusCounts },
  }
}

export function getTakealotOverview(integrationId: string, signal?: AbortSignal) {
  return apiRequest<TakealotOverview>(integrationPath(integrationId, '/overview'), { signal }).then(assertOverview)
}

export function getTakealotTrends(integrationId: string, filters: TakealotDateFilters, signal?: AbortSignal) {
  const params = { ...filters, metric: 'revenue' }
  return apiRequest<TakealotTrends>(integrationPath(integrationId, `/sales/trends${query(params)}`), { signal }).then(
    assertTrends,
  )
}

export function getTakealotBreakdown(
  integrationId: string,
  filters: Pick<TakealotDateFilters, 'from' | 'to'>,
  groupBy: TakealotBreakdownGroup,
  signal?: AbortSignal,
) {
  return apiRequest<TakealotBreakdown>(
    integrationPath(integrationId, `/sales/breakdown${query({ ...filters, groupBy })}`),
    { signal },
  ).then(assertBreakdown)
}

export async function getTakealotProducts(integrationId: string, filters: TakealotPageFilters, signal?: AbortSignal) {
  const response = await apiRequestWithMeta<{
    products: TakealotProduct[]
    summary: TakealotProductSummary
    revenueDefinition: string
  }>(
    integrationPath(
      integrationId,
      `/products/performance${query({
        ...filters,
        page: filters.page ?? 1,
        limit: filters.limit ?? 10,
        sortBy: filters.sortBy ?? 'revenue',
        order: filters.order ?? 'desc',
      })}`,
    ),
    { signal },
  )
  return assertProducts(response)
}

export async function getTakealotOrders(integrationId: string, filters: TakealotOrderFilters, signal?: AbortSignal) {
  const response = await apiRequestWithMeta<{
    orders: TakealotOrderRecord[]
    analytics: TakealotOrders['analytics']
  }>(
    integrationPath(
      integrationId,
      `/orders${query({
        from: filters.from,
        to: filters.to,
        sku: filters.sku,
        productTitle: filters.productTitle,
        tsin: filters.tsin,
        orderId: filters.orderId,
        page: filters.page ?? 1,
        limit: filters.limit ?? 10,
        sortBy: filters.sortBy ?? 'date',
        sortOrder: filters.sortOrder ?? 'desc',
      })}`,
    ),
    { signal },
  )
  return assertOrders(response)
}

export function getTakealotInventorySummary(integrationId: string, signal?: AbortSignal) {
  return apiRequest<TakealotInventorySummary>(integrationPath(integrationId, '/inventory/summary'), { signal })
}

export function getTakealotInventoryHistory(integrationId: string, filters: TakealotDateFilters, signal?: AbortSignal) {
  return apiRequest<TakealotInventoryHistory>(
    integrationPath(
      integrationId,
      `/inventory/snapshots${query({
        from: filters.from,
        to: filters.to,
        interval: filters.interval ?? 'day',
      })}`,
    ),
    { signal },
  )
}

export function getTakealotDashboardOverview(integrationId: string, signal?: AbortSignal) {
  return apiRequest<TakealotDashboardOverview>(integrationPath(integrationId, '/dashboard/overview'), { signal })
}

export function getTakealotOffers(
  integrationId: string,
  filters: {
    page: number
    pageSize: number
    search?: string
    warehouse?: 'CPT' | 'JHB' | 'DBN' | 'ALL'
    stockState?: 'in_stock' | 'out_of_stock' | 'low_stock' | 'all'
    costState?: 'known' | 'missing'
    marginState?: 'positive' | 'negative' | 'zero' | 'all'
    sortBy?: TakealotOfferSortBy
    sortOrder?: 'asc' | 'desc'
  },
  signal?: AbortSignal,
): Promise<TakealotOffersResult> {
  return apiRequestWithMeta<{
    items: TakealotOffersResult['items']
    summary: TakealotOfferAccountSummary
    lastSuccessfulSyncAt: string | null
  }>(integrationPath(integrationId, `/offers${query(filters)}`), { signal }).then((response) => {
    if (!response.pagination) throw new Error('Takealot returned invalid offer pagination metadata.')
    const summary = response.data.summary
    const summaryValues = summary
      ? [
          summary.totalOffers,
          summary.positiveProfitOffers,
          summary.negativeProfitOffers,
          summary.breakEvenOffers,
          summary.unavailableProfitOffers,
          summary.stockByWarehouse?.capeTown,
          summary.stockByWarehouse?.johannesburg,
          summary.stockByWarehouse?.durban,
          summary.potentialRetailValue,
          summary.inventoryCostValue,
          summary.potentialGrossProfitOnCurrentStock,
        ]
      : []
    if (
      !summary ||
      summaryValues.some((value) => typeof value !== 'number' || !Number.isFinite(value)) ||
      [
        summary.totalOffers,
        summary.positiveProfitOffers,
        summary.negativeProfitOffers,
        summary.breakEvenOffers,
        summary.unavailableProfitOffers,
      ].some((value) => !Number.isInteger(value) || value < 0) ||
      summary.totalOffers !==
        summary.positiveProfitOffers +
          summary.negativeProfitOffers +
          summary.breakEvenOffers +
          summary.unavailableProfitOffers
    ) {
      throw new Error('Takealot returned an invalid account-wide offer summary.')
    }
    return {
      ...response.data,
      pagination: {
        page: response.pagination.page,
        pageSize: filters.pageSize,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
        hasMore: response.pagination.hasMore,
      },
    }
  })
}

export function getTakealotInventoryAnalytics(
  integrationId: string,
  filters: { sortBy: TakealotWarehouseSortBy; sortOrder: 'asc' | 'desc' },
  signal?: AbortSignal,
) {
  return apiRequest<TakealotInventoryAnalytics>(
    integrationPath(integrationId, `/analytics/warehouses${query(filters)}`),
    { signal },
  )
}

export function getTakealotTransactions(
  integrationId: string,
  filters: {
    from: string
    to: string
    types?: TakealotTransactionType[]
    search?: string
    page: number
    limit: number
    sortBy: 'createdAt' | 'transactionType' | 'amount' | 'transactionId'
    sortOrder: 'asc' | 'desc'
  },
  signal?: AbortSignal,
): Promise<TakealotTransactionsReport> {
  const params = new URLSearchParams()
  params.set('from', filters.from)
  params.set('to', filters.to)
  params.set('page', String(filters.page))
  params.set('limit', String(filters.limit))
  params.set('sortBy', filters.sortBy)
  params.set('sortOrder', filters.sortOrder)
  if (filters.search) params.set('search', filters.search)
  filters.types?.forEach((type) => params.append('types', type))
  return apiRequestWithMeta<Omit<TakealotTransactionsReport, 'pagination'>>(
    integrationPath(integrationId, `/transactions?${params.toString()}`),
    { signal },
  ).then((response) => {
    const data = requireRecord(response.data, 'transactions report')
    if (!Array.isArray(data.transactions) || !Array.isArray(data.availableTypes)) {
      throw new Error('Takealot returned invalid transaction data.')
    }
    const transactions = data.transactions.map((item: unknown) => {
      const row = requireRecord(item, 'transaction')
      const transaction: TakealotTransaction = {
        transaction_id: requireNumber(row.transaction_id, 'transaction ID'),
        transaction_type: parseTransactionType(row.transaction_type),
        amount_incl_vat: requireNumber(row.amount_incl_vat, 'transaction amount'),
        vat_multiplier: requireNumber(row.vat_multiplier, 'transaction VAT multiplier'),
        created_at: requireString(row.created_at, 'transaction date'),
      }
      if (!Number.isFinite(Date.parse(transaction.created_at))) {
        throw new Error('Takealot returned an invalid transaction date.')
      }
      if (row.references !== undefined) {
        transaction.references = requireRecord(row.references, 'transaction references')
      }
      return transaction
    })
    const summary = requireRecord(data.summary, 'transaction summary')
    const byType = summary.byType
    const trend = summary.trend
    if (!Array.isArray(byType) || !Array.isArray(trend)) {
      throw new Error('Takealot returned invalid transaction analytics.')
    }
    const summaryData = {
      count: requireNumber(summary.count, 'transaction summary count'),
      inflow: requireNumber(summary.inflow, 'transaction inflow'),
      outflow: requireNumber(summary.outflow, 'transaction outflow'),
      net: requireNumber(summary.net, 'transaction net movement'),
      averageTransaction: requireNumber(summary.averageTransaction, 'average transaction'),
      byType: byType.map((item: unknown) => {
        const row = requireRecord(item, 'transaction type summary')
        return {
          type: parseTransactionType(row.type),
          count: requireNumber(row.count, 'transaction count'),
          amount: requireNumber(row.amount, 'transaction type amount'),
          inflow: requireNumber(row.inflow, 'transaction type inflow'),
          outflow: requireNumber(row.outflow, 'transaction type outflow'),
        }
      }),
      trend: trend.map((item: unknown) => {
        const row = requireRecord(item, 'daily transaction summary')
        return {
          date: requireString(row.date, 'transaction trend date'),
          inflow: requireNumber(row.inflow, 'daily inflow'),
          outflow: requireNumber(row.outflow, 'daily outflow'),
          net: requireNumber(row.net, 'daily net movement'),
          count: requireNumber(row.count, 'daily transaction count'),
        }
      }),
    }
    const balance = requireRecord(data.balance, 'balance')
    const balanceData = {
      current: requireNumber(balance.current, 'balance current'),
      available: requireNumber(balance.available, 'balance available'),
      held_back: requireNumber(balance.held_back, 'balance held back'),
    }
    if (!response.pagination) throw new Error('Takealot returned invalid transaction pagination metadata.')
    const definitions = requireRecord(data.definitions, 'transaction definitions')
    const reportedCount =
      data.reportedCount === null ? null : requireNumber(data.reportedCount, 'reported transaction count')
    return {
      transactions,
      summary: summaryData,
      balance: balanceData,
      balanceRetrievedAt: requireString(data.balanceRetrievedAt, 'balance retrieval date'),
      availableTypes: data.availableTypes.map((type: unknown) => parseTransactionType(type)),
      currency: requireString(data.currency, 'transaction currency'),
      timeZone: requireString(data.timeZone, 'transaction time zone'),
      reportedCount,
      definitions: {
        inflow: requireString(definitions.inflow, 'inflow definition'),
        outflow: requireString(definitions.outflow, 'outflow definition'),
        net: requireString(definitions.net, 'net definition'),
        balance: requireString(definitions.balance, 'balance definition'),
      },
      pagination: {
        page: response.pagination.page,
        limit: filters.limit,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
        hasMore: response.pagination.hasMore,
      },
    }
  })
}

export function getTakealotPricingSalesAnalytics(
  integrationId: string,
  filters: { sortBy: TakealotTopOfferSortBy; sortOrder: 'asc' | 'desc' },
  signal?: AbortSignal,
) {
  return apiRequest<TakealotPricingSalesAnalytics>(
    integrationPath(integrationId, `/analytics/pricing-sales${query(filters)}`),
    { signal },
  )
}

export function getTakealotAlerts(
  integrationId: string,
  filters: {
    page: number
    pageSize: number
    type?: string
    severity?: 'critical' | 'high' | 'medium' | 'low'
    warehouse?: 'CPT' | 'JHB' | 'DBN' | 'ALL'
    sortBy?: TakealotAlertSortBy
    sortOrder?: 'asc' | 'desc'
  },
  signal?: AbortSignal,
): Promise<TakealotAlertsResult> {
  return apiRequestWithMeta<{
    items: TakealotAlertsResult['items']
    summary: TakealotAlertsResult['summary']
    lastSuccessfulSyncAt: string | null
    isStale: boolean
  }>(integrationPath(integrationId, `/alerts${query(filters)}`), { signal }).then((response) => {
    if (!response.pagination) throw new Error('Takealot returned invalid alert pagination metadata.')
    if (
      !response.data.summary ||
      ![
        response.data.summary.total,
        response.data.summary.critical,
        response.data.summary.high,
        response.data.summary.medium,
        response.data.summary.low,
      ].every((count) => Number.isInteger(count) && count >= 0)
    ) {
      throw new Error('Takealot returned invalid alert severity summary.')
    }
    return {
      ...response.data,
      pagination: {
        page: response.pagination.page,
        pageSize: filters.pageSize,
        total: response.pagination.total,
        totalPages: response.pagination.totalPages,
        hasMore: response.pagination.hasMore,
      },
    }
  })
}

export function getTakealotSyncStatus(integrationId: string, signal?: AbortSignal) {
  return apiRequest<TakealotSyncStatus>(integrationPath(integrationId, '/sync-status'), { signal })
}

export function triggerTakealotSync(integrationId: string) {
  return apiRequest<{ jobId: string | null; status: TakealotSyncStatus['status'] }>(
    integrationPath(integrationId, '/sync'),
    { method: 'POST' },
  )
}

export function stopTakealotSync(integrationId: string) {
  return apiRequest<{ status: TakealotSyncStatus['status'] }>(integrationPath(integrationId, '/sync/stop'), {
    method: 'POST',
  })
}

export function streamTakealotSync(
  integrationId: string,
  onStatus: (status: TakealotSyncStatus) => void,
  signal?: AbortSignal,
) {
  return apiEventStream(integrationPath(integrationId, '/sync-events'), 'sync-status', onStatus, signal)
}
