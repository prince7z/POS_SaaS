import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Activity,
  AlertCircle,
  BarChart3,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleStop,
  Package,
  RefreshCw,
  ReceiptText,
  ShoppingCart,
  Warehouse,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { EChartsOption } from 'echarts'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Input,
  NativeSelect,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react'
import {
  getTakealotBreakdown,
  getTakealotAlerts,
  getTakealotDashboardOverview,
  getTakealotInventoryHistory,
  getTakealotInventoryAnalytics,
  getTakealotInventorySummary,
  getTakealotOrders,
  getTakealotOffers,
  getTakealotPricingSalesAnalytics,
  getTakealotProducts,
  getTakealotSyncStatus,
  stopTakealotSync,
  streamTakealotSync,
  getTakealotTrends,
  triggerTakealotSync,
  type TakealotAlert,
  type TakealotBreakdownGroup,
  type TakealotDateFilters,
  type TakealotOrder,
  type TakealotOrderRecord,
  type TakealotOverview,
  type TakealotPageFilters,
  type TakealotSale,
  type TakealotSyncStatus,
} from '@/api/endpoints/takealot'
import { getIntegrations, type Integration } from '@/api/endpoints/integrations'
import { EChart } from '@/components/charts/EChart'
import { PageHeader } from '@/components/common/PageHeader'
import { showError, showSuccess } from '@/components/feedback/notifications'
import { PageContainer } from '@/components/layout/PageContainer'
import { getStoredCompany, getStoredUser } from '@/lib/auth'
import { PageSizeControl } from '@/components/common/PageSizeControl'
import { formatCurrency, formatNumber, formatReportDate } from '@/lib/formatters'
import { readTakealotCache, TAKEALOT_CACHE_TTL, writeTakealotCache } from './takealot-cache'
import { TakealotDateRangePicker, type TakealotDateRange } from './components/TakealotDateRangePicker'

type DateRange = TakealotDateRange
type Granularity = 'day' | 'week' | 'month'
type Section = 'overview' | 'analytics' | 'products' | 'orders' | 'stock' | 'offers' | 'alerts'
type ResourceMeta = { savedAt: number; stale: boolean; cached: boolean; loading?: boolean }
type DashboardIdentity = { configured: boolean; companyId: string; userId: string; integrationId: string }

interface ResourceState<T> extends ResourceMeta {
  key: string
  data?: T
  loading: boolean
  error: string
}

const MotionCard = motion.create(Card.Root)
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const lastThirtyDays = (): DateRange => {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { from: iso(from), to: iso(to) }
}
const toErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback)
const escapeChartText = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  )
const cacheKey = (identity: DashboardIdentity, section: string, parameters: object = {}) =>
  JSON.stringify({
    companyId: identity.companyId,
    userId: identity.userId,
    integrationId: identity.integrationId,
    section,
    parameters,
  })
const recordNumber = (value: Record<string, unknown> | undefined, key: string) =>
  typeof value?.[key] === 'number' && Number.isFinite(value[key]) ? (value[key] as number) : undefined
const dateLabel = (value: string) => formatReportDate(value)
const defaultResourceState = <T,>(key: string): ResourceState<T> => ({
  key,
  loading: false,
  error: '',
  savedAt: 0,
  stale: false,
  cached: false,
})

function localIdentity(integrationId = ''): DashboardIdentity {
  const company = getStoredCompany()
  return {
    configured: Boolean(integrationId),
    companyId: company?.id ?? 'current-company',
    userId: getStoredUser()?.id ?? 'current-user',
    integrationId,
  }
}

function useCachedResource<T>(
  enabled: boolean,
  key: string,
  fetcher: (signal: AbortSignal) => Promise<T>,
  refreshToken: number,
  onMeta: (meta: ResourceMeta, refreshToken: number, outcome?: 'success' | 'error') => void,
) {
  const [state, setState] = useState<ResourceState<T>>(() => defaultResourceState<T>(key))
  const stateRef = useRef(state)
  stateRef.current = state
  const requestId = useRef(0)
  const controller = useRef<AbortController | undefined>(undefined)
  const previousRefresh = useRef(refreshToken)

  const load = useCallback(
    async (forceRefresh: boolean) => {
      if (!enabled) return
      controller.current?.abort()
      const activeController = new AbortController()
      controller.current = activeController
      const id = ++requestId.current
      const previousState = stateRef.current
      const previous = previousState.key === key ? previousState.data : undefined
      onMeta({ ...previousState, loading: true }, refreshToken)
      setState((current) => ({
        ...defaultResourceState<T>(key),
        data: current.key === key ? current.data : undefined,
        loading: true,
        savedAt: current.key === key ? current.savedAt : 0,
        cached: current.key === key ? current.cached : false,
        stale: false,
      }))

      let cachedValue: Awaited<ReturnType<typeof readTakealotCache<T>>> = null
      try {
        cachedValue = await readTakealotCache<T>(key)
      } catch (error) {
        console.warn('Takealot dashboard cache is unavailable; loading from the API.', error)
      }
      if (id !== requestId.current || activeController.signal.aborted) return

      const cachedIsFresh = cachedValue !== null && Date.now() - cachedValue.savedAt < TAKEALOT_CACHE_TTL
      if (cachedValue && cachedIsFresh && !forceRefresh) {
        setState({
          key,
          data: cachedValue.value,
          loading: false,
          error: '',
          savedAt: cachedValue.savedAt,
          cached: true,
          stale: false,
        })
        onMeta({ savedAt: cachedValue.savedAt, cached: true, stale: false, loading: false }, refreshToken)
        return
      }

      const fallbackData = previous ?? cachedValue?.value
      if (fallbackData !== undefined) {
        const savedAt = cachedValue?.savedAt ?? previousState.savedAt
        setState({
          key,
          data: fallbackData,
          loading: true,
          error: '',
          savedAt,
          cached: Boolean(cachedValue) || previousState.cached,
          stale: Boolean(cachedValue && !cachedIsFresh),
        })
      }

      try {
        const value = await fetcher(activeController.signal)
        if (id !== requestId.current || activeController.signal.aborted) return
        const savedAt = Date.now()
        setState({ key, data: value, loading: false, error: '', savedAt, cached: false, stale: false })
        onMeta(
          { savedAt, cached: false, stale: false, loading: false },
          refreshToken,
          forceRefresh ? 'success' : undefined,
        )
        try {
          await writeTakealotCache(key, value, savedAt)
        } catch (error) {
          console.warn('Takealot dashboard data could not be cached.', error)
        }
      } catch (error) {
        if (activeController.signal.aborted || id !== requestId.current) return
        const message = toErrorMessage(error, 'Takealot data could not be loaded.')
        const savedAt = cachedValue?.savedAt ?? previousState.savedAt
        const retainedData = previous ?? cachedValue?.value
        setState({
          key,
          data: retainedData,
          loading: false,
          error: message,
          savedAt,
          cached: Boolean(cachedValue) || previousState.cached,
          stale: retainedData !== undefined,
        })
        onMeta(
          {
            savedAt,
            cached: Boolean(cachedValue) || previousState.cached,
            stale: retainedData !== undefined,
            loading: false,
          },
          refreshToken,
          forceRefresh ? 'error' : undefined,
        )
      }
    },
    [enabled, fetcher, key, onMeta, refreshToken],
  )

  useEffect(() => {
    if (!enabled) return
    const forceRefresh = previousRefresh.current !== refreshToken
    previousRefresh.current = refreshToken
    void load(forceRefresh)
    return () => {
      controller.current?.abort()
      requestId.current += 1
    }
  }, [enabled, load, refreshToken])

  const refresh = useCallback(() => {
    void load(true)
  }, [load])
  const visibleState = state.key === key ? state : defaultResourceState<T>(key)
  return { ...visibleState, refresh }
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon = BarChart3,
  valueColor,
}: {
  label: string
  value?: string
  detail?: string
  icon?: LucideIcon
  valueColor?: string
}) {
  return (
    <MotionCard
      variant="outline"
      minW="0"
      w="full"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
    >
      <Card.Body>
        <Flex justify="space-between" align="start">
          <Text color="fg.muted" fontSize="sm">
            {label}
          </Text>
          <Icon size={18} aria-hidden="true" />
        </Flex>
        <Heading size="lg" mt="2" color={valueColor}>
          {value ?? 'Unavailable'}
        </Heading>
        {detail && (
          <Text fontSize="xs" color="fg.muted" mt="1">
            {detail}
          </Text>
        )}
      </Card.Body>
    </MotionCard>
  )
}

function SummaryGroupCard({
  label,
  value,
  secondary,
  detail,
  valueColor,
}: {
  label: string
  value: string
  secondary: Array<{ label: string; value: string }>
  detail?: string
  valueColor?: string
}) {
  return (
    <Card.Root variant="outline" minW="0">
      <Card.Body>
        <Text color="fg.muted" fontSize="sm">
          {label}
        </Text>
        <Heading size="lg" mt="2" color={valueColor}>
          {value}
        </Heading>
        <Stack gap="1" mt="3">
          {secondary.map((item) => (
            <Flex key={item.label} justify="space-between" gap="3">
              <Text color="fg.muted" fontSize="sm">
                {item.label}
              </Text>
              <Text fontSize="sm" fontWeight="medium" color={valueColor}>
                {item.value}
              </Text>
            </Flex>
          ))}
        </Stack>
        {detail && (
          <Text fontSize="xs" color="fg.muted" mt="2">
            {detail}
          </Text>
        )}
      </Card.Body>
    </Card.Root>
  )
}

function ChartCard({
  title,
  description,
  option,
  icon: Icon,
  height = '320px',
}: {
  title: string
  description?: string
  option: EChartsOption
  icon: LucideIcon
  height?: string
}) {
  return (
    <MotionCard
      variant="outline"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <Card.Header>
        <Flex align="center" gap="2">
          <Icon size={17} aria-hidden="true" />
          <Card.Title>{title}</Card.Title>
        </Flex>
        {description && <Card.Description>{description}</Card.Description>}
      </Card.Header>
      <Card.Body>
        <EChart option={option} height={height} ariaLabel={title} />
      </Card.Body>
    </MotionCard>
  )
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Card.Root variant="outline" minW="0" w="full">
      <Card.Body>
        <Flex align="start" gap="3">
          <AlertCircle size={18} aria-hidden="true" />
          <Box>
            <Text color="fg.error">{message}</Text>
            <Button mt="3" size="sm" variant="outline" onClick={retry}>
              Retry
            </Button>
          </Box>
        </Flex>
      </Card.Body>
    </Card.Root>
  )
}

function ResourceNotice({
  resource,
  retry,
}: {
  resource: { error: string; stale: boolean; cached: boolean }
  retry: () => void
}) {
  if (!resource.error && !resource.cached && !resource.stale) return null
  if (resource.error && !resource.stale) {
    return <ErrorPanel message={resource.error} retry={retry} />
  }
  return (
    <Flex
      align={{ base: 'start', md: 'center' }}
      justify="space-between"
      gap="3"
      p="3"
      borderWidth="1px"
      borderColor="border"
      borderRadius="md"
    >
      <Text fontSize="sm" color={resource.stale ? 'fg.error' : 'fg.muted'}>
        {resource.error
          ? `Refresh failed. Showing previously retrieved data. ${resource.error}`
          : resource.cached
            ? 'Showing data saved in this browser.'
            : 'Showing previously retrieved data.'}
      </Text>
      <Button size="xs" variant="outline" onClick={retry}>
        Retry
      </Button>
    </Flex>
  )
}

function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4" aria-label="Loading Takealot dashboard">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} h="120px" borderRadius="md" />
      ))}
    </SimpleGrid>
  )
}

function ChartSkeletons() {
  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
      <Skeleton h="340px" borderRadius="md" />
      <Skeleton h="340px" borderRadius="md" />
    </SimpleGrid>
  )
}

function OverviewPanel({
  enabled,
  identity,
  refreshToken,
  onMeta,
}: {
  enabled: boolean
  identity: DashboardIdentity
  refreshToken: number
  onMeta: (meta: ResourceMeta, refreshToken: number, outcome?: 'success' | 'error') => void
}) {
  const key = cacheKey(identity, 'overview')
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotDashboardOverview(identity.integrationId, signal),
    [identity.integrationId],
  )
  const pricingKey = cacheKey(identity, 'pricing-sales-analytics')
  const pricingFetcher = useCallback(
    (signal: AbortSignal) => getTakealotPricingSalesAnalytics(identity.integrationId, signal),
    [identity.integrationId],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const pricing = useCachedResource(enabled, pricingKey, pricingFetcher, refreshToken, onMeta)
  const data = resource.data

  if (resource.loading && !data) return <LoadingCards />
  if (!data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />
  if (!data) return null

  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <MetricCard label="Total offers" value={formatNumber(data.totalOffers)} icon={Package} />
        <MetricCard label="Active listings" value={formatNumber(data.listingStatusCounts.active)} icon={Activity} />
        <MetricCard
          label="Disabled listings"
          value={formatNumber(data.listingStatusCounts.disabled)}
          icon={AlertCircle}
        />
        <MetricCard label="Stock units" value={formatNumber(data.totalStock)} icon={Warehouse} />
        <MetricCard label="Incoming units" value={formatNumber(data.totalIncomingStock)} icon={ShoppingCart} />
        <MetricCard
          label="Inventory cost value"
          value={formatCurrency(data.inventoryCostValue)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Potential retail value"
          value={formatCurrency(data.potentialRetailInventoryValue)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Potential gross profit"
          value={formatCurrency(data.potentialGrossProfit)}
          icon={CircleDollarSign}
        />
        <MetricCard
          label="Potential gross margin"
          value={
            data.potentialGrossMarginPercent === null
              ? 'Unavailable'
              : `${data.potentialGrossMarginPercent.toFixed(1)}%`
          }
          icon={ChartNoAxesCombined}
        />
        <MetricCard label="Out of stock" value={formatNumber(data.outOfStockOffers)} icon={AlertCircle} />
        <MetricCard label="Low stock" value={formatNumber(data.lowStockOffers)} icon={AlertCircle} />
        <MetricCard label="Excess stock" value={formatNumber(data.excessStockOffers)} icon={Package} />
        <MetricCard label="Missing cost" value={formatNumber(data.missingCostOffers)} icon={ReceiptText} />
        <MetricCard label="Missing RRP" value={formatNumber(data.missingRrpOffers)} icon={ReceiptText} />
      </SimpleGrid>
      {pricing.data && (
        <>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
            <MetricCard
              label="Offers below cost"
              value={formatNumber(pricing.data.pricing.sellingBelowCostOffers)}
              icon={AlertCircle}
            />
            <MetricCard
              label="Offers with positive potential margin"
              value={formatNumber(pricing.data.pricing.positivePotentialMarginOffers)}
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Offers with negative potential margin"
              value={formatNumber(pricing.data.pricing.negativePotentialMarginOffers)}
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Reported sales units"
              value={formatNumber(
                pricing.data.reportedSalesUnitsByWarehouse.reduce((sum, item) => sum + item.units, 0),
              )}
              detail="Takealot-reported offer sales units, not date-bounded revenue."
              icon={ShoppingCart}
            />
          </SimpleGrid>
          <Card.Root variant="outline">
            <Card.Header>
              <Heading size="sm">Top offers by reported sales units</Heading>
              <Text fontSize="sm" color="fg.muted">
                {pricing.data.salesSemantics}
              </Text>
            </Card.Header>
            <Box overflowX="auto">
              <Table.Root size="sm" variant="line">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Offer</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Reported units</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Selling price</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Cost</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Potential profit / unit</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {pricing.data.topOffersByReportedSales.map((offer) => (
                    <Table.Row key={offer.offerId}>
                      <Table.Cell>
                        {offer.title || offer.offerId}
                        <Text fontSize="xs" color="fg.muted">
                          {offer.sku || ''}
                        </Text>
                      </Table.Cell>
                      <Table.Cell textAlign="end">{formatNumber(offer.reportedSalesUnits)}</Table.Cell>
                      <Table.Cell textAlign="end">
                        {offer.sellingPrice === null ? '—' : formatCurrency(offer.sellingPrice)}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        {offer.costPrice === null ? '—' : formatCurrency(offer.costPrice)}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        {offer.potentialGrossProfitPerUnit === null
                          ? 'Unavailable'
                          : formatCurrency(offer.potentialGrossProfitPerUnit)}
                      </Table.Cell>
                    </Table.Row>
                  ))}
                  {pricing.data.topOffersByReportedSales.length === 0 && (
                    <Table.Row>
                      <Table.Cell colSpan={5} textAlign="center">
                        No reported sales units are available.
                      </Table.Cell>
                    </Table.Row>
                  )}
                </Table.Body>
              </Table.Root>
            </Box>
          </Card.Root>
        </>
      )}
      {pricing.loading && !pricing.data && <LoadingCards count={4} />}
      {pricing.error && (
        <ResourceNotice
          resource={{ error: pricing.error, stale: pricing.stale, cached: pricing.cached }}
          retry={pricing.refresh}
        />
      )}
      <Card.Root variant="outline">
        <Card.Body>
          <Text fontSize="sm" color="fg.muted">
            {data.financialNote} These are current offer-derived estimates, not realized sales profit.
          </Text>
          <Text fontSize="xs" color="fg.muted" mt="2">
            {data.lastSuccessfulSyncAt
              ? `Offers last synchronized ${new Date(data.lastSuccessfulSyncAt).toLocaleString()}${data.isStale ? ' · Data is stale' : ''}.`
              : 'No successful offer synchronization is available yet.'}
          </Text>
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}

function AnalyticsPanel({
  enabled,
  identity,
  range,
  granularity,
  refreshToken,
  onMeta,
}: {
  enabled: boolean
  identity: DashboardIdentity
  range: DateRange
  granularity: Granularity
  refreshToken: number
  onMeta: (meta: ResourceMeta, refreshToken: number, outcome?: 'success' | 'error') => void
}) {
  const [groupBy, setGroupBy] = useState<TakealotBreakdownGroup>('saleStatus')
  const filters: TakealotDateFilters = useMemo(() => ({ ...range, interval: granularity }), [range, granularity])
  const keyFilters = JSON.stringify(filters)
  const trendKey = cacheKey(identity, 'trends-v2', filters)
  const breakdownKey = cacheKey(identity, 'breakdown', { from: range.from, to: range.to, groupBy })
  const loadTrends = useCallback(
    (signal: AbortSignal) => getTakealotTrends(identity.integrationId, filters, signal),
    [identity.integrationId, keyFilters],
  )
  const loadBreakdown = useCallback(
    (signal: AbortSignal) => getTakealotBreakdown(identity.integrationId, range, groupBy, signal),
    [identity.integrationId, range.from, range.to, groupBy],
  )
  const trends = useCachedResource(enabled, trendKey, loadTrends, refreshToken, onMeta)
  const breakdown = useCachedResource(enabled, breakdownKey, loadBreakdown, refreshToken, onMeta)
  const points = trends.data?.series ?? []
  const dates = points.map((point) => point.date)
  const totals = useMemo(
    () =>
      points.reduce(
        (result, point) => ({
          revenue: result.revenue + point.revenue,
          units: result.units + point.units,
          orders: result.orders + point.orders,
        }),
        { revenue: 0, units: 0, orders: 0 },
      ),
    [points],
  )
  const trendOption: EChartsOption = useMemo(
    () => ({
      legend: { data: ['Sales value', 'Total fee', 'Units sold', 'Orders'], bottom: 0, selectedMode: 'multiple' },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const items = Array.isArray(params) ? params : [params]
          const date = String(items[0]?.name ?? '')
          const values = items.map((item) => {
            if (item.value === null || item.value === undefined) {
              return `${item.marker ?? ''}${item.seriesName}: unavailable`
            }
            const value = Number(item.value)
            const formatted = ['Sales value', 'Total fee'].includes(String(item.seriesName))
              ? formatCurrency(value)
              : formatNumber(value)
            return `${item.marker ?? ''}${item.seriesName}: ${formatted}`
          })
          return [dateLabel(date), ...values].join('<br/>')
        },
      },
      grid: { left: 76, right: 92, top: 32, bottom: 70 },
      xAxis: { type: 'category', data: dates, axisLabel: { formatter: (value: string) => dateLabel(value) } },
      yAxis: [
        {
          type: 'value',
          name: 'Sales',
          position: 'left',
          axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) },
        },
        {
          type: 'value',
          name: 'Units',
          position: 'right',
          axisLabel: { formatter: (value: number) => formatNumber(Number(value)) },
        },
        {
          type: 'value',
          name: 'Orders',
          position: 'right',
          offset: 58,
          axisLabel: { formatter: (value: number) => formatNumber(Number(value)) },
        },
      ],
      series: [
        {
          name: 'Sales value',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: points.map((point) => point.revenue),
        },
        {
          name: 'Total fee',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          showSymbol: false,
          data: points.map((point) => point.totalFee),
        },
        {
          name: 'Units sold',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: false,
          data: points.map((point) => point.units),
        },
        {
          name: 'Orders',
          type: 'line',
          yAxisIndex: 2,
          smooth: true,
          showSymbol: false,
          data: points.map((point) => point.orders),
        },
      ],
    }),
    [dates, points],
  )
  const breakdownPoints = breakdown.data?.breakdown ?? []
  const breakdownOption: EChartsOption = useMemo(() => {
    const distribution =
      groupBy === 'dc' || groupBy === 'customerDc' || groupBy === 'stockSourceRegion' || groupBy === 'saleStatus'
    if (distribution) {
      return {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          valueFormatter: (value) => formatCurrency(Number(value)),
        },
        grid: { left: 100, right: 24, top: 20, bottom: 30 },
        xAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) } },
        yAxis: { type: 'category', data: breakdownPoints.map((point) => point.key) },
        series: [{ name: 'Sales value', type: 'bar', data: breakdownPoints.map((point) => point.revenue) }],
      }
    }
    return {
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          return `${item.name}: ${formatCurrency(Number(item.value))} (${Number(item.percent ?? 0).toFixed(1)}%)`
        },
      },
      legend: { orient: 'horizontal', bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          data: breakdownPoints.map((point) => ({ name: point.key, value: point.revenue })),
        },
      ],
    }
  }, [breakdownPoints, groupBy])

  const resourceError = trends.error || breakdown.error
  if (enabled && trends.loading && !trends.data && breakdown.loading && !breakdown.data) {
    return (
      <>
        <ChartSkeletons />
        <LoadingCards count={2} />
      </>
    )
  }
  if (resourceError && !trends.data && !breakdown.data) {
    return (
      <ErrorPanel
        message={resourceError}
        retry={() => {
          trends.refresh()
          breakdown.refresh()
        }}
      />
    )
  }
  return (
    <Stack gap="4">
      {(trends.error || breakdown.error) && (
        <ResourceNotice
          resource={{
            error: trends.error || breakdown.error,
            stale: trends.stale || breakdown.stale,
            cached: trends.cached || breakdown.cached,
          }}
          retry={() => {
            trends.refresh()
            breakdown.refresh()
          }}
        />
      )}
      {trends.loading && !trends.data && <ChartSkeletons />}
      {breakdown.loading && !breakdown.data && <Skeleton h="320px" borderRadius="md" />}
      {points.length === 0 && !trends.loading && trends.data && (
        <Card.Root variant="outline">
          <Card.Body>
            <Text>No sales records were returned for this date range. Change the dates or refresh.</Text>
          </Card.Body>
        </Card.Root>
      )}
      {points.length > 0 && (
        <>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
            <MetricCard
              label="Sales value"
              value={formatCurrency(totals.revenue)}
              detail="Sum of selling_price from the sales rows."
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Units sold"
              value={formatNumber(totals.units)}
              detail="Formula: sum of sale-item quantities."
              icon={ShoppingCart}
            />
            <MetricCard
              label="Orders"
              value={formatNumber(totals.orders)}
              detail="Formula: count of distinct order IDs."
              icon={ReceiptText}
            />
          </SimpleGrid>
          <ChartCard
            title="Sales trend"
            description="Daily, weekly, or monthly sales value (sum of selling_price per sales row), total Takealot fees, units, and distinct orders. Click legend items to show or hide each line; each metric uses its own axis."
            option={trendOption}
            height="340px"
            icon={Activity}
          />
        </>
      )}
      <Flex justify="flex-end">
        <NativeSelect.Root size="sm" maxW="220px">
          <NativeSelect.Field
            aria-label="Sales breakdown dimension"
            value={groupBy}
            onChange={(event) => setGroupBy(event.target.value as TakealotBreakdownGroup)}
          >
            <option value="promotion">Promotion</option>
            <option value="saleStatus">Sale status</option>
            <option value="dc">Distribution centre</option>
            <option value="customerDc">Customer distribution centre</option>
            <option value="stockSourceRegion">Stock source region</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Flex>
      {breakdown.data && breakdownPoints.length === 0 ? (
        <Card.Root variant="outline">
          <Card.Body>
            <Text>No breakdown data is available for this range.</Text>
          </Card.Body>
        </Card.Root>
      ) : breakdown.data ? (
        <ChartCard
          title="Sales breakdown"
          description={`Sales value by ${groupBy === 'dc' ? 'distribution centre' : groupBy === 'customerDc' ? 'customer distribution centre' : groupBy === 'saleStatus' ? 'sale status' : groupBy === 'stockSourceRegion' ? 'stock source region' : 'promotion'}.`}
          option={breakdownOption}
          icon={ChartNoAxesCombined}
        />
      ) : null}
      {trends.data && (
        <Text fontSize="xs" color="fg.muted">
          {trends.data.revenueDefinition}
        </Text>
      )}
    </Stack>
  )
}

function ProductPanel({
  enabled,
  identity,
  range,
  refreshToken,
  onMeta,
}: {
  enabled: boolean
  identity: DashboardIdentity
  range: DateRange
  refreshToken: number
  onMeta: (meta: ResourceMeta, refreshToken: number, outcome?: 'success' | 'error') => void
}) {
  const sortBy: TakealotPageFilters['sortBy'] = 'revenue'
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [draftSku, setDraftSku] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [filter, setFilter] = useState<{ sku?: string; productTitle?: string }>({})
  const filters = useMemo(
    () => ({ ...range, ...filter, page, limit, sortBy, order }),
    [range.from, range.to, filter, page, limit, sortBy, order],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'products-v3', filters)
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotProducts(identity.integrationId, filters, signal),
    [identity.integrationId, requestKey],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const productData = resource.data
  const products = productData?.products ?? []
  useEffect(() => {
    setPage(1)
  }, [range.from, range.to])
  const scatterOption: EChartsOption = useMemo(
    () => ({
      legend: {
        data: ['Sales value', 'Units sold', 'Orders', 'Total fee', 'Profit / loss'],
        bottom: 0,
        selectedMode: 'multiple',
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const items = Array.isArray(params) ? params : [params]
          const index = Number(items[0]?.dataIndex ?? 0)
          const product = products[index]
          if (!product) return ''
          return [
            escapeChartText(product.title ?? 'Untitled product'),
            `SKU: ${escapeChartText(product.sku ?? '—')}`,
            `TSIN: ${product.tsin === undefined ? '—' : String(product.tsin)}`,
            ...items.map((item) => {
              if (item.value === null || item.value === undefined) {
                return `${item.marker ?? ''}${item.seriesName}: unavailable`
              }
              const value = Number(item.value)
              const formatted = ['Sales value', 'Total fee', 'Profit / loss'].includes(String(item.seriesName))
                ? formatCurrency(value)
                : formatNumber(value)
              return `${item.marker ?? ''}${item.seriesName}: ${formatted}`
            }),
            `Average selling price: ${formatCurrency(product.averagePrice)}`,
            product.unitCost === null
              ? 'Unit cost: not encoded in SKU'
              : `Unit cost: ${formatCurrency(product.unitCost)}`,
            product.feePerUnit === null
              ? 'Fee per unit: unavailable'
              : `Fee per unit: ${formatCurrency(product.feePerUnit)}`,
          ].join('<br/>')
        },
      },
      grid: { left: 140, right: 96, top: 34, bottom: 74 },
      xAxis: {
        type: 'category',
        data: products.map((product) => product.sku || product.title || 'Product'),
        axisLabel: { rotate: 25, interval: 0 },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Sales',
          position: 'left',
          axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) },
        },
        {
          type: 'value',
          name: 'Units',
          position: 'right',
          axisLabel: { formatter: (value: number) => formatNumber(Number(value)) },
        },
        {
          type: 'value',
          name: 'Orders',
          position: 'right',
          offset: 58,
          axisLabel: { formatter: (value: number) => formatNumber(Number(value)) },
        },
        {
          type: 'value',
          name: 'Profit / loss',
          position: 'left',
          offset: 60,
          axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) },
        },
      ],
      series: [
        {
          name: 'Sales value',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          showSymbol: true,
          data: products.map((product) => product.revenue),
        },
        {
          name: 'Units sold',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          showSymbol: true,
          data: products.map((product) => product.units),
        },
        {
          name: 'Orders',
          type: 'line',
          yAxisIndex: 2,
          smooth: true,
          showSymbol: true,
          data: products.map((product) => product.orders),
        },
        {
          name: 'Total fee',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          showSymbol: true,
          data: products.map((product) => product.totalFee),
        },
        {
          name: 'Profit / loss',
          type: 'line',
          yAxisIndex: 3,
          smooth: true,
          showSymbol: true,
          connectNulls: false,
          lineStyle: { color: '#64748b', type: 'dashed' },
          data: products.map((product) => ({
            value: product.profit,
            ...(product.profit !== null && {
              itemStyle: { color: product.profit >= 0 ? '#16a34a' : '#dc2626' },
            }),
          })),
        },
      ],
    }),
    [products],
  )

  const applyFilter = () => {
    setPage(1)
    setFilter({
      ...(draftSku.trim() && { sku: draftSku.trim() }),
      ...(draftTitle.trim() && { productTitle: draftTitle.trim() }),
    })
  }
  if (resource.loading && !resource.data)
    return (
      <>
        <LoadingCards count={3} />
        <ChartSkeletons />
      </>
    )
  if (!resource.data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />
  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <Flex gap="3" wrap="wrap" align="end">
        <Box>
          <Text fontSize="sm" mb="1">
            SKU
          </Text>
          <Input
            size="sm"
            aria-label="Filter products by SKU"
            value={draftSku}
            onChange={(event) => setDraftSku(event.target.value)}
          />
        </Box>
        <Box>
          <Text fontSize="sm" mb="1">
            Product title
          </Text>
          <Input
            size="sm"
            aria-label="Filter products by title"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
          />
        </Box>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setPage(1)
            setOrder(order === 'desc' ? 'asc' : 'desc')
          }}
        >
          {order === 'desc' ? 'Highest first' : 'Lowest first'}
        </Button>
        <Button size="sm" onClick={applyFilter}>
          Apply filters
        </Button>
      </Flex>
      {productData && (
        <>
          <Text fontSize="sm" color="fg.muted">
            Date-range summary · {dateLabel(range.from)} – {dateLabel(range.to)}
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 3 }} gap="4">
            <SummaryGroupCard
              label="Total revenue"
              value={formatCurrency(productData.summary.revenue)}
              secondary={[{ label: 'Average product price', value: formatCurrency(productData.summary.averagePrice) }]}
            />
            <SummaryGroupCard
              label="Total orders"
              value={formatNumber(productData.summary.orders)}
              secondary={[
                { label: 'Units sold', value: formatNumber(productData.summary.units) },
                { label: 'Average units per order', value: formatNumber(productData.summary.unitsPerOrder) },
              ]}
            />
            <SummaryGroupCard
              label="Total Takealot fees"
              value={
                productData.summary.totalFee === null ? 'Unavailable' : formatCurrency(productData.summary.totalFee)
              }
              secondary={[
                {
                  label: 'Average fee per unit',
                  value:
                    productData.summary.feePerUnit === null
                      ? 'Unavailable'
                      : formatCurrency(productData.summary.feePerUnit),
                },
              ]}
              detail="Charges deducted by Takealot."
              valueColor="fg.error"
            />
          </SimpleGrid>
          <Card.Root variant="outline">
            <Card.Body>
              <SimpleGrid columns={{ base: 1, md: 2 }} gap="6" alignItems="center">
                <Box>
                  <Text color="fg.muted" fontSize="sm">
                    Total item cost
                  </Text>
                  <Heading size="xl" mt="2">
                    {productData.summary.totalCost === null
                      ? 'Unavailable'
                      : formatCurrency(productData.summary.totalCost)}
                  </Heading>
                  <Text fontSize="xs" color="fg.muted" mt="2">
                    Sum of unit cost × quantity for each sale row with a cost encoded in its SKU.
                  </Text>
                  {productData.summary.uncostedUnits > 0 && (
                    <Text fontSize="xs" color="fg.error" mt="1">
                      Cost is unavailable for {formatNumber(productData.summary.uncostedUnits)} units; this total
                      excludes them.
                    </Text>
                  )}
                </Box>
                <Box>
                  <Text color="fg.muted" fontSize="sm">
                    Estimated total profit / loss
                  </Text>
                  <Heading
                    size="2xl"
                    mt="2"
                    color={
                      productData.summary.profit === null
                        ? undefined
                        : productData.summary.profit >= 0
                          ? 'green.fg'
                          : 'fg.error'
                    }
                  >
                    {productData.summary.profit === null
                      ? 'Unavailable'
                      : `${productData.summary.profit >= 0 ? '+' : ''}${formatCurrency(productData.summary.profit)}`}
                  </Heading>
                  <Text fontSize="sm" color="fg.muted" mt="2">
                    Calculated as total revenue − Takealot fees − total item cost
                    {productData.summary.uncostedUnits > 0 ? ' (excludes units without an SKU-encoded cost).' : '.'}
                  </Text>
                </Box>
              </SimpleGrid>
            </Card.Body>
          </Card.Root>
        </>
      )}

      {!productData || products.length === 0 ? (
        <Card.Root variant="outline">
          <Card.Body>
            <Text>No products were returned for this date range.</Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <>
          <ChartCard
            title="Product performance"
            description="Sales value, units sold, distinct orders, total Takealot fees, and backend-calculated profit/loss (sales value - product cost - fees) by product. Click legend items to show or hide lines."
            option={scatterOption}
            icon={ChartNoAxesCombined}
          />
          <Card.Root variant="outline">
            <Card.Header>
              <Flex justify="space-between" align="center">
                <Card.Title>Products</Card.Title>
                <Badge variant="subtle">{formatNumber(productData.pagination.total)} products</Badge>
              </Flex>
            </Card.Header>
            <Stack display={{ base: 'flex', lg: 'none' }} gap="3" px="4" pb="4">
              {products.map((product, index) => {
                return (
                  <Card.Root key={`${product.sku ?? 'product'}-${product.tsin ?? index}`} variant="subtle">
                    <Card.Body gap="3">
                      <Box minW="0">
                        <Text fontWeight="semibold" overflowWrap="anywhere">
                          {product.title ?? 'Untitled product'}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                          SKU {product.sku ?? '—'} · TSIN {product.tsin === undefined ? '—' : String(product.tsin)}
                        </Text>
                      </Box>
                      <SimpleGrid columns={2} gap="3">
                        <Box>
                          <Text fontSize="xs" color="fg.muted">
                            Sales value
                          </Text>
                          <Text color="blue.600">{formatCurrency(product.revenue)}</Text>
                          <Text fontSize="xs" color="fg.muted">
                            Avg. price {formatCurrency(product.averagePrice)}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="fg.muted">
                            Total fee
                          </Text>
                          <Text color="fg.error">
                            {product.totalFee === null ? '—' : formatCurrency(product.totalFee)}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {product.feePerUnit === null ? '—' : `${formatCurrency(product.feePerUnit)} / unit`}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="fg.muted">
                            Total cost
                          </Text>
                          <Text color="yellow.600">
                            {product.totalCost === null ? '—' : formatCurrency(product.totalCost)}
                          </Text>
                          <Text fontSize="xs" color="fg.muted">
                            {product.unitCost === null
                              ? 'Unit cost unavailable'
                              : `${formatCurrency(product.unitCost)} / unit`}
                          </Text>
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="fg.muted">
                            Profit / loss
                          </Text>
                          {product.profit === null ? (
                            <Text>—</Text>
                          ) : (
                            <Text color={product.profit >= 0 ? 'green.fg' : 'fg.error'}>
                              {product.profit >= 0 ? '+' : ''}
                              {formatCurrency(product.profit)}
                              <Text as="span" display="block" fontSize="xs" color="fg.muted">
                                {product.profitPerUnit !== null &&
                                  `${product.profitPerUnit >= 0 ? '+' : ''}${formatCurrency(product.profitPerUnit)} / unit`}
                              </Text>
                            </Text>
                          )}
                        </Box>
                        <Box>
                          <Text fontSize="xs" color="fg.muted">
                            Orders
                          </Text>
                          <Text>{formatNumber(product.orders)}</Text>
                          <Text fontSize="xs" color="fg.muted">
                            {formatNumber(product.units)} units
                          </Text>
                        </Box>
                      </SimpleGrid>
                    </Card.Body>
                  </Card.Root>
                )
              })}
            </Stack>
            <Box display={{ base: 'none', lg: 'block' }} minW="0" w="full">
              <Table.Root size="sm" tableLayout="fixed" w="full">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader w="27%">Product</Table.ColumnHeader>
                    <Table.ColumnHeader w="16%" textAlign="end">
                      Sales value
                    </Table.ColumnHeader>
                    <Table.ColumnHeader w="13%" textAlign="end">
                      Total fee
                    </Table.ColumnHeader>
                    <Table.ColumnHeader w="14%" textAlign="end">
                      Total cost
                    </Table.ColumnHeader>
                    <Table.ColumnHeader w="16%" textAlign="end">
                      Profit / loss
                    </Table.ColumnHeader>
                    <Table.ColumnHeader w="14%" textAlign="end">
                      Orders
                    </Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {products.map((product, index) => {
                    return (
                      <Table.Row key={`${product.sku ?? 'product'}-${product.tsin ?? index}`}>
                        <Table.Cell overflowWrap="anywhere">
                          <Text fontWeight="medium">{product.title ?? 'Untitled product'}</Text>
                          <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                            SKU {product.sku ?? '—'} · TSIN {product.tsin === undefined ? '—' : String(product.tsin)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell textAlign="end" whiteSpace="nowrap">
                          <Text color="blue.600">{formatCurrency(product.revenue)}</Text>
                          <Text display="block" fontSize="xs" color="fg.muted">
                            Avg. price {formatCurrency(product.averagePrice)}
                          </Text>
                        </Table.Cell>
                        <Table.Cell textAlign="end" whiteSpace="nowrap">
                          {product.totalFee === null ? (
                            '—'
                          ) : (
                            <>
                              <Text color="fg.error">{formatCurrency(product.totalFee)}</Text>
                              <Text display="block" fontSize="xs" color="fg.muted">
                                {product.feePerUnit !== null && `${formatCurrency(product.feePerUnit)} / unit`}
                              </Text>
                            </>
                          )}
                        </Table.Cell>
                        <Table.Cell textAlign="end" whiteSpace="nowrap">
                          <Text color="yellow.600">
                            {product.totalCost === null ? '—' : formatCurrency(product.totalCost)}
                          </Text>
                          <Text display="block" fontSize="xs" color="fg.muted">
                            {product.unitCost === null
                              ? 'Unit cost unavailable'
                              : `${formatCurrency(product.unitCost)} / unit`}
                          </Text>
                        </Table.Cell>
                        <Table.Cell textAlign="end" whiteSpace="nowrap">
                          {product.profit === null ? (
                            '—'
                          ) : (
                            <Text as="span" color={product.profit >= 0 ? 'green.fg' : 'fg.error'}>
                              {product.profit >= 0 ? '+' : ''}
                              {formatCurrency(product.profit)}
                              <Text as="span" display="block" fontSize="xs" color="fg.muted">
                                {product.profitPerUnit !== null &&
                                  `${product.profitPerUnit >= 0 ? '+' : ''}${formatCurrency(product.profitPerUnit)} / unit`}
                              </Text>
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell textAlign="end" whiteSpace="nowrap">
                          {formatNumber(product.orders)}
                          <Text display="block" fontSize="xs" color="fg.muted">
                            {formatNumber(product.units)} units
                          </Text>
                        </Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
            <Flex justify="space-between" align="center" p="4" wrap="wrap" gap="3">
              <Text fontSize="sm" color="fg.muted">
                Page {productData.pagination.page} of {Math.max(productData.pagination.totalPages, 1)}
              </Text>
              <Flex gap="3" align="center" wrap="wrap">
                <PageSizeControl
                  value={limit}
                  onChange={(value) => {
                    setLimit(value)
                    setPage(1)
                  }}
                />
                <Flex gap="2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    <ChevronLeft size={15} /> Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={page >= productData.pagination.totalPages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Next <ChevronRight size={15} />
                  </Button>
                </Flex>
              </Flex>
            </Flex>
          </Card.Root>
          <Text fontSize="xs" color="fg.muted">
            {productData.revenueDefinition} Profit / loss = sales value - total item cost - Takealot fees, calculated by
            the backend. Unit cost comes from the C/R&lt;amount&gt; in the SKU (or the catalog cost); rows without a
            cost have no profit.
          </Text>
        </>
      )}
    </Stack>
  )
}

type OrderDisplayRow = {
  key: string
  orderId: number
  itemId?: number
  date?: string
  sku?: string
  title?: string
  quantity?: number
  price?: number
  status?: string | boolean
  dc?: string
}

function normalizeOrders(orders: TakealotOrderRecord[]): OrderDisplayRow[] {
  return orders.flatMap((record, orderIndex) => {
    if ('order_items' in record) {
      const order: TakealotOrder = record
      return order.order_items.map((item, itemIndex) => ({
        key: `${order.order_id}-${item.order_item_id ?? itemIndex}`,
        orderId: order.order_id,
        itemId: item.order_item_id,
        date: order.date_authed,
        sku: item.merchant_sku,
        title: item.title,
      }))
    }
    const sale: TakealotSale = record
    return [
      {
        key: `${sale.order_id}-${sale.order_item_id ?? orderIndex}`,
        orderId: sale.order_id,
        itemId: sale.order_item_id,
        date: sale.order_date,
        sku: sale.sku,
        title: sale.product_title,
        quantity: sale.quantity,
        price: sale.selling_price,
        status: sale.sale_status,
        dc: sale.dc,
      },
    ]
  })
}

function OrdersPanel({
  enabled,
  identity,
  range,
  refreshToken,
  onMeta,
}: {
  enabled: boolean
  identity: DashboardIdentity
  range: DateRange
  refreshToken: number
  onMeta: (meta: ResourceMeta, refreshToken: number, outcome?: 'success' | 'error') => void
}) {
  const [page, setPage] = useState(1)
  const [draftSku, setDraftSku] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [draftOrderId, setDraftOrderId] = useState('')
  const [filter, setFilter] = useState<{ sku?: string; productTitle?: string; orderId?: number }>({})
  const [limit, setLimit] = useState(10)
  const filters = useMemo(
    () => ({
      ...range,
      ...filter,
      page,
      limit,
    }),
    [range.from, range.to, filter, page, limit],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'orders', filters)
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotOrders(identity.integrationId, filters, signal),
    [identity.integrationId, requestKey],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const ordersData = resource.data
  const rows = useMemo(() => normalizeOrders(ordersData?.orders ?? []), [ordersData])
  useEffect(() => {
    setPage(1)
  }, [range.from, range.to])
  const applyFilter = () => {
    const parsedOrderId = draftOrderId.trim() ? Number(draftOrderId) : undefined
    if (parsedOrderId !== undefined && (!Number.isSafeInteger(parsedOrderId) || parsedOrderId <= 0)) {
      showError('Invalid order ID', 'Enter a positive whole-number order ID.')
      return
    }
    setPage(1)
    setFilter({
      ...(draftSku.trim() && { sku: draftSku.trim() }),
      ...(draftTitle.trim() && { productTitle: draftTitle.trim() }),
      ...(parsedOrderId !== undefined && { orderId: parsedOrderId }),
    })
  }

  if (resource.loading && !resource.data) return <Skeleton h="360px" borderRadius="md" />
  if (!resource.data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />
  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <Flex gap="3" wrap="wrap" align="end">
        <Box>
          <Text fontSize="sm" mb="1">
            SKU
          </Text>
          <Input
            size="sm"
            aria-label="Filter orders by SKU"
            value={draftSku}
            onChange={(event) => setDraftSku(event.target.value)}
          />
        </Box>
        <Box>
          <Text fontSize="sm" mb="1">
            Product title
          </Text>
          <Input
            size="sm"
            aria-label="Filter orders by product title"
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
          />
        </Box>
        <Box>
          <Text fontSize="sm" mb="1">
            Order ID
          </Text>
          <Input
            size="sm"
            type="number"
            min="1"
            aria-label="Filter by order ID"
            value={draftOrderId}
            onChange={(event) => setDraftOrderId(event.target.value)}
          />
        </Box>
        <Button size="sm" onClick={applyFilter}>
          Apply filters
        </Button>
      </Flex>
      {!ordersData || rows.length === 0 ? (
        <Card.Root variant="outline">
          <Card.Body>
            <Text>No order records were returned for this date range.</Text>
          </Card.Body>
        </Card.Root>
      ) : (
        <Card.Root variant="outline" minW="0" w="full">
          <Card.Header>
            <Card.Title>Orders and sale items</Card.Title>
          </Card.Header>
          <Stack display={{ base: 'flex', lg: 'none' }} gap="3" px="4" pb="4">
            {rows.map((row) => (
              <Card.Root key={row.key} variant="subtle">
                <Card.Body gap="3">
                  <Flex justify="space-between" align="start" gap="3">
                    <Box minW="0">
                      <Text fontWeight="semibold" overflowWrap="anywhere">
                        {row.title ?? 'Untitled product'}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                        SKU {row.sku ?? '—'}
                      </Text>
                    </Box>
                    <Text fontSize="xs" color="fg.muted" flexShrink="0">
                      {row.date ? formatReportDate(row.date) : '—'}
                    </Text>
                  </Flex>
                  <SimpleGrid columns={2} gap="3">
                    <Box>
                      <Text fontSize="xs" color="fg.muted">
                        Order / item
                      </Text>
                      <Text>
                        {String(row.orderId)} / {row.itemId === undefined ? '—' : String(row.itemId)}
                      </Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="fg.muted">
                        Quantity
                      </Text>
                      <Text>{row.quantity === undefined ? '—' : formatNumber(row.quantity)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="fg.muted">
                        Selling price
                      </Text>
                      <Text>{row.price === undefined ? '—' : formatCurrency(row.price)}</Text>
                    </Box>
                    <Box>
                      <Text fontSize="xs" color="fg.muted">
                        Status / DC
                      </Text>
                      <Text>
                        {row.status === undefined ? '—' : String(row.status)} / {row.dc ?? '—'}
                      </Text>
                    </Box>
                  </SimpleGrid>
                </Card.Body>
              </Card.Root>
            ))}
          </Stack>
          <Box display={{ base: 'none', lg: 'block' }} minW="0" w="full">
            <Table.Root size="sm" tableLayout="fixed" w="full">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader w="17%">Order / item</Table.ColumnHeader>
                  <Table.ColumnHeader w="13%">Date</Table.ColumnHeader>
                  <Table.ColumnHeader w="30%">Product / SKU</Table.ColumnHeader>
                  <Table.ColumnHeader w="9%" textAlign="end">
                    Quantity
                  </Table.ColumnHeader>
                  <Table.ColumnHeader w="13%" textAlign="end">
                    Selling price
                  </Table.ColumnHeader>
                  <Table.ColumnHeader w="10%">Status</Table.ColumnHeader>
                  <Table.ColumnHeader w="8%">DC</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((row) => (
                  <Table.Row key={row.key}>
                    <Table.Cell whiteSpace="nowrap">
                      {String(row.orderId)} / {row.itemId === undefined ? '—' : String(row.itemId)}
                    </Table.Cell>
                    <Table.Cell whiteSpace="nowrap">{row.date ? formatReportDate(row.date) : '—'}</Table.Cell>
                    <Table.Cell overflowWrap="anywhere">
                      <Text>{row.title ?? '—'}</Text>
                      <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                        SKU {row.sku ?? '—'}
                      </Text>
                    </Table.Cell>
                    <Table.Cell textAlign="end" whiteSpace="nowrap">
                      {row.quantity === undefined ? '—' : formatNumber(row.quantity)}
                    </Table.Cell>
                    <Table.Cell textAlign="end" whiteSpace="nowrap">
                      {row.price === undefined ? '—' : formatCurrency(row.price)}
                    </Table.Cell>
                    <Table.Cell overflowWrap="anywhere">
                      {row.status === undefined ? '—' : String(row.status)}
                    </Table.Cell>
                    <Table.Cell overflowWrap="anywhere">{row.dc ?? '—'}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
          <Flex justify="space-between" align="center" p="4" wrap="wrap" gap="3">
            <Text fontSize="sm" color="fg.muted">
              Page {ordersData.pagination.page} of {Math.max(ordersData.pagination.totalPages, 1)} ·{' '}
              {formatNumber(ordersData.pagination.total)} orders
            </Text>
            <Flex gap="3" align="center" wrap="wrap">
              <PageSizeControl
                value={limit}
                onChange={(value) => {
                  setLimit(value)
                  setPage(1)
                }}
              />
              <Flex gap="2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft size={15} /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= ordersData.pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next <ChevronRight size={15} />
                </Button>
              </Flex>
            </Flex>
          </Flex>
        </Card.Root>
      )}
    </Stack>
  )
}

function OffersPanel({
  enabled,
  identity,
  refreshToken,
  onMeta,
}: {
  enabled: boolean
  identity: DashboardIdentity
  refreshToken: number
  onMeta: (meta: ResourceMeta, refreshToken: number, outcome?: 'success' | 'error') => void
}) {
  const [search, setSearch] = useState('')
  const [warehouse, setWarehouse] = useState<'CPT' | 'JHB' | 'DBN' | 'ALL'>('ALL')
  const [stockState, setStockState] = useState<'in_stock' | 'out_of_stock' | 'low_stock' | 'all'>('all')
  const [costState, setCostState] = useState<'known' | 'missing' | ''>('')
  const [marginState, setMarginState] = useState<'positive' | 'negative' | 'zero' | 'all'>('all')
  const [sortBy, setSortBy] = useState('title')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const filters = useMemo(
    () => ({
      page,
      pageSize,
      ...(search.trim() ? { search: search.trim() } : {}),
      warehouse,
      stockState,
      ...(costState ? { costState } : {}),
      marginState,
      sortBy,
      sortOrder,
    }),
    [page, pageSize, search, warehouse, stockState, costState, marginState, sortBy, sortOrder],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'offers', filters)
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotOffers(identity.integrationId, filters, signal),
    [identity.integrationId, requestKey],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const data = resource.data

  if (resource.loading && !data) return <LoadingCards />
  if (!data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />

  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <Flex gap="3" wrap="wrap" align="end">
        <Box flex="1" minW="220px">
          <Text fontSize="xs" mb="1" color="fg.muted">
            Search offers
          </Text>
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            placeholder="Title, SKU, offer ID, or TSIN"
          />
        </Box>
        <NativeSelect.Root size="sm" maxW="150px">
          <NativeSelect.Field
            aria-label="Warehouse filter"
            value={warehouse}
            onChange={(event) => {
              setWarehouse(event.target.value as typeof warehouse)
              setPage(1)
            }}
          >
            <option value="ALL">All warehouses</option>
            <option value="CPT">CPT</option>
            <option value="JHB">JHB</option>
            <option value="DBN">DBN</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" maxW="155px">
          <NativeSelect.Field
            aria-label="Stock filter"
            value={stockState}
            onChange={(event) => {
              setStockState(event.target.value as typeof stockState)
              setPage(1)
            }}
          >
            <option value="all">All stock</option>
            <option value="in_stock">In stock</option>
            <option value="low_stock">Low stock</option>
            <option value="out_of_stock">Out of stock</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" maxW="150px">
          <NativeSelect.Field
            aria-label="Cost filter"
            value={costState}
            onChange={(event) => {
              setCostState(event.target.value as typeof costState)
              setPage(1)
            }}
          >
            <option value="">All costs</option>
            <option value="known">Cost known</option>
            <option value="missing">Cost missing</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" maxW="160px">
          <NativeSelect.Field
            aria-label="Margin filter"
            value={marginState}
            onChange={(event) => {
              setMarginState(event.target.value as typeof marginState)
              setPage(1)
            }}
          >
            <option value="all">All margins</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="zero">Zero</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" maxW="155px">
          <NativeSelect.Field
            aria-label="Offer sort"
            value={sortBy}
            onChange={(event) => {
              setSortBy(event.target.value)
              setPage(1)
            }}
          >
            <option value="title">Product name</option>
            <option value="sku">SKU</option>
            <option value="sellingPrice">Selling price</option>
            <option value="costPrice">Cost</option>
            <option value="totalStock">Total stock</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" maxW="120px">
          <NativeSelect.Field
            aria-label="Sort order"
            value={sortOrder}
            onChange={(event) => {
              setSortOrder(event.target.value as typeof sortOrder)
              setPage(1)
            }}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Flex>
      {resource.error && <ErrorPanel message={resource.error} retry={resource.refresh} />}
      {data && (
        <Card.Root variant="outline">
          <Box overflowX="auto">
            <Table.Root size="sm" variant="line">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Offer</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Selling price</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Cost</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Potential profit / unit</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Stock CPT / JHB / DBN</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.items.map((offer) => (
                  <Table.Row key={offer.offerId}>
                    <Table.Cell minW="220px">
                      {offer.offerUrl ? (
                        <a
                          href={offer.offerUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontWeight: 500, color: 'var(--chakra-colors-blue-600)' }}
                        >
                          {offer.title || offer.offerId}
                        </a>
                      ) : (
                        <Text fontWeight="medium">{offer.title || offer.offerId}</Text>
                      )}
                      <Text fontSize="xs" color="fg.muted">
                        SKU {offer.sku || '—'} · Offer {offer.offerId}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>{offer.status || '—'}</Table.Cell>
                    <Table.Cell textAlign="end">
                      {offer.sellingPrice === null ? '—' : formatCurrency(offer.sellingPrice)}
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      {offer.costPrice === null ? '—' : formatCurrency(offer.costPrice)}
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      {offer.potentialGrossProfitPerUnit === null
                        ? 'Unavailable'
                        : formatCurrency(offer.potentialGrossProfitPerUnit)}
                    </Table.Cell>
                    <Table.Cell textAlign="end" whiteSpace="nowrap">
                      {formatNumber(offer.stockCpt ?? 0)} / {formatNumber(offer.stockJhb ?? 0)} /{' '}
                      {formatNumber(offer.stockDbn ?? 0)}
                    </Table.Cell>
                  </Table.Row>
                ))}
                {data.items.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={6} textAlign="center">
                      No offers matched these filters.
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Root>
          </Box>
          <Flex justify="space-between" align="center" p="4" wrap="wrap" gap="3">
            <Text fontSize="sm" color="fg.muted">
              Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)} ·{' '}
              {formatNumber(data.pagination.total)} offers
            </Text>
            <Flex gap="3" align="center" wrap="wrap">
              <PageSizeControl
                value={pageSize}
                onChange={(value) => {
                  setPageSize(value)
                  setPage(1)
                }}
              />
              <Flex gap="2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft size={15} /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next <ChevronRight size={15} />
                </Button>
              </Flex>
            </Flex>
          </Flex>
        </Card.Root>
      )}
    </Stack>
  )
}

function AlertsPanel({
  enabled,
  identity,
  refreshToken,
  onMeta,
}: {
  enabled: boolean
  identity: DashboardIdentity
  refreshToken: number
  onMeta: (meta: ResourceMeta, refreshToken: number, outcome?: 'success' | 'error') => void
}) {
  const [severity, setSeverity] = useState<'critical' | 'high' | 'medium' | 'low' | ''>('')
  const [warehouse, setWarehouse] = useState<'CPT' | 'JHB' | 'DBN' | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const filters = useMemo(
    () => ({
      page,
      pageSize,
      ...(severity ? { severity } : {}),
      warehouse,
      sortBy: 'severity',
      sortOrder: 'desc' as const,
    }),
    [page, pageSize, severity, warehouse],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'alerts', filters)
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotAlerts(identity.integrationId, filters, signal),
    [identity.integrationId, requestKey],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const data = resource.data

  if (resource.loading && !data) return <LoadingCards />
  if (!data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />

  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <Flex gap="3" wrap="wrap" align="end">
        <NativeSelect.Root size="sm" maxW="170px">
          <NativeSelect.Field
            aria-label="Alert severity"
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value as typeof severity)
              setPage(1)
            }}
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        <NativeSelect.Root size="sm" maxW="150px">
          <NativeSelect.Field
            aria-label="Alert warehouse"
            value={warehouse}
            onChange={(event) => {
              setWarehouse(event.target.value as typeof warehouse)
              setPage(1)
            }}
          >
            <option value="ALL">All warehouses</option>
            <option value="CPT">CPT</option>
            <option value="JHB">JHB</option>
            <option value="DBN">DBN</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        {data?.isStale && <Badge colorPalette="orange">Offer data is stale</Badge>}
      </Flex>
      {resource.error && <ErrorPanel message={resource.error} retry={resource.refresh} />}
      {data && (
        <Card.Root variant="outline">
          <Box overflowX="auto">
            <Table.Root size="sm" variant="line">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Severity</Table.ColumnHeader>
                  <Table.ColumnHeader>Alert</Table.ColumnHeader>
                  <Table.ColumnHeader>Product / SKU</Table.ColumnHeader>
                  <Table.ColumnHeader>Warehouse</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Quantity</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Selling price</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.items.map((alert: TakealotAlert, index) => (
                  <Table.Row key={`${alert.offerId}-${alert.type}-${alert.warehouse ?? 'all'}-${index}`}>
                    <Table.Cell>
                      <Badge
                        colorPalette={
                          alert.severity === 'critical' || alert.severity === 'high'
                            ? 'red'
                            : alert.severity === 'medium'
                              ? 'orange'
                              : 'gray'
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </Table.Cell>
                    <Table.Cell>
                      <Text fontWeight="medium">{alert.type.replaceAll('_', ' ')}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {alert.message}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      {alert.title || alert.offerId}
                      <Text fontSize="xs" color="fg.muted">
                        {alert.sku || ''}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>{alert.warehouse || '—'}</Table.Cell>
                    <Table.Cell textAlign="end">
                      {alert.quantity === null ? '—' : formatNumber(alert.quantity)}
                    </Table.Cell>
                    <Table.Cell textAlign="end">
                      {alert.sellingPrice === null ? '—' : formatCurrency(alert.sellingPrice)}
                    </Table.Cell>
                  </Table.Row>
                ))}
                {data.items.length === 0 && (
                  <Table.Row>
                    <Table.Cell colSpan={6} textAlign="center">
                      No alerts match these filters.
                    </Table.Cell>
                  </Table.Row>
                )}
              </Table.Body>
            </Table.Root>
          </Box>
          <Flex justify="space-between" align="center" p="4" wrap="wrap" gap="3">
            <Text fontSize="sm" color="fg.muted">
              Page {data.pagination.page} of {Math.max(data.pagination.totalPages, 1)} ·{' '}
              {formatNumber(data.pagination.total)} alerts
            </Text>
            <Flex gap="3" align="center" wrap="wrap">
              <PageSizeControl
                value={pageSize}
                onChange={(value) => {
                  setPageSize(value)
                  setPage(1)
                }}
              />
              <Flex gap="2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  <ChevronLeft size={15} /> Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= data.pagination.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next <ChevronRight size={15} />
                </Button>
              </Flex>
            </Flex>
          </Flex>
        </Card.Root>
      )}
    </Stack>
  )
}

function StockPanel({
  enabled,
  identity,
  range,
  granularity,
  fallback,
  refreshToken,
  onMeta,
}: {
  enabled: boolean
  identity: DashboardIdentity
  range: DateRange
  granularity: Granularity
  fallback?: TakealotOverview['inventory']
  refreshToken: number
  onMeta: (meta: ResourceMeta, refreshToken: number, outcome?: 'success' | 'error') => void
}) {
  const summaryKey = cacheKey(identity, 'inventory-summary')
  const historyFilters = useMemo(() => ({ ...range, interval: granularity }), [range.from, range.to, granularity])
  const historyKey = cacheKey(identity, 'inventory-history', historyFilters)
  const warehouseKey = cacheKey(identity, 'warehouse-analytics')
  const getSummary = useCallback(
    (signal: AbortSignal) => getTakealotInventorySummary(identity.integrationId, signal),
    [identity.integrationId],
  )
  const getWarehouseAnalytics = useCallback(
    (signal: AbortSignal) => getTakealotInventoryAnalytics(identity.integrationId, signal),
    [identity.integrationId],
  )
  const getHistory = useCallback(
    (signal: AbortSignal) => getTakealotInventoryHistory(identity.integrationId, historyFilters, signal),
    [identity.integrationId, historyFilters.from, historyFilters.to, historyFilters.interval],
  )
  const summary = useCachedResource(enabled, summaryKey, getSummary, refreshToken, onMeta)
  const warehouseAnalytics = useCachedResource(enabled, warehouseKey, getWarehouseAnalytics, refreshToken, onMeta)
  const history = useCachedResource(
    enabled && !summary.loading && (summary.data !== undefined || summary.error !== ''),
    historyKey,
    getHistory,
    refreshToken,
    onMeta,
  )
  const stockCounts = summary.data?.stockCounts ?? fallback?.stockCounts
  const stockHealth = summary.data?.stockHealth ?? fallback?.stockHealth
  const total = recordNumber(stockCounts, 'total_stock_count')
  const unbalanced = recordNumber(stockCounts, 'unbalanced_stock_count')
  const fees = recordNumber(stockHealth, 'storage_fee_enabled_offer_count')
  const replenishment = recordNumber(stockHealth, 'recommended_for_replenishment_offer_count')
  const inventoryPoints = history.data?.series ?? []
  const chart: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', valueFormatter: (value) => formatNumber(Number(value)) },
      legend: { data: ['Offers with stock', 'Unbalanced stock'], bottom: 0 },
      grid: { left: 70, right: 24, top: 24, bottom: 60 },
      xAxis: {
        type: 'category',
        data: inventoryPoints.map((point) => point.date),
        axisLabel: { formatter: (value: string) => dateLabel(value) },
      },
      yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
      series: [
        {
          name: 'Offers with stock',
          type: 'line',
          smooth: true,
          data: inventoryPoints.map((point) => recordNumber(point.stockCounts, 'total_stock_count') ?? null),
        },
        {
          name: 'Unbalanced stock',
          type: 'line',
          smooth: true,
          data: inventoryPoints.map((point) => recordNumber(point.stockCounts, 'unbalanced_stock_count') ?? null),
        },
      ],
    }),
    [inventoryPoints],
  )

  if (enabled && summary.loading && !summary.data && !fallback)
    return (
      <>
        <LoadingCards count={4} />
        <ChartSkeletons />
      </>
    )
  const error = summary.error || history.error || warehouseAnalytics.error
  if (error && !stockCounts && !stockHealth) {
    return (
      <ErrorPanel
        message={error}
        retry={() => {
          summary.refresh()
          history.refresh()
          warehouseAnalytics.refresh()
        }}
      />
    )
  }
  return (
    <Stack gap="4">
      {(summary.error || history.error || warehouseAnalytics.error) && (
        <ResourceNotice
          resource={{
            error: summary.error || history.error || warehouseAnalytics.error,
            stale: summary.stale || history.stale || warehouseAnalytics.stale,
            cached: summary.cached || history.cached || warehouseAnalytics.cached,
          }}
          retry={() => {
            summary.refresh()
            history.refresh()
            warehouseAnalytics.refresh()
          }}
        />
      )}
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <MetricCard
          label="Offers with stock"
          value={total === undefined ? undefined : formatNumber(total)}
          icon={Package}
        />
        <MetricCard
          label="Unbalanced stock"
          value={unbalanced === undefined ? undefined : formatNumber(unbalanced)}
          icon={Activity}
        />
        <MetricCard
          label="Storage-fee-enabled offers"
          value={fees === undefined ? undefined : formatNumber(fees)}
          icon={ReceiptText}
        />
        <MetricCard
          label="Recommended for replenishment"
          value={replenishment === undefined ? undefined : formatNumber(replenishment)}
          icon={Warehouse}
        />
      </SimpleGrid>
      {warehouseAnalytics.data && (
        <Card.Root variant="outline">
          <Card.Header>
            <Heading size="sm">Warehouse inventory</Heading>
            <Text fontSize="sm" color="fg.muted">
              Current inventory values derived from synchronized offers; values are potential, not realized sales.
            </Text>
          </Card.Header>
          <Box overflowX="auto">
            <Table.Root size="sm" variant="line">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Warehouse</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Stock units</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Incoming units</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Reported sales units</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Inventory cost</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Potential retail value</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Potential gross profit</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {warehouseAnalytics.data.warehouses.map((warehouse) => (
                  <Table.Row key={warehouse.warehouse}>
                    <Table.Cell>{warehouse.warehouse}</Table.Cell>
                    <Table.Cell textAlign="end">{formatNumber(warehouse.stockUnits)}</Table.Cell>
                    <Table.Cell textAlign="end">{formatNumber(warehouse.incomingUnits)}</Table.Cell>
                    <Table.Cell textAlign="end">
                      {warehouse.reportedSalesUnits === undefined ? '—' : formatNumber(warehouse.reportedSalesUnits)}
                    </Table.Cell>
                    <Table.Cell textAlign="end">{formatCurrency(warehouse.inventoryCostValue)}</Table.Cell>
                    <Table.Cell textAlign="end">{formatCurrency(warehouse.potentialRetailValue)}</Table.Cell>
                    <Table.Cell textAlign="end">{formatCurrency(warehouse.potentialGrossProfit)}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
          <Card.Body pt="2">
            <Text fontSize="xs" color="fg.muted">
              {warehouseAnalytics.data.financialNote}
            </Text>
          </Card.Body>
        </Card.Root>
      )}
      {summary.data?.capturedAt && (
        <Text fontSize="sm" color="fg.muted">
          Current snapshot retrieved {new Date(summary.data.capturedAt).toLocaleString()}
        </Text>
      )}
      {history.data && inventoryPoints.length > 0 ? (
        <ChartCard
          title="Saved stock snapshots"
          description="Historical points include snapshots actually saved by the dashboard."
          option={chart}
          icon={Warehouse}
        />
      ) : history.data ? (
        <Card.Root variant="outline">
          <Card.Body>
            <Text>No saved inventory snapshots were found for the selected date range.</Text>
          </Card.Body>
        </Card.Root>
      ) : history.loading ? (
        <Skeleton h="320px" borderRadius="md" />
      ) : null}
    </Stack>
  )
}

export function TakealotDashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [identity, setIdentity] = useState<DashboardIdentity>(() =>
    localIdentity(searchParams.get('integrationId') ?? ''),
  )
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [integrationsLoading, setIntegrationsLoading] = useState(true)
  const [integrationsError, setIntegrationsError] = useState('')
  const [syncStatus, setSyncStatus] = useState<TakealotSyncStatus>()
  const [syncing, setSyncing] = useState(false)
  const [stoppingSync, setStoppingSync] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [range, setRange] = useState<DateRange>(lastThirtyDays)
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [refreshTokens, setRefreshTokens] = useState<Record<Section, number>>({
    overview: 0,
    analytics: 0,
    products: 0,
    orders: 0,
    stock: 0,
    offers: 0,
    alerts: 0,
  })
  const [resourceMeta, setResourceMeta] = useState<Partial<Record<Section, ResourceMeta>>>({})
  const toastRef = useRef('')
  const refresh = () =>
    setRefreshTokens((current) => ({
      ...current,
      [activeSection]: current[activeSection] + 1,
    }))
  const reportMeta = useCallback(
    (section: Section, meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => {
      setResourceMeta((current) => ({ ...current, [section]: meta }))
      if (!outcome) return
      const key = `${section}:${token}`
      if (toastRef.current === key) return
      toastRef.current = key
      if (outcome === 'success') showSuccess('Takealot dashboard refreshed')
      else showError('Takealot dashboard refresh failed')
    },
    [],
  )
  const onOverviewMeta = useCallback(
    (meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => reportMeta('overview', meta, token, outcome),
    [reportMeta],
  )
  const onAnalyticsMeta = useCallback(
    (meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => reportMeta('analytics', meta, token, outcome),
    [reportMeta],
  )
  const onProductsMeta = useCallback(
    (meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => reportMeta('products', meta, token, outcome),
    [reportMeta],
  )
  const onOrdersMeta = useCallback(
    (meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => reportMeta('orders', meta, token, outcome),
    [reportMeta],
  )
  const onStockMeta = useCallback(
    (meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => reportMeta('stock', meta, token, outcome),
    [reportMeta],
  )
  const onOffersMeta = useCallback(
    (meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => reportMeta('offers', meta, token, outcome),
    [reportMeta],
  )
  const onAlertsMeta = useCallback(
    (meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => reportMeta('alerts', meta, token, outcome),
    [reportMeta],
  )
  const sectionMeta = resourceMeta[activeSection]
  const lastRetrieved = sectionMeta?.savedAt

  const reloadIntegrations = useCallback(async () => {
    setIntegrationsLoading(true)
    setIntegrationsError('')
    try {
      const active = (await getIntegrations()).filter(
        (integration) => integration.type === 'TAKEALOT' && integration.configured && integration.isActive,
      )
      setIntegrations(active)
      setIdentity((current) => {
        const currentId = active.some((integration) => integration.id === current.integrationId)
          ? current.integrationId
          : active.length === 1
            ? active[0].id
            : ''
        return { ...localIdentity(currentId), configured: active.length > 0 }
      })
    } catch (cause) {
      const message = toErrorMessage(cause, 'Takealot integrations could not be loaded.')
      setIntegrationsError(message)
      setIntegrations([])
      setIdentity(() => ({ ...localIdentity(), configured: false }))
    } finally {
      setIntegrationsLoading(false)
    }
  }, [])

  const requestedIntegrationId = searchParams.get('integrationId')
  useEffect(() => {
    if (integrationsLoading) return
    const requestedIntegration = integrations.find((integration) => integration.id === requestedIntegrationId)
    if (requestedIntegrationId && requestedIntegration) {
      setIdentity((current) => ({
        ...current,
        configured: true,
        integrationId: requestedIntegration.id,
      }))
      return
    }
    if (!requestedIntegrationId && integrations.length === 1) {
      setIdentity((current) => ({
        ...current,
        configured: true,
        integrationId: integrations[0].id,
      }))
      setSearchParams({ integrationId: integrations[0].id }, { replace: true })
    }
  }, [integrations, integrationsLoading, requestedIntegrationId, setSearchParams])

  const selectIntegration = (integrationId: string) => {
    setIdentity((current) => ({ ...current, integrationId }))
    setSyncStatus(undefined)
    setSearchParams(integrationId ? { integrationId } : {})
  }

  useEffect(() => {
    void reloadIntegrations()
    window.addEventListener('pos-company-updated', reloadIntegrations)
    window.addEventListener('pos-integrations-updated', reloadIntegrations)
    window.addEventListener('storage', reloadIntegrations)
    window.addEventListener('focus', reloadIntegrations)
    document.addEventListener('visibilitychange', reloadIntegrations)
    return () => {
      window.removeEventListener('pos-company-updated', reloadIntegrations)
      window.removeEventListener('pos-integrations-updated', reloadIntegrations)
      window.removeEventListener('storage', reloadIntegrations)
      window.removeEventListener('focus', reloadIntegrations)
      document.removeEventListener('visibilitychange', reloadIntegrations)
    }
  }, [reloadIntegrations])

  useEffect(() => {
    if (!identity.integrationId) {
      setSyncStatus(undefined)
      return
    }
    let cancelled = false
    getTakealotSyncStatus(identity.integrationId)
      .then((status) => {
        if (!cancelled) setSyncStatus(status)
      })
      .catch((cause) => {
        if (!cancelled) showError('Unable to load Takealot sync status', cause)
      })
    return () => {
      cancelled = true
    }
  }, [identity.integrationId])

  useEffect(() => {
    if (
      !identity.integrationId ||
      !syncStatus ||
      !['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(syncStatus.status)
    )
      return
    const controller = new AbortController()
    void streamTakealotSync(
      identity.integrationId,
      (status) => {
        setSyncStatus(status)
        if (status.status === 'SUCCEEDED') {
          setRefreshTokens((current) => ({
            overview: current.overview + 1,
            analytics: current.analytics + 1,
            products: current.products + 1,
            orders: current.orders + 1,
            stock: current.stock + 1,
            offers: current.offers + 1,
            alerts: current.alerts + 1,
          }))
          showSuccess('Takealot offers synchronized', `${formatNumber(status.offersProcessed)} offers processed`)
        } else if (status.status === 'FAILED') {
          showError('Takealot synchronization failed', status.errorMessage ?? undefined)
        } else if (status.status === 'CANCELLED') {
          showSuccess('Takealot synchronization stopped')
        }
      },
      controller.signal,
    ).catch((cause: unknown) => {
      if (!controller.signal.aborted) showError('Takealot sync progress stream disconnected', cause)
    })
    return () => controller.abort()
  }, [identity.integrationId, syncStatus?.status])

  const startSync = async () => {
    if (!identity.integrationId || syncing) return
    setSyncing(true)
    try {
      const queued = await triggerTakealotSync(identity.integrationId)
      setSyncStatus((current) => ({
        status: queued.status,
        jobId: queued.jobId,
        startedAt: current?.startedAt ?? null,
        completedAt: null,
        lastSuccessfulSyncAt: current?.lastSuccessfulSyncAt ?? null,
        pagesProcessed: 0,
        totalPages: 0,
        offersProcessed: 0,
        missingCostCount: 0,
        errorMessage: null,
        isStale: current?.isStale ?? true,
      }))
      setSyncStatus(await getTakealotSyncStatus(identity.integrationId))
      showSuccess('Takealot synchronization started')
    } catch (cause) {
      showError('Unable to start Takealot synchronization', cause)
    } finally {
      setSyncing(false)
    }
  }

  const stopSync = async () => {
    if (!identity.integrationId || stoppingSync) return
    setStoppingSync(true)
    try {
      await stopTakealotSync(identity.integrationId)
      setSyncStatus(await getTakealotSyncStatus(identity.integrationId))
    } catch (cause) {
      showError('Unable to stop Takealot synchronization', cause)
    } finally {
      setStoppingSync(false)
    }
  }

  const syncActive = ['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(syncStatus?.status ?? '')
  const syncProgress = syncStatus?.totalPages
    ? Math.min(100, Math.round((syncStatus.pagesProcessed / syncStatus.totalPages) * 100))
    : 0

  const isBusy = Boolean(resourceMeta[activeSection]?.loading)
  const sections: Array<{ id: Section; label: string; icon: LucideIcon }> = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'analytics', label: 'Sales Analytics', icon: Activity },
    { id: 'products', label: 'Product Performance', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'stock', label: 'Stock Health', icon: Warehouse },
    { id: 'offers', label: 'Offers', icon: Package },
    { id: 'alerts', label: 'Alerts', icon: AlertCircle },
  ]
  return (
    <PageContainer>
      <PageHeader
        title="Takealot Dashboard"
        description="Monitor Takealot sales, product performance and stock health."
        actions={
          <Flex align="center" gap="3" wrap="wrap">
            {lastRetrieved ? (
              <Flex align="center" gap="2">
                <Text fontSize="xs" color="fg.muted">
                  Last retrieved {new Date(lastRetrieved).toLocaleString()}
                </Text>
                {sectionMeta?.cached && <Badge variant="subtle">Cached data</Badge>}
                {sectionMeta?.stale && (
                  <Badge colorPalette="orange" variant="subtle">
                    Stale data
                  </Badge>
                )}
              </Flex>
            ) : null}
            <Button size="sm" variant="outline" onClick={refresh} loading={isBusy}>
              <RefreshCw size={15} /> Refresh
            </Button>
            {identity.integrationId && (
              <>
                {syncStatus && (
                  <Badge colorPalette={syncActive ? 'blue' : syncStatus.isStale ? 'orange' : 'green'}>
                    {syncStatus.status === 'RUNNING'
                      ? 'Sync running'
                      : syncStatus.status === 'QUEUED'
                        ? 'Sync queued'
                        : syncStatus.status === 'CANCEL_REQUESTED'
                          ? 'Stopping sync'
                          : syncStatus.status === 'CANCELLED'
                            ? 'Sync stopped'
                            : syncStatus.isStale
                              ? 'Data stale'
                              : 'Synced'}
                  </Badge>
                )}
                <Button size="sm" onClick={() => void startSync()} loading={syncing} disabled={syncActive}>
                  <RefreshCw size={15} /> Sync offers
                </Button>
                {syncActive && (
                  <Button
                    size="sm"
                    colorPalette="red"
                    variant="outline"
                    onClick={() => void stopSync()}
                    loading={stoppingSync}
                    disabled={syncStatus?.status === 'CANCEL_REQUESTED'}
                  >
                    <CircleStop size={15} /> Stop sync
                  </Button>
                )}
              </>
            )}
          </Flex>
        }
      />

      {identity.integrationId && syncActive && syncStatus && (
        <Card.Root variant="outline" mb="5">
          <Card.Body p="4">
            <Stack gap="2">
              <Flex justify="space-between" gap="3" wrap="wrap">
                <Text fontSize="sm" fontWeight="medium">
                  {syncStatus.status === 'CANCEL_REQUESTED'
                    ? 'Stopping sync safely…'
                    : syncStatus.status === 'QUEUED'
                      ? 'Waiting for a worker…'
                      : 'Synchronizing Takealot offers'}
                </Text>
                <Text fontSize="sm" color="fg.muted" aria-live="polite">
                  {syncStatus.pagesProcessed} / {syncStatus.totalPages || '—'} pages ·{' '}
                  {formatNumber(syncStatus.offersProcessed)} offers
                </Text>
              </Flex>
              <Box
                h="2"
                borderRadius="full"
                bg="bg.muted"
                overflow="hidden"
                role="progressbar"
                aria-valuenow={syncProgress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <motion.div
                  animate={{ width: syncStatus.status === 'QUEUED' ? ['20%', '65%', '20%'] : `${syncProgress}%` }}
                  transition={
                    syncStatus.status === 'QUEUED'
                      ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.35 }
                  }
                  style={{
                    height: '100%',
                    borderRadius: '9999px',
                    background: 'var(--chakra-colors-blue-500)',
                  }}
                />
              </Box>
            </Stack>
          </Card.Body>
        </Card.Root>
      )}

      {integrationsLoading && integrations.length === 0 ? (
        <LoadingCards count={2} />
      ) : integrations.length === 0 ? (
        <Card.Root variant="outline">
          <Card.Body p={{ base: '6', md: '10' }}>
            <Stack align="start" gap="3" maxW="xl">
              <Flex boxSize="12" align="center" justify="center" borderRadius="md" bg="bg.muted">
                <ChartNoAxesCombined size={22} />
              </Flex>
              <Heading size="md">Configure Takealot to view your dashboard</Heading>
              <Text color="fg.muted">
                {integrationsError ||
                  'Add and activate a Takealot connection in Settings to view sales, offer analytics and stock health.'}
              </Text>
              <Button onClick={() => navigate('/settings?section=integrations')}>Configure Takealot</Button>
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : !identity.integrationId ? (
        <Card.Root variant="outline">
          <Card.Body p="6">
            <Stack align="start" gap="3" maxW="xl">
              <Heading size="md">Select a Takealot connection</Heading>
              <Text color="fg.muted">
                Choose which seller account to view. Data from different connections is kept separate.
              </Text>
              <NativeSelect.Root size="sm" maxW="sm">
                <NativeSelect.Field
                  aria-label="Takealot connection"
                  value={identity.integrationId}
                  onChange={(event) => selectIntegration(event.target.value)}
                >
                  <option value="">Choose a connection</option>
                  {integrations.map((integration) => (
                    <option key={integration.id} value={integration.id}>
                      {integration.name}
                    </option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap="5">
          <Stack gap="3">
            <Flex gap="3" wrap="wrap" align="end">
              {integrations.length > 1 && (
                <NativeSelect.Root size="sm" maxW="240px">
                  <NativeSelect.Field
                    aria-label="Takealot connection"
                    value={identity.integrationId}
                    onChange={(event) => selectIntegration(event.target.value)}
                  >
                    {integrations.map((integration) => (
                      <option key={integration.id} value={integration.id}>
                        {integration.name}
                      </option>
                    ))}
                  </NativeSelect.Field>
                </NativeSelect.Root>
              )}
              <TakealotDateRangePicker value={range} onApply={setRange} />
              <NativeSelect.Root size="sm" maxW="140px">
                <NativeSelect.Field
                  aria-label="Chart granularity"
                  value={granularity}
                  onChange={(event) => setGranularity(event.target.value as Granularity)}
                >
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </NativeSelect.Field>
              </NativeSelect.Root>
            </Flex>
            <Text fontSize="xs" color="fg.muted">
              Date range applies to sales, product-performance, order, and saved inventory-history reports. Offer,
              pricing, and alert data reflect the latest synchronization.
            </Text>
          </Stack>

          <Flex
            role="tablist"
            aria-label="Takealot dashboard sections"
            wrap="wrap"
            gap="1"
            p="1"
            bg="bg.subtle"
            borderRadius="md"
          >
            {sections.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                role="tab"
                aria-selected={activeSection === id}
                aria-controls={`takealot-panel-${id}`}
                id={`takealot-tab-${id}`}
                size="sm"
                minW="0"
                variant={activeSection === id ? 'subtle' : 'ghost'}
                onClick={() => setActiveSection(id)}
              >
                <Icon size={15} aria-hidden="true" /> {label}
              </Button>
            ))}
          </Flex>

          <Box role="tabpanel" id={`takealot-panel-${activeSection}`} aria-labelledby={`takealot-tab-${activeSection}`}>
            {activeSection === 'overview' && (
              <OverviewPanel
                enabled={identity.configured}
                identity={identity}
                refreshToken={refreshTokens.overview}
                onMeta={onOverviewMeta}
              />
            )}
            {activeSection === 'analytics' && (
              <AnalyticsPanel
                enabled
                identity={identity}
                range={range}
                granularity={granularity}
                refreshToken={refreshTokens.analytics}
                onMeta={onAnalyticsMeta}
              />
            )}
            {activeSection === 'products' && (
              <ProductPanel
                enabled
                identity={identity}
                range={range}
                refreshToken={refreshTokens.products}
                onMeta={onProductsMeta}
              />
            )}
            {activeSection === 'orders' && (
              <OrdersPanel
                enabled
                identity={identity}
                range={range}
                refreshToken={refreshTokens.orders}
                onMeta={onOrdersMeta}
              />
            )}
            {activeSection === 'stock' && (
              <StockPanel
                enabled
                identity={identity}
                range={range}
                granularity={granularity}
                fallback={undefined}
                refreshToken={refreshTokens.stock}
                onMeta={onStockMeta}
              />
            )}
            {activeSection === 'offers' && (
              <OffersPanel enabled identity={identity} refreshToken={refreshTokens.offers} onMeta={onOffersMeta} />
            )}
            {activeSection === 'alerts' && (
              <AlertsPanel enabled identity={identity} refreshToken={refreshTokens.alerts} onMeta={onAlertsMeta} />
            )}
          </Box>
        </Stack>
      )}
    </PageContainer>
  )
}
