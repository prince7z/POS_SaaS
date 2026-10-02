import { useMemo } from 'react'
import { Box, NativeSelect } from '@chakra-ui/react'
import type { EChartsOption } from 'echarts'
import { EChart } from '@/components/charts/EChart'
import { formatCurrency } from '@/lib/formatters'
import { getChartThemeTokens } from '../chartTheme'
import type { DashboardGranularity, TrendPoint } from '../types'
import { DashboardSection } from './DashboardSection'

function formatChartDate(value: string) {
  if (value.includes('T') || value.includes(' ')) {
    const date = new Date(value.replace(' ', 'T'))
    if (!Number.isNaN(date.getTime()))
      return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
  }
  const normalized = /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value
  const date = new Date(`${normalized}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(date)
}

export function SalesProfitTrend({
  trend,
  granularity,
  onGranularityChange,
}: {
  trend: Record<DashboardGranularity, TrendPoint[]>
  granularity: DashboardGranularity
  onGranularityChange: (value: DashboardGranularity) => void
}) {
  const theme = getChartThemeTokens()
  const points = trend[granularity] ?? []
  const option = useMemo<EChartsOption>(
    () => ({
      animation: true,
      animationDuration: 450,
      animationDurationUpdate: 250,
      color: [theme.primary, theme.secondary],
      tooltip: {
        trigger: 'axis',
        renderMode: 'html',
        appendToBody: true,
        confine: false,
        valueFormatter: (value) => formatCurrency(Number(value)),
      },
      legend: { bottom: 0, icon: 'circle', textStyle: { color: theme.text } },
      grid: { left: 12, right: 18, top: 20, bottom: 62, containLabel: true },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: points.map((point) => point.date),
        axisLine: { lineStyle: { color: theme.border } },
        axisLabel: {
          color: theme.text,
          interval: 0,
          hideOverlap: false,
          rotate: points.length > 8 ? 28 : 0,
          margin: 14,
          formatter: formatChartDate,
        },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: theme.border } },
        axisLabel: { color: theme.text, formatter: (value: number) => formatCurrency(value).replace(/\.00$/, '') },
      },
      series: [
        {
          name: 'Revenue',
          type: 'line',
          smooth: true,
          showSymbol: false,
          data: points.map((point) => point.revenue),
          emphasis: { focus: 'series' },
          areaStyle: { opacity: 0.05 },
        },
        ...(points.some((point) => point.profit !== undefined)
          ? [
              {
                name: 'Profit',
                type: 'line' as const,
                smooth: true,
                showSymbol: false,
                data: points.map((point) => point.profit ?? null),
                emphasis: { focus: 'series' as const },
              },
            ]
          : []),
      ],
    }),
    [points, theme.border, theme.primary, theme.secondary, theme.text],
  )

  return (
    <DashboardSection
      title="Revenue & Profit Trend"
      description="Compare revenue with gross profit across the selected period."
      action={
        <NativeSelect.Root size="sm" width="100px">
          <NativeSelect.Field
            aria-label="Chart granularity"
            value={granularity}
            onChange={(event) => onGranularityChange(event.target.value as DashboardGranularity)}
          >
            <option value="HOUR">Hour</option>
            <option value="DAY">Day</option>
            <option value="WEEK">Week</option>
            <option value="MONTH">Month</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      }
    >
      <Box px={{ base: '3', md: '5' }} pb="4">
        <EChart option={option} height="340px" ariaLabel="Revenue and profit trend chart" />
      </Box>
    </DashboardSection>
  )
}
