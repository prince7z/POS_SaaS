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
  })
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
): Promise<T> {
  return toaster.promise(promise, messages)
}
