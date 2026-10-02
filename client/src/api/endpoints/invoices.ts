import { apiRequest, apiBlob } from '../client'
import type { CatalogProduct } from './catalog'
import type { Customer } from './customers'
import type {
  SaleCompletionPayload,
  SaleDiscountType,
  SalePaymentMethod,
  SaleSummary,
} from './sales'

export type InvoiceStatus = 'DRAFT' | 'COMPLETED' | 'CANCELLED'
export type InvoicePaymentStatus = 'PAID' | 'PENDING' | 'PARTIALLY_PAID'

export interface InvoiceFilters {
  page: number
  limit: number
  search?: string
  paymentStatus?: InvoicePaymentStatus
  status?: InvoiceStatus
  customerId?: string
  from?: string
  to?: string
  sortBy?: 'soldAt' | 'invoiceNumber' | 'total' | 'createdAt'
  sortOrder?: 'asc' | 'desc'
}

export interface InvoicePage {
  items: SaleSummary[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface InvoiceItem {
  id: string
  productId: string
  productName: string
  sku: string
  barcode: string | null
  quantity: number
  unitPrice: number
  lineSubtotal: number
}

export interface InvoiceDetail {
  id: string
  invoiceNumber: string | null
  source: string
  status: InvoiceStatus
  paymentStatus: InvoicePaymentStatus
  customer: { id: string; name: string; phone: string | null; email: string | null } | null
  cashier: { id: string; name: string } | null
  items: InvoiceItem[]
  payments: Array<{
    id: string
    paymentMethod: SalePaymentMethod
    amount: number
    reference: string | null
    paidAt: string
  }>
  subtotal: number
  taxRate: number
  taxAmount: number
  discountType: SaleDiscountType | null
  discountValue: number | null
  discountAmount: number
  total: number
  paidAmount: number
  balanceDue: number
  notes: string | null
  soldAt: string
}

export interface InvoiceDraftPayload {
  source: 'POS'
  customerId: string | null
  items: Array<{ productId: string; quantity: number }>
  taxRate: number
  discountType: SaleDiscountType | null
  discountValue: number | null
  notes: string | null
}

function query(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString()
}

export function getInvoices(filters: InvoiceFilters) {
  return apiRequest<InvoicePage>(`/sales?${query(filters)}`)
}

export function getInvoice(id: string) {
  return apiRequest<InvoiceDetail>(`/sales/${id}`)
}

export function createInvoiceDraft(payload: InvoiceDraftPayload) {
  return apiRequest<InvoiceDetail>('/sales/drafts', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateInvoiceDraft(id: string, payload: Partial<InvoiceDraftPayload>) {
  return apiRequest<InvoiceDetail>(`/sales/${id}/draft`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function completeInvoice(id: string, payload: SaleCompletionPayload) {
  return apiRequest<InvoiceDetail>(`/sales/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) })
}

export function cancelInvoice(id: string) {
  return apiRequest<InvoiceDetail>(`/sales/${id}/cancel`, { method: 'POST' })
}

export function searchInvoiceCustomers(search: string) {
  return apiRequest<{ items: Customer[] }>(`/customers?${query({ page: 1, limit: 10, search, isActive: true })}`)
}

export function searchInvoiceProducts(search: string) {
  return apiRequest<{ items: CatalogProduct[] }>(
    `/catalog/products?${query({ page: 1, limit: 10, search, includeInactive: false })}`,
  )
}

export function downloadInvoicePdf(id: string) {
  return apiBlob(`/sales/${id}/invoice-pdf`)
}
