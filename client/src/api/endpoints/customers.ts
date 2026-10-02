import { apiRequest } from '../client'

export interface CustomerStats {
  totalPurchases: number
  totalOrders: number
  averageOrderValue: number
  lastPurchaseAt: string | null
}

export interface Customer {
  id: string
  name: string
  isWalkIn: boolean
  isActive: boolean
  phone: string | null
  email?: string | null
  profileImageKey?: string | null
  profileImageUrl?: string | null
  customerType?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  creditLimit?: number
  creditBalance?: number
  storeCreditBalance?: number
  createdAt?: string
  stats?: CustomerStats
}

export interface CustomerFilters {
  page: number
  limit: number
  search?: string
  includeInactive?: boolean
  customerType?: string
  hasBalance?: boolean
  sortBy?: 'name' | 'createdAt' | 'creditBalance'
  sortOrder?: 'asc' | 'desc'
  includeStats?: boolean
}

export interface CustomerPage {
  items: Customer[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface CustomerPayload {
  name: string
  phone?: string | null
  email?: string | null
  customerType?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  creditLimit?: number
}

function query(filters: Record<string, string | number | boolean | undefined>) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  return params.toString()
}

export function getCustomers(filters: CustomerFilters | string = {}) {
  const values = typeof filters === 'string' ? { page: 1, limit: 10, search: filters, includeInactive: false } : filters
  return apiRequest<CustomerPage>(`/customers?${query(values as Record<string, string | number | boolean | undefined>)}`)
}
export function getCustomer(id: string) { return apiRequest<Customer>(`/customers/${id}`) }
export function getCustomerSummary() { return apiRequest<{ totalCustomers: number; activeCustomers: number; newCustomers: number; totalCustomerSales: number }>('/customers/summary') }
export function createCustomer(payload: CustomerPayload) { return apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateCustomer(id: string, payload: Partial<CustomerPayload>) { return apiRequest<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export function deleteCustomer(id: string) { return apiRequest<void>(`/customers/${id}`, { method: 'DELETE' }) }
