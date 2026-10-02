import { apiRequest } from '../client'

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<void>('/auth/change-password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}
