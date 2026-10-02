import {
  getInventoryCustomerReport,
  getLowStockItems,
  getProfitLossReport,
  getSalesReport,
  getSalesTransactions,
} from '@/api/endpoints/reports'
import type { DashboardCustomRange, DashboardRange, DashboardGranularity } from './types'
import { mapDashboardData } from './dashboard.mapper'

function dates(range: DashboardRange, customRange?: DashboardCustomRange | null) {
  const today = new Date()
  const date = (value: Date) => value.toISOString().slice(0, 10)
  if (range === 'today') return { from: date(today), to: date(today) }
  if (range === 'yesterday') {
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    return { from: date(yesterday), to: date(yesterday) }
  }
  if (range === 'lastMonth') {
    const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastOfPreviousMonth = new Date(firstOfCurrentMonth.getTime() - 86400000)
    return {
      from: date(new Date(lastOfPreviousMonth.getFullYear(), lastOfPreviousMonth.getMonth(), 1)),
      to: date(lastOfPreviousMonth),
    }
  }
  if (range === 'thisMonth') return { from: date(new Date(today.getFullYear(), today.getMonth(), 1)), to: date(today) }
  if (range === 'custom' && customRange) return customRange
  const days = range === 'last7' ? 7 : 30
  const from = new Date(today)
  from.setDate(today.getDate() - days + 1)
  return { from: date(from), to: date(today) }
}

export async function getDashboardData(
  range: DashboardRange,
  granularity: DashboardGranularity = 'DAY',
  customRange?: DashboardCustomRange | null,
) {
  const selectedDates = dates(range, customRange)
  const isSingleDay = selectedDates.from === selectedDates.to
  const filters = { ...selectedDates, granularity: isSingleDay ? ('HOUR' as const) : granularity }
  const [sales, transactions, inventory, lowStock, profitLoss] = await Promise.all([
    getSalesReport(filters),
    getSalesTransactions(filters),
    getInventoryCustomerReport(filters),
    getLowStockItems({ page: 1, limit: 5 }),
    getProfitLossReport(filters),
  ])
  return mapDashboardData(sales, inventory, lowStock, profitLoss, transactions)
}
