import type { CatalogCategory, CatalogProduct } from '@/api/endpoints/catalog'
import type { Customer } from '@/api/endpoints/customers'
import type { SaleDiscountType, SalePaymentMethod } from '@/api/endpoints/sales'

export type { CatalogCategory, CatalogProduct, Customer, SaleDiscountType, SalePaymentMethod }
export interface CartItem extends CatalogProduct { quantity: number }
export interface SaleTotals { subtotal: number; discount: number; taxableAmount: number; tax: number; total: number }
export interface POSFilters { search: string; categoryId: string | null; page: number }
