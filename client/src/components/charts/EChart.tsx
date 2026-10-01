import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

export function EChart({ option, height = '320px', ariaLabel }: { option: EChartsOption; height?: string; ariaLabel: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const chart = echarts.init(containerRef.current)
    chartRef.current = chart
    const resizeObserver = new ResizeObserver(() => chart.resize())

    chart.setOption(option)
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: false, lazyUpdate: true })
  }, [option])

  return <div ref={containerRef} role="img" aria-label={ariaLabel} style={{ width: '100%', height }} />
}
