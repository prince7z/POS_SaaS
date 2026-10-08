import { clearAuthSession } from '@/lib/auth'
import { apiBaseUrl } from '@/config/app'

export interface ApiSuccess<T> {
  success: true
  data: T
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

const baseUrl = `${apiBaseUrl}`

export async function apiBlob(path: string): Promise<Blob> {
  const token = localStorage.getItem('pos-auth-token')
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'text/csv', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/') && window.location.pathname !== '/login') {
        window.location.href = '/auth/login'
      }
    }
    throw new ApiError('The report export could not be downloaded.', 'EXPORT_FAILED', response.status)
  }
  return response.blob()
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem('pos-auth-token')
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })

  const body = (await response.json()) as ApiSuccess<T> | ApiFailure
  if (!response.ok || !body.success) {
    if (
      response.status === 401 &&
      !path.startsWith('/auth/login') &&
      !path.startsWith('/auth/register') &&
      !path.startsWith('/auth/forgot-password') &&
      !path.startsWith('/auth/reset-password')
    ) {
      clearAuthSession()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/') && window.location.pathname !== '/login') {
        window.location.href = '/auth/login'
      }
    }
    const error = 'error' in body && body.error
      ? body.error
      : { code: 'HTTP_ERROR', message: response.statusText || 'An unknown error occurred.' }
    throw new ApiError(error.message, error.code, response.status)
  }
  return body.data
}
