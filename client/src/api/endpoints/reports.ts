import { apiBlob, apiRequest } from '../client'

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
  trend: Array<{ period: string; sales: number; orders: number; itemsSold: number; averageOrderValue: number }>
  byCategory: Array<{ categoryId: string | null; categoryName: string; sales: number; percentage: number }>
  byPaymentMethod: Array<{ paymentMethod: string; amount: number; percentage: number }>
  topProducts: Array<{
    productId: string
    productName: string
    sku: string
    imageKeys: string[]
    imageUrls?: string[]
    imageUrl?: string | null
    quantitySold: number
    totalSales: number
  }>
  recentSales: Array<Record<string, unknown>>
  salesActivity: Array<{ dayOfWeek: string; hour: number; salesAmount: number; orderCount: number }>
  productPerformance: Array<{ product: string; unitsSold: number; revenue: number; cost: number; profit: number }>
}
export interface TransactionsReport {
  items: Array<Record<string, unknown>>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
export interface InventoryReport {
  kpis: {
    totalProducts: number
    totalUnits: number
    lowStockItems: number
    outOfStock: number
    totalStockValue: number
  }
  customerKpis: { totalCustomers: number; newCustomers: number; activeCustomers: number; totalPurchases: number }
  stockStatus: { inStock: number; lowStock: number; outOfStock: number }
  inventoryValueByCategory: Array<{ category: string; value: number }>
  newVsReturning: Array<{ period: string; newCustomers: number; returningCustomers: number }>
  customerTypeDistribution: Array<{ type: string; customers: number }>
  customerPerformance: Array<{
    customerId: string
    name: string
    orders: number
    purchaseValue: number
    averageOrderValue: number
  }>
}
export interface LowStockReport {
  items: Array<Record<string, unknown>>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}
export interface ProfitLossReport {
  kpis: { revenue: Metric; cost: Metric; expenses: Metric; netProfit: Metric; netMargin: number }
  trend: Array<{ period: string; revenue: number; cost: number; expenses: number; netProfit: number }>
  expenseBreakdown: Array<Record<string, unknown>>
  expenseTrend: Array<{ period: string; category: string; amount: number }>
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
  return apiRequest<TransactionsReport>(
    `/reports/sales/transactions${query({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 5 })}`,
  )
}
export function exportSalesReport(filters: PageFilters) {
  return apiBlob(`/reports/sales/export${query(filters)}`)
}
export function getInventoryCustomerReport(filters: ReportFilters) {
  return apiRequest<InventoryReport>(`/reports/inventory-customer${query(filters)}`)
}
export function getLowStockItems(filters: PageFilters) {
  return apiRequest<LowStockReport>(
    `/reports/inventory-customer/low-stock${query({ ...filters, page: filters.page ?? 1, limit: filters.limit ?? 5 })}`,
  )
}
export function getTopCustomers(filters: ReportFilters) {
  return apiRequest<{ items: Array<Record<string, unknown>> }>(
    `/reports/inventory-customer/top-customers${query(filters)}`,
  )
}
export function getRecentCustomers(filters: ReportFilters) {
  return apiRequest<{ items: Array<Record<string, unknown>> }>(
    `/reports/inventory-customer/recent-customers${query(filters)}`,
  )
}
export function exportInventoryReport(filters: PageFilters) {
  return apiBlob(`/reports/inventory-customer/export${query(filters)}`)
}
export function getProfitLossReport(filters: ReportFilters) {
  return apiRequest<ProfitLossReport>(`/reports/profit-loss${query(filters)}`)
}
export function getProfitableProducts(filters: ReportFilters) {
  return apiRequest<{ items: Array<Record<string, unknown>> }>(`/reports/profit-loss/top-products${query(filters)}`)
}
export function getRecentExpenses(filters: ReportFilters) {
  return apiRequest<{ items: Array<Record<string, unknown>> }>(`/reports/profit-loss/recent-expenses${query(filters)}`)
}
export function exportProfitLossReport(filters: PageFilters) {
  return apiBlob(`/reports/profit-loss/export${query(filters)}`)
}
