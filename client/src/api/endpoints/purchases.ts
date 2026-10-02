import { apiRequest } from '../client'

export interface SupplierStats {
  totalOrders: number
  totalPurchaseValue: number
  pendingAmount: number
}

export interface Supplier {
  id: string
  name: string
  contactPerson: string
  phone: string
  email: string
  website?: string | null
  addressLine1: string
  addressLine2?: string | null
  city: string
  state: string
  postalCode: string
  paymentTermsDays: number
  creditLimit: number
  bankName?: string | null
  accountName?: string | null
  accountNumber?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  stats?: SupplierStats
  totalPurchaseValue?: number
  totalPaid?: number
  outstandingBalance?: number
}
export type SupplierOption = Pick<Supplier, 'id' | 'name'>

export interface SupplierPayload {
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  paymentTermsDays?: number
  creditLimit?: number
  bankName?: string | null
  accountName?: string | null
  accountNumber?: string | null
}

export interface PurchasePage {
  items: PurchaseOrderSummary[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
export interface PurchaseOrderSummary {
  id: string
  poNumber: string
  status: string
  orderDate: string
  expectedDate: string | null
  subtotal: number
  taxAmount: number
  total: number
  paidAmount: number
  balanceDue: number
  supplier: { id: string; name: string } | null
}
export interface PurchaseOrderDetail extends PurchaseOrderSummary {
  notes: string | null
  items: Array<{
    id: string
    productId: string
    productName: string
    sku: string
    imageUrl: string | null
    orderedQuantity: number
    receivedQuantity: number
    remainingQuantity: number
    unitCost: number
    lineTotal: number
  }>
}
export interface PurchaseOrderPayload {
  supplierId: string
  expectedDate?: string
  taxRate?: number
  notes?: string | null
  items: Array<{ productId: string; quantity: number; unitCost: number }>
}

export interface SupplierPayment {
  id: string
  amount: number
  paymentMethod: string
  reference: string | null
  paidAt: string
  creator?: { id: string; fullName: string }
}

function query(filters: object) {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString()
}

export function getSuppliers(filters: {
  page: number
  limit: number
  search?: string
  includeInactive?: boolean
  includeStats?: boolean
}) {
  return apiRequest<{
    items: Supplier[]
    pagination: { page: number; limit: number; total: number; totalPages: number }
  }>(`/purchases/suppliers?${query(filters)}`)
}
export function getSupplierSummary() {
  return apiRequest<{
    totalSuppliers: number
    activeSuppliers: number
    totalPurchaseValue: number
    pendingPayments: number
  }>('/purchases/suppliers/summary')
}
export function getSupplier(id: string) {
  return apiRequest<Supplier>(`/purchases/suppliers/${id}`)
}
export function getSupplierPayments(id: string, page = 1, limit = 10) {
  return apiRequest<{ items: SupplierPayment[]; pagination: PurchasePage['pagination'] }>(
    `/purchases/suppliers/${id}/payments?${query({ page, limit })}`,
  )
}
export function createSupplier(payload: SupplierPayload) {
  return apiRequest<Supplier>('/purchases/suppliers', { method: 'POST', body: JSON.stringify(payload) })
}
export function updateSupplier(id: string, payload: Partial<SupplierPayload>) {
  return apiRequest<Supplier>(`/purchases/suppliers/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function deleteSupplier(id: string) {
  return apiRequest<void>(`/purchases/suppliers/${id}`, { method: 'DELETE' })
}
export function getPurchaseOrders(filters: {
  page: number
  limit: number
  supplierId?: string
  status?: string
  search?: string
  sortBy?: string
  sortOrder?: string
}) {
  return apiRequest<PurchasePage>(`/purchases?${query(filters)}`)
}
export function getPurchaseOrderSummary() {
  return apiRequest<{
    totalOrders: number
    totalSpend: number
    pendingAmount: number
    byStatus: Array<{ status: string; count: number }>
  }>('/purchases/summary')
}
export function getPurchaseOrder(id: string) {
  return apiRequest<PurchaseOrderDetail>(`/purchases/${id}`)
}
export function createPurchaseOrder(payload: PurchaseOrderPayload) {
  return apiRequest<PurchaseOrderDetail>('/purchases', { method: 'POST', body: JSON.stringify(payload) })
}
export function updatePurchaseOrder(id: string, payload: Partial<PurchaseOrderPayload>) {
  return apiRequest<PurchaseOrderDetail>(`/purchases/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
}
export function receivePurchaseOrder(
  id: string,
  items: Array<{ purchaseOrderItemId: string; quantityReceived: number }>,
) {
  return apiRequest<PurchaseOrderDetail>(`/purchases/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
}
export function cancelPurchaseOrder(id: string) {
  return apiRequest<PurchaseOrderDetail>(`/purchases/${id}/cancel`, { method: 'POST' })
}
export function addPurchasePayment(id: string, payload: { amount: number; paymentMethod: string; reference?: string }) {
  return apiRequest<{ paymentId: string }>(`/purchases/${id}/payments`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
