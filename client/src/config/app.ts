// ─── Application Metadata ──────────────────────────────────────────────
export const APP_NAME = 'Jcom'
export const APP_DESCRIPTION = 'Multi-location Point of Sale & Analytics Suite'
export const APP_VERSION = '1.0.0'

// ─── Configuration ─────────────────────────────────────────────────────
export const apiBaseUrl =
  (import.meta.env.VITE_BE_API as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (typeof process !== 'undefined' ? process.env?.BE_API : undefined) ||
  'http://localhost:4000'

export const appConfig = {
  name: APP_NAME,
  description: APP_DESCRIPTION,
  version: APP_VERSION,
  defaultCurrency: 'USD',
  defaultLocale: 'en-US',
  defaultTimezone: 'America/New_York',
  dateFormat: 'MMM dd, yyyy',
  timeFormat: 'hh:mm a',
  pagination: {
    defaultPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
  },
  tax: {
    defaultRate: 0.08, // 8%
    inclusive: false,
  },
} as const
