import { useEffect, useState } from 'react'
import { Alert, Box, Button, Grid, GridItem, Skeleton, VStack } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { getDashboardProviderData } from '@/data/providers/dashboardProvider'
import type { DashboardCustomRange, DashboardGranularity, DashboardRange, DashboardViewModel } from './types'
import { DashboardFilters } from './components/DashboardFilters'
import { DashboardKpiGrid } from './components/DashboardKpiGrid'
import { SalesProfitTrend } from './components/SalesProfitTrend'
import { SalesByCategory } from './components/SalesByCategory'
import { LowStockAlerts, RecentInvoices, TopSellingProducts } from './components/DashboardLists'

const MotionBox = motion.create(Box)

function DashboardSkeleton() {
  return <VStack align="stretch" gap="6"><Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(5, 1fr)' }} gap="3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} h="112px" borderRadius="lg" />)}</Grid><Grid templateColumns={{ base: '1fr', xl: '2fr 1fr' }} gap="4"><Skeleton h="420px" borderRadius="lg" /><Skeleton h="420px" borderRadius="lg" /></Grid></VStack>
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardViewModel | null>(null)
  const [range, setRange] = useState<DashboardRange>('today')
  const [granularity, setGranularity] = useState<DashboardGranularity>('DAY')
  const [customRange, setCustomRange] = useState<DashboardCustomRange | null>(null)
  const [error, setError] = useState('')
  const singleDay = range === 'today' || range === 'yesterday' || (range === 'custom' && customRange !== null && customRange.from === customRange.to)
  const chartGranularity = singleDay ? 'HOUR' : granularity

  const loadDashboard = () => {
    setError('')
    setData(null)
    getDashboardProviderData(range, granularity, customRange).then(setData).catch(() => setError('Dashboard data could not be loaded.'))
  }

  useEffect(() => { loadDashboard() }, [range, granularity, customRange])

  return (
    <PageContainer>
      <PageHeader title="Dashboard" description="A clear view of your store performance and daily operations." actions={<DashboardFilters value={range} customRange={customRange} onChange={setRange} onCustomRangeChange={(nextRange) => { setCustomRange(nextRange); setRange('custom') }} />} />
      {error && <Alert.Root status="error" mb="6"><Alert.Indicator /><Alert.Content><Alert.Title>Unable to load dashboard</Alert.Title><Alert.Description>{error}</Alert.Description></Alert.Content><Button size="sm" variant="outline" onClick={loadDashboard}>Retry</Button></Alert.Root>}
      {!data && !error && <DashboardSkeleton />}
      {data && (
        <MotionBox initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <VStack align="stretch" gap="6">
            <DashboardKpiGrid kpis={data.kpis} />
            <Grid templateColumns={{ base: '1fr', xl: 'minmax(0, 2fr) minmax(320px, 1fr)' }} gap="4">
              <GridItem><SalesProfitTrend trend={data.trend} granularity={chartGranularity} onGranularityChange={setGranularity} /></GridItem>
              <GridItem><SalesByCategory categories={data.categorySales} /></GridItem>
            </Grid>
            <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }} gap="4">
              {/* <GridItem><RecentTransactions items={data.recentTransactions} /></GridItem> */}
              <GridItem><TopSellingProducts items={data.topSellingProducts} /></GridItem>
              <GridItem><LowStockAlerts items={data.lowStockAlerts} /></GridItem>
            </Grid>
            <RecentInvoices items={data.recentInvoices} />
          </VStack>
        </MotionBox>
      )}
    </PageContainer>
  )
}
