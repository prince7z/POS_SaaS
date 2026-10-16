import { Access } from '@prisma/client'
import { Router, type Request, type Response } from 'express'

import { requireTakealotApiKey } from '../../middleware/takealot'
import { requireAccess } from '../../middleware/access'
import { requireAuth } from '../../middleware/auth'
import { sendSuccess } from '../../utils/apiResponse'
import { AppError, unauthorized } from '../../utils/errors'
import * as integrationService from '../integrations/service'
import * as dashboardService from './dashboard.service'
import { enqueueTakealotSync } from './sync.queue'
import * as service from './service'

const router = Router({ mergeParams: true })
router.use(requireAuth, requireAccess(Access.TAKEALOT))

const authFrom = (request: Request) => {
  if (!request.auth) throw unauthorized()
  return request.auth
}

const apiKeyFrom = (request: Request) => {
  if (!request.takealotApiKey) {
    throw new AppError('Takealot API key is not configured.', 422, 'TAKEALOT_API_NOT_CONFIGURED')
  }
  return request.takealotApiKey
}

const sendPaginatedSuccess = (response: Response, data: unknown, pagination: unknown) =>
  response.status(200).json({ success: true, data, pagination })

const integrationIdFrom = (request: Request) => integrationService.parseIntegrationId(request.params.integrationId)

router.post('/sync', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  return sendSuccess(response, await enqueueTakealotSync(auth.companyId, integrationId), 202)
})

router.get('/sync-status', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  return sendSuccess(response, await dashboardService.syncStatus(auth.companyId, integrationId))
})

router.get('/sync-events', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)

  response.status(200)
  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache, no-transform')
  response.setHeader('Connection', 'keep-alive')
  response.setHeader('X-Accel-Buffering', 'no')
  response.flushHeaders()

  let closed = false
  let timer: NodeJS.Timeout | undefined
  const close = () => {
    closed = true
    if (timer) clearInterval(timer)
  }
  response.on('close', close)

  const sendStatus = async () => {
    if (closed) return
    try {
      const status = await dashboardService.syncStatus(auth.companyId, integrationId)
      if (closed) return
      response.write(`event: sync-status\ndata: ${JSON.stringify(status)}\n\n`)
      if (!['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(status.status)) {
        close()
        response.end()
      }
    } catch (error) {
      close()
      if (!response.destroyed) response.destroy(error instanceof Error ? error : undefined)
    }
  }

  await sendStatus()
  if (!closed) timer = setInterval(() => void sendStatus(), 1000)
})

router.post('/sync/stop', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  return sendSuccess(response, await dashboardService.stopSync(auth.companyId, integrationId))
})

router.get('/dashboard/overview', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  return sendSuccess(response, await dashboardService.overview(auth.companyId, integrationId))
})

router.get('/offers', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  await dashboardService.syncStatus(auth.companyId, integrationId, true)
  const input = dashboardService.parse(dashboardService.offersSchema, request.query)
  const result = await dashboardService.listOffers(integrationId, input)
  const { pagination, ...data } = result
  return sendPaginatedSuccess(response, data, pagination)
})

router.get('/analytics/inventory', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  return sendSuccess(response, await dashboardService.inventoryAnalytics(integrationId))
})

router.get('/analytics/warehouses', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  return sendSuccess(response, await dashboardService.warehouseAnalytics(integrationId))
})

router.get('/analytics/pricing-sales', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  return sendSuccess(response, await dashboardService.pricingSalesAnalytics(integrationId))
})

router.get('/alerts', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  const input = dashboardService.parse(dashboardService.alertsSchema, request.query)
  const result = await dashboardService.listAlerts(auth.companyId, integrationId, input)
  const { pagination, ...data } = result
  return sendPaginatedSuccess(response, data, pagination)
})

router.get('/overview', requireTakealotApiKey, async (request, response) => {
  const input = service.parse(service.overviewSchema, request.query)
  return sendSuccess(response, await service.overview(apiKeyFrom(request), input))
})

router.get('/sales', requireTakealotApiKey, async (request, response) => {
  const result = await service.listSales(apiKeyFrom(request), service.parse(service.salesListSchema, request.query))
  return sendPaginatedSuccess(response, { sales: result.sales }, result.pagination)
})

router.get('/sales/trends', requireTakealotApiKey, async (request, response) => {
  const companyId = authFrom(request).companyId
  return sendSuccess(
    response,
    await service.salesTrends(companyId, apiKeyFrom(request), service.parse(service.trendsSchema, request.query)),
  )
})

router.get('/sales/breakdown', requireTakealotApiKey, async (request, response) => {
  const companyId = authFrom(request).companyId
  return sendSuccess(
    response,
    await service.salesBreakdown(companyId, apiKeyFrom(request), service.parse(service.breakdownSchema, request.query)),
  )
})

router.get('/products/performance', requireTakealotApiKey, async (request, response) => {
  const companyId = authFrom(request).companyId
  const result = await service.productPerformance(
    companyId,
    apiKeyFrom(request),
    service.parse(service.productsSchema, request.query),
  )
  const { pagination, ...data } = result
  return sendPaginatedSuccess(response, data, pagination)
})

router.get('/orders', requireTakealotApiKey, async (request, response) => {
  const result = await service.listOrders(apiKeyFrom(request), service.parse(service.ordersSchema, request.query))
  return sendPaginatedSuccess(response, { orders: result.orders }, result.pagination)
})

router.get('/inventory/summary', requireTakealotApiKey, async (request, response) => {
  return sendSuccess(
    response,
    await service.inventorySummary(authFrom(request).companyId, integrationIdFrom(request), apiKeyFrom(request)),
  )
})

router.get('/inventory/snapshots', async (request, response) => {
  const auth = authFrom(request)
  const integrationId = integrationIdFrom(request)
  await integrationService.assertTakealotIntegration(auth.companyId, integrationId)
  return sendSuccess(
    response,
    await service.inventorySnapshots(
      auth.companyId,
      integrationId,
      service.parse(service.inventorySnapshotsSchema, request.query),
    ),
  )
})

export default router
