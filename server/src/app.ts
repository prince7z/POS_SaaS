import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { logger } from './lib/logger'
import { errorHandler } from './middleware/error'
import { notFound } from './middleware/notFound'
import apiRouter from './routes'
import { env } from './config/env'

const app = express()

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  }),
)
app.use(
  cors({
    origin: [...new Set([env.origin, env.frontendUrl, 'http://localhost:5173', 'http://jcom.pcodes.tech'])],
    credentials: true,
  }),
)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use((request, response, next) => {
  const startedAt = performance.now()
  response.on('finish', () => {
    logger.info(
      'HTTP request completed',
      JSON.stringify({
        method: request.method,
        path: request.originalUrl.split('?')[0],
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    )
  })
  next()
})

app.use('/', apiRouter)
app.use(notFound)
app.use(errorHandler)

export default app
