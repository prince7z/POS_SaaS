import { clearAuthSession, getAuthToken, getRefreshToken, setAuthTokens } from '@/lib/auth'
import { apiBaseUrl } from '@/config/app'

export interface ApiSuccess<T> {
  success: true
  data: T
  pagination?: ApiPagination
}

export interface ApiPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasMore?: boolean
}

export interface ApiFailure {
  success: false
  error: { code: string; message: string }
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number

  constructor(message: string, code: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

const baseUrl = apiBaseUrl.replace(/\/+$/, '')
const authRefreshExclusions = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/refresh',
]

let refreshInFlight: Promise<string | null> | null = null

function shouldRefresh(path: string): boolean {
  return !authRefreshExclusions.some((excludedPath) => path.startsWith(excludedPath))
}

function redirectToLogin(): void {
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/auth/') &&
    window.location.pathname !== '/login'
  ) {
    window.location.href = '/auth/login'
  }
}

async function parseResponseBody<T>(response: Response): Promise<T | undefined> {
  try {
    return (await response.json()) as T
  } catch {
    return undefined
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken()
      const response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(refreshToken ? { refreshToken } : {}),
      })
      const body = await parseResponseBody<ApiSuccess<{ accessToken: string; refreshToken?: string }> | ApiFailure>(
        response,
      )

      if (response.status === 401) {
        clearAuthSession()
        return null
      }

      if (!response.ok || !body || !body.success) {
        const error = body && !body.success ? body.error : undefined
        throw new ApiError(
          error?.message ?? response.statusText ?? 'Unable to refresh the session.',
          error?.code ?? 'TOKEN_REFRESH_FAILED',
          response.status,
        )
      }

      if (!body.data.accessToken) {
        throw new ApiError('The refresh response did not include an access token.', 'TOKEN_REFRESH_FAILED', 500)
      }

      setAuthTokens(body.data.accessToken, body.data.refreshToken)
      return body.data.accessToken
    })().finally(() => {
      refreshInFlight = null
    })
  }

  return refreshInFlight
}

async function fetchAuthorized(path: string, init: RequestInit | undefined, accept: string): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('Accept', accept)
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const token = getAuthToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const request = () =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers,
    })

  let response = await request()
  if (response.status !== 401 || !shouldRefresh(path)) return response

  const refreshedToken = await refreshAccessToken()
  if (!refreshedToken) {
    redirectToLogin()
    return response
  }

  headers.set('Authorization', `Bearer ${refreshedToken}`)
  response = await request()
  if (response.status === 401) {
    clearAuthSession()
    redirectToLogin()
  }
  return response
}

export async function apiBlob(path: string, accept = 'text/csv'): Promise<Blob> {
  const response = await fetchAuthorized(path, undefined, accept)
  if (!response.ok) {
    const body = await parseResponseBody<ApiFailure>(response)
    throw new ApiError(
      body && !body.success ? body.error.message : 'The requested file could not be downloaded.',
      body && !body.success ? body.error.code : 'DOWNLOAD_FAILED',
      response.status,
    )
  }
  return response.blob()
}

export async function apiEventStream<T>(
  path: string,
  eventName: string,
  onEvent: (event: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetchAuthorized(path, { signal }, 'text/event-stream')
  if (!response.ok || !response.body) {
    const body = await parseResponseBody<ApiFailure>(response)
    throw new ApiError(
      body && !body.success ? body.error.message : 'The event stream could not be opened.',
      body && !body.success ? body.error.code : 'EVENT_STREAM_FAILED',
      response.status,
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        const message = buffer.slice(0, boundary).replace(/\r/g, '')
        buffer = buffer.slice(boundary + 2)
        const lines = message.split('\n')
        if (lines.includes(`event: ${eventName}`)) {
          const data = lines
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trim())
            .join('\n')
          if (data) onEvent(JSON.parse(data) as T)
        }
        boundary = buffer.indexOf('\n\n')
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function apiRequestWithMeta<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; pagination?: ApiPagination }> {
  const response = await fetchAuthorized(path, init, 'application/json')
  const body = await parseResponseBody<ApiSuccess<T> | ApiFailure>(response)

  if (!response.ok || !body || !body.success) {
    const error = body && !body.success ? body.error : undefined
    throw new ApiError(
      error?.message ?? response.statusText ?? 'An unknown error occurred.',
      error?.code ?? 'HTTP_ERROR',
      response.status,
    )
  }

  return { data: body.data, pagination: body.pagination }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await apiRequestWithMeta<T>(path, init)
  return result.data
}
