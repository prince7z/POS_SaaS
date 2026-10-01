import { apiRequest } from '../client'

export interface CatalogCategory { id: string; name: string; parentId: string | null }
export interface CatalogProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  sellingPrice: number
  stockQuantity: number
  lowStockThreshold: number
  imageKeys: string[]
  categoryId: string
}
interface Page<T> { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface ProductFilters { page: number; limit: number; search?: string; categoryId?: string }

export function getCategories() {
  return apiRequest<Page<CatalogCategory>>('/catalog/categories?page=1&limit=50&includeChildren=false')
}
export function getProducts(filters: ProductFilters) {
  const params = new URLSearchParams({ page: String(filters.page), limit: String(filters.limit), includeInactive: 'false', sortBy: 'name', sortOrder: 'asc' })
  if (filters.search) params.set('search', filters.search)
  if (filters.categoryId) params.set('categoryId', filters.categoryId)
  return apiRequest<Page<CatalogProduct>>(`/catalog/products?${params}`)
}
