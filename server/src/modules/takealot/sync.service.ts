import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'

import { prisma } from '../../lib/prisma'
import { toPublicMediaUrl } from '../../integrations/aws/media'
import { getTakealotApiKey } from '../integrations/service'
import { resolveTakealotUnitCosts } from './service'
import { takealotApi } from './takealot-api'

type Warehouse = 'CPT' | 'JHB' | 'DBN'
type SyncProgress = {
  pagesProcessed: number
  totalPages: number
  offersProcessed: number
  missingCostCount: number
}

class TakealotSyncCancelled extends Error {
  constructor() {
    super('Takealot synchronization was cancelled.')
    this.name = 'TakealotSyncCancelled'
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const firstValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null) return value
  }
  return undefined
}

const stringValue = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

const numberValue = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const booleanValue = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number' && (value === 0 || value === 1)) return value === 1
  if (typeof value === 'string') {
    if (['true', 'yes', '1'].includes(value.toLowerCase())) return true
    if (['false', 'no', '0'].includes(value.toLowerCase())) return false
  }
  return null
}

const warehouseFrom = (value: unknown): Warehouse | null => {
  const normalized = stringValue(value)
    ?.toUpperCase()
    .replace(/[^A-Z]/g, '')
  if (normalized === 'CPT' || normalized?.includes('CAPETOWN')) return 'CPT'
  if (normalized === 'JHB' || normalized?.includes('JOHANNESBURG')) return 'JHB'
  if (normalized === 'DBN' || normalized?.includes('DURBAN')) return 'DBN'
  return null
}

const warehouseRows = (offer: Record<string, unknown>, metric: 'stock' | 'incoming' | 'sales' | 'cover') => {
  const keys = {
    stock: ['stock_at_takealot', 'stock_by_warehouse', 'warehouse_stock', 'warehouses'],
    incoming: ['stock_on_way', 'incoming_by_warehouse', 'incoming_stock_by_warehouse'],
    sales: ['sales_units', 'sales_by_warehouse'],
    cover: ['stock_cover', 'stock_cover_by_warehouse'],
  }[metric]
  const rows = firstValue(offer, keys)
  return Array.isArray(rows) ? rows.filter(isRecord) : []
}

const warehouseFromRow = (row: Record<string, unknown>) => {
  const warehouse = firstValue(row, ['warehouse', 'merchant_warehouse'])
  const nestedName = isRecord(warehouse) ? firstValue(warehouse, ['name', 'warehouse_name', 'code']) : warehouse
  return (
    warehouseFrom(nestedName) ??
    warehouseFrom(
      firstValue(row, [
        'warehouse_name',
        'warehouse_code',
        'distribution_centre',
        'distribution_center',
        'dc',
        'code',
        'name',
      ]),
    )
  )
}

const warehouseId = (row: Record<string, unknown>) => {
  const warehouse = firstValue(row, ['warehouse', 'merchant_warehouse'])
  return numberValue(
    firstValue(row, ['warehouse_id']) ??
      (isRecord(warehouse) ? firstValue(warehouse, ['warehouse_id', 'id']) : undefined),
  )
}

const warehouseRow = (
  offer: Record<string, unknown>,
  warehouse: Warehouse,
  metric: 'stock' | 'incoming' | 'sales' | 'cover',
) => {
  const rows = warehouseRows(offer, metric)
  const namedRow = rows.find((row) => warehouseFromRow(row) === warehouse)
  if (namedRow) return namedRow

  const stockRow = warehouseRows(offer, 'stock').find((row) => warehouseFromRow(row) === warehouse)
  const targetId = stockRow ? warehouseId(stockRow) : null
  return targetId === null ? undefined : rows.find((row) => warehouseId(row) === targetId)
}

const warehouseMetric = (
  offer: Record<string, unknown>,
  warehouse: Warehouse,
  metric: 'stock' | 'incoming' | 'sales' | 'cover',
) => {
  const row = warehouseRow(offer, warehouse, metric)
  const keysByMetric = {
    stock: ['quantity_available', 'stock_quantity', 'quantity', 'available', 'stock', 'on_hand'],
    incoming: [
      'quantity_on_way',
      'quantity_available',
      'stock_on_way',
      'incoming_stock',
      'quantity_incoming',
      'on_way',
    ],
    sales: ['sales_units', 'units_sold', 'quantity_sold', 'reported_sales_units', 'sales'],
    cover: ['stock_cover', 'stock_cover_days', 'cover', 'cover_days'],
  }
  const aliases = keysByMetric[metric]
  const direct = firstValue(offer, [
    `${warehouse.toLowerCase()}_${metric === 'stock' ? 'stock' : metric === 'incoming' ? 'on_way' : metric === 'sales' ? 'sales_units' : 'stock_cover'}`,
    `${metric === 'stock' ? 'stock' : metric === 'incoming' ? 'stock_on_way' : metric === 'sales' ? 'sales_units' : 'stock_cover'}_${warehouse.toLowerCase()}`,
  ])
  const raw = direct ?? (row ? firstValue(row, aliases) : undefined)
  return { value: numberValue(raw), raw: stringValue(raw) }
}

const imageUrlFrom = (offer: Record<string, unknown>) => {
  const candidate = stringValue(firstValue(offer, ['image_url', 'imageUrl', 'product_image_url', 'image']))
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null
    return url.toString()
  } catch {
    return null
  }
}

const offerUrlFrom = (offer: Record<string, unknown>) => {
  const candidate = stringValue(firstValue(offer, ['offer_url', 'offerUrl', 'url']))
  if (!candidate) return null
  try {
    const url = new URL(candidate)
    if ((url.hostname !== 'takealot.com' && !url.hostname.endsWith('.takealot.com')) || url.username || url.password)
      return null
    url.protocol = 'https:'
    return url.toString()
  } catch {
    return null
  }
}

export const normalizeOffer = (
  offer: Record<string, unknown>,
  costPrice: number | null,
  fallbackImage: string | null,
) => {
  const offerId = stringValue(firstValue(offer, ['offer_id', 'offerId', 'id']))
  if (!offerId) throw new Error('Takealot returned an offer without an offer ID.')
  const coverCpt = warehouseMetric(offer, 'CPT', 'cover')
  const coverJhb = warehouseMetric(offer, 'JHB', 'cover')
  const coverDbn = warehouseMetric(offer, 'DBN', 'cover')
  return {
    offerId,
    tsinId: stringValue(firstValue(offer, ['tsin_id', 'tsinId', 'tsin'])),
    sku: stringValue(firstValue(offer, ['sku', 'merchant_sku'])),
    title: stringValue(firstValue(offer, ['title', 'product_title', 'name'])),
    imageUrl: imageUrlFrom(offer) ?? fallbackImage,
    offerUrl: offerUrlFrom(offer),
    status: stringValue(firstValue(offer, ['status', 'listing_status', 'offer_status'])),
    sellingPrice: numberValue(firstValue(offer, ['selling_price', 'sellingPrice', 'price'])),
    rrp: numberValue(firstValue(offer, ['rrp', 'recommended_retail_price'])),
    costPrice,
    stockCpt: warehouseMetric(offer, 'CPT', 'stock').value,
    stockJhb: warehouseMetric(offer, 'JHB', 'stock').value,
    stockDbn: warehouseMetric(offer, 'DBN', 'stock').value,
    stockOnWayCpt: warehouseMetric(offer, 'CPT', 'incoming').value,
    stockOnWayJhb: warehouseMetric(offer, 'JHB', 'incoming').value,
    stockOnWayDbn: warehouseMetric(offer, 'DBN', 'incoming').value,
    salesUnitsCpt: warehouseMetric(offer, 'CPT', 'sales').value,
    salesUnitsJhb: warehouseMetric(offer, 'JHB', 'sales').value,
    salesUnitsDbn: warehouseMetric(offer, 'DBN', 'sales').value,
    stockCoverCpt: coverCpt.value,
    stockCoverJhb: coverJhb.value,
    stockCoverDbn: coverDbn.value,
    stockCoverCptRaw: coverCpt.raw,
    stockCoverJhbRaw: coverJhb.raw,
    stockCoverDbnRaw: coverDbn.raw,
    totalExcessStock: numberValue(
      firstValue(offer, ['total_excess_takealot_stock', 'total_excess_stock', 'excess_stock', 'excess_inventory']),
    ),
    catalogueQualityScore: numberValue(
      firstValue(offer, ['catalogue_quality_score', 'catalog_quality_score', 'quality_score']),
    ),
    storageFeeEligible: booleanValue(
      firstValue(offer, ['storage_fee_eligible', 'storage_fee_enabled', 'is_storage_fee_eligible']),
    ),
  }
}

const safeErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : 'Takealot synchronization failed.'
  return message.replace(/(?:Key|Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi, '[redacted]').slice(0, 500)
}

export const syncTakealotOffers = async (
  companyId: string,
  integrationId: string,
  jobId: string | undefined,
  onProgress: (progress: SyncProgress) => Promise<void> = async () => undefined,
) => {
  const apiKey = await getTakealotApiKey(companyId, integrationId)
  const syncRunId = randomUUID()
  const startedAt = new Date()
  const started = await prisma.takealotSyncState.updateMany({
    where: { integrationId, status: { not: 'CANCEL_REQUESTED' } },
    data: {
      status: 'RUNNING',
      jobId: jobId ?? null,
      currentRunId: syncRunId,
      startedAt,
      completedAt: null,
      pagesProcessed: 0,
      totalPages: 0,
      offersProcessed: 0,
      missingCostCount: 0,
      errorMessage: null,
    },
  })
  if (!started.count) {
    await prisma.takealotSyncState.update({
      where: { integrationId },
      data: { status: 'CANCELLED', currentRunId: null, completedAt: new Date() },
    })
    return { pagesProcessed: 0, totalPages: 0, offersProcessed: 0, missingCostCount: 0, cancelled: true }
  }

  try {
    const pageSize = 100
    const firstPage = await takealotApi.getOffers(apiKey, 1, pageSize)
    const totalPages = Math.max(1, Math.ceil(firstPage.page_summary.total_results / pageSize))
    if (
      firstPage.page_summary.page_number !== 1 ||
      firstPage.page_summary.page_size !== pageSize ||
      totalPages > 100_000
    ) {
      throw new Error('Takealot returned invalid offer pagination metadata.')
    }
    let pagesProcessed = 0
    let offersProcessed = 0
    let missingCostCount = 0

    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
      const currentState = await prisma.takealotSyncState.findUnique({
        where: { integrationId },
        select: { status: true },
      })
      if (currentState?.status === 'CANCEL_REQUESTED') throw new TakealotSyncCancelled()

      const page = pageNumber === 1 ? firstPage : await takealotApi.getOffers(apiKey, pageNumber, pageSize)
      if (
        page.page_summary.page_number !== pageNumber ||
        page.page_summary.page_size !== pageSize ||
        page.page_summary.total_results !== firstPage.page_summary.total_results ||
        (pageNumber < totalPages && page.offers.length === 0)
      ) {
        throw new Error('Takealot returned incomplete offer pagination.')
      }

      const rawOffers = page.offers.map((offer) => {
        const id = stringValue(firstValue(offer, ['offer_id', 'offerId', 'id']))
        if (!id) throw new Error('Takealot returned an offer without an offer ID.')
        return { id, offer }
      })
      const afterFetchState = await prisma.takealotSyncState.findUnique({
        where: { integrationId },
        select: { status: true },
      })
      if (afterFetchState?.status === 'CANCEL_REQUESTED') throw new TakealotSyncCancelled()

      const skus = rawOffers.flatMap(({ offer }) => {
        const sku = stringValue(firstValue(offer, ['sku', 'merchant_sku']))
        return sku ? [sku] : []
      })
      const costs = await resolveTakealotUnitCosts(companyId, skus)
      const productRows = skus.length
        ? await prisma.product.findMany({
            where: { companyId, deletedAt: null, sku: { in: [...new Set(skus)] } },
            select: { sku: true, imageKeys: true },
          })
        : []
      const images = new Map(
        productRows.map((product) => [
          product.sku,
          product.imageKeys[0] ? toPublicMediaUrl(product.imageKeys[0]) : null,
        ]),
      )
      const syncTime = new Date()
      const normalized = rawOffers.map(({ id, offer }) => {
        const sku = stringValue(firstValue(offer, ['sku', 'merchant_sku']))
        const data = normalizeOffer(
          offer,
          sku ? (costs.get(sku) ?? null) : null,
          sku ? (images.get(sku) ?? null) : null,
        )
        return {
          integrationId,
          syncRunId,
          offerId: id,
          data: { ...data, lastSyncedAt: syncTime.toISOString() } as Prisma.InputJsonObject,
        }
      })
      await Promise.all(
        normalized.map((row) =>
          prisma.takealotOfferStage.upsert({
            where: { integrationId_syncRunId_offerId: { integrationId, syncRunId, offerId: row.offerId } },
            create: row,
            update: { data: row.data },
          }),
        ),
      )
      pagesProcessed += 1
      offersProcessed += normalized.length
      missingCostCount += normalized.filter(
        (row) => !isRecord(row.data) || row.data.costPrice === null || row.data.costPrice === undefined,
      ).length
      await prisma.takealotSyncState.update({
        where: { integrationId },
        data: { pagesProcessed, totalPages, offersProcessed, missingCostCount },
      })
      await onProgress({ pagesProcessed, totalPages, offersProcessed, missingCostCount })
    }

    await prisma.$transaction(async (tx) => {
      const currentState = await tx.takealotSyncState.findUnique({
        where: { integrationId },
        select: { status: true },
      })
      if (currentState?.status === 'CANCEL_REQUESTED') throw new TakealotSyncCancelled()
      const staged = await tx.takealotOfferStage.findMany({
        where: { integrationId, syncRunId },
        select: { offerId: true, data: true },
      })
      await tx.takealotOffer.deleteMany({ where: { integrationId } })
      for (let offset = 0; offset < staged.length; offset += 500) {
        const rows = staged.slice(offset, offset + 500).map((stage) => {
          const data = stage.data as Record<string, unknown>
          return {
            integrationId,
            offerId: stage.offerId,
            tsinId: stringValue(data.tsinId),
            sku: stringValue(data.sku),
            title: stringValue(data.title),
            imageUrl: stringValue(data.imageUrl),
            offerUrl: stringValue(data.offerUrl),
            status: stringValue(data.status),
            sellingPrice: numberValue(data.sellingPrice),
            rrp: numberValue(data.rrp),
            costPrice: numberValue(data.costPrice),
            stockCpt: numberValue(data.stockCpt),
            stockJhb: numberValue(data.stockJhb),
            stockDbn: numberValue(data.stockDbn),
            stockOnWayCpt: numberValue(data.stockOnWayCpt),
            stockOnWayJhb: numberValue(data.stockOnWayJhb),
            stockOnWayDbn: numberValue(data.stockOnWayDbn),
            salesUnitsCpt: numberValue(data.salesUnitsCpt),
            salesUnitsJhb: numberValue(data.salesUnitsJhb),
            salesUnitsDbn: numberValue(data.salesUnitsDbn),
            stockCoverCpt: numberValue(data.stockCoverCpt),
            stockCoverJhb: numberValue(data.stockCoverJhb),
            stockCoverDbn: numberValue(data.stockCoverDbn),
            stockCoverCptRaw: stringValue(data.stockCoverCptRaw),
            stockCoverJhbRaw: stringValue(data.stockCoverJhbRaw),
            stockCoverDbnRaw: stringValue(data.stockCoverDbnRaw),
            totalExcessStock: numberValue(data.totalExcessStock),
            catalogueQualityScore: numberValue(data.catalogueQualityScore),
            storageFeeEligible: booleanValue(data.storageFeeEligible),
            lastSyncedAt: new Date(stringValue(data.lastSyncedAt) ?? startedAt.toISOString()),
            updatedAt: new Date(),
          }
        })
        await tx.takealotOffer.createMany({ data: rows })
      }
      await tx.takealotOfferStage.deleteMany({ where: { integrationId, syncRunId } })
      await tx.takealotSyncState.update({
        where: { integrationId },
        data: {
          status: 'SUCCEEDED',
          currentRunId: null,
          completedAt: new Date(),
          lastSuccessfulSyncAt: new Date(),
          pagesProcessed,
          totalPages,
          offersProcessed: staged.length,
          missingCostCount,
          errorMessage: null,
        },
      })
    })
    return { pagesProcessed, totalPages, offersProcessed, missingCostCount }
  } catch (error) {
    await prisma.takealotOfferStage.deleteMany({ where: { integrationId, syncRunId } })
    if (error instanceof TakealotSyncCancelled) {
      await prisma.takealotSyncState.updateMany({
        where: { integrationId, status: 'CANCEL_REQUESTED' },
        data: { status: 'CANCELLED', currentRunId: null, completedAt: new Date() },
      })
      const state = await prisma.takealotSyncState.findUnique({
        where: { integrationId },
        select: { pagesProcessed: true, totalPages: true, offersProcessed: true, missingCostCount: true },
      })
      return {
        pagesProcessed: state?.pagesProcessed ?? 0,
        totalPages: state?.totalPages ?? 0,
        offersProcessed: state?.offersProcessed ?? 0,
        missingCostCount: state?.missingCostCount ?? 0,
        cancelled: true,
      }
    }
    await prisma.takealotSyncState.update({
      where: { integrationId },
      data: {
        status: 'FAILED',
        currentRunId: null,
        completedAt: new Date(),
        errorMessage: safeErrorMessage(error),
      },
    })
    throw error
  }
}
