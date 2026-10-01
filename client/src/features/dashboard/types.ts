export type DashboardRange = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'custom'
export type DashboardGranularity = 'HOUR' | 'DAY' | 'WEEK' | 'MONTH'
export interface DashboardCustomRange {
  from: string
  to: string
}
export type PaymentMethod = 'Card' | 'Cash' | 'Transfer'
export type TransactionStatus = 'Completed' | 'Pending' | 'Refunded'
export type StockStatus = 'Low stock' | 'Out of stock'

export interface DashboardKpi {
  id: string
  label: string
  value: number | null
  format: 'currency' | 'number'
  change: number
  comparison: string
}

export interface TrendPoint {
  date: string
  revenue: number
  profit?: number
}

export interface CategorySale {
  category: string
  sales: number
  percentage: number
}

export interface RecentTransaction {
  id: string
  customer: string
  itemCount: number
  total: number
  paymentMethod: PaymentMethod
  status: TransactionStatus
  timestamp: string
}

export interface TopSellingProduct {
  rank: number
  productId: string
  productName: string
  imageKeys: string[]
  unitsSold: number
  revenue: number
}

export interface LowStockAlert {
  productId: string
  productName: string
  imageKeys: string[]
  currentStock: number
  threshold: number
  status: StockStatus
}

export interface RecentInvoice {
  invoiceNumber: string
  customer: string
  date: string
  itemCount: number
  subtotal: number
  tax: number
  total: number
  paymentStatus: 'Paid' | 'Pending' | 'Overdue'
  status: 'Issued' | 'Draft' | 'Cancelled'
}

export interface DashboardViewModel {
  kpis: DashboardKpi[]
  trend: Record<DashboardGranularity, TrendPoint[]>
  categorySales: CategorySale[]
  recentTransactions: RecentTransaction[]
  topSellingProducts: TopSellingProduct[]
  lowStockAlerts: LowStockAlert[]
  recentInvoices: RecentInvoice[]
}
