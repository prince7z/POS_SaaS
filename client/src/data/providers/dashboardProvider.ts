import { getDashboardData } from '@/features/dashboard/dashboard.service'
import type { DashboardCustomRange, DashboardGranularity, DashboardRange } from '@/features/dashboard/types'

export function getDashboardProviderData(
  range: DashboardRange,
  granularity: DashboardGranularity,
  customRange?: DashboardCustomRange | null,
) {
  return getDashboardData(range, granularity, customRange)
}
