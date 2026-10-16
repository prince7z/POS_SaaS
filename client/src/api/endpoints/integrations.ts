import { apiRequest } from '../client'

export interface Integration {
  id: string
  type: string
  name: string
  configured: boolean
  sellerId: string | null
  lowStockThreshold: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateTakealotIntegration {
  type: 'TAKEALOT'
  name: string
  apiKey: string
  sellerId?: string
  lowStockThreshold: number
}

export interface UpdateTakealotIntegration {
  name?: string
  apiKey?: string
  removeApiKey?: boolean
  sellerId?: string | null
  lowStockThreshold?: number
  isActive?: boolean
}

export function getIntegrations() {
  return apiRequest<Integration[]>('/integrations')
}

export function createTakealotIntegration(input: CreateTakealotIntegration) {
  return apiRequest<Integration>('/integrations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export function updateTakealotIntegration(id: string, input: UpdateTakealotIntegration) {
  return apiRequest<Integration>(`/integrations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export function deleteIntegration(id: string) {
  return apiRequest<void>(`/integrations/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function testTakealotIntegration(id: string) {
  return apiRequest<{ connected: boolean }>(`/integrations/${encodeURIComponent(id)}/test`, {
    method: 'POST',
  })
}
