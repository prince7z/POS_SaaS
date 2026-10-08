import { STORAGE_KEYS } from '@/config/constants'
import type { AuthResponse, CompanyOption } from '@/api/endpoints/auth'

export function setAuthSession(data: AuthResponse) {
  if (data.accessToken) {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, data.accessToken)
    // Set fallback cookie for session tracking
    document.cookie = `${STORAGE_KEYS.AUTH_TOKEN}=${data.accessToken}; path=/; max-age=604800; SameSite=Lax`
  }
  if (data.refreshToken) {
    localStorage.setItem('pos-refresh-token', data.refreshToken)
  }
  if (data.user) {
    localStorage.setItem('pos-user', JSON.stringify(data.user))
  }
  if (data.company) {
    localStorage.setItem('pos-company', JSON.stringify(data.company))
  }
  if (data.companies) {
    localStorage.setItem('pos-companies', JSON.stringify(data.companies))
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN)
}

export function getStoredUser(): AuthResponse['user'] | null {
  const raw = localStorage.getItem('pos-user')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthResponse['user']
  } catch {
    return null
  }
}

export function getStoredCompany(): AuthResponse['company'] | null {
  const raw = localStorage.getItem('pos-company')
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthResponse['company']
  } catch {
    return null
  }
}

export function getStoredCompanies(): CompanyOption[] {
  const raw = localStorage.getItem('pos-companies')
  if (!raw) return []
  try {
    return JSON.parse(raw) as CompanyOption[]
  } catch {
    return []
  }
}

export function clearAuthSession() {
  localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN)
  localStorage.removeItem('pos-refresh-token')
  localStorage.removeItem('pos-user')
  localStorage.removeItem('pos-company')
  localStorage.removeItem('pos-companies')
  document.cookie = `${STORAGE_KEYS.AUTH_TOKEN}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken())
}
