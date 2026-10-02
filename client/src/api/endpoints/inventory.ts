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

export function getInventorySummary() {
  return apiRequest<InventorySummary>('/inventory/summary')
}

export function getInventory(filters: { page: number; limit: number; outOfStock?: boolean; lowStock?: boolean }) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => query.set(key, String(value)))
  return apiRequest<InventoryPage>(`/inventory?${query.toString()}`)
}
