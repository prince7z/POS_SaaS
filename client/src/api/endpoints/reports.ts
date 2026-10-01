import { apiRequest } from '../client'

export type ReportGranularity = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH'
export interface ReportFilters {
  from?: string
  to?: string
  categoryId?: string
  paymentMethod?: 'CASH' | 'CARD' | 'STORE_CREDIT'
  customerType?: string
  granularity?: ReportGranularity
}
export interface PageFilters extends ReportFilters {
  page?: number
  limit?: number
  search?: string
}

export interface Metric {
  value: number
  previousValue: number
  changePercent: number | null
  direction: 'up' | 'down' | 'flat'
}
export interface SalesReport {
  filters: { from: string; to: string }
  kpis: { totalSales: Metric; totalOrders: Metric; totalItemsSold: number; averageOrderValue: Metric }
  trend: Array<{ period: string; sales: number }>
  byCategory: Array<{ categoryId: string | null; categoryName: string; sales: number; percentage: number }>
  byPaymentMethod: Array<{ paymentMethod: string; amount: number; percentage: number }>
  topProducts: Array<{ productId: string; productName: string; sku: string; imageKeys: string[]; quantitySold: number; totalSales: number }>
  recentSales: Array<Record<string, unknown>>
}
export interface TransactionsReport {
  items: Array<Record<string, unknown>>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
export interface InventoryReport {
  kpis: { totalProducts: number; lowStockItems: number; outOfStock: number; totalStockValue: number }
  stockStatus: { inStock: number; lowStock: number; outOfStock: number }
}
export interface LowStockReport {
  items: Array<Record<string, unknown>>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
export interface ProfitLossReport {
  kpis: { revenue: Metric; cost: Metric; expenses: Metric; netProfit: Metric }
  trend: Array<Record<string, unknown>>
  expenseBreakdown: Array<Record<string, unknown>>
}

function query(filters: object) {
  const params = new URLSearchParams()
  Object.entries(filters as Record<string, string | number | undefined>).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value))
  })
  return params.toString() ? `?${params.toString()}` : ''
}

export function getSalesReport(filters: ReportFilters) {
  return apiRequest<SalesReport>(`/reports/sales${query(filters)}`)
}
export function getSalesTransactions(filters: PageFilters) {
  return apiRequest<TransactionsReport>(`/reports/sales/transactions${query({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 5 })}`)
}
export function getInventoryCustomerReport(filters: ReportFilters) {
  return apiRequest<InventoryReport>(`/reports/inventory-customer${query(filters)}`)
}
export function getLowStockItems(filters: PageFilters) {
  return apiRequest<LowStockReport>(`/reports/inventory-customer/low-stock${query({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 5 })}`)
}
export function getProfitLossReport(filters: ReportFilters) {
  return apiRequest<ProfitLossReport>(`/reports/profit-loss${query(filters)}`)
}
