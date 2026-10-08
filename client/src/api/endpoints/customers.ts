import { apiRequest } from '../client'

export interface CustomerStats {
  totalPurchases: number
  totalOrders: number
  averageOrderValue: number
  lastPurchaseAt: string | null
}

export interface CustomerSummary {
  customer: Customer
  purchases: Array<{
    id: string
    invoiceNumber: string
    soldAt: string
    total: number
    paidAmount: number
    balanceDue: number
    items: Array<{
      productId: string
      name: string
      sku: string
      quantity: number
      unitPrice: number
      imageUrl: string | null
    }>
  }>
  payments: Array<{
    id: string
    invoiceId: string | null
    amount: number
    paymentMethod: string
    reference: string | null
    notes: string | null
    paidAt: string
  }>
  trend: Array<{ date: string; amount: number }>
  products: Array<{
    productId: string
    name: string
    sku: string
    quantity: number
    total: number
    imageUrl: string | null
  }>
  stats: CustomerStats & { creditLimit: number; creditBalance: number; storeCreditBalance: number }
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
  isActive?: boolean
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
  profileImageKey?: string | null
  customerType?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  creditLimit?: number
}

function query(filters: object) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString()
}

export function getCustomers(filters: CustomerFilters | string = { page: 1, limit: 10, includeInactive: false }) {
  const values = typeof filters === 'string' ? { page: 1, limit: 10, search: filters, includeInactive: false } : filters
  return apiRequest<CustomerPage>(`/customers?${query(values)}`)
}
export function getCustomer(id: string) {
  return apiRequest<Customer>(`/customers/${id}`)
}
export function getCustomerSummaryDetails(id: string) {
  return apiRequest<CustomerSummary>(`/customers/${id}/summary`)
}
export function requestCustomerProfileUpload(id: string, contentType: string) {
  return apiRequest<{ key: string; uploadUrl: string }>(`/customers/${id}/profile/upload-url`, {
    method: 'POST',
    body: JSON.stringify({ contentType }),
  })
}
export function attachCustomerProfile(id: string, profileImageKey: string) {
  return apiRequest<{ profileImageKey: string }>(`/customers/${id}/profile`, {
    method: 'PATCH',
    body: JSON.stringify({ profileImageKey }),
  })
}
export function getCustomerSummary() {
  return apiRequest<{
    totalCustomers: number
    activeCustomers: number
    newCustomers: number
    totalCustomerSales: number
  }>('/customers/summary')
}
export function createCustomer(payload: CustomerPayload) {
  return apiRequest<Customer>('/customers', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateCustomer(id: string, payload: Partial<CustomerPayload>) {
  return apiRequest<Customer>(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function deleteCustomer(id: string) {
  return apiRequest<void>(`/customers/${id}`, { method: 'DELETE' })
}
