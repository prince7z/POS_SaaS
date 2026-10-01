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
export function createSaleDraft(payload: SaleDraftPayload) {
  return apiRequest<CompletedSale>('/sales/drafts', { method: 'POST', body: JSON.stringify(payload) })
}
export function completeSale(id: string, payload: SaleCompletionPayload) {
  return apiRequest<CompletedSale>(`/sales/${id}/complete`, { method: 'POST', body: JSON.stringify(payload) })
}
