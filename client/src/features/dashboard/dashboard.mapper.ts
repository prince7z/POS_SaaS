import type { InventoryReport, LowStockReport, ProfitLossReport, SalesReport, TransactionsReport } from '@/api/endpoints/reports'
import type { DashboardGranularity, DashboardViewModel, RecentInvoice } from './types'

const paymentLabel = (value: string) => value === 'STORE_CREDIT' ? 'Store credit' : value.charAt(0) + value.slice(1).toLowerCase()
const transactionStatus = (value: unknown) => value === 'PAID' ? 'Completed' : value === 'REFUNDED' ? 'Refunded' : 'Pending'

export function mapDashboardData(sales: SalesReport, inventory: InventoryReport, lowStock: LowStockReport, profitLoss: ProfitLossReport, transactions: TransactionsReport): DashboardViewModel {
  const categorySales = sales.byCategory.map((item) => ({ category: item.categoryName, sales: item.sales, percentage: item.percentage }))
  const recentTransactions = transactions.items.map((item) => ({
    id: String(item.invoiceNumber ?? item.saleId ?? ''),
    customer: String(item.customerName ?? 'Walk-in customer'),
    itemCount: Number(item.itemsCount ?? 0),
    total: Number(item.total ?? 0),
    paymentMethod: paymentLabel(String(item.paymentMethod ?? 'CARD')) as 'Card' | 'Cash' | 'Transfer',
    status: transactionStatus(item.paymentStatus) as 'Completed' | 'Pending' | 'Refunded',
    timestamp: String(item.soldAt ?? new Date().toISOString()),
  }))
  const topSellingProducts = sales.topProducts.map((item, index) => ({ rank: index + 1, productId: item.productId, productName: item.productName, imageKeys: item.imageKeys, unitsSold: item.quantitySold, revenue: item.totalSales }))
  const lowStockAlerts = lowStock.items.map((item) => ({
    productId: String(item.productId ?? ''),
    productName: String(item.productName ?? 'Unnamed product'),
    imageKeys: Array.isArray(item.imageKeys) ? item.imageKeys.map(String) : [],
    currentStock: Number(item.stockQuantity ?? 0),
    threshold: Number(item.lowStockThreshold ?? 0),
    status: Number(item.stockQuantity ?? 0) === 0 ? 'Out of stock' as const : 'Low stock' as const,
  }))
  const recentInvoices: RecentInvoice[] = recentTransactions.map((item) => ({
    invoiceNumber: item.id,
    customer: item.customer,
    date: item.timestamp,
    itemCount: item.itemCount,
    subtotal: item.total,
    tax: 0,
    total: item.total,
    paymentStatus: item.status === 'Completed' ? 'Paid' : 'Pending',
    status: 'Issued',
  }))
  const trend: Record<DashboardGranularity, Array<{ date: string; revenue: number; profit?: number }>> = {
    HOUR: sales.trend.map((item) => ({ date: item.period, revenue: item.sales })),
    DAY: sales.trend.map((item) => ({ date: item.period, revenue: item.sales })),
    WEEK: sales.trend.map((item) => ({ date: item.period, revenue: item.sales })),
    MONTH: sales.trend.map((item) => ({ date: item.period, revenue: item.sales })),
  }

  return {
    kpis: [
      { id: 'sales', label: "Today's Sales", value: sales.kpis.totalSales.value, format: 'currency', change: sales.kpis.totalSales.changePercent ?? 0, comparison: 'vs. previous period' },
      { id: 'orders', label: "Today's Orders", value: sales.kpis.totalOrders.value, format: 'number', change: sales.kpis.totalOrders.changePercent ?? 0, comparison: 'vs. previous period' },
      { id: 'profit', label: 'Net Profit', value: profitLoss.kpis.netProfit.value, format: 'currency', change: profitLoss.kpis.netProfit.changePercent ?? 0, comparison: 'vs. previous period' },
      { id: 'stock', label: 'Low Stock Items', value: inventory.kpis.lowStockItems, format: 'number', change: 0, comparison: 'current inventory' },
      { id: 'payments', label: 'Pending Payments', value: null, format: 'currency', change: 0, comparison: 'Not provided by API' },
    ],
    trend,
    categorySales,
    recentTransactions,
    topSellingProducts,
    lowStockAlerts,
    recentInvoices,
  }
}
