import { apiRequest } from '../client'

export interface InventorySummary {
  totalProducts: number
  totalUnits: number
  lowStockProducts: number
  outOfStockProducts: number
  inventoryValue: number
}

export interface InventoryPage<T = unknown> {
  items: T[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export interface InventoryItem {
  productId: string
  name: string
  sku: string
  barcode: string | null
  description?: string | null
  supplier?: { id: string; name: string } | null
  imageKeys: string[]
  imageUrls?: string[]
  category?: { id: string; name: string } | null
  brand?: { id: string; name: string } | null
  stockQuantity: number
  averageCost: number
  sellingPrice: number
  purchaseCost: number
  lowStockThreshold: number
  isLowStock: boolean
  isOutOfStock: boolean
  takealotSync: boolean
}

export interface InventoryMovement {
  id: string
  movementType: 'OPENING' | 'PURCHASE_RECEIPT' | 'SALE' | 'RETURN' | 'ADJUSTMENT' | 'SALE_REVERSAL' | 'RETURN_REVERSAL'
  quantityChange: number
  quantityBefore: number
  quantityAfter: number
  unitCost: number | null
  operationId: string
  referenceType?: string | null
  referenceId?: string | null
  reason?: string | null
  note?: string | null
  createdBy: { id: string; name: string }
  createdAt: string
}

export function getInventorySummary() {
  return apiRequest<InventorySummary>('/inventory/summary')
}

export function getInventory(filters: { page: number; limit: number; search?: string; categoryId?: string; brandId?: string; outOfStock?: boolean; lowStock?: boolean; sortBy?: 'name' | 'stockQuantity' | 'createdAt'; sortOrder?: 'asc' | 'desc' }) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && String(value) !== '') query.set(key, String(value)) })
  return apiRequest<InventoryPage<InventoryItem>>(`/inventory?${query.toString()}`)
}

export function getProductInventory(productId: string) { return apiRequest<InventoryItem>(`/inventory/${productId}`) }
export function getProductMovements(productId: string, filters: { page: number; limit: number; movementType?: InventoryMovement['movementType']; from?: string; to?: string }) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && String(value) !== '') query.set(key, String(value)) })
  return apiRequest<InventoryPage<InventoryMovement>>(`/inventory/${productId}/movements?${query.toString()}`)
}
export function adjustStock(payload: { items: Array<{ productId: string; action: 'ADD' | 'REMOVE'; quantity: number; unitCost?: number; reason?: string; note?: string }> }) {
  return apiRequest<{ operationId: string }>('/inventory/adjust', { method: 'POST', body: JSON.stringify(payload) })
}
export function setOpeningStock(payload: { productId: string; quantity: number; unitCost?: number; note?: string }) {
  return apiRequest<{ productId: string; stockQuantity: number; averageCost: number }>('/inventory/opening-stock', { method: 'POST', body: JSON.stringify(payload) })
}
