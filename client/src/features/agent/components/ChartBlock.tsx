import { useMemo } from 'react'
import { Box, Text } from '@chakra-ui/react'
import type { EChartsOption } from 'echarts'
import { EChart } from '@/components/charts/EChart'
import { chartColors } from '@/theme/tokens'
import type { ChartBlock as ChartBlockType, ChartSpec } from '../types/agent'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeChartSpec(rawSpec: any): ChartSpec {
  if (Array.isArray(rawSpec)) {
    return {
      chartType: 'bar',
      data: rawSpec,
    }
  }

  if (rawSpec && typeof rawSpec === 'object') {
    const data = Array.isArray(rawSpec.data)
      ? rawSpec.data
      : Array.isArray(rawSpec.rows)
      ? rawSpec.rows
      : Array.isArray(rawSpec.items)
      ? rawSpec.items
      : []

    const rawType = String(rawSpec.chartType || rawSpec.chart_type || rawSpec.type || '').toLowerCase()
    const titleLower = String(rawSpec.title || '').toLowerCase()

    let chartType: 'line' | 'bar' | 'donut' | 'pie' | 'area' = 'bar'

    if (rawType.includes('line') || titleLower.includes('line') || titleLower.includes('trend')) {
      chartType = 'line'
    } else if (
      rawType.includes('donut') ||
      rawType.includes('pie') ||
      titleLower.includes('donut') ||
      titleLower.includes('pie') ||
      titleLower.includes('share')
    ) {
      chartType = 'donut'
    } else if (rawType.includes('area')) {
      chartType = 'area'
    } else if (rawType.includes('bar') || titleLower.includes('bar')) {
      chartType = 'bar'
    }

    const xKey = rawSpec.xAxis?.key || rawSpec.xKey || rawSpec.xAxisKey
    const series = Array.isArray(rawSpec.series)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? rawSpec.series.map((s: any) => ({
          key: String(s.key || s.dataKey || ''),
          label: String(s.label || s.key || s.dataKey || ''),
          dataKey: String(s.dataKey || s.key || ''),
        }))
      : []

    return {
      chartType,
      title: rawSpec.title,
      xAxis: rawSpec.xAxis || (xKey ? { key: xKey } : undefined),
      xKey,
      series,
      data,
    }
  }

  return { chartType: 'bar', data: [] }
}

export function buildEChartOption(rawSpec: ChartSpec): EChartsOption {
  const spec = normalizeChartSpec(rawSpec)
  const { chartType, xAxis, xKey, series = [], data = [] } = spec

  if (data.length === 0) {
    return { title: { text: 'No chart data available', left: 'center', textStyle: { fontSize: 12, color: '#9CA3AF' } } }
  }

  const sample = data[0] || {}
  const keys = Object.keys(sample)

  const resolvedXKey =
    (xAxis?.key && sample[xAxis.key] !== undefined ? xAxis.key : null) ||
    (xKey && sample[xKey] !== undefined ? xKey : null) ||
    keys.find((k) => ['category', 'name', 'label', 'date', 'month', 'week', 'time', 'day'].includes(k.toLowerCase())) ||
    keys.find((k) => typeof sample[k] === 'string') ||
    keys[0] ||
    'x'

  if (chartType === 'donut' || (chartType as string) === 'pie') {
    const seriesKey =
      series[0]?.key ||
      series[0]?.dataKey ||
      keys.find((k) => ['amount', 'total', 'sales', 'expenses', 'value', 'count'].includes(k.toLowerCase())) ||
      keys.find((k) => typeof sample[k] === 'number') ||
      keys[1] ||
      'value'

    const pieData = data.map((item) => {
      const labelVal = String(item[resolvedXKey] ?? item.name ?? item.category ?? '')
      const numVal = Number(item[seriesKey] ?? item.amount ?? item.value ?? 0)
      return {
        name: labelVal || 'Other',
        value: isNaN(numVal) ? 0 : numVal,
      }
    })

    return {
      color: [...chartColors],
      tooltip: { trigger: 'item', formatter: '{b}: ₹{c} ({d}%)' },
      legend: { bottom: '0', icon: 'circle', textStyle: { fontSize: 11 } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 12, fontWeight: 'bold' } },
          data: pieData,
        },
      ],
    }
  }

  // Line, Bar, or Area chart
  const xCategories = data.map((item) => String(item[resolvedXKey] ?? ''))

  let effectiveSeries = series
  if (effectiveSeries.length === 0) {
    const numericKeys = keys.filter((k) => k !== resolvedXKey && typeof sample[k] === 'number')
    effectiveSeries = (numericKeys.length > 0 ? numericKeys : [keys[1] || 'value']).map((k) => ({
      key: k,
      dataKey: k,
      label: k.replace(/_/g, ' ').toUpperCase(),
    }))
  }

  const echartsSeries = effectiveSeries.map((s, index) => {
    const dataKey = s.key || s.dataKey || ''
    const isLineOrArea = chartType === 'line' || chartType === 'area'
    return {
      name: s.label,
      type: isLineOrArea ? ('line' as const) : ('bar' as const),
      smooth: isLineOrArea,
      showSymbol: isLineOrArea,
      symbolSize: 6,
      areaStyle: chartType === 'area' ? { opacity: 0.25 } : undefined,
      data: data.map((item) => {
        const val = Number(item[dataKey] ?? 0)
        return isNaN(val) ? 0 : val
      }),
      itemStyle: {
        color: chartColors[index % chartColors.length],
        borderRadius: chartType === 'bar' ? [4, 4, 0, 0] : 0,
      },
    }
  })

  return {
    color: [...chartColors],
    tooltip: { trigger: 'axis' },
    legend: { top: '0', icon: 'circle', textStyle: { fontSize: 11 } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: effectiveSeries.length > 1 ? '35px' : '15px', containLabel: true },
    xAxis: {
      type: 'category',
      data: xCategories,
      axisLine: { lineStyle: { color: '#E5E7EB' } },
      axisLabel: { color: '#6B7280', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#F3F4F6' } },
      axisLabel: { color: '#6B7280', fontSize: 11 },
    },
    series: echartsSeries,
  }
}

export function ChartBlock({ block }: { block: ChartBlockType }) {
  const { spec } = block
  const option = useMemo(() => buildEChartOption(spec), [spec])

  return (
    <Box p="3" bg="surface" borderWidth="1px" borderRadius="lg" my="2" shadow="sm">
      {spec.title && (
        <Text fontSize="xs" fontWeight="semibold" color="foreground" mb="2">
          {spec.title}
        </Text>
      )}
      <EChart option={option} height="220px" ariaLabel={spec.title || 'Agent Chart'} />
    </Box>
  )
}
