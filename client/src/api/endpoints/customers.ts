import { apiRequest } from '../client'

export interface Customer { id: string; name: string; isWalkIn: boolean; phone: string | null }
export function getCustomers(search = '') {
  const params = new URLSearchParams({ page: '1', limit: '10', includeInactive: 'false' })
  if (search.trim()) params.set('search', search.trim())
  return apiRequest<{ items: Customer[]; pagination: { total: number; totalPages: number } }>(`/customers?${params}`)
}
