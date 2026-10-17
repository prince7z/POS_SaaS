import { logger } from '../../lib/logger'
import { AppError } from '../../utils/errors'

type StockSyncInput = {
  companyId: string
  productId: string
  takealotProductId: string
  quantity: number
}

export type OfferIdentifierType = 'BARCODE' | 'SKU' | 'OFFER_ID'

export type TakealotPayload = Readonly<Record<string, string | number | boolean | readonly string[] | undefined>>

type TakealotRequestOptions = {
  notFoundAsNull?: boolean
  errorCode?: string
  baseUrl?: string
  apiKeyHeader?: 'Authorization' | 'X-API-Key'
}

const sellerApiBaseUrl = 'https://seller-api.takealot.com'
const marketplaceApiBaseUrl = 'https://marketplace-api.takealot.com'
const timeoutMs = 10_000
const maxAttempts = 3

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

const safePaginationQuery = (url: URL): string => {
  const safe = new URLSearchParams()
  for (const key of ['page_number', 'page_size']) {
    const value = url.searchParams.get(key)
    if (value !== null) safe.set(key, value)
  }
  const serialized = safe.toString()
  return serialized ? `?${serialized}` : ''
}

const retryDelay = (response: Response | undefined, attempt: number): number => {
  const retryAfter = response?.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000
    const date = Date.parse(retryAfter)
    if (Number.isFinite(date)) return Math.max(0, date - Date.now())
  }

  return 250 * 2 ** (attempt - 1)
}

function request<T>(
  apiKey: string,
  api: string,
  payload?: TakealotPayload,
  options?: TakealotRequestOptions & { notFoundAsNull?: false },
): Promise<T>
function request<T>(
  apiKey: string,
  api: string,
  payload: TakealotPayload | undefined,
  options: TakealotRequestOptions & { notFoundAsNull: true },
): Promise<T | null>
async function request<T>(
  apiKey: string,
  api: string,
  payload: TakealotPayload = {},
  options: TakealotRequestOptions = {},
): Promise<T | null> {
  if (!api.startsWith('/') || api.startsWith('//')) {
    throw new AppError('Invalid Takealot API path.', 500, 'TAKEALOT_INVALID_PATH')
  }

  const url = new URL(api, options.baseUrl ?? sellerApiBaseUrl)
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item)
    } else {
      url.searchParams.set(key, String(value))
    }
  }

  let response: Response | undefined
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const startedAt = performance.now()
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          [options.apiKeyHeader ?? 'Authorization']: options.apiKeyHeader === 'X-API-Key' ? apiKey : `Key ${apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (error) {
      lastError = error
      logger.warn(
        'Takealot API request failed before receiving a response',
        JSON.stringify({
          method: 'GET',
          path: `${url.pathname}${safePaginationQuery(url)}`,
          attempt,
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : 'Unknown network error',
        }),
      )
      if (attempt < maxAttempts) {
        await wait(retryDelay(undefined, attempt))
        continue
      }
      throw new AppError('Takealot request failed.', 502, 'TAKEALOT_API_UNAVAILABLE')
    }
    logger.info(
      'Takealot API response received',
      JSON.stringify({
        method: 'GET',
        path: `${url.pathname}${safePaginationQuery(url)}`,
        statusCode: response.status,
        attempt,
        durationMs: Math.round(performance.now() - startedAt),
      }),
    )

    if (response.status === 404 && options.notFoundAsNull) return null
    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxAttempts) {
        await wait(retryDelay(response, attempt))
        continue
      }
    }
    if (!response.ok) {
      throw new AppError(
        `Takealot API request failed with status ${response.status}.`,
        502,
        options.errorCode ?? 'TAKEALOT_API_FAILED',
      )
    }

    try {
      return (await response.json()) as T
    } catch {
      throw new AppError('Takealot returned an invalid response.', 502, 'TAKEALOT_INVALID_RESPONSE')
    }
  }

  throw new AppError(
    'Takealot request failed.',
    502,
    lastError ? 'TAKEALOT_API_UNAVAILABLE' : (options.errorCode ?? 'TAKEALOT_API_FAILED'),
  )
}

export const takealotClient = {
  request,
  marketplaceRequest<T>(apiKey: string, api: string, payload?: TakealotPayload): Promise<T> {
    return request<T>(apiKey, api, payload, {
      baseUrl: marketplaceApiBaseUrl,
      apiKeyHeader: 'X-API-Key',
      errorCode: 'TAKEALOT_MARKETPLACE_API_FAILED',
    })
  },
  async findOffer(apiKey: string, identifierType: OfferIdentifierType, identifier: string): Promise<unknown> {
    const encodedIdentifier = encodeURIComponent(identifier)
    const path = identifierType === 'OFFER_ID' ? encodedIdentifier : `${identifierType}${encodedIdentifier}`
    return request<unknown>(
      apiKey,
      `/v2/offers/offer/${path}`,
      {},
      {
        notFoundAsNull: true,
        errorCode: 'TAKEALOT_LOOKUP_FAILED',
      },
    )
  },
}

export const queueTakealotStockSync = async (input: StockSyncInput): Promise<void> => {
  logger.info('Takealot stock sync queued', {
    companyId: input.companyId,
    productId: input.productId,
    takealotProductId: input.takealotProductId,
    quantity: input.quantity,
  })
}
