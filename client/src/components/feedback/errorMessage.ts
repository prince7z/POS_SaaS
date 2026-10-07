/**
 * Safely extracts a clean, user-facing error message from any caught error.
 * Prevents raw JSON, status codes, or stack traces from leaking into toasts.
 */
export function getUserErrorMessage(
  error: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!error) return fallback
  if (typeof error === 'string') return sanitizeMessage(error, fallback)
  if (error instanceof Error && error.message) {
    return sanitizeMessage(error.message, fallback)
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
  ) {
    return sanitizeMessage((error as { message: string }).message, fallback)
  }
  return fallback
}

function sanitizeMessage(msg: string, fallback: string): string {
  const trimmed = msg.trim()
  if (!trimmed) return fallback
  // If it looks like raw JSON, HTML, or an unhandled stack trace, return fallback
  if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<')) {
    return fallback
  }
  if (trimmed.includes('TypeError:') || trimmed.includes('SyntaxError:') || trimmed.includes('at ')) {
    return fallback
  }
  return trimmed
}
