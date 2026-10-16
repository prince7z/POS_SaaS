import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import { validationError } from '../../utils/errors'
import { getTakealotLowStockThreshold } from '../integrations/service'
import { enqueueTakealotSync, requestTakealotSyncStop } from './sync.queue'

const pageSchema = z.coerce.number().int().min(1).default(1)
const pageSizeSchema = z.coerce.number().int().min(1).max(100).default(25)
const optionalNumber = z.coerce.number().finite().nonnegative().optional()
const optionalBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional()
const numericRange = (value: { min?: number; max?: number }, context: z.RefinementCtx) => {
  if (value.min !== undefined && value.max !== undefined && value.min > value.max) {
    context.addIssue({ code: 'custom', message: 'Minimum filter value cannot exceed maximum' })
  }
}

export const parse = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value)
  if (!result.success) throw validationError(result.error.issues[0]?.message ?? 'Invalid request')
  return result.data
}

const numberRange = {
  minSellingPrice: optionalNumber,
  maxSellingPrice: optionalNumber,
  minRrp: optionalNumber,
  maxRrp: optionalNumber,
  minStockCover: optionalNumber,
  maxStockCover: optionalNumber,
}

export const offersSchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    search: z.string().trim().max(200).optional(),
    status: z.string().trim().min(1).max(80).optional(),
    warehouse: z.enum(['CPT', 'JHB', 'DBN', 'ALL']).default('ALL'),
    stockState: z.enum(['in_stock', 'out_of_stock', 'low_stock', 'all']).default('all'),
    costState: z.enum(['known', 'missing']).optional(),
    marginState: z.enum(['positive', 'negative', 'zero', 'all']).default('all'),
    excessStock: optionalBoolean,
    storageFeeEligible: optionalBoolean,
    ...numberRange,
    sortBy: z
      .enum([
        'offerId',
        'title',
        'sku',
        'status',
        'sellingPrice',
        'rrp',
        'costPrice',
        'stockCpt',
        'stockJhb',
        'stockDbn',
        'potentialGrossProfitPerUnit',
        'totalExcessStock',
        'catalogueQualityScore',
        'lastSyncedAt',
        'totalStock',
      ])
      .default('title'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict()
  .superRefine((value, context) => {
    numericRange({ min: value.minSellingPrice, max: value.maxSellingPrice }, context)
    numericRange({ min: value.minRrp, max: value.maxRrp }, context)
    numericRange({ min: value.minStockCover, max: value.maxStockCover }, context)
  })

export const alertsSchema = z
  .object({
    page: pageSchema,
    pageSize: pageSizeSchema,
    type: z.string().trim().min(1).max(60).optional(),
    severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    warehouse: z.enum(['CPT', 'JHB', 'DBN', 'ALL']).default('ALL'),
    sortBy: z
      .enum(['severity', 'type', 'title', 'sku', 'warehouse', 'quantity', 'sellingPrice', 'costPrice'])
      .default('severity'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()

export const warehouseAnalyticsSchema = z
  .object({
    sortBy: z
      .enum([
        'warehouse',
        'stockUnits',
        'incomingUnits',
        'inventoryCostValue',
        'potentialRetailValue',
        'potentialGrossProfit',
        'outOfStockOffers',
        'lowStockOffers',
        'excessStockOffers',
        'shareOfInventoryPercent',
        'reportedSalesUnits',
      ])
      .default('stockUnits'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()

export const pricingSalesSchema = z
  .object({
    sortBy: z
      .enum([
        'offerId',
        'title',
        'sku',
        'sellingPrice',
        'rrp',
        'costPrice',
        'potentialGrossProfitPerUnit',
        'grossMarginPercent',
        'reportedSalesUnits',
      ])
      .default('reportedSalesUnits'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()

const stocks = {
  CPT: Prisma.sql`COALESCE("stockCpt", 0)`,
  JHB: Prisma.sql`COALESCE("stockJhb", 0)`,
  DBN: Prisma.sql`COALESCE("stockDbn", 0)`,
  ALL: Prisma.sql`COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0)`,
} as const
const incoming = {
  CPT: Prisma.sql`COALESCE("stockOnWayCpt", 0)`,
  JHB: Prisma.sql`COALESCE("stockOnWayJhb", 0)`,
  DBN: Prisma.sql`COALESCE("stockOnWayDbn", 0)`,
  ALL: Prisma.sql`COALESCE("stockOnWayCpt", 0) + COALESCE("stockOnWayJhb", 0) + COALESCE("stockOnWayDbn", 0)`,
} as const
const sales = {
  CPT: Prisma.sql`COALESCE("salesUnitsCpt", 0)`,
  JHB: Prisma.sql`COALESCE("salesUnitsJhb", 0)`,
  DBN: Prisma.sql`COALESCE("salesUnitsDbn", 0)`,
  ALL: Prisma.sql`COALESCE("salesUnitsCpt", 0) + COALESCE("salesUnitsJhb", 0) + COALESCE("salesUnitsDbn", 0)`,
} as const
const coverColumns = {
  CPT: Prisma.sql`"stockCoverCpt"`,
  JHB: Prisma.sql`"stockCoverJhb"`,
  DBN: Prisma.sql`"stockCoverDbn"`,
} as const

const num = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  const result = Number(value)
  return Number.isFinite(result) ? result : null
}
const val = (value: unknown) => num(value) ?? 0
const pageInfo = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: Math.ceil(total / pageSize),
  hasMore: page * pageSize < total,
})
const staleAfterMs = 24 * 60 * 60 * 1000

export const syncStatus = async (companyId: string, integrationId: string, autoRefresh = false) => {
  let state = await prisma.takealotSyncState.findUnique({ where: { integrationId } })
  const isStale = !state?.lastSuccessfulSyncAt || Date.now() - state.lastSuccessfulSyncAt.getTime() > staleAfterMs
  const canAutoRefresh = !state || state.status === 'IDLE' || state.status === 'SUCCEEDED'
  if (autoRefresh && isStale && canAutoRefresh) {
    try {
      await enqueueTakealotSync(companyId, integrationId)
      state = await prisma.takealotSyncState.findUnique({ where: { integrationId } })
    } catch (error) {
      logger.warn(
        'Stale Takealot data could not be refreshed',
        JSON.stringify({
          companyId,
          integrationId,
          error: error instanceof Error ? error.message : 'Unknown queue error',
        }),
      )
    }
  }
  return {
    status: state?.status ?? 'IDLE',
    jobId: state?.jobId ?? null,
    startedAt: state?.startedAt ?? null,
    completedAt: state?.completedAt ?? null,
    lastSuccessfulSyncAt: state?.lastSuccessfulSyncAt ?? null,
    pagesProcessed: state?.pagesProcessed ?? 0,
    totalPages: state?.totalPages ?? 0,
    offersProcessed: state?.offersProcessed ?? 0,
    missingCostCount: state?.missingCostCount ?? 0,
    errorMessage: state?.errorMessage ?? null,
    isStale: !state?.lastSuccessfulSyncAt || Date.now() - state.lastSuccessfulSyncAt.getTime() > staleAfterMs,
  }
}

export const stopSync = async (_companyId: string, integrationId: string) => requestTakealotSyncStop(integrationId)

const aggregateSql = (integrationId: string, lowStockThreshold: number) =>
  prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
  SELECT
    COUNT(*)::int AS "totalOffers",
    COALESCE(SUM(COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0)), 0) AS "totalStock",
    COALESCE(SUM(COALESCE("stockOnWayCpt", 0) + COALESCE("stockOnWayJhb", 0) + COALESCE("stockOnWayDbn", 0)), 0) AS "totalIncomingStock",
    COUNT(*) FILTER (WHERE COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0) <= 0)::int AS "outOfStockOffers",
    COUNT(*) FILTER (WHERE COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0) > 0 AND COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0) <= ${lowStockThreshold})::int AS "lowStockOffers",
    COUNT(*) FILTER (WHERE COALESCE("totalExcessStock", 0) > 0)::int AS "excessStockOffers",
    COUNT(*) FILTER (WHERE "costPrice" IS NULL)::int AS "missingCostOffers",
    COUNT(*) FILTER (WHERE "rrp" IS NULL)::int AS "missingRrpOffers",
    COALESCE(SUM((COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0)) * "costPrice") FILTER (WHERE "costPrice" IS NOT NULL), 0) AS "inventoryCostValue",
    COALESCE(SUM((COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0)) * "sellingPrice") FILTER (WHERE "sellingPrice" IS NOT NULL), 0) AS "potentialRetailInventoryValue",
    COALESCE(SUM((COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0)) * ("sellingPrice" - "costPrice")) FILTER (WHERE "sellingPrice" IS NOT NULL AND "costPrice" IS NOT NULL), 0) AS "potentialGrossProfit",
    COUNT(*) FILTER (WHERE UPPER(BTRIM(COALESCE("status", ''))) IN ('BUYABLE', 'ACTIVE', 'LIVE', 'PUBLISHED'))::int AS "buyableOffers",
    COUNT(*) FILTER (WHERE UPPER(BTRIM(COALESCE("status", ''))) = 'NOT BUYABLE')::int AS "notBuyableOffers",
    COUNT(*) FILTER (WHERE UPPER(BTRIM(COALESCE("status", ''))) = 'DISABLED BY TAKEALOT')::int AS "disabledByTakealotOffers",
    COUNT(*) FILTER (WHERE UPPER(BTRIM(COALESCE("status", ''))) = 'DISABLED BY SELLER')::int AS "disabledBySellerOffers",
    COUNT(*) FILTER (WHERE UPPER(BTRIM(COALESCE("status", ''))) NOT IN (
      'BUYABLE', 'ACTIVE', 'LIVE', 'PUBLISHED', 'NOT BUYABLE', 'DISABLED BY TAKEALOT', 'DISABLED BY SELLER'
    ))::int AS "otherOffers"
  FROM "TakealotOffer" WHERE "integrationId" = ${integrationId}
`)

export const overview = async (companyId: string, integrationId: string) => {
  const lowStockThreshold = await getTakealotLowStockThreshold(integrationId)
  const [rows, state, warehouseRows] = await Promise.all([
    aggregateSql(integrationId, lowStockThreshold),
    syncStatus(companyId, integrationId, true),
    prisma.takealotOffer.aggregate({
      where: { integrationId },
      _sum: {
        stockCpt: true,
        stockJhb: true,
        stockDbn: true,
        stockOnWayCpt: true,
        stockOnWayJhb: true,
        stockOnWayDbn: true,
      },
    }),
  ])
  const row = rows[0] ?? {}
  const totalRetail = val(row.potentialRetailInventoryValue)
  const totalProfit = val(row.potentialGrossProfit)
  return {
    totalOffers: val(row.totalOffers),
    listingStatusCounts: {
      buyable: val(row.buyableOffers),
      notBuyable: val(row.notBuyableOffers),
      disabledByTakealot: val(row.disabledByTakealotOffers),
      disabledBySeller: val(row.disabledBySellerOffers),
      other: val(row.otherOffers),
    },
    totalStock: val(row.totalStock),
    totalIncomingStock: val(row.totalIncomingStock),
    inventoryCostValue: val(row.inventoryCostValue),
    potentialRetailInventoryValue: totalRetail,
    potentialGrossProfit: totalProfit,
    potentialGrossMarginPercent: totalRetail > 0 ? (totalProfit / totalRetail) * 100 : null,
    outOfStockOffers: val(row.outOfStockOffers),
    lowStockOffers: val(row.lowStockOffers),
    excessStockOffers: val(row.excessStockOffers),
    missingCostOffers: val(row.missingCostOffers),
    missingRrpOffers: val(row.missingRrpOffers),
    stockByWarehouse: {
      CPT: val(warehouseRows._sum.stockCpt),
      JHB: val(warehouseRows._sum.stockJhb),
      DBN: val(warehouseRows._sum.stockDbn),
    },
    incomingByWarehouse: {
      CPT: val(warehouseRows._sum.stockOnWayCpt),
      JHB: val(warehouseRows._sum.stockOnWayJhb),
      DBN: val(warehouseRows._sum.stockOnWayDbn),
    },
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    isStale: state.isStale,
    currency: 'ZAR',
    financialNote:
      'Inventory values and gross profit are potential estimates based on current offer prices and known costs. They exclude marketplace fees, shipping, returns, taxes, and other expenses.',
  }
}

const whereSql = (integrationId: string, input: z.infer<typeof offersSchema>, lowStockThreshold: number) => {
  const clauses: Prisma.Sql[] = [Prisma.sql`"integrationId" = ${integrationId}`]
  if (input.search) {
    const pattern = `%${input.search}%`
    clauses.push(
      Prisma.sql`("title" ILIKE ${pattern} OR "sku" ILIKE ${pattern} OR "offerId" ILIKE ${pattern} OR "tsinId" ILIKE ${pattern})`,
    )
  }
  if (input.status) clauses.push(Prisma.sql`"status" = ${input.status}`)
  if (input.stockState === 'in_stock') clauses.push(Prisma.sql`${stocks[input.warehouse]} > 0`)
  if (input.stockState === 'out_of_stock') clauses.push(Prisma.sql`${stocks[input.warehouse]} <= 0`)
  if (input.stockState === 'low_stock')
    clauses.push(Prisma.sql`${stocks[input.warehouse]} > 0 AND ${stocks[input.warehouse]} <= ${lowStockThreshold}`)
  if (input.costState === 'known') clauses.push(Prisma.sql`"costPrice" IS NOT NULL`)
  if (input.costState === 'missing') clauses.push(Prisma.sql`"costPrice" IS NULL`)
  if (input.marginState === 'positive')
    clauses.push(Prisma.sql`"costPrice" IS NOT NULL AND "sellingPrice" > "costPrice"`)
  if (input.marginState === 'negative')
    clauses.push(Prisma.sql`"costPrice" IS NOT NULL AND "sellingPrice" < "costPrice"`)
  if (input.marginState === 'zero') clauses.push(Prisma.sql`"costPrice" IS NOT NULL AND "sellingPrice" = "costPrice"`)
  if (input.excessStock !== undefined) {
    clauses.push(
      input.excessStock
        ? Prisma.sql`COALESCE("totalExcessStock", 0) > 0`
        : Prisma.sql`COALESCE("totalExcessStock", 0) <= 0`,
    )
  }
  if (input.storageFeeEligible !== undefined)
    clauses.push(Prisma.sql`"storageFeeEligible" = ${input.storageFeeEligible}`)
  for (const [key, field, operator] of [
    ['minSellingPrice', 'sellingPrice', '>='],
    ['maxSellingPrice', 'sellingPrice', '<='],
    ['minRrp', 'rrp', '>='],
    ['maxRrp', 'rrp', '<='],
  ] as const) {
    const filterValue = input[key]
    if (filterValue !== undefined)
      clauses.push(Prisma.sql`"${Prisma.raw(field)}" ${Prisma.raw(operator)} ${filterValue}`)
  }
  if (input.minStockCover !== undefined) {
    const coverClause =
      input.warehouse === 'ALL'
        ? Prisma.sql`("stockCoverCpt" >= ${input.minStockCover} OR "stockCoverJhb" >= ${input.minStockCover} OR "stockCoverDbn" >= ${input.minStockCover})`
        : Prisma.sql`${coverColumns[input.warehouse]} >= ${input.minStockCover}`
    clauses.push(coverClause)
  }
  if (input.maxStockCover !== undefined) {
    const coverClause =
      input.warehouse === 'ALL'
        ? Prisma.sql`("stockCoverCpt" <= ${input.maxStockCover} OR "stockCoverJhb" <= ${input.maxStockCover} OR "stockCoverDbn" <= ${input.maxStockCover})`
        : Prisma.sql`${coverColumns[input.warehouse]} <= ${input.maxStockCover}`
    clauses.push(coverClause)
  }
  return Prisma.join(clauses, ' AND ')
}

const sortColumns: Record<z.infer<typeof offersSchema>['sortBy'], Prisma.Sql> = {
  offerId: Prisma.sql`"offerId"`,
  title: Prisma.sql`"title"`,
  sku: Prisma.sql`"sku"`,
  status: Prisma.sql`"status"`,
  sellingPrice: Prisma.sql`"sellingPrice"`,
  rrp: Prisma.sql`"rrp"`,
  costPrice: Prisma.sql`"costPrice"`,
  stockCpt: Prisma.sql`"stockCpt"`,
  stockJhb: Prisma.sql`"stockJhb"`,
  stockDbn: Prisma.sql`"stockDbn"`,
  potentialGrossProfitPerUnit: Prisma.sql`CASE WHEN "sellingPrice" IS NOT NULL AND "costPrice" IS NOT NULL THEN "sellingPrice" - "costPrice" END`,
  totalExcessStock: Prisma.sql`"totalExcessStock"`,
  catalogueQualityScore: Prisma.sql`"catalogueQualityScore"`,
  lastSyncedAt: Prisma.sql`"lastSyncedAt"`,
  totalStock: Prisma.sql`COALESCE("stockCpt",0) + COALESCE("stockJhb",0) + COALESCE("stockDbn",0)`,
}

export const listOffers = async (integrationId: string, input: z.infer<typeof offersSchema>) => {
  const lowStockThreshold = await getTakealotLowStockThreshold(integrationId)
  const where = whereSql(integrationId, input, lowStockThreshold)
  const order = input.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`
  const [rows, counts, accountSummaries] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT * FROM "TakealotOffer" WHERE ${where}
      ORDER BY ${sortColumns[input.sortBy]} ${order} NULLS LAST, "offerId" ASC
      LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}
    `),
    prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS total FROM "TakealotOffer" WHERE ${where}
    `),
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT
        COUNT(*)::int AS "totalOffers",
        COUNT(*) FILTER (WHERE "sellingPrice" IS NOT NULL AND "costPrice" IS NOT NULL AND "sellingPrice" > "costPrice")::int AS "positiveProfitOffers",
        COUNT(*) FILTER (WHERE "sellingPrice" IS NOT NULL AND "costPrice" IS NOT NULL AND "sellingPrice" < "costPrice")::int AS "negativeProfitOffers",
        COUNT(*) FILTER (WHERE "sellingPrice" IS NOT NULL AND "costPrice" IS NOT NULL AND "sellingPrice" = "costPrice")::int AS "breakEvenOffers",
        COUNT(*) FILTER (WHERE "sellingPrice" IS NULL OR "costPrice" IS NULL)::int AS "unavailableProfitOffers",
        COALESCE(SUM(COALESCE("stockCpt", 0)), 0) AS "capeTownStock",
        COALESCE(SUM(COALESCE("stockJhb", 0)), 0) AS "johannesburgStock",
        COALESCE(SUM(COALESCE("stockDbn", 0)), 0) AS "durbanStock",
        COALESCE(SUM((COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0)) * "sellingPrice")
          FILTER (WHERE "sellingPrice" IS NOT NULL), 0) AS "potentialRetailValue",
        COALESCE(SUM((COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0)) * "costPrice")
          FILTER (WHERE "costPrice" IS NOT NULL), 0) AS "inventoryCostValue",
        COALESCE(SUM((COALESCE("stockCpt", 0) + COALESCE("stockJhb", 0) + COALESCE("stockDbn", 0)) * ("sellingPrice" - "costPrice"))
          FILTER (WHERE "sellingPrice" IS NOT NULL AND "costPrice" IS NOT NULL), 0) AS "potentialGrossProfitOnCurrentStock"
      FROM "TakealotOffer"
      WHERE "integrationId" = ${integrationId}
    `),
  ])
  const items = rows.map((row) => {
    const stockCpt = num(row.stockCpt)
    const stockJhb = num(row.stockJhb)
    const stockDbn = num(row.stockDbn)
    const totalStock = val(stockCpt) + val(stockJhb) + val(stockDbn)
    const sellingPrice = num(row.sellingPrice)
    const costPrice = num(row.costPrice)
    const potentialGrossProfitPerUnit = sellingPrice !== null && costPrice !== null ? sellingPrice - costPrice : null
    return {
      ...row,
      sellingPrice,
      rrp: num(row.rrp),
      costPrice,
      stockCpt,
      stockJhb,
      stockDbn,
      stockOnWayCpt: num(row.stockOnWayCpt),
      stockOnWayJhb: num(row.stockOnWayJhb),
      stockOnWayDbn: num(row.stockOnWayDbn),
      salesUnitsCpt: num(row.salesUnitsCpt),
      salesUnitsJhb: num(row.salesUnitsJhb),
      salesUnitsDbn: num(row.salesUnitsDbn),
      stockCoverCpt: num(row.stockCoverCpt),
      stockCoverJhb: num(row.stockCoverJhb),
      stockCoverDbn: num(row.stockCoverDbn),
      totalExcessStock: num(row.totalExcessStock),
      catalogueQualityScore: num(row.catalogueQualityScore),
      totalStock,
      totalIncomingStock: val(row.stockOnWayCpt) + val(row.stockOnWayJhb) + val(row.stockOnWayDbn),
      potentialGrossProfitPerUnit,
      grossMarginPercent:
        sellingPrice !== null && sellingPrice > 0 && costPrice !== null
          ? (potentialGrossProfitPerUnit! / sellingPrice) * 100
          : null,
    }
  })
  const total = counts[0]?.total ?? 0
  const accountSummary = accountSummaries[0]
  if (!accountSummary) throw new Error('Takealot offer summary query returned no result.')
  return {
    items,
    pagination: pageInfo(input.page, input.pageSize, total),
    summary: {
      totalOffers: val(accountSummary.totalOffers),
      positiveProfitOffers: val(accountSummary.positiveProfitOffers),
      negativeProfitOffers: val(accountSummary.negativeProfitOffers),
      breakEvenOffers: val(accountSummary.breakEvenOffers),
      unavailableProfitOffers: val(accountSummary.unavailableProfitOffers),
      stockByWarehouse: {
        capeTown: val(accountSummary.capeTownStock),
        johannesburg: val(accountSummary.johannesburgStock),
        durban: val(accountSummary.durbanStock),
      },
      potentialRetailValue: val(accountSummary.potentialRetailValue),
      inventoryCostValue: val(accountSummary.inventoryCostValue),
      potentialGrossProfitOnCurrentStock: val(accountSummary.potentialGrossProfitOnCurrentStock),
    },
    lastSuccessfulSyncAt:
      (await prisma.takealotSyncState.findUnique({ where: { integrationId }, select: { lastSuccessfulSyncAt: true } }))
        ?.lastSuccessfulSyncAt ?? null,
  }
}

export const inventoryAnalytics = async (integrationId: string) => {
  const lowStockThreshold = await getTakealotLowStockThreshold(integrationId)
  const warehouseRows = await Promise.all(
    (['CPT', 'JHB', 'DBN'] as const).map(async (warehouse) => {
      const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT ${warehouse}::text AS warehouse,
        COALESCE(SUM(${stocks[warehouse]}),0) AS "stockUnits",
        COALESCE(SUM(${incoming[warehouse]}),0) AS "incomingUnits",
        COALESCE(SUM(${stocks[warehouse]} * "costPrice") FILTER (WHERE "costPrice" IS NOT NULL),0) AS "inventoryCostValue",
        COALESCE(SUM(${stocks[warehouse]} * "sellingPrice") FILTER (WHERE "sellingPrice" IS NOT NULL),0) AS "potentialRetailValue",
        COALESCE(SUM(${stocks[warehouse]} * ("sellingPrice" - "costPrice")) FILTER (WHERE "sellingPrice" IS NOT NULL AND "costPrice" IS NOT NULL),0) AS "potentialGrossProfit",
        COUNT(*) FILTER (WHERE ${stocks[warehouse]} <= 0)::int AS "outOfStockOffers",
        COUNT(*) FILTER (WHERE ${stocks[warehouse]} > 0 AND ${stocks[warehouse]} <= ${lowStockThreshold})::int AS "lowStockOffers",
        COUNT(*) FILTER (WHERE COALESCE("totalExcessStock",0) > 0)::int AS "excessStockOffers"
      FROM "TakealotOffer" WHERE "integrationId" = ${integrationId}
    `)
      return rows[0] ?? { warehouse, stockUnits: 0, incomingUnits: 0 }
    }),
  )
  const totals = await prisma.takealotOffer.aggregate({
    where: { integrationId },
    _sum: {
      stockCpt: true,
      stockJhb: true,
      stockDbn: true,
      stockOnWayCpt: true,
      stockOnWayJhb: true,
      stockOnWayDbn: true,
    },
  })
  const stockTotal = val(totals._sum.stockCpt) + val(totals._sum.stockJhb) + val(totals._sum.stockDbn)
  const warehouses = warehouseRows.map((row) => ({
    warehouse: String(row.warehouse),
    stockUnits: val(row.stockUnits),
    incomingUnits: val(row.incomingUnits),
    inventoryCostValue: val(row.inventoryCostValue),
    potentialRetailValue: val(row.potentialRetailValue),
    potentialGrossProfit: val(row.potentialGrossProfit),
    outOfStockOffers: val(row.outOfStockOffers),
    lowStockOffers: val(row.lowStockOffers),
    excessStockOffers: val(row.excessStockOffers),
    shareOfInventoryPercent: stockTotal > 0 ? (val(row.stockUnits) / stockTotal) * 100 : 0,
  }))
  return {
    warehouses,
    stockVsIncoming: warehouses.map(({ warehouse, stockUnits, incomingUnits }) => ({
      warehouse,
      stockUnits,
      incomingUnits,
    })),
    currency: 'ZAR',
    financialNote: 'Values are current potential inventory values, not realized revenue.',
  }
}

export const warehouseAnalytics = async (integrationId: string, input: z.infer<typeof warehouseAnalyticsSchema>) => {
  const inventory = await inventoryAnalytics(integrationId)
  const salesByWarehouse = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT
      COALESCE(SUM("salesUnitsCpt"),0) AS "CPT",
      COALESCE(SUM("salesUnitsJhb"),0) AS "JHB",
      COALESCE(SUM("salesUnitsDbn"),0) AS "DBN"
    FROM "TakealotOffer" WHERE "integrationId" = ${integrationId}
  `)
  const reportedSales = salesByWarehouse[0] ?? {}
  const warehouses = inventory.warehouses.map((item) => ({
    ...item,
    reportedSalesUnits: val(reportedSales[item.warehouse]),
  }))
  const direction = input.sortOrder === 'asc' ? 1 : -1
  warehouses.sort((left, right) => {
    const leftValue = left[input.sortBy]
    const rightValue = right[input.sortBy]
    if (leftValue === null || leftValue === undefined) return rightValue === null || rightValue === undefined ? 0 : 1
    if (rightValue === null || rightValue === undefined) return -1
    const comparison =
      typeof leftValue === 'string' && typeof rightValue === 'string'
        ? leftValue.localeCompare(rightValue)
        : Number(leftValue) - Number(rightValue)
    return comparison === 0 ? left.warehouse.localeCompare(right.warehouse) : comparison * direction
  })
  return {
    warehouses,
    currency: inventory.currency,
    financialNote: inventory.financialNote,
  }
}

export const pricingSalesAnalytics = async (integrationId: string, input: z.infer<typeof pricingSalesSchema>) => {
  const pricingSortColumns: Record<z.infer<typeof pricingSalesSchema>['sortBy'], Prisma.Sql> = {
    offerId: Prisma.sql`"offerId"`,
    title: Prisma.sql`"title"`,
    sku: Prisma.sql`"sku"`,
    sellingPrice: Prisma.sql`"sellingPrice"`,
    rrp: Prisma.sql`"rrp"`,
    costPrice: Prisma.sql`"costPrice"`,
    potentialGrossProfitPerUnit: Prisma.sql`CASE WHEN "sellingPrice" IS NOT NULL AND "costPrice" IS NOT NULL THEN "sellingPrice" - "costPrice" END`,
    grossMarginPercent: Prisma.sql`CASE WHEN "sellingPrice" > 0 AND "costPrice" IS NOT NULL THEN (("sellingPrice" - "costPrice") / "sellingPrice") * 100 END`,
    reportedSalesUnits: Prisma.sql`COALESCE("salesUnitsCpt",0) + COALESCE("salesUnitsJhb",0) + COALESCE("salesUnitsDbn",0)`,
  }
  const sortOrder = input.sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`
  const [aggregates, topBySales] = await Promise.all([
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE "costPrice" IS NULL)::int AS "missingCostOffers",
        COUNT(*) FILTER (WHERE "rrp" IS NULL)::int AS "missingRrpOffers",
        COUNT(*) FILTER (WHERE "sellingPrice" < "costPrice" AND "costPrice" IS NOT NULL)::int AS "belowCostOffers",
        COUNT(*) FILTER (WHERE "sellingPrice" > "costPrice" AND "costPrice" IS NOT NULL)::int AS "positiveMarginOffers",
        COUNT(*) FILTER (WHERE "sellingPrice" < "costPrice" AND "costPrice" IS NOT NULL)::int AS "negativeMarginOffers",
        COUNT(*) FILTER (WHERE "sellingPrice" = "costPrice" AND "costPrice" IS NOT NULL)::int AS "zeroMarginOffers",
        COALESCE(SUM("salesUnitsCpt"),0) AS "salesCpt",
        COALESCE(SUM("salesUnitsJhb"),0) AS "salesJhb",
        COALESCE(SUM("salesUnitsDbn"),0) AS "salesDbn"
      FROM "TakealotOffer" WHERE "integrationId" = ${integrationId}
    `),
    prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT "offerId", "title", "sku", "imageUrl", "offerUrl", "sellingPrice", "rrp", "costPrice",
        COALESCE("salesUnitsCpt",0) + COALESCE("salesUnitsJhb",0) + COALESCE("salesUnitsDbn",0) AS "reportedSalesUnits"
      FROM "TakealotOffer" WHERE "integrationId" = ${integrationId}
      ORDER BY ${pricingSortColumns[input.sortBy]} ${sortOrder} NULLS LAST, "offerId" ASC LIMIT 10
    `),
  ])
  const aggregate = aggregates[0] ?? {}
  const toPriceOffer = (offer: Record<string, unknown>) => {
    const sellingPrice = num(offer.sellingPrice)
    const costPrice = num(offer.costPrice)
    return {
      ...offer,
      sellingPrice,
      rrp: num(offer.rrp),
      costPrice,
      potentialGrossProfitPerUnit: sellingPrice !== null && costPrice !== null ? sellingPrice - costPrice : null,
      grossMarginPercent:
        sellingPrice !== null && sellingPrice > 0 && costPrice !== null
          ? ((sellingPrice - costPrice) / sellingPrice) * 100
          : null,
      reportedSalesUnits: val(offer.reportedSalesUnits),
    }
  }
  return {
    reportedSalesUnitsByWarehouse: [
      { warehouse: 'CPT', units: val(aggregate.salesCpt) },
      { warehouse: 'JHB', units: val(aggregate.salesJhb) },
      { warehouse: 'DBN', units: val(aggregate.salesDbn) },
    ],
    topOffersByReportedSales: topBySales.map(toPriceOffer),
    pricing: {
      missingCostOffers: val(aggregate.missingCostOffers),
      missingRrpOffers: val(aggregate.missingRrpOffers),
      sellingBelowCostOffers: val(aggregate.belowCostOffers),
      positivePotentialMarginOffers: val(aggregate.positiveMarginOffers),
      negativePotentialMarginOffers: val(aggregate.negativeMarginOffers),
      zeroPotentialMarginOffers: val(aggregate.zeroMarginOffers),
    },
    salesSemantics:
      'Reported offer sales units are returned as provided by Takealot; the endpoint does not establish a date range. They are not converted to revenue.',
    currency: 'ZAR',
  }
}

type Alert = {
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

export const listAlerts = async (companyId: string, integrationId: string, input: z.infer<typeof alertsSchema>) => {
  const lowStockThreshold = await getTakealotLowStockThreshold(integrationId)
  const state = await syncStatus(companyId, integrationId, false)
  const orderColumn = {
    severity: Prisma.raw('"severityRank"'),
    type: Prisma.raw('"type"'),
    title: Prisma.raw('"title"'),
    sku: Prisma.raw('"sku"'),
    warehouse: Prisma.raw('"warehouse"'),
    quantity: Prisma.raw('"quantity"'),
    sellingPrice: Prisma.raw('"sellingPrice"'),
    costPrice: Prisma.raw('"costPrice"'),
  }[input.sortBy]
  const orderDirection = input.sortOrder === 'asc' ? Prisma.raw('ASC') : Prisma.raw('DESC')
  const rows = await prisma.$queryRaw<
    Array<
      Alert & {
        severityRank: number
        totalCount: bigint
        criticalCount: number
        highCount: number
        mediumCount: number
        lowCount: number
      }
    >
  >(Prisma.sql`
    WITH base AS (
      SELECT "offerId", "title", "sku", "imageUrl", "offerUrl", "status", "sellingPrice", "costPrice", "rrp",
        "stockCpt", "stockJhb", "stockDbn", "stockCoverCpt", "stockCoverJhb", "stockCoverDbn",
        "stockOnWayCpt", "stockOnWayJhb", "stockOnWayDbn", "totalExcessStock", "catalogueQualityScore", "storageFeeEligible"
      FROM "TakealotOffer" WHERE "integrationId" = ${integrationId}
    ),
    warehouse_stock AS (
      SELECT b.*, w."warehouse", w."stock", w."cover", w."onWay"
      FROM base b
      CROSS JOIN LATERAL (VALUES
        ('CPT'::text, b."stockCpt", b."stockCoverCpt", b."stockOnWayCpt"),
        ('JHB'::text, b."stockJhb", b."stockCoverJhb", b."stockOnWayJhb"),
        ('DBN'::text, b."stockDbn", b."stockCoverDbn", b."stockOnWayDbn")
      ) AS w("warehouse", "stock", "cover", "onWay")
    ),
    alerts AS (
      SELECT 'OUT_OF_STOCK'::text AS "type", 'critical'::text AS "severity", 4 AS "severityRank",
        'Offer is out of stock.'::text AS "message", "title", "sku", "offerId", "imageUrl", "offerUrl",
        "warehouse", "stock" AS "quantity", "sellingPrice", "costPrice"
      FROM warehouse_stock WHERE "stock" <= 0
      UNION ALL
      SELECT 'LOW_STOCK', CASE WHEN "cover" <= 7 THEN 'high' ELSE 'medium' END,
        CASE WHEN "cover" <= 7 THEN 3 ELSE 2 END,
        ${Prisma.sql`'Stock is at or below the configured threshold of ' || ${lowStockThreshold} || ' units.'`},
        "title", "sku", "offerId", "imageUrl", "offerUrl", "warehouse", "stock", "sellingPrice", "costPrice"
      FROM warehouse_stock WHERE "stock" > 0 AND "stock" <= ${lowStockThreshold}
      UNION ALL
      SELECT 'INCOMING_STOCK', 'low', 1, 'Incoming stock is expected; review replenishment timing.',
        "title", "sku", "offerId", "imageUrl", "offerUrl", "warehouse", "onWay", "sellingPrice", "costPrice"
      FROM warehouse_stock WHERE "onWay" > 0 AND "stock" <= ${lowStockThreshold}
      UNION ALL
      SELECT 'EXCESS_STOCK', 'medium', 2, 'Excess inventory is reported for this offer.',
        "title", "sku", "offerId", "imageUrl", "offerUrl", NULL::text, "totalExcessStock", "sellingPrice", "costPrice"
      FROM base WHERE "totalExcessStock" > 0
      UNION ALL
      SELECT 'BELOW_COST', 'high', 3, 'Selling price is below the known product cost.',
        "title", "sku", "offerId", "imageUrl", "offerUrl", NULL::text, NULL::numeric, "sellingPrice", "costPrice"
      FROM base WHERE "sellingPrice" < "costPrice"
      UNION ALL
      SELECT 'MISSING_COST', 'medium', 2, 'Product cost could not be resolved from its SKU or POS catalog match.',
        "title", "sku", "offerId", "imageUrl", "offerUrl", NULL::text, NULL::numeric, "sellingPrice", "costPrice"
      FROM base WHERE "costPrice" IS NULL
      UNION ALL
      SELECT 'DISABLED_LISTING', 'medium', 2, 'Listing is disabled.',
        "title", "sku", "offerId", "imageUrl", "offerUrl", NULL::text, NULL::numeric, "sellingPrice", "costPrice"
      FROM base WHERE UPPER(COALESCE("status", '')) IN ('DISABLED', 'INACTIVE')
      UNION ALL
      SELECT 'LOW_CATALOGUE_QUALITY', 'low', 1, 'Catalogue quality score is below 50.',
        "title", "sku", "offerId", "imageUrl", "offerUrl", NULL::text, "catalogueQualityScore", "sellingPrice", "costPrice"
      FROM base WHERE "catalogueQualityScore" < 50
      UNION ALL
      SELECT 'STORAGE_FEE_REVIEW', 'low', 1, 'This offer is flagged as storage-fee eligible; review the Takealot terms.',
        "title", "sku", "offerId", "imageUrl", "offerUrl", NULL::text, NULL::numeric, "sellingPrice", "costPrice"
      FROM base WHERE "storageFeeEligible" = TRUE
      UNION ALL
      SELECT 'MISSING_RRP', 'low', 1, 'Recommended retail price is missing.',
        "title", "sku", "offerId", "imageUrl", "offerUrl", NULL::text, NULL::numeric, "sellingPrice", "costPrice"
      FROM base WHERE "rrp" IS NULL
      UNION ALL
      SELECT 'STALE_DATA', ${state.status === 'FAILED' ? 'high' : 'low'}, ${state.status === 'FAILED' ? 3 : 1},
        ${state.status === 'FAILED' ? (state.errorMessage ?? 'The latest Takealot synchronization failed.') : 'Takealot offer data is more than 24 hours old.'},
        NULL::text, NULL::text, 'sync-state', NULL::text, NULL::text, NULL::text, NULL::numeric, NULL::numeric, NULL::numeric
      WHERE ${state.isStale}
    ),
    filtered AS (
      SELECT * FROM alerts
      WHERE (${input.type ?? null}::text IS NULL OR "type" = UPPER(${input.type ?? null}))
        AND (${input.severity ?? null}::text IS NULL OR "severity" = ${input.severity ?? null})
        AND (${input.warehouse} = 'ALL' OR "warehouse" = ${input.warehouse})
    ),
    counted AS (
      SELECT
        COUNT(*) AS "totalCount",
        COUNT(*) FILTER (WHERE "severity" = 'critical')::int AS "criticalCount",
        COUNT(*) FILTER (WHERE "severity" = 'high')::int AS "highCount",
        COUNT(*) FILTER (WHERE "severity" = 'medium')::int AS "mediumCount",
        COUNT(*) FILTER (WHERE "severity" = 'low')::int AS "lowCount"
      FROM filtered
    ),
    paged AS (
      SELECT * FROM filtered
      ORDER BY ${orderColumn} ${orderDirection} NULLS LAST, "offerId" ASC, "warehouse" ASC NULLS LAST, "type" ASC
      LIMIT ${input.pageSize} OFFSET ${(input.page - 1) * input.pageSize}
    )
    SELECT
      paged.*,
      counted."totalCount",
      counted."criticalCount",
      counted."highCount",
      counted."mediumCount",
      counted."lowCount"
    FROM counted LEFT JOIN paged ON TRUE
  `)
  const total = Number(rows[0]?.totalCount ?? 0n)
  const summary = {
    total,
    critical: val(rows[0]?.criticalCount),
    high: val(rows[0]?.highCount),
    medium: val(rows[0]?.mediumCount),
    low: val(rows[0]?.lowCount),
  }
  return {
    items: rows
      .filter((row) => row.offerId !== null)
      .map(
        ({
          severityRank: _severityRank,
          totalCount: _totalCount,
          criticalCount: _criticalCount,
          highCount: _highCount,
          mediumCount: _mediumCount,
          lowCount: _lowCount,
          ...alert
        }) => ({
          ...alert,
          quantity: num(alert.quantity),
          sellingPrice: num(alert.sellingPrice),
          costPrice: num(alert.costPrice),
        }),
      ),
    pagination: pageInfo(input.page, input.pageSize, total),
    summary,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    isStale: state.isStale,
  }
}
