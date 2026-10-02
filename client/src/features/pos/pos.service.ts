import { getCategories, getProducts } from '@/api/endpoints/catalog'
import { getCustomers } from '@/api/endpoints/customers'
import type { POSFilters } from './types'

export function loadPOSData(filters: POSFilters) {
  return Promise.all([
    getCategories(),
    getProducts({ ...filters, categoryId: filters.categoryId ?? undefined, limit: 24 }),
    getCustomers(),
  ])
}
