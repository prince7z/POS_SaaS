import { Box, Grid, Heading, Skeleton, Text } from '@chakra-ui/react'
import type { EChartsOption } from 'echarts'
import type { InventoryItem, InventorySummary } from '@/api/endpoints/inventory'
import { EChart } from '@/components/charts/EChart'

export function InventoryAnalytics({ summary, lowStockItems, loading }: { summary?: InventorySummary; lowStockItems: InventoryItem[]; loading: boolean }) {
  const healthOption: EChartsOption = {
    animationDuration: 300,
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['55%', '78%'], avoidLabelOverlap: true, data: [{ name: 'Low stock', value: summary?.lowStockProducts ?? 0 }, { name: 'Out of stock', value: summary?.outOfStockProducts ?? 0 }], emphasis: { scale: true } }],
  }
  const lowStockOption: EChartsOption = {
    animationDuration: 300,
    grid: { left: 8, right: 18, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', inverse: true, data: lowStockItems.map((item) => item.name) },
    series: [{ type: 'bar', data: lowStockItems.map((item) => item.stockQuantity), barMaxWidth: 18 }],
  }
  return (
    <Grid templateColumns={{ base: '1fr', xl: 'minmax(280px, 0.8fr) minmax(0, 1.2fr)' }} gap="4">
      <Box borderWidth="1px" borderColor="border" borderRadius="lg" bg="surface" p="4">
        <Heading fontSize="md">Stock health</Heading>
        <Text mt="1" fontSize="sm" color="secondary">Current low and out-of-stock products</Text>
        {loading ? <Skeleton mt="4" h="220px" borderRadius="md" /> : <EChart option={healthOption} height="220px" ariaLabel="Stock health donut chart" />}
      </Box>
      <Box borderWidth="1px" borderColor="border" borderRadius="lg" bg="surface" p="4">
        <Heading fontSize="md">Low stock items</Heading>
        <Text mt="1" fontSize="sm" color="secondary">Products returned by the low-stock filter</Text>
        {loading ? <Skeleton mt="4" h="220px" borderRadius="md" /> : lowStockItems.length ? <EChart option={lowStockOption} height="220px" ariaLabel="Low stock items bar chart" /> : <Text py="20" textAlign="center" color="secondary">No low-stock products.</Text>}
      </Box>
    </Grid>
  )
}

