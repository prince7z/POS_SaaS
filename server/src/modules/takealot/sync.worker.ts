import { Worker } from 'bullmq'

import { createBullMqConnection } from '../../infrastructure/redis'
import { logger } from '../../lib/logger'
import { TAKEALOT_SYNC_QUEUE, type TakealotSyncJob } from './sync.queue'
import { syncTakealotOffers } from './sync.service'

export const createTakealotSyncWorker = () => {
  const worker = new Worker<TakealotSyncJob>(
    TAKEALOT_SYNC_QUEUE,
    async (job) => {
      logger.info(
        'Takealot offers synchronization started',
        JSON.stringify({
          jobId: job.id,
          companyId: job.data.companyId,
          integrationId: job.data.integrationId,
        }),
      )
      const result = await syncTakealotOffers(
        job.data.companyId,
        job.data.integrationId,
        String(job.id),
        async (progress) => {
          logger.info(
            'Takealot offer sync page processed',
            JSON.stringify({
              jobId: job.id,
              integrationId: job.data.integrationId,
              ...progress,
            }),
          )
        },
      )
      logger.info(
        result.cancelled ? 'Takealot offers synchronization stopped' : 'Takealot offers synchronization completed',
        JSON.stringify({
          jobId: job.id,
          integrationId: job.data.integrationId,
          ...result,
        }),
      )
      return result
    },
    { connection: createBullMqConnection(), concurrency: 2 },
  )
  worker.on('failed', (job, error) => {
    if (!job) return
    const message = error.message.replace(/(?:Key|Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi, '[redacted]').slice(0, 500)
    logger.error(
      'Takealot offers synchronization failed',
      JSON.stringify({
        jobId: job.id,
        integrationId: job.data.integrationId,
        error: message,
      }),
    )
  })
  return worker
}
