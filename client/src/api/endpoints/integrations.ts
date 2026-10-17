import { apiRequest } from '../client'

const integrationsCacheMs = 15_000
let integrationsCache: { value: Integration[]; expiresAt: number } | undefined
let integrationsRequest: Promise<Integration[]> | undefined

if (typeof window !== 'undefined') {
  window.addEventListener('pos-integrations-updated', () => {
    integrationsCache = undefined
  })
  window.addEventListener('pos-company-updated', () => {
    integrationsCache = undefined
  })
}

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
  if (integrationsCache && integrationsCache.expiresAt > Date.now()) {
    return Promise.resolve(integrationsCache.value)
  }
  if (integrationsRequest) return integrationsRequest

  integrationsRequest = apiRequest<Integration[]>('/integrations')
    .then((integrations) => {
      integrationsCache = { value: integrations, expiresAt: Date.now() + integrationsCacheMs }
      return integrations
    })
    .finally(() => {
      integrationsRequest = undefined
    })

  return integrationsRequest
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
