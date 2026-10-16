import { getCategories, getProducts } from '@/api/endpoints/catalog'
import { getCustomers } from '@/api/endpoints/customers'
import type { POSFilters } from './types'

export function loadPOSInitialData() {
  return Promise.all([
    getCategories(),
    getCustomers({ page: 1, limit: 100, includeInactive: false, sortBy: 'name', sortOrder: 'asc' }),
  ])
}

export function fetchPOSProducts(filters: POSFilters) {
  return getProducts({
    page: filters.page,
    limit: filters.limit,
    search: filters.search || undefined,
    categoryId: filters.categoryId || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    includeInactive: false,
  })
}
