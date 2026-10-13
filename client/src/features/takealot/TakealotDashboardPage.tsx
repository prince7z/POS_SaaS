import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import {
  Activity,
  AlertCircle,
  BarChart3,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
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
  getTakealotInventoryHistory,
  getTakealotInventorySummary,
  getTakealotOrders,
  getTakealotOverview,
  getTakealotProducts,
  getTakealotTrends,
  type TakealotBreakdownGroup,
  type TakealotDateFilters,
  type TakealotOrder,
  type TakealotOrderRecord,
  type TakealotOverview,
  type TakealotPageFilters,
  type TakealotSale,
} from '@/api/endpoints/takealot'
import { EChart } from '@/components/charts/EChart'
import { PageHeader } from '@/components/common/PageHeader'
import { showError, showSuccess } from '@/components/feedback/notifications'
import { PageContainer } from '@/components/layout/PageContainer'
import { getStoredCompany, getStoredUser } from '@/lib/auth'
import { formatCurrency, formatNumber, formatReportDate } from '@/lib/formatters'
import {
  readTakealotCache,
  TAKEALOT_CACHE_TTL,
  writeTakealotCache,
} from './takealot-cache'

type DateRange = { from: string; to: string }
type Granularity = 'day' | 'week' | 'month'
type Section = 'overview' | 'analytics' | 'products' | 'orders' | 'stock'
type ResourceMeta = { savedAt: number; stale: boolean; cached: boolean; loading?: boolean }
type DashboardIdentity = { configured: boolean; companyId: string; userId: string; integrationVersion: string }

interface ResourceState<T> extends ResourceMeta {
  key: string
  data?: T
  loading: boolean
  error: string
}

const MotionCard = motion.create(Card.Root)
const today = () => new Date().toISOString().slice(0, 10)
const iso = (date: Date) => date.toISOString().slice(0, 10)
const lastThirtyDays = (): DateRange => {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - 29)
  return { from: iso(from), to: iso(to) }
}
const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
const toErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback
const skuUnitCost = (sku?: string) => {
  const costMatch = /^C(\d+)(?:$|[^0-9])/i.exec(sku?.trim() ?? '')
  return costMatch ? Number(costMatch[1]) : undefined
}
const escapeChartText = (value: string) =>
  value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
const cacheKey = (identity: DashboardIdentity, section: string, parameters: object = {}) =>
  JSON.stringify({
    companyId: identity.companyId,
    userId: identity.userId,
    integrationVersion: identity.integrationVersion,
    section,
    parameters,
  })
const recordNumber = (value: Record<string, unknown> | undefined, key: string) =>
  typeof value?.[key] === 'number' && Number.isFinite(value[key]) ? value[key] as number : undefined
const dateLabel = (value: string) => formatReportDate(value)
const defaultResourceState = <T,>(key: string): ResourceState<T> => ({
  key,
  loading: false,
  error: '',
  savedAt: 0,
  stale: false,
  cached: false,
})

function localIdentity(): DashboardIdentity {
  const company = getStoredCompany()
  const fromStorage = localStorage.getItem('takealotConfigured') === 'true' ||
    localStorage.getItem('takealotapiexist') === 'true'
  return {
    configured: fromStorage || Boolean(company?.takealotConfigured),
    companyId: company?.id ?? 'current-company',
    userId: getStoredUser()?.id ?? 'current-user',
    integrationVersion: company?.takealotApiKeyPrefix ?? 'unversioned',
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

  const load = useCallback(async (forceRefresh: boolean) => {
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
      onMeta({ savedAt, cached: false, stale: false, loading: false }, refreshToken, forceRefresh ? 'success' : undefined)
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
        { savedAt, cached: Boolean(cachedValue) || previousState.cached, stale: retainedData !== undefined, loading: false },
        refreshToken,
        forceRefresh ? 'error' : undefined,
      )
    }
  }, [enabled, fetcher, key, onMeta, refreshToken])

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
}: {
  label: string
  value?: string
  detail?: string
  icon?: LucideIcon
}) {
  return (
    <MotionCard
      variant="outline"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      whileHover={{ y: -2 }}
    >
      <Card.Body>
        <Flex justify="space-between" align="start">
          <Text color="fg.muted" fontSize="sm">{label}</Text>
          <Icon size={18} aria-hidden="true" />
        </Flex>
        <Heading size="lg" mt="2">{value ?? 'Unavailable'}</Heading>
        {detail && <Text fontSize="xs" color="fg.muted" mt="1">{detail}</Text>}
      </Card.Body>
    </MotionCard>
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
    <Card.Root variant="outline">
      <Card.Body>
        <Flex align="start" gap="3">
          <AlertCircle size={18} aria-hidden="true" />
          <Box>
            <Text color="fg.error">{message}</Text>
            <Button mt="3" size="sm" variant="outline" onClick={retry}>Retry</Button>
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
          : resource.cached ? 'Showing data saved in this browser.' : 'Showing previously retrieved data.'}
      </Text>
      <Button size="xs" variant="outline" onClick={retry}>Retry</Button>
    </Flex>
  )
}

function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4" aria-label="Loading Takealot dashboard">
      {Array.from({ length: count }, (_, index) => <Skeleton key={index} h="120px" borderRadius="md" />)}
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
  const fetcher = useCallback((signal: AbortSignal) => getTakealotOverview(signal), [])
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const data = resource.data
  const totalStock = recordNumber(data?.inventory.stockCounts, 'total_stock_count')
  const unbalanced = recordNumber(data?.inventory.stockCounts, 'unbalanced_stock_count')
  const storageFees = recordNumber(data?.inventory.stockHealth, 'storage_fee_enabled_offer_count')
  const replenishment = recordNumber(data?.inventory.stockHealth, 'recommended_for_replenishment_offer_count')

  if (resource.loading && !data) return <LoadingCards />
  if (!data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />
  if (!data) return null

  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        {data.salesSummary.periods.map((period) => (
          <MetricCard
            key={period.date_range}
            label={`Sales · ${period.date_range}`}
            value={formatCurrency(period.total)}
            detail={`Units: ${formatNumber(period.quantity)} · Sales total and quantity are reported by Takealot; neither is recalculated in the dashboard.`}
            icon={CircleDollarSign}
          />
        ))}
        <MetricCard
          label="Total stock count"
          value={totalStock === undefined ? undefined : formatNumber(totalStock)}
          detail="Takealot-reported total_stock_count; direct API value."
          icon={Package}
        />
        <MetricCard
          label="Unbalanced stock"
          value={unbalanced === undefined ? undefined : formatNumber(unbalanced)}
          detail="Takealot-reported unbalanced_stock_count; direct API value."
          icon={Activity}
        />
        {storageFees !== undefined && (
          <MetricCard label="Storage-fee-enabled offers" value={formatNumber(storageFees)} detail="Takealot-reported offer count; direct API value." icon={ReceiptText} />
        )}
        {replenishment !== undefined && (
          <MetricCard label="Recommended for replenishment" value={formatNumber(replenishment)} detail="Takealot-reported offer count; direct API value." icon={Warehouse} />
        )}
      </SimpleGrid>
      <Card.Root variant="outline">
        <Card.Body>
          <Text fontSize="sm" color="fg.muted">
            The sales summary uses Takealot&apos;s fixed reporting periods, and the selected date range does not change them. Sales Analytics calculates gross sales as selling price × quantity, units as the sum of quantity, and orders as distinct order IDs. Inventory values are reported directly by Takealot.
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
  const filters: TakealotDateFilters = useMemo(
    () => ({ ...range, interval: granularity }),
    [range, granularity],
  )
  const keyFilters = JSON.stringify(filters)
  const trendKey = cacheKey(identity, 'trends', filters)
  const breakdownKey = cacheKey(identity, 'breakdown', { from: range.from, to: range.to, groupBy })
  const loadTrends = useCallback(
    (signal: AbortSignal) => getTakealotTrends(filters, signal),
    [keyFilters],
  )
  const loadBreakdown = useCallback(
    (signal: AbortSignal) => getTakealotBreakdown(range, groupBy, signal),
    [range.from, range.to, groupBy],
  )
  const trends = useCachedResource(enabled, trendKey, loadTrends, refreshToken, onMeta)
  const breakdown = useCachedResource(enabled, breakdownKey, loadBreakdown, refreshToken, onMeta)
  const points = trends.data?.series ?? []
  const dates = points.map((point) => point.date)
  const totals = useMemo(() => points.reduce(
    (result, point) => ({
      revenue: result.revenue + point.revenue,
      units: result.units + point.units,
      orders: result.orders + point.orders,
    }),
    { revenue: 0, units: 0, orders: 0 },
  ), [points])
  const trendOption: EChartsOption = useMemo(() => ({
    legend: { data: ['Sales value', 'Units sold', 'Orders'], bottom: 0, selectedMode: 'multiple' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params]
        const date = String(items[0]?.name ?? '')
        const values = items.map((item) => {
          const value = Number(item.value)
          const formatted = item.seriesName === 'Sales value' ? formatCurrency(value) : formatNumber(value)
          return `${item.marker ?? ''}${item.seriesName}: ${formatted}`
        })
        return [dateLabel(date), ...values].join('<br/>')
      },
    },
    grid: { left: 76, right: 92, top: 32, bottom: 70 },
    xAxis: { type: 'category', data: dates, axisLabel: { formatter: (value: string) => dateLabel(value) } },
    yAxis: [
      { type: 'value', name: 'Sales', position: 'left', axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) } },
      { type: 'value', name: 'Units', position: 'right', axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
      { type: 'value', name: 'Orders', position: 'right', offset: 58, axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
    ],
    series: [
      { name: 'Sales value', type: 'line', yAxisIndex: 0, smooth: true, showSymbol: false, data: points.map((point) => point.revenue) },
      { name: 'Units sold', type: 'line', yAxisIndex: 1, smooth: true, showSymbol: false, data: points.map((point) => point.units) },
      { name: 'Orders', type: 'line', yAxisIndex: 2, smooth: true, showSymbol: false, data: points.map((point) => point.orders) },
    ],
  }), [dates, points])
  const breakdownPoints = breakdown.data?.breakdown ?? []
  const breakdownOption: EChartsOption = useMemo(() => {
    const distribution = groupBy === 'dc' || groupBy === 'customerDc' ||
      groupBy === 'stockSourceRegion' || groupBy === 'saleStatus'
    if (distribution) {
      return {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value) => formatCurrency(Number(value)) },
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
      series: [{
        type: 'pie',
        radius: ['42%', '70%'],
        data: breakdownPoints.map((point) => ({ name: point.key, value: point.revenue })),
      }],
    }
  }, [breakdownPoints, groupBy])

  const resourceError = trends.error || breakdown.error
  if (enabled && trends.loading && !trends.data && breakdown.loading && !breakdown.data) {
    return <><ChartSkeletons /><LoadingCards count={2} /></>
  }
  if (resourceError && !trends.data && !breakdown.data) {
    return <ErrorPanel message={resourceError} retry={() => { trends.refresh(); breakdown.refresh() }} />
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
          retry={() => { trends.refresh(); breakdown.refresh() }}
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
            <MetricCard label="Sales value" value={formatCurrency(totals.revenue)} detail="Formula: sum of selling price × quantity." icon={CircleDollarSign} />
            <MetricCard label="Units sold" value={formatNumber(totals.units)} detail="Formula: sum of sale-item quantities." icon={ShoppingCart} />
            <MetricCard label="Orders" value={formatNumber(totals.orders)} detail="Formula: count of distinct order IDs." icon={ReceiptText} />
          </SimpleGrid>
          <ChartCard
            title="Sales trend"
            description="Daily, weekly, or monthly gross sales (selling price × quantity), units (sum of quantity), and distinct orders. Click legend items to show or hide each line; each metric uses its own axis."
            option={trendOption}
            height="340px"
            icon={Activity}
          />
        </>
      )}
      <Flex justify="flex-end">
        <NativeSelect.Root size="sm" maxW="220px">
          <NativeSelect.Field aria-label="Sales breakdown dimension" value={groupBy} onChange={(event) => setGroupBy(event.target.value as TakealotBreakdownGroup)}>
            <option value="promotion">Promotion</option>
            <option value="saleStatus">Sale status</option>
            <option value="dc">Distribution centre</option>
            <option value="customerDc">Customer distribution centre</option>
            <option value="stockSourceRegion">Stock source region</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Flex>
      {breakdown.data && breakdownPoints.length === 0 ? (
        <Card.Root variant="outline"><Card.Body><Text>No breakdown data is available for this range.</Text></Card.Body></Card.Root>
      ) : breakdown.data ? (
        <ChartCard
          title="Sales breakdown"
          description={`Sales value by ${groupBy === 'dc' ? 'distribution centre' : groupBy === 'customerDc' ? 'customer distribution centre' : groupBy === 'saleStatus' ? 'sale status' : groupBy === 'stockSourceRegion' ? 'stock source region' : 'promotion'}.`}
          option={breakdownOption}
          icon={ChartNoAxesCombined}
        />
      ) : null}
      {trends.data && <Text fontSize="xs" color="fg.muted">{trends.data.revenueDefinition}</Text>}
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
  const [draftSku, setDraftSku] = useState('')
  const [draftTitle, setDraftTitle] = useState('')
  const [filter, setFilter] = useState<{ sku?: string; productTitle?: string }>({})
  const filters = useMemo(
    () => ({ ...range, ...filter, page, limit: 10, sortBy, order }),
    [range.from, range.to, filter, page, sortBy, order],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'products', filters)
  const fetcher = useCallback((signal: AbortSignal) => getTakealotProducts(filters, signal), [requestKey])
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const productData = resource.data
  const products = productData?.products ?? []
  useEffect(() => {
    setPage(1)
  }, [range.from, range.to])
  const scatterOption: EChartsOption = useMemo(() => ({
    legend: { data: ['Sales value', 'Units sold', 'Orders', 'Profit / loss'], bottom: 0, selectedMode: 'multiple' },
    tooltip: {
      trigger: 'axis',
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params]
        const index = Number(items[0]?.dataIndex ?? 0)
        const product = products[index]
        if (!product) return ''
        const cost = skuUnitCost(product.sku)
        const estimatedProfitPerUnit = cost === undefined ? undefined : product.averagePrice - cost
        const estimatedProfit = estimatedProfitPerUnit === undefined ? undefined : estimatedProfitPerUnit * product.units
        return [
          escapeChartText(product.title ?? 'Untitled product'),
          `SKU: ${escapeChartText(product.sku ?? '—')}`,
          `TSIN: ${product.tsin === undefined ? '—' : String(product.tsin)}`,
          ...items.map((item) => {
            const value = Number(item.value)
            const formatted = item.seriesName === 'Sales value'
              ? formatCurrency(value)
              : formatNumber(value)
            return `${item.marker ?? ''}${item.seriesName}: ${formatted}`
          }),
          `Average selling price: ${formatCurrency(product.averagePrice)}`,
          cost === undefined ? 'Unit cost: not encoded in SKU' : `Unit cost: ${formatCurrency(cost)}`,
          estimatedProfit === undefined
            ? 'Profit / loss: unavailable'
            : `Estimated profit / loss: ${estimatedProfit >= 0 ? '+' : ''}${formatCurrency(estimatedProfit)}`,
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
      { type: 'value', name: 'Sales', position: 'left', axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) } },
      { type: 'value', name: 'Units', position: 'right', axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
      { type: 'value', name: 'Orders', position: 'right', offset: 58, axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
      { type: 'value', name: 'Profit / loss', position: 'left', offset: 60, axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) } },
    ],
    series: [
      { name: 'Sales value', type: 'line', yAxisIndex: 0, smooth: true, showSymbol: true, data: products.map((product) => product.revenue) },
      { name: 'Units sold', type: 'line', yAxisIndex: 1, smooth: true, showSymbol: true, data: products.map((product) => product.units) },
      { name: 'Orders', type: 'line', yAxisIndex: 2, smooth: true, showSymbol: true, data: products.map((product) => product.orders) },
      {
        name: 'Profit / loss',
        type: 'line',
        yAxisIndex: 3,
        smooth: true,
        showSymbol: true,
        connectNulls: false,
        lineStyle: { color: '#64748b', type: 'dashed' },
        data: products.map((product) => {
          const unitCost = skuUnitCost(product.sku)
          if (unitCost === undefined) return { value: null }
          const profit = (product.averagePrice - unitCost) * product.units
          return {
            value: Math.round((profit + Number.EPSILON) * 100) / 100,
            itemStyle: { color: profit >= 0 ? '#16a34a' : '#dc2626' },
          }
        }),
      },
    ],
  }), [products])

  const applyFilter = () => {
    setPage(1)
    setFilter({
      ...(draftSku.trim() && { sku: draftSku.trim() }),
      ...(draftTitle.trim() && { productTitle: draftTitle.trim() }),
    })
  }
  if (resource.loading && !resource.data) return <><LoadingCards count={3} /><ChartSkeletons /></>
  if (!resource.data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />
  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <Flex gap="3" wrap="wrap" align="end">
        <Box>
          <Text fontSize="sm" mb="1">SKU</Text>
          <Input size="sm" aria-label="Filter products by SKU" value={draftSku} onChange={(event) => setDraftSku(event.target.value)} />
        </Box>
        <Box>
          <Text fontSize="sm" mb="1">Product title</Text>
          <Input size="sm" aria-label="Filter products by title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
        </Box>
        <Button size="sm" variant="outline" onClick={() => { setPage(1); setOrder(order === 'desc' ? 'asc' : 'desc') }}>
          {order === 'desc' ? 'Highest first' : 'Lowest first'}
        </Button>
        <Button size="sm" onClick={applyFilter}>Apply filters</Button>
      </Flex>
      {!productData || products.length === 0 ? (
        <Card.Root variant="outline"><Card.Body><Text>No products were returned for this date range.</Text></Card.Body></Card.Root>
      ) : (
        <>
          <ChartCard
            title="Product performance"
            description="Sales value (selling price × quantity), units sold, distinct orders, and estimated profit/loss ((average selling price - SKU unit cost) × units) by product. Click legend items to show or hide lines; profit/loss is unavailable when SKU cost cannot be read."
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
            <Box overflowX="auto">
              <Table.Root size="sm">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeader>Product</Table.ColumnHeader>
                    <Table.ColumnHeader>SKU</Table.ColumnHeader>
                    <Table.ColumnHeader>TSIN</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Unit cost</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Profit / loss</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Units</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Orders</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Average price</Table.ColumnHeader>
                    <Table.ColumnHeader textAlign="end">Sales value</Table.ColumnHeader>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {products.map((product, index) => {
                    const unitCost = skuUnitCost(product.sku)
                    const profitPerUnit = unitCost === undefined ? undefined : product.averagePrice - unitCost
                    const totalProfit = profitPerUnit === undefined ? undefined : profitPerUnit * product.units
                    return (
                      <Table.Row key={`${product.sku ?? 'product'}-${product.tsin ?? index}`}>
                        <Table.Cell>{product.title ?? 'Untitled product'}</Table.Cell>
                        <Table.Cell>{product.sku ?? '—'}</Table.Cell>
                        <Table.Cell>{product.tsin === undefined ? '—' : String(product.tsin)}</Table.Cell>
                        <Table.Cell textAlign="end">{unitCost === undefined ? '—' : formatCurrency(unitCost)}</Table.Cell>
                        <Table.Cell textAlign="end">
                          {totalProfit === undefined ? '—' : (
                            <Text as="span" color={totalProfit >= 0 ? 'green.fg' : 'fg.error'}>
                              {totalProfit >= 0 ? '+' : ''}{formatCurrency(totalProfit)}
                              <Text as="span" display="block" fontSize="xs" color="fg.muted">
                                {profitPerUnit !== undefined && `${profitPerUnit >= 0 ? '+' : ''}${formatCurrency(profitPerUnit)} / unit`}
                              </Text>
                            </Text>
                          )}
                        </Table.Cell>
                        <Table.Cell textAlign="end">{formatNumber(product.units)}</Table.Cell>
                        <Table.Cell textAlign="end">{formatNumber(product.orders)}</Table.Cell>
                        <Table.Cell textAlign="end">{formatCurrency(product.averagePrice)}</Table.Cell>
                        <Table.Cell textAlign="end">{formatCurrency(product.revenue)}</Table.Cell>
                      </Table.Row>
                    )
                  })}
                </Table.Body>
              </Table.Root>
            </Box>
            <Flex justify="space-between" align="center" p="4">
              <Text fontSize="sm" color="fg.muted">
                Page {productData.pagination.page} of {Math.max(productData.pagination.totalPages, 1)}
              </Text>
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
          </Card.Root>
          <Text fontSize="xs" color="fg.muted">
            {productData.revenueDefinition} Estimated profit / loss uses the C&lt;amount&gt; in the SKU as unit cost and calculates (average selling price - unit cost) × units; it excludes Takealot fees and other costs. Rows without that SKU pattern have no profit estimate.
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
    return [{
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
    }]
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
  const filters = useMemo(
    () => ({
      ...range,
      ...filter,
      page,
      limit: 10,
    }),
    [range.from, range.to, filter, page],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'orders', filters)
  const fetcher = useCallback((signal: AbortSignal) => getTakealotOrders(filters, signal), [requestKey])
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
        <Box><Text fontSize="sm" mb="1">SKU</Text><Input size="sm" aria-label="Filter orders by SKU" value={draftSku} onChange={(event) => setDraftSku(event.target.value)} /></Box>
        <Box><Text fontSize="sm" mb="1">Product title</Text><Input size="sm" aria-label="Filter orders by product title" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} /></Box>
        <Box><Text fontSize="sm" mb="1">Order ID</Text><Input size="sm" type="number" min="1" aria-label="Filter by order ID" value={draftOrderId} onChange={(event) => setDraftOrderId(event.target.value)} /></Box>
        <Button size="sm" onClick={applyFilter}>Apply filters</Button>
      </Flex>
      {!ordersData || rows.length === 0 ? (
        <Card.Root variant="outline"><Card.Body><Text>No order records were returned for this date range.</Text></Card.Body></Card.Root>
      ) : (
        <Card.Root variant="outline">
          <Card.Header><Card.Title>Orders and sale items</Card.Title></Card.Header>
          <Box overflowX="auto">
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Order</Table.ColumnHeader>
                  <Table.ColumnHeader>Item</Table.ColumnHeader>
                  <Table.ColumnHeader>Date</Table.ColumnHeader>
                  <Table.ColumnHeader>Product</Table.ColumnHeader>
                  <Table.ColumnHeader>SKU</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Quantity</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Selling price</Table.ColumnHeader>
                  <Table.ColumnHeader>Status</Table.ColumnHeader>
                  <Table.ColumnHeader>DC</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {rows.map((row) => (
                  <Table.Row key={row.key}>
                    <Table.Cell>{String(row.orderId)}</Table.Cell>
                    <Table.Cell>{row.itemId === undefined ? '—' : String(row.itemId)}</Table.Cell>
                    <Table.Cell>{row.date ? formatReportDate(row.date) : '—'}</Table.Cell>
                    <Table.Cell>{row.title ?? '—'}</Table.Cell>
                    <Table.Cell>{row.sku ?? '—'}</Table.Cell>
                    <Table.Cell textAlign="end">{row.quantity === undefined ? '—' : formatNumber(row.quantity)}</Table.Cell>
                    <Table.Cell textAlign="end">{row.price === undefined ? '—' : formatCurrency(row.price)}</Table.Cell>
                    <Table.Cell>{row.status === undefined ? '—' : String(row.status)}</Table.Cell>
                    <Table.Cell>{row.dc ?? '—'}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Box>
          <Flex justify="space-between" align="center" p="4">
            <Text fontSize="sm" color="fg.muted">
              Page {ordersData.pagination.page} of {Math.max(ordersData.pagination.totalPages, 1)} · {formatNumber(ordersData.pagination.total)} orders
            </Text>
            <Flex gap="2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                <ChevronLeft size={15} /> Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page >= ordersData.pagination.totalPages} onClick={() => setPage((current) => current + 1)}>
                Next <ChevronRight size={15} />
              </Button>
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
  const getSummary = useCallback((signal: AbortSignal) => getTakealotInventorySummary(signal), [])
  const getHistory = useCallback(
    (signal: AbortSignal) => getTakealotInventoryHistory(historyFilters, signal),
    [historyFilters.from, historyFilters.to, historyFilters.interval],
  )
  const summary = useCachedResource(enabled, summaryKey, getSummary, refreshToken, onMeta)
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
  const chart: EChartsOption = useMemo(() => ({
    tooltip: { trigger: 'axis', valueFormatter: (value) => formatNumber(Number(value)) },
    legend: { data: ['Offers with stock', 'Unbalanced stock'], bottom: 0 },
    grid: { left: 70, right: 24, top: 24, bottom: 60 },
    xAxis: { type: 'category', data: inventoryPoints.map((point) => point.date), axisLabel: { formatter: (value: string) => dateLabel(value) } },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
    series: [
      { name: 'Offers with stock', type: 'line', smooth: true, data: inventoryPoints.map((point) => recordNumber(point.stockCounts, 'total_stock_count') ?? null) },
      { name: 'Unbalanced stock', type: 'line', smooth: true, data: inventoryPoints.map((point) => recordNumber(point.stockCounts, 'unbalanced_stock_count') ?? null) },
    ],
  }), [inventoryPoints])

  if (enabled && summary.loading && !summary.data && !fallback) return <><LoadingCards count={4} /><ChartSkeletons /></>
  const error = summary.error || history.error
  if (error && !stockCounts && !stockHealth) {
    return <ErrorPanel message={error} retry={() => { summary.refresh(); history.refresh() }} />
  }
  return (
    <Stack gap="4">
      {(summary.error || history.error) && (
        <ResourceNotice
          resource={{ error: summary.error || history.error, stale: summary.stale || history.stale, cached: summary.cached || history.cached }}
          retry={() => { summary.refresh(); history.refresh() }}
        />
      )}
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <MetricCard label="Offers with stock" value={total === undefined ? undefined : formatNumber(total)} icon={Package} />
        <MetricCard label="Unbalanced stock" value={unbalanced === undefined ? undefined : formatNumber(unbalanced)} icon={Activity} />
        <MetricCard label="Storage-fee-enabled offers" value={fees === undefined ? undefined : formatNumber(fees)} icon={ReceiptText} />
        <MetricCard label="Recommended for replenishment" value={replenishment === undefined ? undefined : formatNumber(replenishment)} icon={Warehouse} />
      </SimpleGrid>
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
          <Card.Body><Text>No saved inventory snapshots were found for the selected date range.</Text></Card.Body>
        </Card.Root>
      ) : history.loading ? <Skeleton h="320px" borderRadius="md" /> : null}
    </Stack>
  )
}

export function TakealotDashboardPage() {
  const navigate = useNavigate()
  const [identity, setIdentity] = useState<DashboardIdentity>(() => localIdentity())
  const [activeSection, setActiveSection] = useState<Section>('overview')
  const [range, setRange] = useState<DateRange>(lastThirtyDays)
  const [draftRange, setDraftRange] = useState<DateRange>(lastThirtyDays)
  const [granularity, setGranularity] = useState<Granularity>('day')
  const [dateError, setDateError] = useState('')
  const [refreshTokens, setRefreshTokens] = useState<Record<Section, number>>({
    overview: 0,
    analytics: 0,
    products: 0,
    orders: 0,
    stock: 0,
  })
  const [resourceMeta, setResourceMeta] = useState<Partial<Record<Section, ResourceMeta>>>({})
  const toastRef = useRef('')
  const refresh = () => setRefreshTokens((current) => ({
    ...current,
    [activeSection]: current[activeSection] + 1,
  }))
  const reportMeta = useCallback((section: Section, meta: ResourceMeta, token: number, outcome?: 'success' | 'error') => {
    setResourceMeta((current) => ({ ...current, [section]: meta }))
    if (!outcome) return
    const key = `${section}:${token}`
    if (toastRef.current === key) return
    toastRef.current = key
    if (outcome === 'success') showSuccess('Takealot dashboard refreshed')
    else showError('Takealot dashboard refresh failed')
  }, [])
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
  const sectionMeta = resourceMeta[activeSection]
  const lastRetrieved = sectionMeta?.savedAt

  useEffect(() => {
    const updateIdentity = () => setIdentity(localIdentity())
    window.addEventListener('pos-company-updated', updateIdentity)
    window.addEventListener('storage', updateIdentity)
    window.addEventListener('focus', updateIdentity)
    document.addEventListener('visibilitychange', updateIdentity)
    return () => {
      window.removeEventListener('pos-company-updated', updateIdentity)
      window.removeEventListener('storage', updateIdentity)
      window.removeEventListener('focus', updateIdentity)
      document.removeEventListener('visibilitychange', updateIdentity)
    }
  }, [])

  const applyQuickRange = (preset: string) => {
    let next: DateRange
    const end = new Date()
    if (preset === 'last7') {
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      next = { from: iso(start), to: iso(end) }
    } else if (preset === 'thisMonth') {
      next = { from: iso(new Date(end.getFullYear(), end.getMonth(), 1)), to: iso(end) }
    } else {
      next = lastThirtyDays()
    }
    setDraftRange(next)
    setRange(next)
    setDateError('')
  }

  const applyRange = () => {
    if (!validDate(draftRange.from) || !validDate(draftRange.to)) {
      setDateError('Enter valid start and end dates.')
      return
    }
    if (draftRange.from > draftRange.to) {
      setDateError('The start date must be on or before the end date.')
      return
    }
    setDateError('')
    setRange(draftRange)
  }

  const isBusy = Boolean(resourceMeta[activeSection]?.loading)
  const sections: Array<{ id: Section; label: string; icon: LucideIcon }> = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'analytics', label: 'Sales Analytics', icon: Activity },
    { id: 'products', label: 'Product Performance', icon: Package },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'stock', label: 'Stock Health', icon: Warehouse },
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
                {sectionMeta?.stale && <Badge colorPalette="orange" variant="subtle">Stale data</Badge>}
              </Flex>
            ) : null}
            <Button size="sm" variant="outline" onClick={refresh} loading={isBusy}>
              <RefreshCw size={15} /> Refresh
            </Button>
          </Flex>
        }
      />

      {!identity.configured ? (
        <Card.Root variant="outline">
          <Card.Body p={{ base: '6', md: '10' }}>
            <Stack align="start" gap="3" maxW="xl">
              <Flex boxSize="12" align="center" justify="center" borderRadius="md" bg="bg.muted">
                <ChartNoAxesCombined size={22} />
              </Flex>
              <Heading size="md">Configure Takealot to view your dashboard</Heading>
              <Text color="fg.muted">
                Connect your Takealot API in Settings to view sales performance, product analytics and stock health.
              </Text>
              <Button onClick={() => navigate('/settings?section=integrations')}>Configure Takealot</Button>
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap="5">
          <Stack gap="3">
            <Flex gap="3" wrap="wrap" align="end">
              <Box>
                <Flex align="center" gap="1" mb="1">
                  <CalendarDays size={14} aria-hidden="true" />
                  <Text fontSize="sm">From</Text>
                </Flex>
                <Input
                  aria-label="From date"
                  type="date"
                  size="sm"
                  value={draftRange.from}
                  max={draftRange.to || today()}
                  onChange={(event) => setDraftRange((current) => ({ ...current, from: event.target.value }))}
                />
              </Box>
              <Box>
                <Flex align="center" gap="1" mb="1">
                  <CalendarDays size={14} aria-hidden="true" />
                  <Text fontSize="sm">To</Text>
                </Flex>
                <Input
                  aria-label="To date"
                  type="date"
                  size="sm"
                  value={draftRange.to}
                  min={draftRange.from}
                  max={today()}
                  onChange={(event) => setDraftRange((current) => ({ ...current, to: event.target.value }))}
                />
              </Box>
              <NativeSelect.Root size="sm" maxW="170px">
                <NativeSelect.Field
                  aria-label="Quick date range"
                  defaultValue="last30"
                  onChange={(event) => {
                    if (event.target.value !== 'custom') applyQuickRange(event.target.value)
                  }}
                >
                  <option value="last7">Last 7 days</option>
                  <option value="last30">Last 30 days</option>
                  <option value="thisMonth">This month</option>
                  <option value="custom">Custom</option>
                </NativeSelect.Field>
              </NativeSelect.Root>
              <NativeSelect.Root size="sm" maxW="140px">
                <NativeSelect.Field aria-label="Chart granularity" value={granularity} onChange={(event) => setGranularity(event.target.value as Granularity)}>
                  <option value="day">Day</option>
                  <option value="week">Week</option>
                  <option value="month">Month</option>
                </NativeSelect.Field>
              </NativeSelect.Root>
              <Button size="sm" variant="outline" onClick={applyRange}>Apply dates</Button>
            </Flex>
            {dateError && <Text role="alert" color="fg.error" fontSize="sm">{dateError}</Text>}
          </Stack>

          <Flex
            role="tablist"
            aria-label="Takealot dashboard sections"
            gap="1"
            p="1"
            bg="bg.subtle"
            borderRadius="md"
            overflowX="auto"
          >
            {sections.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                role="tab"
                aria-selected={activeSection === id}
                aria-controls={`takealot-panel-${id}`}
                id={`takealot-tab-${id}`}
                size="sm"
                minW="max-content"
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
          </Box>
        </Stack>
      )}
    </PageContainer>
  )
}
