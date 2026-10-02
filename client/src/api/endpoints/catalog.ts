import { apiRequest } from '../client'

export interface CatalogCategory { id: string; name: string; description?: string | null; parentId: string | null; logoKey?: string | null; isActive?: boolean; createdAt?: string; updatedAt?: string; productCount?: number; children?: CatalogCategory[] }
export interface CatalogBrand { id: string; name: string; description?: string | null; logoKey?: string | null; isActive?: boolean; createdAt?: string; updatedAt?: string; productCount?: number }
export interface CatalogPage<T> { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
export interface CatalogProduct {
  id: string
  name: string
  sku: string
  brand?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  supplier?: { id: string; name: string } | null
  barcode: string | null
  description?: string | null
  rrp?: number
  purchaseCost?: number
  sellingPrice: number
  stockQuantity: number
  lowStockThreshold: number
  imageKeys: string[]
  categoryId: string
}
export interface ProductFilters { page: number; limit: number; search?: string; categoryId?: string; brandId?: string; supplierId?: string; lowStock?: boolean; sortBy?: 'name' | 'sellingPrice' | 'stockQuantity' | 'createdAt'; sortOrder?: 'asc' | 'desc'; includeInactive?: boolean }
export interface CategoryFilters { page: number; limit: number; search?: string; includeChildren?: boolean }
export interface BrandFilters { page: number; limit: number; search?: string; sortBy?: 'name' | 'createdAt'; sortOrder?: 'asc' | 'desc' }
export interface ProductPayload { name: string; sku: string; barcode?: string | null; description?: string | null; categoryId: string; brandId?: string | null; supplierId?: string | null; rrp: number; sellingPrice: number; purchaseCost: number; lowStockThreshold: number; warrantyMonths?: number | null; productCode?: string | null; takealotProductId?: string | null; takealotSync?: boolean }
export interface CategoryPayload { name: string; description?: string | null; parentId?: string | null }
export interface BrandPayload { name: string; description?: string | null }
export interface MediaUpload { key: string; uploadUrl: string; contentType: string; expiresIn: number; expiresAt: string }

function params(values: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)) })
  return query.toString()
}

export function getCategories() {
  return apiRequest<CatalogPage<CatalogCategory>>('/catalog/categories?page=1&limit=50&includeChildren=false')
}
export function getProducts(filters: ProductFilters) {
  const { page, limit, ...rest } = filters
  return apiRequest<CatalogPage<CatalogProduct>>(`/catalog/products?${params({ page, limit, includeInactive: filters.includeInactive ?? false, ...rest })}`)
}
export function getCategoriesPage(filters: CategoryFilters) { return apiRequest<CatalogPage<CatalogCategory>>(`/catalog/categories?${params({ ...filters, includeChildren: filters.includeChildren ?? true })}`) }
export function getBrands(filters: BrandFilters) { return apiRequest<CatalogPage<CatalogBrand>>(`/catalog/brands?${params({ ...filters })}`) }
export function createProduct(payload: ProductPayload) { return apiRequest<CatalogProduct>('/catalog/products', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateProduct(id: string, payload: Partial<ProductPayload>) { return apiRequest<CatalogProduct>(`/catalog/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export function deleteProduct(id: string) { return apiRequest<void>(`/catalog/products/${id}`, { method: 'DELETE' }) }
export function createCategory(payload: CategoryPayload) { return apiRequest<CatalogCategory>('/catalog/categories', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateCategory(id: string, payload: Partial<CategoryPayload>) { return apiRequest<CatalogCategory>(`/catalog/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export function deleteCategory(id: string) { return apiRequest<void>(`/catalog/categories/${id}`, { method: 'DELETE' }) }
export function createBrand(payload: BrandPayload) { return apiRequest<CatalogBrand>('/catalog/brands', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateBrand(id: string, payload: Partial<BrandPayload>) { return apiRequest<CatalogBrand>(`/catalog/brands/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export function deleteBrand(id: string) { return apiRequest<void>(`/catalog/brands/${id}`, { method: 'DELETE' }) }

export function requestProductImageUploadUrls(id: string, contentTypes: string[]) {
  return apiRequest<{ uploads: MediaUpload[] }>(`/catalog/products/${id}/images/upload-urls`, { method: 'POST', body: JSON.stringify({ contentTypes }) })
}
export function addProductImages(id: string, imageKeys: string[]) {
  return apiRequest<{ imageKeys: string[] }>(`/catalog/products/${id}/images`, { method: 'POST', body: JSON.stringify({ imageKeys }) })
}
export function reorderProductImages(id: string, imageKeys: string[]) {
  return apiRequest<{ imageKeys: string[] }>(`/catalog/products/${id}/images`, { method: 'PATCH', body: JSON.stringify({ imageKeys }) })
}
export function removeProductImage(id: string, imageKey: string) {
  return apiRequest<{ imageKeys: string[] }>(`/catalog/products/${id}/images`, { method: 'DELETE', body: JSON.stringify({ imageKey }) })
}
export function requestCategoryLogoUploadUrl(id: string, contentType: string) {
  return apiRequest<MediaUpload>(`/catalog/categories/${id}/logo/upload-url`, { method: 'POST', body: JSON.stringify({ contentType }) })
}
export function updateCategoryLogo(id: string, logoKey: string) {
  return apiRequest<CatalogCategory>(`/catalog/categories/${id}/logo`, { method: 'PATCH', body: JSON.stringify({ logoKey }) })
}
export function removeCategoryLogo(id: string) {
  return apiRequest<void>(`/catalog/categories/${id}/logo`, { method: 'DELETE' })
}
export function requestBrandLogoUploadUrl(id: string, contentType: string) {
  return apiRequest<MediaUpload>(`/catalog/brands/${id}/logo/upload-url`, { method: 'POST', body: JSON.stringify({ contentType }) })
}
export function updateBrandLogo(id: string, logoKey: string) {
  return apiRequest<CatalogBrand>(`/catalog/brands/${id}/logo`, { method: 'PATCH', body: JSON.stringify({ logoKey }) })
}
export function removeBrandLogo(id: string) {
  return apiRequest<void>(`/catalog/brands/${id}/logo`, { method: 'DELETE' })
}

export async function uploadMediaFile(upload: MediaUpload, file: File) {
  const response = await fetch(upload.uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': upload.contentType },
  })
  if (!response.ok) throw new Error(`Image upload failed (${response.status}).`)
}
