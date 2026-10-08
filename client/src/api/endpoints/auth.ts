import { apiRequest } from '../client'

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<void>('/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function forgotPassword(email: string) {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(payload: { token: string; newPassword: string; confirmPassword: string }) {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export interface CompanyOption {
  id: string
  name: string
  logoUrl?: string | null
  currencyCode?: string
  countryCode?: string
  roleName?: string
}

export interface LoginPayload {
  companyId?: string
  email: string
  password: string
}

export interface AuthResponse {
  user: {
    id: string
    email: string
    fullName: string
    roleName: string
    companyId: string
  }
  company: {
    id: string
    name: string
    logoUrl?: string | null
    currencyCode: string
    countryCode: string
  }
  companies?: CompanyOption[]
  accessToken: string
  refreshToken: string
}

export function login(payload: LoginPayload) {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function switchCompany(companyId: string) {
  return apiRequest<AuthResponse>('/auth/switch-company', {
    method: 'POST',
    body: JSON.stringify({ companyId }),
  })
}

