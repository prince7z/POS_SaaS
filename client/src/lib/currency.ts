export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  locale: string
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'INR', name: 'INR — Indian Rupee (₹)', symbol: '₹', locale: 'en-IN' },
  { code: 'USD', name: 'USD — US Dollar ($)', symbol: '$', locale: 'en-US' },
  { code: 'ZAR', name: 'ZAR — South African Rand (R)', symbol: 'R', locale: 'en-ZA' },
  { code: 'EUR', name: 'EUR — Euro (€)', symbol: '€', locale: 'en-IE' },
  { code: 'GBP', name: 'GBP — British Pound (£)', symbol: '£', locale: 'en-GB' },
  { code: 'CAD', name: 'CAD — Canadian Dollar (CA$)', symbol: 'CA$', locale: 'en-CA' },
  { code: 'AUD', name: 'AUD — Australian Dollar (AU$)', symbol: 'AU$', locale: 'en-AU' },
  { code: 'AED', name: 'AED — UAE Dirham (AED)', symbol: 'AED', locale: 'en-AE' },
  { code: 'SGD', name: 'SGD — Singapore Dollar (SG$)', symbol: 'SG$', locale: 'en-SG' },
  { code: 'JPY', name: 'JPY — Japanese Yen (¥)', symbol: '¥', locale: 'ja-JP' },
]

export interface CountryInfo {
  code: string
  name: string
  defaultCurrency: string
}

export const SUPPORTED_COUNTRIES: CountryInfo[] = [
  { code: 'IN', name: 'India', defaultCurrency: 'INR' },
  { code: 'US', name: 'United States', defaultCurrency: 'USD' },
  { code: 'ZA', name: 'South Africa', defaultCurrency: 'ZAR' },
  { code: 'GB', name: 'United Kingdom', defaultCurrency: 'GBP' },
  { code: 'AE', name: 'United Arab Emirates', defaultCurrency: 'AED' },
  { code: 'CA', name: 'Canada', defaultCurrency: 'CAD' },
  { code: 'AU', name: 'Australia', defaultCurrency: 'AUD' },
  { code: 'SG', name: 'Singapore', defaultCurrency: 'SGD' },
  { code: 'JP', name: 'Japan', defaultCurrency: 'JPY' },
  { code: 'DE', name: 'Germany', defaultCurrency: 'EUR' },
  { code: 'FR', name: 'France', defaultCurrency: 'EUR' },
]

export function getActiveCurrencyCode(): string {
  try {
    const raw = localStorage.getItem('pos-company')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.currencyCode) return parsed.currencyCode
    }
  } catch {}
  return 'ZAR'
}

export function getActiveCurrencySymbol(code?: string): string {
  const c = code || getActiveCurrencyCode()
  const found = SUPPORTED_CURRENCIES.find((item) => item.code === c)
  return found?.symbol ?? c
}

export function formatCurrency(value: number, customCurrency?: string): string {
  const code = customCurrency || getActiveCurrencyCode()
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === code) || {
    code,
    symbol: code,
    locale: 'en-US',
  }
  const num = typeof value === 'number' && !Number.isNaN(value) ? value : 0
  try {
    return new Intl.NumberFormat(info.locale, {
      style: 'currency',
      currency: info.code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    return `${info.symbol} ${num.toFixed(2)}`
  }
}

