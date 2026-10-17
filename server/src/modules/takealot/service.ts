import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '../../lib/prisma'
import { AppError, validationError } from '../../utils/errors'
import {
  takealotApi,
  type TakealotOrder,
  type TakealotOrderItem,
  type TakealotOrderRecord,
  type TakealotSale,
  type TakealotSalesFilters,
  type TakealotTransaction,
  type TakealotTransactionType,
  takealotTransactionTypes,
} from './takealot-api'

const pageSchema = z.coerce.number().int().min(1).default(1)
const limitSchema = z.coerce.number().int().min(1).max(100).default(20)
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Dates must be valid YYYY-MM-DD values')
const filterTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((value) => !/[;\r\n]/.test(value), 'Filter values cannot contain semicolons or line breaks')
  .optional()
const optionalBooleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()
const optionalIntegerSchema = z.coerce
  .number()
  .int()
  .positive()
  .refine(Number.isSafeInteger, 'Filter identifiers must be safe integers')
  .optional()
const rangeFields = {
  from: dateSchema.optional(),
  to: dateSchema.optional(),
}

const dateRangeIssue = (value: { from?: string; to?: string }, context: z.RefinementCtx, required = false) => {
  if (required && (!value.from || !value.to)) {
    context.addIssue({ code: 'custom', message: 'Both from and to dates are required' })
    return
  }
  if ((value.from && !value.to) || (!value.from && value.to)) {
    context.addIssue({ code: 'custom', message: 'Both from and to dates must be provided together' })
    return
  }
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: 'custom', message: 'from must be on or before to' })
  }
}

const filterFields = {
  sku: filterTextSchema,
  productTitle: filterTextSchema,
  tsin: optionalIntegerSchema,
  orderId: optionalIntegerSchema,
  dc: filterTextSchema,
  customerDc: filterTextSchema,
  saleStatus: filterTextSchema,
  promotion: optionalBooleanSchema,
}

export const overviewSchema = z
  .object(rangeFields)
  .strict()
  .superRefine((value, context) => dateRangeIssue(value, context))
export const salesListSchema = z
  .object({
    ...rangeFields,
    ...filterFields,
    page: pageSchema,
    limit: limitSchema,
  })
  .strict()
  .superRefine((value, context) => dateRangeIssue(value, context))
export const trendsSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    interval: z.enum(['day', 'week', 'month']).default('day'),
    metric: z.enum(['revenue', 'units', 'orders']).default('revenue'),
    sku: filterTextSchema,
    productTitle: filterTextSchema,
    tsin: optionalIntegerSchema,
  })
  .strict()
  .superRefine((value, context) => dateRangeIssue(value, context, true))
export const salesSummarySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    ...filterFields,
  })
  .strict()
  .superRefine((value, context) => dateRangeIssue(value, context, true))
export const breakdownSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    groupBy: z.enum(['promotion', 'saleStatus', 'dc', 'customerDc', 'stockSourceRegion']),
  })
  .strict()
  .superRefine((value, context) => dateRangeIssue(value, context, true))
export const productsSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    sortBy: z
      .enum(['revenue', 'units', 'orders', 'averagePrice', 'title', 'totalFee', 'totalCost', 'profit'])
      .default('revenue'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: pageSchema,
    limit: limitSchema,
    sku: filterTextSchema,
    productTitle: filterTextSchema,
    tsin: optionalIntegerSchema,
  })
  .strict()
  .superRefine((value, context) => dateRangeIssue(value, context, true))
export const ordersSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    sku: filterTextSchema,
    productTitle: filterTextSchema,
    tsin: optionalIntegerSchema,
    orderId: optionalIntegerSchema,
    page: pageSchema,
    limit: limitSchema,
    sortBy: z.enum(['orderId', 'date', 'title', 'quantity', 'price', 'status', 'dc']).default('date'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .superRefine((value, context) => dateRangeIssue(value, context, true))
export const inventorySnapshotsSchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    interval: z.enum(['day', 'week', 'month']).default('day'),
  })
  .strict()
  .superRefine((value, context) => dateRangeIssue(value, context, true))

const takealotTimezoneOffsetMs = 2 * 60 * 60 * 1000
const takealotToday = () => new Date(Date.now() + takealotTimezoneOffsetMs).toISOString().slice(0, 10)
const transactionDateSchema = dateSchema.refine((value) => value <= takealotToday(), {
  message: 'Transaction dates cannot be in the future',
})
export const transactionsSchema = z
  .object({
    from: transactionDateSchema,
    to: transactionDateSchema,
    types: z
      .union([
        z.array(z.enum(takealotTransactionTypes)).max(takealotTransactionTypes.length),
        z.enum(takealotTransactionTypes),
      ])
      .optional()
      .transform((value) => (value === undefined ? undefined : Array.isArray(value) ? value : [value])),
    search: z.string().trim().max(100).optional(),
    page: pageSchema,
    limit: limitSchema,
    sortBy: z.enum(['createdAt', 'transactionType', 'amount', 'transactionId']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .superRefine((value, context) => {
    dateRangeIssue(value, context, true)
    if (value.from && value.to) {
      const rangeInDays =
        (Date.parse(`${value.to}T00:00:00.000Z`) - Date.parse(`${value.from}T00:00:00.000Z`)) / 86_400_000
      if (Number.isFinite(rangeInDays) && rangeInDays > 180) {
        context.addIssue({ code: 'custom', path: ['to'], message: 'Transaction date ranges cannot exceed 180 days' })
      }
    }
  })

export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value)
  if (!result.success) throw validationError(result.error.issues[0]?.message ?? 'Invalid request')
  return result.data
}

const pageResult = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.ceil(total / limit),
  hasMore: page * limit < total,
})

const inFlightSales = new Map<string, Promise<TakealotSale[]>>()

const publicSale = (sale: TakealotSale) => ({
  shipment_id: sale.shipment_id,
  shipment_state_id: sale.shipment_state_id,
  po_number: sale.po_number,
  shipment_name: sale.shipment_name,
  offer_id: sale.offer_id,
  product_title: sale.product_title,
  image_url: sale.imageUrl ?? null,
  takealot_url_mobi: sale.takealot_url_mobi,
  sku: sale.sku,
  tsin: sale.tsin,
  order_id: sale.order_id,
  order_item_id: sale.order_item_id,
  quantity: sale.quantity,
  selling_price: sale.selling_price,
  dc: sale.dc,
  customer_dc: sale.customer_dc,
  order_date: sale.order_date,
  sale_status: sale.sale_status,
  promotion: sale.promotion,
  stock_source_region: sale.stock_source_region,
  success_fee: sale.success_fee,
  fulfillment_fee: sale.fulfillment_fee,
  courier_collection_fee: sale.courier_collection_fee,
  total_fee: sale.total_fee,
  stock_transfer_fee: sale.stock_transfer_fee,
})

const publicOrderItem = (item: TakealotOrderItem) => ({
  ...(item.order_item_id !== undefined && { order_item_id: item.order_item_id }),
  ...(item.merchant_sku !== undefined && { merchant_sku: item.merchant_sku }),
  ...(item.title !== undefined && { title: item.title }),
  ...(item.tsin_id !== undefined && { tsin_id: item.tsin_id }),
  ...(item.takealot_url !== undefined && { takealot_url: item.takealot_url }),
  ...(item.quantity !== undefined && { quantity: item.quantity }),
  ...(item.selling_price !== undefined && { selling_price: item.selling_price }),
  ...(item.sale_status !== undefined && { sale_status: item.sale_status }),
  ...(item.dc !== undefined && { dc: item.dc }),
  image_url: item.imageUrl ?? null,
})

const publicOrder = (order: TakealotOrder) => ({
  order_id: order.order_id,
  date_authed: order.date_authed,
  order_items: order.order_items.map(publicOrderItem),
})

const fetchAllSales = async (apiKey: string, filters: TakealotSalesFilters): Promise<TakealotSale[]> => {
  const pageSize = 100
  const firstPage = await takealotApi.getSales(apiKey, filters, 1, pageSize)
  const total = firstPage.page_summary.total
  const expectedPages = Math.ceil(total / pageSize)
  if (firstPage.page_summary.page_number !== 1 || firstPage.sales.length > total) {
    throw new AppError('Takealot returned inconsistent sales pagination.', 502, 'TAKEALOT_INCOMPLETE_RESPONSE')
  }

  const sales = [...firstPage.sales]
  for (let page = 2; page <= expectedPages; page++) {
    const result = await takealotApi.getSales(apiKey, filters, page, pageSize)
    if (result.page_summary.page_number !== page || result.page_summary.total !== total || result.sales.length === 0) {
      throw new AppError('Takealot returned incomplete sales pagination.', 502, 'TAKEALOT_INCOMPLETE_RESPONSE')
    }
    sales.push(...result.sales)
  }

  if (sales.length !== total) {
    throw new AppError('Takealot returned an incomplete sales result.', 502, 'TAKEALOT_INCOMPLETE_RESPONSE')
  }
  return sales
}

const fetchAllSalesForCompany = (
  companyId: string,
  apiKey: string,
  filters: TakealotSalesFilters,
): Promise<TakealotSale[]> => {
  const key = JSON.stringify({ companyId, filters })
  const pending = inFlightSales.get(key)
  if (pending) return pending

  const request = fetchAllSales(apiKey, filters).finally(() => {
    inFlightSales.delete(key)
  })
  inFlightSales.set(key, request)
  return request
}

const addDateFilters = (input: { from?: string; to?: string }): Pick<TakealotSalesFilters, 'from' | 'to'> => ({
  from: input.from,
  to: input.to,
})

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
const assertSaleMetrics = (sale: TakealotSale) => {
  if (
    !Number.isFinite(sale.selling_price) ||
    !Number.isFinite(sale.quantity) ||
    !Number.isFinite(sale.order_id) ||
    (sale.total_fee !== undefined && !Number.isFinite(sale.total_fee)) ||
    [sale.success_fee, sale.fulfillment_fee, sale.courier_collection_fee, sale.stock_transfer_fee].some(
      (fee) => fee !== undefined && !Number.isFinite(fee),
    )
  ) {
    throw new AppError(
      'Takealot returned sales without valid price, quantity, fee, or order identifiers.',
      502,
      'TAKEALOT_INVALID_RESPONSE',
    )
  }
}

export const resolveTakealotUnitCosts = async (companyId: string, skuValues: string[]) => {
  const skus = [...new Set(skuValues.filter((sku) => sku.trim()).map((sku) => sku.trim()))]
  const products: Array<{ sku: string; averageCost: Prisma.Decimal }> = []
  for (let offset = 0; offset < skus.length; offset += 500) {
    products.push(
      ...(await prisma.product.findMany({
        where: { companyId, deletedAt: null, sku: { in: skus.slice(offset, offset + 500) } },
        select: { sku: true, averageCost: true },
      })),
    )
  }
  const costs = new Map<string, number>()
  for (const product of products) {
    const averageCost = Number(product.averageCost)
    if (Number.isFinite(averageCost) && averageCost > 0) costs.set(product.sku, averageCost)
  }
  // The SKU-encoded cost (e.g. R35-... or C35-...) takes precedence over the catalog.
  for (const sku of skus) {
    const match = /(?:^|[^A-Z0-9])(?:[CR]\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*[CR])(?=$|[^A-Z0-9])/i.exec(
      sku.trim(),
    )
    const encodedCost = match?.[1] ?? match?.[2]
    if (encodedCost) costs.set(sku, Number(encodedCost.replace(',', '.')))
  }
  return costs
}

const summarizeProductSales = (sales: TakealotSale[], unitCosts: Map<string, number>, allowPartialCost = false) => {
  let revenue = 0
  let units = 0
  let totalFee = 0
  let totalCost = 0
  let feesAvailable = true
  let costedUnits = 0
  let uncostedUnits = 0
  const feeComponents = {
    successFee: { value: 0, rows: 0 },
    fulfillmentFee: { value: 0, rows: 0 },
    courierCollectionFee: { value: 0, rows: 0 },
    stockTransferFee: { value: 0, rows: 0 },
  }
  const orderIds = new Set<number>()

  for (const sale of sales) {
    assertSaleMetrics(sale)
    revenue += sale.selling_price
    units += sale.quantity
    orderIds.add(sale.order_id)

    if (sale.total_fee === undefined) {
      feesAvailable = false
    } else {
      totalFee += sale.total_fee
    }

    if (sale.success_fee !== undefined) {
      feeComponents.successFee.value += sale.success_fee
      feeComponents.successFee.rows++
    }
    if (sale.fulfillment_fee !== undefined) {
      feeComponents.fulfillmentFee.value += sale.fulfillment_fee
      feeComponents.fulfillmentFee.rows++
    }
    if (sale.courier_collection_fee !== undefined) {
      feeComponents.courierCollectionFee.value += sale.courier_collection_fee
      feeComponents.courierCollectionFee.rows++
    }
    if (sale.stock_transfer_fee !== undefined) {
      feeComponents.stockTransferFee.value += sale.stock_transfer_fee
      feeComponents.stockTransferFee.rows++
    }
    const unitCost = sale.sku ? unitCosts.get(sale.sku) : undefined
    if (unitCost === undefined) {
      uncostedUnits += sale.quantity
    } else {
      totalCost += unitCost * sale.quantity
      costedUnits += sale.quantity
    }
  }

  const roundedRevenue = roundMoney(revenue)
  const roundedTotalFee = feesAvailable && sales.length > 0 ? roundMoney(totalFee) : null
  // Partial totals are returned with uncostedUnits so the UI can flag incomplete coverage.
  const roundedTotalCost = sales.length > 0 && (allowPartialCost || uncostedUnits === 0) ? roundMoney(totalCost) : null
  const profit =
    roundedTotalFee === null || roundedTotalCost === null
      ? null
      : roundMoney(roundedRevenue - roundedTotalCost - roundedTotalFee)
  const feeComponentSummary = Object.fromEntries(
    Object.entries(feeComponents).map(([name, component]) => [
      name,
      {
        total: sales.length > 0 && component.rows === sales.length ? roundMoney(component.value) : null,
        rowsWithValue: component.rows,
      },
    ]),
  )

  return {
    revenue: roundedRevenue,
    averagePrice: units === 0 ? 0 : roundMoney(revenue / units),
    units,
    orders: orderIds.size,
    totalFee: roundedTotalFee,
    feePerUnit: roundedTotalFee === null || units === 0 ? null : roundMoney(roundedTotalFee / units),
    feeRowsWithTotal: sales.filter((sale) => sale.total_fee !== undefined).length,
    feeRowsMissingTotal: sales.filter((sale) => sale.total_fee === undefined).length,
    feeComponents: feeComponentSummary,
    totalCost: roundedTotalCost,
    costedUnits,
    uncostedUnits,
    costCoverage: units === 0 ? 0 : roundMoney(costedUnits / units),
    profit,
    profitPerUnit: profit === null || units === 0 ? null : roundMoney(profit / units),
    unitsPerOrder: orderIds.size === 0 ? 0 : roundMoney(units / orderIds.size),
  }
}

const aggregateTotalFees = (sales: TakealotSale[]): number | null => {
  let total = 0
  for (const sale of sales) {
    if (sale.total_fee === undefined) return null
    total += sale.total_fee
  }
  return roundMoney(total)
}

const invalidOrderDate = (): never => {
  throw new AppError('Takealot returned an invalid order date.', 502, 'TAKEALOT_INVALID_RESPONSE')
}

const bucketDate = (orderDate: string, interval: 'day' | 'week' | 'month'): string => {
  const takealotDate = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(orderDate)
  let date: Date
  if (takealotDate) {
    const [, dayText, monthText, yearText, hourText = '00', minuteText = '00', secondText = '00'] = takealotDate
    const months: Record<string, string> = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    }
    const month = months[monthText.toLowerCase()]
    if (!month) invalidOrderDate()
    const isoDate = `${yearText}-${month}-${dayText.padStart(2, '0')}T${hourText}:${minuteText}:${secondText}.000Z`
    date = new Date(isoDate)
    if (!Number.isFinite(date.getTime()) || date.toISOString() !== isoDate) {
      invalidOrderDate()
    }
  } else {
    const dateValue = orderDate.includes('T') ? orderDate : orderDate.replace(' ', 'T')
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateValue)
    const normalizedDate = /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ? `${dateValue}T00:00:00.000Z`
      : hasTimezone
        ? dateValue
        : `${dateValue}Z`
    date = new Date(normalizedDate)
    if (!Number.isFinite(date.getTime())) {
      invalidOrderDate()
    }
  }
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  if (interval === 'month') {
    return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-01`
  }
  if (interval === 'week') {
    const daysSinceMonday = (utcDate.getUTCDay() + 6) % 7
    utcDate.setUTCDate(utcDate.getUTCDate() - daysSinceMonday)
  }
  return utcDate.toISOString().slice(0, 10)
}

const aggregateSales = (sales: TakealotSale[]) => {
  let salesValue = 0
  let units = 0
  const orders = new Set<number>()
  for (const sale of sales) {
    assertSaleMetrics(sale)
    salesValue += sale.selling_price
    units += sale.quantity
    orders.add(sale.order_id)
  }
  return { revenue: roundMoney(salesValue), units, orders: orders.size }
}

const revenueDefinition =
  'Gross sales value is the sum of Takealot selling_price values per sales row; quantity is summed separately. All returned sale_status values are included because the API documentation does not define their business meaning; this is not net revenue or profit.'
const profitDefinition =
  "Estimated merchandise profit is gross sales value minus Takealot total_fee and the known product cost (unit cost multiplied by quantity). Unit cost uses a C/R amount encoded in the SKU first, then the current averageCost of an exact-SKU match in this company's product catalog. If some units have no cost, totalCost and profit include only costed units; uncostedUnits and costCoverage show the incomplete coverage, so these partial estimates overstate profit. Profit is unavailable if any sales row lacks total_fee. This is not historical-cost accounting profit and excludes other expenses, taxes, and unreported fees."

export const overview = async (apiKey: string, input: z.infer<typeof overviewSchema>) => {
  const [salesSummary, stockCounts, stockHealth] = await Promise.all([
    takealotApi.getSalesSummary(apiKey),
    takealotApi.getStockCounts(apiKey),
    takealotApi.getStockHealthStats(apiKey),
  ])
  return {
    salesSummary: {
      periods: salesSummary,
      requestedRange: input.from && input.to ? { from: input.from, to: input.to } : null,
      requestedRangeApplied: false,
      limitation:
        "Takealot's documented sales summary endpoint has no date-filter parameters; its periods cannot be matched reliably to an arbitrary requested date range.",
    },
    inventory: { stockCounts, stockHealth },
  }
}

export const listSales = async (apiKey: string, input: z.infer<typeof salesListSchema>) => {
  const page = await takealotApi.getSales(
    apiKey,
    {
      ...addDateFilters(input),
      sku: input.sku,
      productTitle: input.productTitle,
      tsin: input.tsin,
      orderId: input.orderId,
      dc: input.dc,
      customerDc: input.customerDc,
      saleStatus: input.saleStatus,
      promotion: input.promotion,
    },
    input.page,
    input.limit,
  )

  if (page.page_summary.page_number !== input.page) {
    throw new AppError('Takealot returned a different page than requested.', 502, 'TAKEALOT_INCOMPLETE_RESPONSE')
  }
  return {
    sales: page.sales.map(publicSale),
    pagination: pageResult(input.page, input.limit, page.page_summary.total),
  }
}

export const salesTrends = async (companyId: string, apiKey: string, input: z.infer<typeof trendsSchema>) => {
  const sales = await fetchAllSalesForCompany(companyId, apiKey, {
    from: input.from,
    to: input.to,
    sku: input.sku,
    productTitle: input.productTitle,
    tsin: input.tsin,
  })
  const buckets = new Map<string, TakealotSale[]>()
  for (const sale of sales) {
    const date = bucketDate(sale.order_date, input.interval)
    const bucket = buckets.get(date) ?? []
    bucket.push(sale)
    buckets.set(date, bucket)
  }
  const series = [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, rows]) => ({ date, ...aggregateSales(rows), totalFee: aggregateTotalFees(rows) }))
  return { interval: input.interval, metric: input.metric, series, revenueDefinition }
}

export const salesSummary = async (companyId: string, apiKey: string, input: z.infer<typeof salesSummarySchema>) => {
  const sales = await fetchAllSalesForCompany(companyId, apiKey, {
    from: input.from,
    to: input.to,
    sku: input.sku,
    productTitle: input.productTitle,
    tsin: input.tsin,
    orderId: input.orderId,
    dc: input.dc,
    customerDc: input.customerDc,
    saleStatus: input.saleStatus,
    promotion: input.promotion,
  })
  const costs = await resolveTakealotUnitCosts(
    companyId,
    sales.flatMap((sale) => (sale.sku ? [sale.sku] : [])),
  )
  return {
    range: { from: input.from, to: input.to },
    salesRows: sales.length,
    ...summarizeProductSales(sales, costs, true),
    revenueDefinition,
    profitDefinition,
  }
}

const breakdownValue = (sale: TakealotSale, groupBy: z.infer<typeof breakdownSchema>['groupBy']): string => {
  const value = {
    promotion: sale.promotion,
    saleStatus: sale.sale_status,
    dc: sale.dc,
    customerDc: sale.customer_dc,
    stockSourceRegion: sale.stock_source_region,
  }[groupBy]
  return value === null || value === undefined || value === '' ? 'Unknown' : String(value)
}

export const salesBreakdown = async (companyId: string, apiKey: string, input: z.infer<typeof breakdownSchema>) => {
  const sales = await fetchAllSalesForCompany(companyId, apiKey, { from: input.from, to: input.to })
  const groups = new Map<string, TakealotSale[]>()
  for (const sale of sales) {
    const key = breakdownValue(sale, input.groupBy)
    const group = groups.get(key) ?? []
    group.push(sale)
    groups.set(key, group)
  }
  const breakdown = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => ({ key, ...aggregateSales(rows) }))
  return { groupBy: input.groupBy, breakdown, revenueDefinition }
}

const productIdentifier = (sale: TakealotSale, index: number): string => {
  if (Number.isFinite(sale.offer_id)) return `offer:${sale.offer_id}`
  if (sale.sku && Number.isFinite(sale.tsin)) return `sku:${sale.sku}|tsin:${sale.tsin}`
  if (sale.sku) return `sku:${sale.sku}`
  if (Number.isFinite(sale.tsin)) return `tsin:${sale.tsin}`
  if (Number.isFinite(sale.order_item_id)) return `order-item:${sale.order_item_id}`
  return `unidentified:${index}`
}

const findTakealotOfferImages = async (integrationId: string | undefined, skus: string[], offerIds: string[]) => {
  const images = new Map<string, string>()
  if (!integrationId || (skus.length === 0 && offerIds.length === 0)) return images
  const or = [
    ...(skus.length ? [{ sku: { in: [...new Set(skus)] } }] : []),
    ...(offerIds.length ? [{ offerId: { in: [...new Set(offerIds)] } }] : []),
  ]
  const offers = await prisma.takealotOffer.findMany({
    where: { integrationId, OR: or },
    select: { sku: true, offerId: true, imageUrl: true },
  })
  for (const offer of offers) {
    if (offer.sku && offer.imageUrl) images.set(`sku:${offer.sku}`, offer.imageUrl)
    if (offer.imageUrl) images.set(`offer:${offer.offerId}`, offer.imageUrl)
  }
  return images
}

export const productPerformance = async (
  companyId: string,
  apiKey: string,
  input: z.infer<typeof productsSchema>,
  integrationId?: string,
) => {
  const sales = await fetchAllSalesForCompany(companyId, apiKey, {
    from: input.from,
    to: input.to,
    sku: input.sku,
    productTitle: input.productTitle,
    tsin: input.tsin,
  })
  const unitCosts = await resolveTakealotUnitCosts(
    companyId,
    sales.flatMap((sale) => (sale.sku ? [sale.sku] : [])),
  )
  const products = new Map<
    string,
    {
      stableId: string
      offerId?: number
      sku?: string
      tsin?: number
      title?: string
      salesValue: number
      totalFee: number
      feesAvailable: boolean
      totalCost: number
      costedUnits: number
      uncostedUnits: number
      units: number
      orderIds: Set<number>
    }
  >()
  sales.forEach((sale, index) => {
    assertSaleMetrics(sale)
    const stableId = productIdentifier(sale, index)
    const product = products.get(stableId) ?? {
      stableId,
      offerId: sale.offer_id,
      sku: sale.sku,
      tsin: sale.tsin,
      title: sale.product_title,
      salesValue: 0,
      totalFee: 0,
      feesAvailable: true,
      totalCost: 0,
      costedUnits: 0,
      uncostedUnits: 0,
      units: 0,
      orderIds: new Set<number>(),
    }
    product.salesValue += sale.selling_price
    if (sale.total_fee === undefined) {
      product.feesAvailable = false
    } else {
      product.totalFee += sale.total_fee
    }
    const saleUnitCost = sale.sku ? unitCosts.get(sale.sku) : undefined
    if (saleUnitCost === undefined) {
      product.uncostedUnits += sale.quantity
    } else {
      product.totalCost += saleUnitCost * sale.quantity
      product.costedUnits += sale.quantity
    }
    product.units += sale.quantity
    product.orderIds.add(sale.order_id)
    products.set(stableId, product)
  })

  const ranked = [...products.values()].map((product) => {
    const unitCost = product.sku ? unitCosts.get(product.sku) : undefined
    const revenue = roundMoney(product.salesValue)
    const averagePrice = product.units === 0 ? 0 : roundMoney(product.salesValue / product.units)
    const totalFee = product.feesAvailable ? roundMoney(product.totalFee) : null
    const feePerUnit = totalFee === null || product.units === 0 ? null : roundMoney(totalFee / product.units)
    const totalCost = product.uncostedUnits > 0 ? null : roundMoney(product.totalCost)
    const profit = totalFee === null || totalCost === null ? null : roundMoney(revenue - totalCost - totalFee)
    const profitPerUnit = profit === null || product.units === 0 ? null : roundMoney(profit / product.units)
    return {
      sku: product.sku,
      tsin: product.tsin,
      title: product.title,
      unitCost: unitCost ?? null,
      totalCost,
      costedUnits: product.costedUnits,
      uncostedUnits: product.uncostedUnits,
      totalFee,
      feePerUnit,
      profit,
      profitPerUnit,
      revenue,
      units: product.units,
      orders: product.orderIds.size,
      averagePrice,
      offerId: product.offerId,
      stableId: product.stableId,
    }
  })
  const direction = input.order === 'asc' ? 1 : -1
  ranked.sort((left, right) => {
    const leftValue = left[input.sortBy]
    const rightValue = right[input.sortBy]
    if (leftValue === null || leftValue === undefined)
      return rightValue === null || rightValue === undefined ? left.stableId.localeCompare(right.stableId) : 1
    if (rightValue === null || rightValue === undefined) return -1
    const comparison =
      typeof leftValue === 'string' && typeof rightValue === 'string'
        ? leftValue.localeCompare(rightValue)
        : Number(leftValue) - Number(rightValue)
    return comparison === 0 ? left.stableId.localeCompare(right.stableId) : comparison * direction
  })
  const start = (input.page - 1) * input.limit
  const pageProducts = ranked.slice(start, start + input.limit)
  const imageBySkuOrOffer = await findTakealotOfferImages(
    integrationId,
    pageProducts.flatMap((product) => (product.sku ? [product.sku] : [])),
    pageProducts.flatMap((product) => (product.offerId === undefined ? [] : [String(product.offerId)])),
  )
  return {
    products: pageProducts.map(({ stableId: _stableId, ...product }) => ({
      ...product,
      imageUrl:
        (product.sku ? imageBySkuOrOffer.get(`sku:${product.sku}`) : undefined) ??
        (product.offerId === undefined ? undefined : imageBySkuOrOffer.get(`offer:${product.offerId}`)) ??
        null,
    })),
    pagination: pageResult(input.page, input.limit, ranked.length),
    summary: summarizeProductSales(sales, unitCosts, true),
    revenueDefinition,
    profitDefinition,
  }
}

export const listOrders = async (apiKey: string, input: z.infer<typeof ordersSchema>, integrationId?: string) => {
  const upstreamPageSize = 100
  const firstPage = await takealotApi.getSalesOrders(apiKey, {
    ...input,
    page: 1,
    limit: upstreamPageSize,
  })
  if (firstPage.page_summary.page_number !== 1) {
    throw new AppError('Takealot returned a different page than requested.', 502, 'TAKEALOT_INCOMPLETE_RESPONSE')
  }
  const salesFilters = {
    ...addDateFilters(input),
    sku: input.sku,
    productTitle: input.productTitle,
    tsin: input.tsin,
    orderId: input.orderId,
  }
  let total = firstPage.page_summary.total
  let allOrders: TakealotOrderRecord[]
  if (firstPage.orders.length > 0 && !('order_items' in firstPage.orders[0])) {
    allOrders = await fetchAllSales(apiKey, {
      ...salesFilters,
    })
    total = allOrders.length
  } else {
    const pageSize = firstPage.page_summary.page_size
    if (total > 0 && (pageSize < 1 || firstPage.orders.length > total)) {
      throw new AppError('Takealot returned inconsistent order pagination.', 502, 'TAKEALOT_INCOMPLETE_RESPONSE')
    }
    allOrders = [...firstPage.orders]
    const expectedPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0
    for (let pageNumber = 2; pageNumber <= expectedPages; pageNumber++) {
      const result = await takealotApi.getSalesOrders(apiKey, {
        ...input,
        page: pageNumber,
        limit: pageSize,
      })
      if (
        result.page_summary.page_number !== pageNumber ||
        result.page_summary.total !== total ||
        result.page_summary.page_size !== pageSize ||
        result.orders.length === 0
      ) {
        throw new AppError('Takealot returned incomplete order pagination.', 502, 'TAKEALOT_INCOMPLETE_RESPONSE')
      }
      allOrders.push(...result.orders)
    }
    if (allOrders.length !== total) {
      throw new AppError('Takealot returned an incomplete order result.', 502, 'TAKEALOT_INCOMPLETE_RESPONSE')
    }
  }

  const sales = allOrders.some((order) => 'order_items' in order)
    ? await fetchAllSales(apiKey, salesFilters)
    : allOrders.filter((order): order is TakealotSale => !('order_items' in order))
  const trendByDate = new Map<string, { revenue: number; units: number }>()
  const statusCounts = new Map<string, number>()
  for (const sale of sales) {
    assertSaleMetrics(sale)
    if (!sale.order_date || !Number.isFinite(Date.parse(sale.order_date))) {
      throw new AppError('Takealot returned a sale with an invalid order date.', 502, 'TAKEALOT_INVALID_RESPONSE')
    }
    const date = sale.order_date.slice(0, 10)
    const point = trendByDate.get(date) ?? { revenue: 0, units: 0 }
    point.revenue += sale.selling_price
    point.units += sale.quantity
    trendByDate.set(date, point)
    if (sale.sale_status !== undefined) {
      const status = String(sale.sale_status)
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
    }
  }
  const analytics = {
    trend: [...trendByDate.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, point]) => ({ date, revenue: roundMoney(point.revenue), units: point.units })),
    statusCounts: [...statusCounts.entries()].map(([name, value]) => ({ name, value })),
  }
  const salesByOrderItem = new Map<string, TakealotSale>()
  const salesByOrderAndSku = new Map<string, TakealotSale[]>()
  for (const sale of sales) {
    if (sale.order_item_id !== undefined) {
      salesByOrderItem.set(`${sale.order_id}:${sale.order_item_id}`, sale)
    }
    if (sale.sku) {
      const key = `${sale.order_id}:${sale.sku.trim().toLocaleLowerCase()}`
      const matchingSales = salesByOrderAndSku.get(key) ?? []
      matchingSales.push(sale)
      salesByOrderAndSku.set(key, matchingSales)
    }
  }
  const matchedSales = new Set<TakealotSale>()
  const enrichedOrders = allOrders.map((order): TakealotOrderRecord => {
    if (!('order_items' in order)) return order
    return {
      ...order,
      order_items: order.order_items.map((item) => {
        const exactMatch =
          item.order_item_id === undefined ? undefined : salesByOrderItem.get(`${order.order_id}:${item.order_item_id}`)
        const skuMatches = item.merchant_sku
          ? salesByOrderAndSku.get(`${order.order_id}:${item.merchant_sku.trim().toLocaleLowerCase()}`)
          : undefined
        const sale =
          (exactMatch && !matchedSales.has(exactMatch) ? exactMatch : undefined) ??
          skuMatches?.find((candidate) => !matchedSales.has(candidate))
        if (sale) matchedSales.add(sale)
        return {
          ...item,
          quantity: item.quantity ?? sale?.quantity,
          selling_price: item.selling_price ?? sale?.selling_price,
          sale_status: item.sale_status ?? sale?.sale_status,
          dc: item.dc ?? sale?.dc,
        }
      }),
    }
  })
  const orderSortValue = (order: TakealotOrderRecord): string | number | boolean | null => {
    if ('order_items' in order) {
      const item = order.order_items[0]
      switch (input.sortBy) {
        case 'orderId':
          return order.order_id
        case 'date':
          return order.date_authed
        case 'title':
          return item?.title ?? null
        case 'quantity':
          return item?.quantity ?? null
        case 'price':
          return item?.selling_price ?? null
        case 'status':
          return item?.sale_status ?? null
        case 'dc':
          return item?.dc ?? null
      }
    }
    switch (input.sortBy) {
      case 'orderId':
        return order.order_id
      case 'date':
        return order.order_date
      case 'title':
        return order.product_title ?? null
      case 'quantity':
        return order.quantity
      case 'price':
        return order.selling_price
      case 'status':
        return order.sale_status
      case 'dc':
        return order.dc ?? null
    }
  }
  const direction = input.sortOrder === 'asc' ? 1 : -1
  const sortedOrders = [...enrichedOrders].sort((left, right) => {
    const leftValue = orderSortValue(left)
    const rightValue = orderSortValue(right)
    if (leftValue === null || leftValue === undefined) return rightValue === null || rightValue === undefined ? 0 : 1
    if (rightValue === null || rightValue === undefined) return -1
    const leftDate = input.sortBy === 'date' && typeof leftValue === 'string' ? Date.parse(leftValue) : NaN
    const rightDate = input.sortBy === 'date' && typeof rightValue === 'string' ? Date.parse(rightValue) : NaN
    const comparison =
      Number.isFinite(leftDate) && Number.isFinite(rightDate)
        ? leftDate - rightDate
        : typeof leftValue === 'string' && typeof rightValue === 'string'
          ? leftValue.localeCompare(rightValue, undefined, { numeric: true })
          : Number(leftValue) - Number(rightValue)
    return comparison === 0 ? left.order_id - right.order_id : comparison * direction
  })
  const start = (input.page - 1) * input.limit
  const sortedPageOrders = sortedOrders.slice(start, start + input.limit)
  const skus = sortedPageOrders.flatMap((order) =>
    'order_items' in order
      ? order.order_items.flatMap((item) => (item.merchant_sku ? [item.merchant_sku] : []))
      : order.sku
        ? [order.sku]
        : [],
  )
  const offerIds = sortedPageOrders.flatMap((order) =>
    'order_items' in order || order.offer_id === undefined ? [] : [String(order.offer_id)],
  )
  const imageBySkuOrOffer = await findTakealotOfferImages(integrationId, skus, offerIds)
  return {
    orders: sortedPageOrders.map((order: TakealotOrderRecord) => {
      if ('order_items' in order) {
        return publicOrder({
          ...order,
          order_items: order.order_items.map((item) => ({
            ...item,
            imageUrl: item.merchant_sku ? (imageBySkuOrOffer.get(`sku:${item.merchant_sku}`) ?? null) : null,
          })),
        })
      }
      return publicSale({
        ...order,
        imageUrl:
          (order.sku ? imageBySkuOrOffer.get(`sku:${order.sku}`) : undefined) ??
          (order.offer_id === undefined ? undefined : imageBySkuOrOffer.get(`offer:${order.offer_id}`)) ??
          null,
      })
    }),
    pagination: pageResult(input.page, input.limit, total),
    analytics,
  }
}

export const inventorySummary = async (companyId: string, integrationId: string, apiKey: string) => {
  const [reportedStockCounts, stockHealth, synchronizedStock] = await Promise.all([
    takealotApi.getStockCounts(apiKey),
    takealotApi.getStockHealthStats(apiKey),
    prisma.takealotOffer.aggregate({
      where: { integrationId },
      _count: { _all: true },
      _sum: { stockCpt: true, stockJhb: true, stockDbn: true },
    }),
  ])
  const hasSynchronizedOffers = synchronizedStock._count._all > 0
  const reportedTotalStockCount =
    typeof reportedStockCounts.total_stock_count === 'number'
      ? reportedStockCounts.total_stock_count
      : typeof reportedStockCounts.count === 'number'
        ? reportedStockCounts.count
        : null
  const synchronizedTotalStockCount =
    Number(synchronizedStock._sum.stockCpt ?? 0) +
    Number(synchronizedStock._sum.stockJhb ?? 0) +
    Number(synchronizedStock._sum.stockDbn ?? 0)
  const stockCounts = {
    ...reportedStockCounts,
    ...(reportedTotalStockCount !== null && { reported_total_stock_count: reportedTotalStockCount }),
    total_stock_count: hasSynchronizedOffers ? synchronizedTotalStockCount : (reportedTotalStockCount ?? 0),
    total_stock_count_source: hasSynchronizedOffers ? 'synchronized_offers' : 'Takealot API',
  }
  const capturedAt = new Date()
  await prisma.takealotInventorySnapshot.create({
    data: {
      companyId,
      integrationId,
      capturedAt,
      stockCounts: JSON.parse(JSON.stringify(stockCounts)) as Prisma.InputJsonValue,
      stockHealth: JSON.parse(JSON.stringify(stockHealth)) as Prisma.InputJsonValue,
    },
  })
  return { stockCounts, stockHealth, capturedAt }
}

type TransactionDataset = {
  transactions: TakealotTransaction[]
  balance: Awaited<ReturnType<typeof takealotApi.getBalances>>
  balanceRetrievedAt: string
  reportedCount: number | null
}

const transactionDatasetCache = new Map<string, { expiresAt: number; value: TransactionDataset }>()
const transactionDatasetRequests = new Map<string, Promise<TransactionDataset>>()
const transactionDatasetTtlMs = 60_000
const maximumTransactionPages = 500

const transactionDataset = (
  companyId: string,
  integrationId: string,
  apiKey: string,
  input: Pick<z.infer<typeof transactionsSchema>, 'from' | 'to' | 'types'>,
): Promise<TransactionDataset> => {
  const cacheKey = JSON.stringify({ companyId, integrationId, ...input })
  const cached = transactionDatasetCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)
  const pending = transactionDatasetRequests.get(cacheKey)
  if (pending) return pending

  const request = (async () => {
    const from = `${input.from}T00:00:00+02:00`
    const to = `${input.to}T23:59:59.999+02:00`
    const [transactions, balance] = await Promise.all([
      (async () => {
        const records = new Map<number, TakealotTransaction>()
        const seenTokens = new Set<string>()
        let continuationToken: string | undefined
        let reportedCount: number | null = null
        let pages = 0
        do {
          if (pages >= maximumTransactionPages) {
            throw new AppError(
              `The selected range contains more than ${maximumTransactionPages * 100} transactions. Narrow the date range or transaction types.`,
              422,
              'TAKEALOT_TRANSACTION_RANGE_TOO_LARGE',
            )
          }
          const page = await takealotApi.getTransactions(apiKey, {
            from,
            to,
            types: input.types,
            continuationToken,
          })
          pages += 1
          if (pages === 1) reportedCount = page.count ?? null
          for (const transaction of page.items) records.set(transaction.transaction_id, transaction)
          continuationToken = page.continuation_token ?? undefined
          if (continuationToken && seenTokens.has(continuationToken)) {
            throw new AppError(
              'Takealot repeated a transaction continuation token.',
              502,
              'TAKEALOT_INCOMPLETE_RESPONSE',
            )
          }
          if (continuationToken) seenTokens.add(continuationToken)
        } while (continuationToken)
        if (reportedCount !== null && records.size !== reportedCount) {
          throw new AppError(
            'Takealot returned an incomplete transactions result.',
            502,
            'TAKEALOT_INCOMPLETE_RESPONSE',
          )
        }
        return { transactions: [...records.values()], reportedCount }
      })(),
      takealotApi.getBalances(apiKey),
    ])
    const value = {
      ...transactions,
      balance,
      balanceRetrievedAt: new Date().toISOString(),
    }
    transactionDatasetCache.set(cacheKey, { expiresAt: Date.now() + transactionDatasetTtlMs, value })
    while (transactionDatasetCache.size > 10) {
      const oldestKey = transactionDatasetCache.keys().next().value
      if (oldestKey === undefined) break
      transactionDatasetCache.delete(oldestKey)
    }
    return value
  })().finally(() => transactionDatasetRequests.delete(cacheKey))

  transactionDatasetRequests.set(cacheKey, request)
  return request
}

export const transactionsReport = async (
  companyId: string,
  integrationId: string,
  apiKey: string,
  input: z.infer<typeof transactionsSchema>,
) => {
  const dataset = await transactionDataset(companyId, integrationId, apiKey, input)
  const filteredTransactions = input.search
    ? dataset.transactions.filter((transaction) => String(transaction.transaction_id).includes(input.search!))
    : dataset.transactions
  const transactionTypeTotals = new Map<
    TakealotTransactionType,
    { count: number; amount: number; inflow: number; outflow: number }
  >()
  const dailyTotals = new Map<string, { inflow: number; outflow: number; net: number; count: number }>()
  let inflow = 0
  let outflow = 0
  let net = 0

  for (const transaction of filteredTransactions) {
    const amount = transaction.amount_incl_vat
    const positiveAmount = Math.max(amount, 0)
    const negativeAmount = Math.abs(Math.min(amount, 0))
    inflow += positiveAmount
    outflow += negativeAmount
    net += amount

    const typeTotals = transactionTypeTotals.get(transaction.transaction_type) ?? {
      count: 0,
      amount: 0,
      inflow: 0,
      outflow: 0,
    }
    typeTotals.count += 1
    typeTotals.amount += amount
    typeTotals.inflow += positiveAmount
    typeTotals.outflow += negativeAmount
    transactionTypeTotals.set(transaction.transaction_type, typeTotals)

    const date = new Date(Date.parse(transaction.created_at) + takealotTimezoneOffsetMs).toISOString().slice(0, 10)
    const day = dailyTotals.get(date) ?? { inflow: 0, outflow: 0, net: 0, count: 0 }
    day.inflow += positiveAmount
    day.outflow += negativeAmount
    day.net += amount
    day.count += 1
    dailyTotals.set(date, day)
  }

  const direction = input.sortOrder === 'asc' ? 1 : -1
  const compareValues = (left: string | number, right: string | number) =>
    typeof left === 'string' && typeof right === 'string'
      ? left.localeCompare(right, undefined, { numeric: true })
      : Number(left) - Number(right)
  const sortedTransactions = [...filteredTransactions].sort((left, right) => {
    const values: Record<typeof input.sortBy, [string | number, string | number]> = {
      createdAt: [left.created_at, right.created_at],
      transactionType: [left.transaction_type, right.transaction_type],
      amount: [left.amount_incl_vat, right.amount_incl_vat],
      transactionId: [left.transaction_id, right.transaction_id],
    }
    const comparison = compareValues(...values[input.sortBy])
    return (comparison || left.transaction_id - right.transaction_id) * direction
  })
  const start = (input.page - 1) * input.limit
  const total = filteredTransactions.length
  return {
    transactions: sortedTransactions.slice(start, start + input.limit),
    pagination: pageResult(input.page, input.limit, total),
    summary: {
      count: total,
      inflow: roundMoney(inflow),
      outflow: roundMoney(outflow),
      net: roundMoney(net),
      averageTransaction: total ? roundMoney(net / total) : 0,
      byType: [...transactionTypeTotals.entries()]
        .map(([type, values]) => ({
          type,
          count: values.count,
          amount: roundMoney(values.amount),
          inflow: roundMoney(values.inflow),
          outflow: roundMoney(values.outflow),
        }))
        .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount)),
      trend: [...dailyTotals.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, values]) => ({
          date,
          inflow: roundMoney(values.inflow),
          outflow: roundMoney(values.outflow),
          net: roundMoney(values.net),
          count: values.count,
        })),
    },
    balance: dataset.balance,
    balanceRetrievedAt: dataset.balanceRetrievedAt,
    availableTypes: takealotTransactionTypes,
    currency: 'ZAR',
    timeZone: 'Africa/Johannesburg',
    reportedCount: dataset.reportedCount,
    definitions: {
      inflow: 'Sum of positive amount_incl_vat values in the selected range.',
      outflow: 'Absolute sum of negative amount_incl_vat values in the selected range.',
      net: 'Signed sum of amount_incl_vat values in the selected range; not an account balance.',
      balance:
        'Current balance figures are returned by the separate Takealot balances endpoint and are not filtered by the selected date range.',
    },
  }
}

const snapshotBucket = (date: Date, interval: 'day' | 'week' | 'month'): string => {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  if (interval === 'month') {
    return `${utcDate.getUTCFullYear()}-${String(utcDate.getUTCMonth() + 1).padStart(2, '0')}-01`
  }
  if (interval === 'week') {
    utcDate.setUTCDate(utcDate.getUTCDate() - ((utcDate.getUTCDay() + 6) % 7))
  }
  return utcDate.toISOString().slice(0, 10)
}

export const inventorySnapshots = async (
  companyId: string,
  integrationId: string,
  input: z.infer<typeof inventorySnapshotsSchema>,
) => {
  const from = new Date(`${input.from}T00:00:00.000Z`)
  const to = new Date(`${input.to}T23:59:59.999Z`)
  const snapshots = await prisma.takealotInventorySnapshot.findMany({
    where: { companyId, integrationId, capturedAt: { gte: from, lte: to } },
    orderBy: { capturedAt: 'asc' },
    select: { capturedAt: true, stockCounts: true, stockHealth: true },
  })
  const latestByBucket = new Map<string, (typeof snapshots)[number]>()
  for (const snapshot of snapshots) {
    latestByBucket.set(snapshotBucket(snapshot.capturedAt, input.interval), snapshot)
  }
  return {
    interval: input.interval,
    series: [...latestByBucket.entries()].map(([date, snapshot]) => ({
      date,
      capturedAt: snapshot.capturedAt,
      stockCounts: snapshot.stockCounts,
      stockHealth: snapshot.stockHealth,
    })),
  }
}
