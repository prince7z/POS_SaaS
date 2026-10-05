import { apiRequest } from '../client'

export type QrUploadPurpose =
  | 'PRODUCT_IMAGE'
  | 'CATEGORY_IMAGE'
  | 'BRAND_LOGO'
  | 'CUSTOMER_PROFILE'
  | 'COMPANY_LOGO'

export interface QrSessionResponse {
  token: string
  purpose: QrUploadPurpose
  expiresAt: string
  isMultiple: boolean
}

export interface QrSessionInfoResponse {
  purpose: QrUploadPurpose
  status: 'PENDING' | 'UPLOADED'
  expiresAt: string
  isMultiple: boolean
}

export interface QrPresignFileInput {
  contentType: string
  size?: number
}

export interface QrPresignedFile {
  key: string
  uploadUrl: string
  contentType: string
  expiresIn: number
  expiresAt: string
}

export interface QrPresignResponse {
  files: QrPresignedFile[]
}

export interface QrCompleteResponse {
  success: boolean
  status: 'UPLOADED'
  keys: string[]
}

export interface QrStatusResponse {
  status: 'PENDING' | 'UPLOADED' | 'EXPIRED'
  keys: string[]
  previewUrls: string[]
}

export function createQrUploadSession(purpose: QrUploadPurpose) {
  return apiRequest<QrSessionResponse>('/qr-upload/session', {
    method: 'POST',
    body: JSON.stringify({ purpose }),
  })
}

export function getMobileQrSessionInfo(token: string) {
  return apiRequest<QrSessionInfoResponse>(`/qr-upload/${encodeURIComponent(token)}/session`)
}

export function requestQrUploadPresignedUrls(token: string, files: QrPresignFileInput[]) {
  return apiRequest<QrPresignResponse>(`/qr-upload/${encodeURIComponent(token)}/presign`, {
    method: 'POST',
    body: JSON.stringify({ files }),
  })
}

export function completeQrUploadSession(token: string, keys: string[]) {
  return apiRequest<QrCompleteResponse>(`/qr-upload/${encodeURIComponent(token)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ keys }),
  })
}

export function getQrUploadStatus(token: string) {
  return apiRequest<QrStatusResponse>(`/qr-upload/${encodeURIComponent(token)}/status`)
}

export function deleteQrUploadSession(token: string) {
  return apiRequest<{ success: boolean }>(`/qr-upload/${encodeURIComponent(token)}`, {
    method: 'DELETE',
  })
}

export function deleteMediaKey(key: string) {
  return apiRequest<{ success: boolean }>('/qr-upload/delete-media', {
    method: 'POST',
    body: JSON.stringify({ key }),
  })
}
