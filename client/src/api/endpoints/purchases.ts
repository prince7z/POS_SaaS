import { apiRequest } from '../client'

export interface SupplierOption {
  id: string
  name: string
}

export function getSuppliers(filters: { page: number; limit: number; search?: string }) {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  return apiRequest<{ items: SupplierOption[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/purchases/suppliers?${query.toString()}`)
}
