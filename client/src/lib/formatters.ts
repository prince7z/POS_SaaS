import { appConfig } from '@/config/app'

// ─── Currency ──────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat(appConfig.defaultLocale, {
  style: 'currency',
  currency: appConfig.defaultCurrency,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value)
}

// ─── Numbers ───────────────────────────────────────────────────────────

const compactFormatter = new Intl.NumberFormat(appConfig.defaultLocale, {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
})

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(appConfig.defaultLocale).format(value)
}

export function formatCompact(value: number): string {
  return compactFormatter.format(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

// ─── Date / Time ───────────────────────────────────────────────────────

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(appConfig.defaultLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(appConfig.defaultLocale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const diff = now - new Date(dateStr).getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return formatDate(dateStr)
}

// ─── Misc ──────────────────────────────────────────────────────────────

export function formatSku(sku: string): string {
  return sku.toUpperCase()
}

export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
  }
  return phone
}
