import { apiRequest } from '../client'

export type SaleDiscountType = 'PERCENT' | 'FIXED'
export type SalePaymentMethod = 'CASH' | 'CARD' | 'STORE_CREDIT'
export interface SaleItemPayload { productId: string; quantity: number }
export interface SalePaymentPayload { paymentMethod: SalePaymentMethod; amount: number; reference?: string | null }
export interface SaleDraftPayload {
  source: 'POS'
  customerId: string | null
  items: SaleItemPayload[]
  taxRate: number
  discountType: SaleDiscountType | null
  discountValue: number | null
  notes?: string | null
}
export interface SaleCompletionPayload {
  taxRate: number
  discountType: SaleDiscountType | null
  discountValue: number | null
  payments: SalePaymentPayload[]
  customerId: string | null
  notes?: string | null
}
export interface CompletedSale { id: string; invoiceNumber?: string | null; total?: number }
export interface SaleSummary { id: string; invoiceNumber: string; status: string; paymentStatus: string; total: number; paidAmount: number; balanceDue: number; soldAt: string }
export interface ReturnableSale { saleId: string; invoiceNumber: string; soldAt: string; total: number; customer: { id: string; name: string; phone: string | null; imageUrl?: string | null } | null; items: Array<{ saleItemId: string; productId: string; productName: string; sku: string; imageUrl?: string | null; soldQuantity: number; returnedQuantity: number; returnableQuantity: number; unitPrice: number }> }
export function searchSales(search: string) {
  return apiRequest<{ items: SaleSummary[] }>(`/sales?${new URLSearchParams({ search, page: '1', limit: '10', status: 'COMPLETED', sortBy: 'soldAt', sortOrder: 'desc' })}`)
}
export function getReturnableItems(saleId: string) { return apiRequest<ReturnableSale>(`/sales/${saleId}/returnable-items`) }
export function createReturn(saleId: string, payload: { refundType: 'CASH' | 'STORE_CREDIT'; reason?: string; notes?: string; items: Array<{ saleItemId: string; quantity: number }> }) { return apiRequest<ReturnRow>(`/sales/${saleId}/returns`, { method: 'POST', body: JSON.stringify(payload) }) }
export type ReturnFilters = { page?: number; limit?: number; search?: string; refundType?: 'CASH' | 'STORE_CREDIT'; from?: string; to?: string }
export interface ReturnRow { id: string; returnNumber: string; invoiceNumber: string | null; customer: { id: string; name: string; phone?: string | null; imageUrl?: string | null } | null; refundType: 'CASH' | 'STORE_CREDIT'; refundAmount: number; reason?: string | null; notes?: string | null; status: string; processedBy: { id: string; name: string } | null; processedAt: string; items: Array<{ productId: string; productName: string | null; sku: string | null; imageUrl: string | null; quantity: number; refundAmount: number }> }
export interface ReturnSummary { totalReturns: number; totalRefunded: number; totalItemsReturned: number; pendingReturns: number }
export function getCustomerSales(customerId: string, page = 1) {
  return apiRequest<{ items: SaleSummary[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/sales?${new URLSearchParams({ customerId, page: String(page), limit: '10', sortBy: 'soldAt', sortOrder: 'desc' })}`)
}
export function createSaleDraft(payload: SaleDraftPayload) {
  return apiRequest<CompletedSale>('/sales/drafts', { method: 'POST', body: JSON.stringify(payload) })
}
export function completeSale(id: string, payload: SaleCompletionPayload) {
  return apiRequest<CompletedSale>(`/sales/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) })
}
export function getReturns(filters: ReturnFilters) {
  const params = new URLSearchParams()
  Object.entries({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 10 }).forEach(([key, value]) => { if (value !== undefined && value !== '') params.set(key, String(value)) })
  return apiRequest<{ items: ReturnRow[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/sales/returns?${params}`)
}
export function getReturnSummary(filters: Pick<ReturnFilters, 'from' | 'to' | 'refundType'>) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value) })
  return apiRequest<ReturnSummary>(`/sales/returns/summary?${params}`)
}
