import { toaster } from '@/components/ui/toaster'
import { getUserErrorMessage } from './errorMessage'

/**
 * Show a clean, modern success toast notification.
 */
export function showSuccess(title: string, description?: string) {
  toaster.create({
    type: 'success',
    title,
    description,
    duration: 4000,
  })
}

/**
 * Show a clean, modern error toast notification.
 * Automatically normalizes errors into human-readable messages.
 */
export function showError(title: string, error?: unknown) {
  const description = error ? getUserErrorMessage(error) : undefined
  toaster.create({
    type: 'error',
    title,
    description,
    duration: 5000,
  })
}

/**
 * Show an informational toast notification for non-error informational events.
 */
export function showInfo(title: string, description?: string) {
  toaster.create({
    type: 'info',
    title,
    description,
    duration: 4000,
  })
}

/**
 * Stash a toast notification across page reloads (e.g. after company switch).
 */
export function stashToast(type: 'success' | 'error' | 'info', title: string, description?: string) {
  try {
    sessionStorage.setItem('pos-pending-toast', JSON.stringify({ type, title, description }))
  } catch {}
}

/**
 * Consume and show any stashed toast after page reload.
 */
export function consumeStashedToast() {
  try {
    const raw = sessionStorage.getItem('pos-pending-toast')
    if (raw) {
      sessionStorage.removeItem('pos-pending-toast')
      const { type, title, description } = JSON.parse(raw)
      if (type === 'success') showSuccess(title, description)
      else if (type === 'error') showError(title, description)
      else showInfo(title, description)
    }
  } catch {}
}

/**
 * Wrapper around Chakra toaster promise for async long-running actions.
 */
export function notifyPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: { title: string; description?: string }
    success: { title: string; description?: string }
    error: { title: string; description?: string }
  },
) {
  return toaster.promise(promise, messages)
}
