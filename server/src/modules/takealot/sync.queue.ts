import { randomUUID } from 'node:crypto'
import { Queue } from 'bullmq'

import { createBullMqConnection } from '../../infrastructure/redis'
import { AppError } from '../../utils/errors'
import { logger } from '../../lib/logger'
import { prisma } from '../../lib/prisma'
import { getTakealotApiKey } from '../integrations/service'

export const TAKEALOT_SYNC_QUEUE = 'takealot-offers-sync'

export type TakealotSyncJob = {
  companyId: string
  integrationId: string
}

export const takealotSyncQueue = new Queue<TakealotSyncJob>(TAKEALOT_SYNC_QUEUE, {
  connection: createBullMqConnection(),
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { age: 24 * 60 * 60, count: 1000 },
    removeOnFail: { age: 7 * 24 * 60 * 60, count: 5000 },
  },
})

export const closeTakealotSyncQueue = () => takealotSyncQueue.close()

export const enqueueTakealotSync = async (companyId: string, integrationId: string) => {
  await getTakealotApiKey(companyId, integrationId)
  const initialState = await prisma.takealotSyncState.upsert({
    where: { integrationId },
    create: { integrationId, status: 'IDLE' },
    update: {},
  })
  if (initialState.status === 'QUEUED' || initialState.status === 'RUNNING') {
    return { jobId: initialState.jobId, status: initialState.status }
  }

  const jobId = randomUUID()
  const claimed = await prisma.takealotSyncState.updateMany({
    where: { integrationId, status: { notIn: ['QUEUED', 'RUNNING'] } },
    data: {
      status: 'QUEUED',
      jobId,
      currentRunId: null,
      startedAt: null,
      completedAt: null,
      pagesProcessed: 0,
      totalPages: 0,
      offersProcessed: 0,
      missingCostCount: 0,
      errorMessage: null,
    },
  })
  if (claimed.count === 0) {
    const current = await prisma.takealotSyncState.findUnique({ where: { integrationId } })
    return { jobId: current?.jobId ?? null, status: current?.status ?? 'QUEUED' }
  }

  try {
    const job = await takealotSyncQueue.add('sync-offers', { companyId, integrationId }, { jobId })
    return { jobId: String(job.id), status: 'QUEUED' }
  } catch (error) {
    await prisma.takealotSyncState.update({
      where: { integrationId },
      data: { status: 'FAILED', completedAt: new Date(), errorMessage: 'Synchronization could not be queued.' },
    })
    throw new AppError('Takealot synchronization could not be queued.', 503, 'TAKEALOT_SYNC_QUEUE_UNAVAILABLE')
  }
}

export const requestTakealotSyncStop = async (integrationId: string) => {
  const state = await prisma.takealotSyncState.findUnique({ where: { integrationId } })
  if (!state || !['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(state.status)) {
    return { status: state?.status ?? 'IDLE' }
  }

  if (state.status === 'QUEUED' && state.jobId) {
    const job = await takealotSyncQueue.getJob(state.jobId)
    if (job) {
      const jobState = await job.getState()
      if (jobState !== 'active') {
        try {
          if (['waiting', 'delayed', 'waiting-children', 'prioritized'].includes(jobState)) {
            await job.remove()
          }
          const cancelled = await prisma.takealotSyncState.updateMany({
            where: { integrationId, jobId: state.jobId, status: 'QUEUED' },
            data: { status: 'CANCELLED', completedAt: new Date(), currentRunId: null },
          })
          if (cancelled.count > 0) return { status: 'CANCELLED' }
        } catch (error) {
          // The worker may have claimed the job between the state check and remove.
          logger.warn(
            'Takealot sync job could not be removed before worker pickup',
            JSON.stringify({
              integrationId,
              jobId: state.jobId,
              error: error instanceof Error ? error.message : 'Unknown queue error',
            }),
          )
        }
      }
    } else {
      const cancelled = await prisma.takealotSyncState.updateMany({
        where: { integrationId, jobId: state.jobId, status: 'QUEUED' },
        data: { status: 'CANCELLED', completedAt: new Date(), currentRunId: null },
      })
      if (cancelled.count > 0) return { status: 'CANCELLED' }
    }
  }

  if (state.status === 'QUEUED' && !state.jobId) {
    const cancelled = await prisma.takealotSyncState.updateMany({
      where: { integrationId, status: 'QUEUED', jobId: null },
      data: { status: 'CANCELLED', completedAt: new Date(), currentRunId: null },
    })
    if (cancelled.count > 0) return { status: 'CANCELLED' }
  }

  const requested = await prisma.takealotSyncState.updateMany({
    where: { integrationId, jobId: state.jobId, status: { in: ['QUEUED', 'RUNNING'] } },
    data: { status: 'CANCEL_REQUESTED' },
  })
  const current = await prisma.takealotSyncState.findUnique({ where: { integrationId } })
  return { status: requested.count ? 'CANCEL_REQUESTED' : (current?.status ?? 'IDLE') }
}
