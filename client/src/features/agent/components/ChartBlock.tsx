import { useMemo } from 'react'
import { Box, Text } from '@chakra-ui/react'
import type { EChartsOption } from 'echarts'
import { EChart } from '@/components/charts/EChart'
import { chartColors } from '@/theme/tokens'
import type { ChartBlock as ChartBlockType, ChartSpec } from '../types/agent'

export function buildEChartOption(spec: ChartSpec): EChartsOption {
  const { chartType, xKey = 'x', series = [], data = [] } = spec

  const xCategories = data.map((item) => String(item[xKey] ?? ''))

  if (chartType === 'donut') {
    const seriesKey = series[0]?.dataKey || 'value'
    const pieData = data.map((item) => ({
      name: String(item[xKey] || item.name || ''),
      value: Number(item[seriesKey] || 0),
    }))

    return {
      color: [...chartColors],
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
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

  // Line or Bar chart
  const echartsSeries = series.map((s, index) => ({
    name: s.label,
    type: chartType === 'line' ? ('line' as const) : ('bar' as const),
    smooth: chartType === 'line',
    data: data.map((item) => Number(item[s.dataKey] || 0)),
    itemStyle: {
      color: chartColors[index % chartColors.length],
      borderRadius: chartType === 'bar' ? [4, 4, 0, 0] : 0,
    },
  }))

  return {
    color: [...chartColors],
    tooltip: { trigger: 'axis' },
    legend: { top: '0', icon: 'circle', textStyle: { fontSize: 11 } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: series.length > 1 ? '35px' : '15px', containLabel: true },
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
