import type { SaleDiscountType } from '@/api/endpoints/sales'
import type { SaleTotals } from './types'

export function calculateSaleTotals(subtotal: number, discountType: SaleDiscountType | null, discountValue: number, taxRate: number): SaleTotals {
  const gross = Math.max(0, subtotal)
  const requestedDiscount = discountType === 'PERCENT' ? gross * (discountValue / 100) : discountType === 'FIXED' ? discountValue : 0
  const discount = Math.min(gross, Math.max(0, requestedDiscount))
  const taxableAmount = Math.max(0, gross - discount)
  const tax = taxableAmount * (taxRate / 100)
  return { subtotal: gross, discount, taxableAmount, tax, total: taxableAmount + tax }
}
