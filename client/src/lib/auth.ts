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
    const accesses = Array.isArray(data.user.accesses) ? data.user.accesses : []
    localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(accesses))
    window.dispatchEvent(new CustomEvent('pos-permissions-updated', { detail: accesses }))
  }
  if (data.company) {
    setStoredCompany(data.company)
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

export function getStoredPermissions(): string[] {
  const raw = localStorage.getItem(STORAGE_KEYS.PERMISSIONS)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    } catch {
      // ignore
    }
  }
  const user = getStoredUser()
  if (user?.accesses && Array.isArray(user.accesses)) {
    try {
      localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(user.accesses))
    } catch {
      // ignore
    }
    return user.accesses
  }
  return []
}

export function hasPermission(required?: string | string[]): boolean {
  if (!required || (Array.isArray(required) && required.length === 0)) return true
  const permissions = getStoredPermissions()
  if (Array.isArray(required)) {
    return required.some((perm) => permissions.includes(perm))
  }
  return permissions.includes(required)
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

export function setStoredCompany(company: AuthResponse['company']) {
  if (company) {
    localStorage.setItem('pos-company', JSON.stringify(company))
    localStorage.setItem('takealotapiexist', String(Boolean(company.takealotConfigured)))
    if (company.takealotApiKeyPrefix) localStorage.setItem('takealotapi', company.takealotApiKeyPrefix.slice(0, 5))
    else localStorage.removeItem('takealotapi')
    window.dispatchEvent(new CustomEvent('pos-company-updated', { detail: company }))
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
  localStorage.removeItem('takealotapiexist')
  localStorage.removeItem('takealotapi')
  localStorage.removeItem('pos-companies')
  localStorage.removeItem(STORAGE_KEYS.PERMISSIONS)
  window.dispatchEvent(new CustomEvent('pos-permissions-updated', { detail: [] }))
  document.cookie = `${STORAGE_KEYS.AUTH_TOKEN}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken())
}
