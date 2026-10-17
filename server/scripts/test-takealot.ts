import assert from 'node:assert/strict'
import http from 'node:http'

type HttpResult = { status: number; body: Record<string, unknown> }
type StoredSnapshot = {
  companyId: string
  integrationId: string
  capturedAt: Date
  stockCounts: Record<string, unknown>
  stockHealth: Record<string, unknown>
}

const main = async (): Promise<void> => {
  process.env.NODE_ENV = 'test'
  process.env.TEST_AUTH_BYPASS = 'true'
  process.env.PSQL ??= 'postgresql://user:password@127.0.0.1:5432/pos_test?schema=public'
  process.env.JWT_SECRET ??= 'takealot-test-secret'
  process.env.AWS_S3_BUCKET ??= 'takealot-test-bucket'
  process.env.AWS_ACCESS_KEY_ID ??= 'takealot-test-access-key'
  process.env.AWS_SECRET_ACCESS_KEY ??= 'takealot-test-secret-key'

  const express = (await import('express')).default
  const { errorHandler } = await import('../src/middleware/error')
  const { default: takealotRouter } = await import('../src/modules/takealot/route')
  const { env } = await import('../src/config/env')
  const { prisma } = await import('../src/lib/prisma')
  const { takealotClient } = await import('../src/integrations/takealot/client')
  const { takealotApi } = await import('../src/modules/takealot/takealot-api')
  const jwt = (await import('jsonwebtoken')).default
  const app = express()
  const integrationId = 'a2b8e672-7f09-4783-81ba-51a572205b71'
  app.use('/integrations/:integrationId/takealot', takealotRouter)
  app.use(errorHandler)
  const server = app.listen(0)
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not start Takealot test server')
  const baseUrl = `http://127.0.0.1:${address.port}`
  const snapshotRows: StoredSnapshot[] = []
  const snapshotModel = (
    prisma as unknown as {
      takealotInventorySnapshot: {
        create: (input: { data: StoredSnapshot }) => Promise<unknown>
        findMany: (input: {
          where: { companyId: string; integrationId: string; capturedAt: { gte: Date; lte: Date } }
          orderBy: { capturedAt: 'asc' }
          select: { capturedAt: true; stockCounts: true; stockHealth: true }
        }) => Promise<StoredSnapshot[]>
      }
    }
  ).takealotInventorySnapshot
  const originalCreate = snapshotModel.create
  const originalFindMany = snapshotModel.findMany
  const integrationModel = prisma.integration as unknown as {
    findFirst: (input: unknown) => Promise<Record<string, unknown> | null>
    findMany: (input: unknown) => Promise<Array<{ id: string }>>
  }
  const originalIntegrationFindFirst = integrationModel.findFirst
  const originalIntegrationFindMany = integrationModel.findMany
  const offerModel = prisma.takealotOffer as unknown as {
    aggregate: (input: unknown) => Promise<{
      _count: { _all: number }
      _sum: { stockCpt: number; stockJhb: number; stockDbn: number }
    }>
    findMany: (input: unknown) => Promise<Array<{ sku: string | null; offerId: string; imageUrl: string | null }>>
  }
  const originalOfferAggregate = offerModel.aggregate
  const originalOfferFindMany = offerModel.findMany
  const companyUserModel = prisma.companyUser as unknown as {
    findFirst: (input: unknown) => Promise<{ userId: string; companyId: string; accesses: never[] } | null>
  }
  const originalCompanyUserFindFirst = companyUserModel.findFirst
  const productModel = prisma.product as unknown as {
    findMany: (input: unknown) => Promise<Array<{ sku: string; averageCost: number }>>
  }
  const originalProductFindMany = productModel.findMany
  let includeBetaCost = true
  snapshotModel.create = async ({ data }) => {
    snapshotRows.push(data)
    return { ...data, id: `snapshot-${snapshotRows.length}` }
  }
  snapshotModel.findMany = async ({ where }) =>
    snapshotRows
      .filter(
        (row) =>
          row.companyId === where.companyId &&
          row.integrationId === where.integrationId &&
          row.capturedAt >= where.capturedAt.gte &&
          row.capturedAt <= where.capturedAt.lte,
      )
      .sort((left, right) => left.capturedAt.getTime() - right.capturedAt.getTime())
  integrationModel.findFirst = async () => ({
    id: integrationId,
    companyId: 'a2b8e672-7f09-4783-81ba-51a572205b71',
    type: 'TAKEALOT',
    name: 'Test Takealot',
    credentials: { apiKey: 'test-api-key' },
    configuration: { lowStockThreshold: 5 },
    isActive: true,
  })
  integrationModel.findMany = async () => [{ id: integrationId }]
  offerModel.aggregate = async () => ({
    _count: { _all: 1 },
    _sum: { stockCpt: 560, stockJhb: 752, stockDbn: 128 },
  })
  offerModel.findMany = async () => []
  companyUserModel.findFirst = async () => ({
    userId: 'permission-test-user',
    companyId: 'permission-test-company',
    accesses: [],
  })
  productModel.findMany = async () => [
    { sku: 'SKU-R10-A', averageCost: 10 },
    ...(includeBetaCost ? [{ sku: 'SKU-B', averageCost: 2 }] : []),
  ]

  const originalFetch = globalThis.fetch
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => {
    const candidate = args[0]
    if (
      candidate instanceof Error &&
      [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'VALIDATION_ERROR',
        'TAKEALOT_INCOMPLETE_RESPONSE',
        'TAKEALOT_INVALID_RESPONSE',
      ].includes((candidate as Error & { code?: string }).code ?? '')
    )
      return
    originalConsoleError(...args)
  }
  const upstreamCalls: Array<{ url: URL; authorization: string | null; apiKey: string | null }> = []
  let retryAttempts = 0
  const sales = [
    {
      shipment_id: 1,
      shipment_state_id: 1,
      po_number: 101,
      shipment_name: 'Shipment 1',
      offer_id: 55,
      product_title: 'Alpha item',
      takealot_url_mobi: 'https://example.test/a',
      sku: 'SKU-R10-A',
      tsin: 100,
      order_id: 10,
      order_item_id: 1,
      quantity: 2,
      selling_price: 10,
      total_fee: 1,
      dc: 'JHB',
      customer_dc: 'CPT',
      order_date: '01 Oct 2026 10:00:00',
      sale_status: true,
      promotion: false,
      customer: 'Must not be returned',
      stock_source_region: 'ZA',
    },
    {
      shipment_id: 2,
      shipment_state_id: 1,
      po_number: 102,
      shipment_name: 'Shipment 2',
      offer_id: 55,
      product_title: 'Alpha item',
      takealot_url_mobi: 'https://example.test/a',
      sku: 'SKU-R10-A',
      tsin: 100,
      order_id: 10,
      order_item_id: 2,
      quantity: 1,
      selling_price: 20,
      total_fee: 2,
      dc: 'JHB',
      customer_dc: 'CPT',
      order_date: '2026-10-01T12:00:00Z',
      sale_status: false,
      promotion: true,
      customer: 'Must not be returned',
      stock_source_region: 'ZA',
    },
    {
      shipment_id: 3,
      shipment_state_id: 1,
      po_number: 103,
      shipment_name: 'Shipment 3',
      offer_id: 66,
      product_title: 'Beta item',
      takealot_url_mobi: 'https://example.test/b',
      sku: 'SKU-B',
      tsin: 200,
      order_id: 11,
      order_item_id: 3,
      quantity: 3,
      selling_price: 5,
      total_fee: 1.15,
      dc: 'CPT',
      customer_dc: 'JHB',
      order_date: '2026-10-02T08:00:00Z',
      sale_status: true,
      promotion: true,
      customer: 'Must not be returned',
      stock_source_region: 'ZA',
    },
  ]

  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const authorization = new Headers(init?.headers).get('authorization')
    const apiKey = new Headers(init?.headers).get('X-API-Key')
    upstreamCalls.push({ url, authorization, apiKey })
    if (url.hostname === 'marketplace-api.takealot.com' && url.pathname === '/v1/balances') {
      return Response.json({ balances: { current: 120, available: 100, held_back: 20 } })
    }
    if (url.hostname === 'marketplace-api.takealot.com' && url.pathname === '/v1/transactions') {
      const types = url.searchParams.getAll('transaction_type__in')
      const customerPayment = {
        transaction_id: 501,
        transaction_type: 'payment-customer-order',
        amount_incl_vat: 100,
        vat_multiplier: 0.15,
        created_at: '2026-10-01T10:00:00+02:00',
        references: { order_id: 10 },
      }
      const fulfilmentCharge = {
        transaction_id: 502,
        transaction_type: 'charge-fulfilment-fee',
        amount_incl_vat: -25,
        vat_multiplier: 0.15,
        created_at: '2026-10-02T11:30:00+02:00',
        references: { order_id: 10 },
      }
      if (types.length > 0) {
        const filtered = [customerPayment, fulfilmentCharge].filter((item) => types.includes(item.transaction_type))
        return Response.json({ items: filtered, continuation_token: null, count: filtered.length })
      }
      if (url.searchParams.get('continuation_token') === 'transactions-page-2') {
        return Response.json({ items: [fulfilmentCharge], continuation_token: null })
      }
      return Response.json({
        items: [customerPayment],
        continuation_token: 'transactions-page-2',
        count: 2,
      })
    }
    if (url.pathname === '/v1/test/retry') {
      retryAttempts++
      if (retryAttempts === 1) {
        return new Response(JSON.stringify({ message: 'rate limited' }), {
          status: 429,
          headers: { 'content-type': 'application/json', 'retry-after': '0' },
        })
      }
      return Response.json({ ok: true })
    }
    if (url.pathname === '/v1/test/forbidden') {
      return Response.json({ message: 'private upstream detail' }, { status: 403 })
    }
    if (url.pathname === '/v2/offers/offer/NOTFOUND') {
      return new Response(null, { status: 404 })
    }
    if (url.pathname === '/v2/offers') {
      return Response.json({
        page_size: 100,
        page_number: 1,
        total_results: 1,
        offers: [{ offer_id: 42, sku: 'SKU-42', title: 'Test offer' }],
      })
    }
    if (url.pathname === '/v1/sales/summary') {
      return Response.json({ sales_summary: [{ date_range: 'documented period', total: 500, quantity: 7 }] })
    }
    if (url.pathname === '/v1/offers/stock_counts') return Response.json({ count: 15 })
    if (url.pathname === '/v1/offers/stock_health_stats') {
      return Response.json({ storage_fee_enabled_offer_count: 2 })
    }
    if (url.pathname === '/v1/sales/orders') {
      const pageNumber = Number(url.searchParams.get('page_number') ?? 1)
      return Response.json({
        page_summary: { page_size: 2, page_number: pageNumber, total: 1 },
        orders: [
          {
            order_id: 10,
            date_authed: '2026-10-01T10:00:00Z',
            order_items: [
              {
                order_item_id: 1,
                merchant_sku: 'SKU-A',
                title: 'Alpha item',
                tsin_id: 100,
                takealot_url: 'https://example.test/a',
              },
              {
                order_item_id: 2,
                merchant_sku: 'SKU-B',
                title: 'Beta item',
                tsin_id: 200,
                takealot_url: 'https://example.test/b',
              },
            ],
          },
        ],
      })
    }
    if (url.pathname === '/v1/sales') {
      const pageNumber = Number(url.searchParams.get('page_number') ?? 1)
      const pageSize = Number(url.searchParams.get('page_size') ?? 100)
      const filters = url.searchParams.getAll('filters')
      if (filters.includes('sku:INVALID_DATE') || filters.includes('sku:OFFSET_DATE')) {
        const orderDate = filters.includes('sku:INVALID_DATE') ? 'not-a-date' : '2026-10-02T00:30:00+02:00'
        return Response.json({
          page_summary: { page_size: pageSize, page_number: pageNumber, total: 1 },
          sales: [{ ...sales[0], order_date: orderDate }],
        })
      }
      if (url.pathname === '/v1/sales' && (filters.includes('sku:PAGEFAIL') || filters.includes('sku:PAGEOK'))) {
        const completePagination = filters.includes('sku:PAGEOK')
        const pageRows =
          pageNumber === 1
            ? Array.from({ length: 100 }, (_, index) => ({
                ...sales[index % sales.length],
                order_id: index + 1,
                order_item_id: index + 1,
              }))
            : completePagination
              ? [{ ...sales[0], order_id: 101, order_item_id: 101 }]
              : []
        return Response.json({
          page_summary: { page_size: pageSize, page_number: pageNumber, total: 101 },
          sales: pageRows,
        })
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
      const rows = sales.slice((pageNumber - 1) * pageSize, pageNumber * pageSize)
      return Response.json({
        page_summary: { page_size: pageSize, page_number: pageNumber, total: sales.length },
        sales: rows,
      })
    }
    throw new Error(`Unexpected Takealot test URL: ${url.pathname}`)
  }

  const request = async (path: string, headers?: http.OutgoingHttpHeaders, method = 'GET'): Promise<HttpResult> =>
    new Promise((resolve, reject) => {
      const outgoing = http.request(
        `${baseUrl}${path.replace(/^\/takealot/, `/integrations/${integrationId}/takealot`)}`,
        { headers, method },
        (response) => {
          let rawBody = ''
          response.setEncoding('utf8')
          response.on('data', (chunk: string) => {
            rawBody += chunk
          })
          response.on('end', () => {
            try {
              resolve({
                status: response.statusCode ?? 500,
                body: JSON.parse(rawBody) as Record<string, unknown>,
              })
            } catch (error) {
              reject(error)
            }
          })
        },
      )
      outgoing.on('error', reject)
      outgoing.end()
    })
  const dataOf = (result: HttpResult): Record<string, any> => result.body.data as Record<string, any>
  const logPass = (name: string) => console.log(`  PASS  ${name}`)

  try {
    console.log('\nTakealot integration checks')

    ;(env as { testAuthBypass: boolean }).testAuthBypass = false
    const unauthenticated = await request('/takealot/overview')
    assert.equal(unauthenticated.status, 401)
    const unauthenticatedEvents = await request('/takealot/sync-events')
    assert.equal(unauthenticatedEvents.status, 401)
    const unauthenticatedStop = await request('/takealot/sync/stop', undefined, 'POST')
    assert.equal(unauthenticatedStop.status, 401)
    ;(env as { testAuthBypass: boolean }).testAuthBypass = true
    logPass('dashboard, sync event stream, and stop routes require authentication')
    ;(env as { testAuthBypass: boolean }).testAuthBypass = false
    const permissionToken = jwt.sign(
      { sub: 'permission-test-user', companyId: 'permission-test-company' },
      env.jwtSecret,
    )
    const deniedWithoutTakealotAccess = await request('/takealot/overview', {
      Authorization: `Bearer ${permissionToken}`,
    })
    assert.equal(deniedWithoutTakealotAccess.status, 403)
    ;(env as { testAuthBypass: boolean }).testAuthBypass = true
    logPass('every Takealot route rejects authenticated users without TAKEALOT permission')

    const invalidTrend = await request('/takealot/sales/trends?from=2026-10-01&to=2026-10-02&interval=year')
    assert.equal(invalidTrend.status, 400)
    logPass('query validation rejects unsupported trend intervals')
    const invalidFilter = await request('/takealot/sales?unsupportedFilter=value')
    assert.equal(invalidFilter.status, 400)
    logPass('query validation rejects unsupported filters')

    const overview = await request('/takealot/overview?from=2026-10-01&to=2026-10-02')
    assert.equal(overview.status, 200, JSON.stringify(overview.body))
    assert.equal(dataOf(overview).salesSummary.requestedRangeApplied, false)
    assert.equal(dataOf(overview).inventory.stockCounts.count, 15)
    assert.equal(dataOf(overview).inventory.stockHealth.storage_fee_enabled_offer_count, 2)
    logPass('overview combines the documented summary and current stock endpoints without claiming date filtering')

    const futureDate = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    const invalidTransactionRange = await request(
      `/takealot/transactions?from=${futureDate}&to=${futureDate}&page=1&limit=25&sortBy=createdAt&sortOrder=desc`,
    )
    assert.equal(invalidTransactionRange.status, 400)
    const oversizedTransactionRange = await request(
      '/takealot/transactions?from=2026-01-01&to=2026-07-01&page=1&limit=25&sortBy=createdAt&sortOrder=desc',
    )
    assert.equal(oversizedTransactionRange.status, 400)
    const transactionReport = await request(
      '/takealot/transactions?from=2026-10-01&to=2026-10-02&page=1&limit=1&sortBy=amount&sortOrder=asc',
    )
    assert.equal(transactionReport.status, 200, JSON.stringify(transactionReport.body))
    const transactionData = dataOf(transactionReport)
    assert.equal((transactionData.transactions as Array<Record<string, unknown>>).length, 1)
    assert.equal((transactionData.transactions as Array<Record<string, unknown>>)[0].transaction_id, 502)
    assert.deepEqual(transactionData.summary, {
      count: 2,
      inflow: 100,
      outflow: 25,
      net: 75,
      averageTransaction: 37.5,
      byType: [
        { type: 'payment-customer-order', count: 1, amount: 100, inflow: 100, outflow: 0 },
        { type: 'charge-fulfilment-fee', count: 1, amount: -25, inflow: 0, outflow: 25 },
      ],
      trend: [
        { date: '2026-10-01', inflow: 100, outflow: 0, net: 100, count: 1 },
        { date: '2026-10-02', inflow: 0, outflow: 25, net: -25, count: 1 },
      ],
    })
    assert.deepEqual(transactionData.balance, { current: 120, available: 100, held_back: 20 })
    assert.equal((transactionReport.body.pagination as Record<string, unknown>).total, 2)
    assert.equal((transactionReport.body.pagination as Record<string, unknown>).hasMore, true)
    const filteredTransactions = await request(
      '/takealot/transactions?from=2026-10-01&to=2026-10-02&page=1&limit=25&sortBy=createdAt&sortOrder=desc&types=charge-fulfilment-fee',
    )
    assert.equal(filteredTransactions.status, 200)
    assert.equal((dataOf(filteredTransactions).summary as Record<string, unknown>).count, 1)
    assert.equal((dataOf(filteredTransactions).transactions as Array<Record<string, unknown>>)[0].transaction_id, 502)
    const marketplaceCalls = upstreamCalls.filter((call) => call.url.hostname === 'marketplace-api.takealot.com')
    assert.equal(marketplaceCalls.length, 5)
    assert.ok(marketplaceCalls.every((call) => call.apiKey === 'test-api-key' && call.authorization === null))
    const marketplaceTransactionCalls = marketplaceCalls.filter((call) => call.url.pathname === '/v1/transactions')
    assert.equal(marketplaceTransactionCalls.length, 3)
    assert.deepEqual(marketplaceTransactionCalls[0].url.searchParams.getAll('transaction_type__in'), [])
    assert.equal(marketplaceTransactionCalls[0].url.searchParams.get('created_at__gte'), '2026-10-01T00:00:00+02:00')
    assert.equal(
      marketplaceTransactionCalls[0].url.searchParams.get('created_at__lte'),
      '2026-10-02T23:59:59.999+02:00',
    )
    assert.deepEqual(marketplaceTransactionCalls[2].url.searchParams.getAll('transaction_type__in'), [
      'charge-fulfilment-fee',
    ])
    assert.equal(transactionData.currency, 'ZAR')
    logPass(
      'transactions fetch all continuation pages, aggregate signed totals, filter/sort/page, and keep current balance distinct',
    )

    const offersPage = await takealotApi.getOffers('test-api-key', 1, 100)
    assert.equal(offersPage.page_summary.total_results, 1)
    assert.equal(offersPage.offers[0].offer_id, 42)
    logPass('Takealot offer pagination parses flat page metadata returned by /v2/offers')
    const { normalizeOffer } = await import('../src/modules/takealot/sync.service')
    const normalizedOffer = normalizeOffer(
      {
        offer_id: 42,
        stock_at_takealot: [
          { warehouse: { warehouse_id: 1, name: 'Cape Town' }, quantity_available: 12 },
          { warehouse: { warehouse_id: 2, name: 'Johannesburg' }, quantity_available: 8 },
          { warehouse: { warehouse_id: 3, name: 'Durban' }, quantity_available: 6 },
        ],
        stock_on_way: [{ warehouse: { warehouse_id: 2, name: 'Johannesburg' }, quantity_available: 3 }],
        stock_cover: [{ warehouse_id: 1, stock_cover_days: 4 }],
        sales_units: [{ warehouse_id: 3, sales_units: 5 }],
      },
      null,
      null,
    )
    assert.equal(normalizedOffer.stockCpt, 12)
    assert.equal(normalizedOffer.stockJhb, 8)
    assert.equal(normalizedOffer.stockDbn, 6)
    assert.equal(normalizedOffer.stockOnWayJhb, 3)
    assert.equal(normalizedOffer.stockCoverCpt, 4)
    assert.equal(normalizedOffer.salesUnitsDbn, 5)
    logPass('Takealot warehouse stock, incoming, cover, and sales arrays normalize by warehouse')
    const takealotSample = normalizeOffer(
      {
        offer_id: 93606482,
        sku: '5-90R',
        stock_at_takealot: [
          { warehouse: { warehouse_id: 1, name: 'CPT' }, quantity_available: 0 },
          { warehouse: { warehouse_id: 3, name: 'JHB' }, quantity_available: 0 },
          { warehouse: { warehouse_id: 6, name: 'DBN' }, quantity_available: 0 },
        ],
        stock_on_way: [
          { warehouse: { warehouse_id: 1, name: 'CPT' }, quantity_available: 0 },
          { warehouse: { warehouse_id: 3, name: 'JHB' }, quantity_available: 0 },
          { warehouse: { warehouse_id: 6, name: 'DBN' }, quantity_available: 0 },
        ],
        stock_cover: [
          { warehouse_id: 1, stock_cover_days: 0 },
          { warehouse_id: 3, stock_cover_days: 0 },
          { warehouse_id: 6, stock_cover_days: 0 },
        ],
        sales_units: [
          { warehouse_id: 1, sales_units: 0 },
          { warehouse_id: 3, sales_units: 0 },
          { warehouse_id: 6, sales_units: 0 },
        ],
        total_excess_takealot_stock: null,
        catalogue_quality_score: 1,
      },
      90,
      null,
    )
    assert.equal(takealotSample.stockCpt, 0)
    assert.equal(takealotSample.stockJhb, 0)
    assert.equal(takealotSample.stockDbn, 0)
    assert.equal(takealotSample.stockOnWayCpt, 0)
    assert.equal(takealotSample.stockOnWayJhb, 0)
    assert.equal(takealotSample.stockOnWayDbn, 0)
    assert.equal(takealotSample.salesUnitsCpt, 0)
    assert.equal(takealotSample.salesUnitsJhb, 0)
    assert.equal(takealotSample.salesUnitsDbn, 0)
    assert.equal(takealotSample.stockCoverCpt, 0)
    assert.equal(takealotSample.stockCoverJhb, 0)
    assert.equal(takealotSample.stockCoverDbn, 0)
    assert.equal(takealotSample.stockCoverCptRaw, '0')
    assert.equal(takealotSample.totalExcessStock, null)
    assert.equal(takealotSample.catalogueQualityScore, 1)
    const { resolveTakealotUnitCosts } = await import('../src/modules/takealot/service')
    const skuCosts = await resolveTakealotUnitCosts('test-company', ['5-90R', 'C35-M139-01'])
    assert.equal(skuCosts.get('5-90R'), 90)
    assert.equal(skuCosts.get('C35-M139-01'), 35)
    logPass('Takealot sample warehouse zeroes and 5-90R SKU cost map to numeric values')

    const salesList = await request(
      '/takealot/sales?from=2026-10-01&to=2026-10-02&sku=SKU-A&productTitle=Alpha%20item&tsin=100&orderId=10&dc=JHB&customerDc=CPT&saleStatus=true&promotion=false&page=2&limit=2',
    )
    assert.equal(salesList.status, 200)
    assert.equal((dataOf(salesList).sales as unknown[]).length, 1)
    assert.equal((salesList.body.pagination as Record<string, unknown>).total, 3)
    assert.equal((salesList.body.pagination as Record<string, unknown>).hasMore, false)
    assert.equal('customer' in (dataOf(salesList).sales as Array<Record<string, unknown>>)[0], false)
    const salesApiCall = upstreamCalls.find((call) => call.url.pathname === '/v1/sales')
    assert.ok(salesApiCall)
    for (const filter of [
      'start_date:2026-10-01',
      'end_date:2026-10-02',
      'sku:SKU-A',
      'product_title:Alpha item',
      'tsin:100',
      'order_id:10',
      'dc:JHB',
      'customer_dc:CPT',
      'sale_status:true',
      'promotion:false',
    ]) {
      assert.ok(salesApiCall.url.searchParams.getAll('filters').includes(filter), `missing mapped filter ${filter}`)
    }
    assert.equal(salesApiCall.url.searchParams.get('page_number'), '2')
    assert.equal(salesApiCall.url.searchParams.get('page_size'), '2')
    logPass('sales filters map to documented upstream filters and pagination metadata is accurate')

    const partialResult = await request('/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=PAGEFAIL')
    assert.equal(partialResult.status, 502)
    assert.equal(partialResult.body.success, false)
    logPass('incomplete multi-page datasets fail instead of returning partial analytics')
    const multiPageResult = await request('/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=PAGEOK')
    assert.equal(multiPageResult.status, 200)
    assert.equal(
      upstreamCalls.filter(
        (call) => call.url.pathname === '/v1/sales' && call.url.searchParams.getAll('filters').includes('sku:PAGEOK'),
      ).length,
      2,
    )
    logPass('analytics fetches every page before aggregating a complete result')

    const trends = await request('/takealot/sales/trends?from=2026-10-01&to=2026-10-02&interval=day&metric=orders')
    assert.equal(trends.status, 200)
    const trendSeries = dataOf(trends).series as Array<Record<string, unknown>>
    assert.equal(trendSeries.length, 2)
    assert.deepEqual(trendSeries[0], { date: '2026-10-01', revenue: 30, units: 3, orders: 1, totalFee: 3 })
    assert.deepEqual(trendSeries[1], { date: '2026-10-02', revenue: 5, units: 3, orders: 1, totalFee: 1.15 })
    logPass('trends aggregate ISO and Takealot-formatted dates by UTC day')
    const invalidOrderDate = await request('/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=INVALID_DATE')
    assert.equal(invalidOrderDate.status, 502)
    assert.equal((invalidOrderDate.body.error as Record<string, unknown>).code, 'TAKEALOT_INVALID_RESPONSE')
    logPass('trends explicitly reject malformed upstream order dates')
    const timezoneTrend = await request('/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=OFFSET_DATE')
    assert.equal(timezoneTrend.status, 200)
    assert.equal((dataOf(timezoneTrend).series as Array<Record<string, unknown>>)[0].date, '2026-10-01')
    logPass('ISO timezone offsets are applied before assigning trend buckets')

    const callsBeforeCoalescing = upstreamCalls.filter((call) => call.url.pathname === '/v1/sales').length
    const concurrentTrends = await Promise.all([
      request('/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=SKU-A'),
      request('/takealot/sales/trends?from=2026-10-01&to=2026-10-02&sku=SKU-A'),
    ])
    assert.deepEqual(
      concurrentTrends.map((result) => result.status),
      [200, 200],
    )
    assert.equal(upstreamCalls.filter((call) => call.url.pathname === '/v1/sales').length - callsBeforeCoalescing, 1)
    logPass('concurrent identical sales requests share one in-progress upstream fetch')

    const breakdown = await request('/takealot/sales/breakdown?from=2026-10-01&to=2026-10-02&groupBy=promotion')
    assert.equal(breakdown.status, 200)
    const groups = dataOf(breakdown).breakdown as Array<Record<string, unknown>>
    assert.deepEqual(groups, [
      { key: 'false', revenue: 10, units: 2, orders: 1 },
      { key: 'true', revenue: 25, units: 4, orders: 2 },
    ])
    logPass('breakdowns group data and deduplicate orders across multiple line items')

    const products = await request(
      '/takealot/products/performance?from=2026-10-01&to=2026-10-02&sortBy=revenue&order=desc&page=1&limit=1',
    )
    assert.equal(products.status, 200)
    assert.deepEqual((dataOf(products).products as Array<Record<string, unknown>>)[0], {
      sku: 'SKU-R10-A',
      offerId: 55,
      tsin: 100,
      title: 'Alpha item',
      imageUrl: null,
      unitCost: 10,
      totalCost: 30,
      totalFee: 3,
      feePerUnit: 1,
      costedUnits: 3,
      uncostedUnits: 0,
      profit: -3,
      profitPerUnit: -1,
      revenue: 30,
      units: 3,
      orders: 1,
      averagePrice: 10,
    })
    assert.equal((products.body.pagination as Record<string, unknown>).total, 2)
    assert.deepEqual(dataOf(products).summary, {
      revenue: 35,
      averagePrice: 5.83,
      units: 6,
      orders: 2,
      totalFee: 4.15,
      feePerUnit: 0.69,
      feeRowsWithTotal: 3,
      feeRowsMissingTotal: 0,
      feeComponents: {
        successFee: { total: null, rowsWithValue: 0 },
        fulfillmentFee: { total: null, rowsWithValue: 0 },
        courierCollectionFee: { total: null, rowsWithValue: 0 },
        stockTransferFee: { total: null, rowsWithValue: 0 },
      },
      totalCost: 36,
      costedUnits: 6,
      uncostedUnits: 0,
      costCoverage: 1,
      profit: -5.15,
      profitPerUnit: -0.86,
      unitsPerOrder: 3,
    })
    logPass('product performance ranks by stable offer identifier and calculates weighted average price')
    const { findAgentTool } = await import('../src/modules/agent/registry')
    const takealotTool = findAgentTool('takealot_tool', 'sales_summary')
    assert.ok(takealotTool)
    assert.equal(takealotTool.requiredAccessByOperation.sales_summary, 'TAKEALOT')
    const { executeTakealotTool } = await import('../src/modules/agent/graph/takealotTool')
    const agentSummary = (await executeTakealotTool('a2b8e672-7f09-4783-81ba-51a572205b71', 'sales_summary', {
      integrationId,
      from: '2026-10-01',
      to: '2026-10-02',
    })) as { revenue: number; totalFee: number | null; profit: number | null }
    assert.equal(agentSummary.revenue, 35)
    assert.equal(agentSummary.totalFee, 4.15)
    assert.equal(agentSummary.profit, -5.15)
    includeBetaCost = false
    const incompleteSummary = (await executeTakealotTool('a2b8e672-7f09-4783-81ba-51a572205b71', 'sales_summary', {
      integrationId,
      from: '2026-10-01',
      to: '2026-10-02',
    })) as {
      totalCost: number | null
      profit: number | null
      costCoverage: number
      costedUnits: number
      uncostedUnits: number
    }
    assert.equal(incompleteSummary.totalCost, 30)
    assert.equal(incompleteSummary.profit, 0.85)
    assert.equal(incompleteSummary.costCoverage, 0.5)
    assert.equal(incompleteSummary.costedUnits, 3)
    assert.equal(incompleteSummary.uncostedUnits, 3)
    const incompleteProducts = await request(
      '/takealot/products/performance?from=2026-10-01&to=2026-10-02&sortBy=revenue&order=desc&page=1&limit=10',
    )
    assert.equal(incompleteProducts.status, 200)
    const uncostedProduct = (dataOf(incompleteProducts).products as Array<Record<string, unknown>>).find(
      (product) => product.sku === 'SKU-B',
    )
    assert.ok(uncostedProduct)
    assert.equal(uncostedProduct.totalCost, null)
    assert.equal(uncostedProduct.uncostedUnits, 3)
    logPass('Takealot summary returns backend-calculated partial cost and profit with cost coverage')

    const orders = await request('/takealot/orders?from=2026-10-01&to=2026-10-02&sku=SKU-A&orderId=10&page=1&limit=2')
    assert.equal(orders.status, 200)
    const orderRows = dataOf(orders).orders as Array<Record<string, unknown>>
    assert.equal(orderRows.length, 1)
    assert.equal((orderRows[0].order_items as unknown[]).length, 2)
    const ordersCall = upstreamCalls.filter((call) => call.url.pathname === '/v1/sales/orders').at(-1)
    assert.ok(ordersCall)
    assert.equal(ordersCall.url.searchParams.get('start_date'), '2026-10-01')
    assert.equal(ordersCall.url.searchParams.get('end_date'), '2026-10-02')
    assert.equal(ordersCall.url.searchParams.get('sku'), 'SKU-A')
    logPass('orders use the dedicated endpoint and preserve separate order-item rows')

    const inventory = await request('/takealot/inventory/summary')
    assert.equal(inventory.status, 200)
    assert.equal(snapshotRows.length, 1)
    assert.equal(dataOf(inventory).stockCounts.count, 15)
    assert.equal(dataOf(inventory).stockCounts.reported_total_stock_count, 15)
    assert.equal(dataOf(inventory).stockCounts.total_stock_count, 1440)
    assert.equal(dataOf(inventory).stockCounts.total_stock_count_source, 'synchronized_offers')
    assert.equal(snapshotRows[0].companyId, 'a2b8e672-7f09-4783-81ba-51a572205b71')
    assert.equal(snapshotRows[0].integrationId, integrationId)
    logPass('inventory refresh saves a timestamped seller-scoped snapshot')

    snapshotRows.push({
      companyId: 'other-company',
      integrationId: 'other-integration',
      capturedAt: new Date('2026-10-14T00:00:00.000Z'),
      stockCounts: { count: 999 },
      stockHealth: { storage_fee_enabled_offer_count: 999 },
    })
    const snapshots = await request('/takealot/inventory/snapshots?from=2026-10-01&to=2026-10-31&interval=day')
    assert.equal(snapshots.status, 200)
    assert.equal((dataOf(snapshots).series as unknown[]).length, 1)
    logPass('inventory history returns only snapshots actually recorded')

    const retryResult = await takealotClient.request<{ ok: boolean }>('test-api-key', '/v1/test/retry', {
      q: 'a value',
    })
    assert.equal(retryResult.ok, true)
    assert.equal(retryAttempts, 2)
    assert.equal(upstreamCalls.at(-1)?.authorization, 'Key test-api-key')
    assert.equal(upstreamCalls.at(-1)?.url.searchParams.get('q'), 'a value')
    logPass('central client encodes payloads, authenticates requests, and retries a rate-limited call')

    assert.equal(await takealotClient.findOffer('test-api-key', 'OFFER_ID', 'NOTFOUND'), null)
    logPass('existing offer lookup preserves its not-found behavior through the central client')

    await assert.rejects(
      () => takealotClient.request('test-api-key', '/v1/test/forbidden'),
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'Takealot API request failed with status 403.' &&
        !error.message.includes('private upstream detail'),
    )
    logPass('upstream failures surface sanitized errors instead of empty successful data')

    console.log('\nAll Takealot integration checks passed.')
  } finally {
    globalThis.fetch = originalFetch
    console.error = originalConsoleError
    snapshotModel.create = originalCreate
    snapshotModel.findMany = originalFindMany
    integrationModel.findFirst = originalIntegrationFindFirst
    integrationModel.findMany = originalIntegrationFindMany
    offerModel.aggregate = originalOfferAggregate
    offerModel.findMany = originalOfferFindMany
    companyUserModel.findFirst = originalCompanyUserFindFirst
    productModel.findMany = originalProductFindMany
    const { closeTakealotSyncQueue } = await import('../src/modules/takealot/sync.queue')
    const { redisClient } = await import('../src/infrastructure/redis')
    await closeTakealotSyncQueue()
    await redisClient.quit()
    http.globalAgent.destroy()
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    await prisma.$disconnect()
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error('\nTakealot integration checks failed.')
    console.error(error)
    process.exit(1)
  },
)
