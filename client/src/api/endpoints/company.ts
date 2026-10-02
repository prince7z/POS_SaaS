import { apiRequest } from '../client'

export interface Company {
  id: string; name: string; phone: string | null; email: string | null; logoKey: string | null; logoUrl: string | null
  addressLine1: string | null; addressLine2: string | null; city: string | null; state: string | null; postalCode: string | null; countryCode: string
  currencyCode: string; timezone: string; defaultTaxRate: number; dateFormat: string; timeFormat: string
  lowStockAlerts: boolean; showProductImages: boolean; autoGenerateInvoiceNumber: boolean; autoPrintInvoice: boolean
  takealotSellerId: string | null; takealotConfigured: boolean
}
export interface CompanyUser { id: string; fullName: string; email: string; phone: string | null; roleName: string; accesses: string[]; isActive: boolean; createdAt: string }
export interface Page<T> { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface MediaUpload { key: string; uploadUrl: string; contentType: string; expiresIn: number; expiresAt: string }
export type CompanyUpdate = Record<string, string | number | boolean | null | undefined>

export function getCompany() { return apiRequest<Company>('/company') }
export function updateCompany(input: CompanyUpdate) { return apiRequest<Company>('/company', { method: 'PATCH', body: JSON.stringify(input) }) }
export function requestCompanyLogoUploadUrl(contentType: string) { return apiRequest<MediaUpload>('/company/logo/upload-url', { method: 'POST', body: JSON.stringify({ contentType }) }) }
export function updateCompanyLogo(logoKey: string) { return apiRequest<Company>('/company/logo', { method: 'PATCH', body: JSON.stringify({ logoKey }) }) }
export function deleteCompanyLogo() { return apiRequest<void>('/company/logo', { method: 'DELETE' }) }
export function getCompanyUsers(page = 1, limit = 20) { return apiRequest<Page<CompanyUser>>(`/company/users?page=${page}&limit=${limit}`) }
export function createCompanyUser(input: { fullName: string; email: string; phone?: string; password: string; roleName: string; accesses: string[] }) { return apiRequest<CompanyUser>('/company/users', { method: 'POST', body: JSON.stringify(input) }) }
export function updateCompanyUser(id: string, input: { fullName?: string; phone?: string; roleName?: string; accesses?: string[]; isActive?: boolean }) { return apiRequest<CompanyUser>(`/company/users/${id}`, { method: 'PATCH', body: JSON.stringify(input) }) }
export function deactivateCompanyUser(id: string) { return apiRequest<void>(`/company/users/${id}`, { method: 'DELETE' }) }
export function getCompanyAccesses() { return apiRequest<string[]>('/company/accesses') }

export async function uploadCompanyLogo(upload: MediaUpload, file: File) {
  const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': upload.contentType }, body: file })
  if (!response.ok) throw new Error(`Logo upload failed (${response.status}).`)
}
