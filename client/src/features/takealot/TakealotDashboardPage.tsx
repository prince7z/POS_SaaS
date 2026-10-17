import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Activity,
  AlertCircle,
  ArrowDown,
  ArrowDownUp,
  ArrowUp,
  BarChart3,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleStop,
  Package,
  RefreshCw,
  ReceiptText,
  RotateCcw,
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
  Grid,
  Heading,
  Image,
  Input,
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
  type TakealotAlertSortBy,
  type TakealotBreakdownGroup,
  type TakealotDateFilters,
  type TakealotOrder,
  type TakealotOrderSortBy,
  type TakealotOrderRecord,
  type TakealotOverview,
  type TakealotOfferSortBy,
  type TakealotProductSortBy,
  type TakealotTopOfferSortBy,
  type TakealotSale,
  type TakealotSyncStatus,
  type TakealotWarehouseSortBy,
} from '@/api/endpoints/takealot'
import { getIntegrations, type Integration } from '@/api/endpoints/integrations'
import { EChart } from '@/components/charts/EChart'
import { PageHeader } from '@/components/common/PageHeader'
import { showError, showSuccess } from '@/components/feedback/notifications'
import { PageContainer } from '@/components/layout/PageContainer'
import { getStoredCompany, getStoredUser } from '@/lib/auth'
import { PageSizeControl } from '@/components/common/PageSizeControl'
import { SearchableSelect, type SearchableSelectOption } from '@/components/common/SearchableSelect'
import { formatCurrency, formatNumber, formatReportDate } from '@/lib/formatters'
import { readTakealotCache, TAKEALOT_CACHE_TTL, writeTakealotCache } from './takealot-cache'
import { TakealotDateRangePicker, type TakealotDateRange } from './components/TakealotDateRangePicker'

type DateRange = TakealotDateRange
type Granularity = 'day' | 'week' | 'month'
type Section = 'overview' | 'analytics' | 'products' | 'orders' | 'stock' | 'offers' | 'alerts'
type ResourceMeta = { savedAt: number; stale: boolean; cached: boolean; loading?: boolean }
type DashboardIdentity = { configured: boolean; companyId: string; userId: string; integrationId: string }
type TableSort<K extends string = string> = { key: K; direction: 'asc' | 'desc' }

interface ResourceState<T> extends ResourceMeta {
  key: string
  data?: T
  loading: boolean
  error: string
}

const MotionCard = motion.create(Card.Root)
const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const warehouseLabel = (warehouse: string) =>
  ({ CPT: 'Cape Town (CPT)', JHB: 'Johannesburg (JHB)', DBN: 'Durban (DBN)' })[warehouse] ?? warehouse
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
const toggleTableSort = <K extends string>(current: TableSort<K>, key: K): TableSort<K> => ({
  key,
  direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
})
function SortableColumnHeader<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  textAlign,
  width,
}: {
  label: string
  sortKey: K
  sort: TableSort<K>
  onSort: (sortKey: K) => void
  textAlign?: 'start' | 'center' | 'end'
  width?: string
}) {
  const active = sort.key === sortKey
  const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowDownUp
  return (
    <Table.ColumnHeader
      textAlign={textAlign}
      w={width}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Button
        variant={active ? 'subtle' : 'ghost'}
        size="xs"
        fontWeight="semibold"
        px="1.5"
        py="1"
        minH="7"
        minW="0"
        color={active ? 'blue.700' : 'fg'}
        aria-label={`Sort by ${label}${active ? `, currently ${sort.direction}ending` : ''}`}
        title={`Sort by ${label}${active ? ` (${sort.direction}ending)` : ''}`}
        onClick={() => onSort(sortKey)}
      >
        <Flex align="center" gap="1.5" justify={textAlign === 'end' ? 'flex-end' : 'flex-start'}>
          {label}
          <Icon size={15} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
        </Flex>
      </Button>
    </Table.ColumnHeader>
  )
}

function ProductImage({ src, alt, size = 10 }: { src?: string | null; alt: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [src])
  return src && !failed ? (
    <Image
      src={src}
      alt={alt}
      boxSize={size}
      objectFit="contain"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border"
      bg="bg.panel"
      flexShrink={0}
      onError={() => setFailed(true)}
    />
  ) : (
    <Flex
      boxSize={size}
      align="center"
      justify="center"
      borderRadius="md"
      borderWidth="1px"
      borderColor="border"
      bg="bg.muted"
      color="fg.muted"
      flexShrink={0}
      aria-label={`${alt} image unavailable`}
    >
      <Package size={Math.max(14, size * 1.4)} />
    </Flex>
  )
}

function WarehouseStockBadges({ cpt, jhb, dbn }: { cpt: number | null; jhb: number | null; dbn: number | null }) {
  return (
    <Flex gap="1.5" wrap="wrap" align="center">
      <Badge colorPalette="yellow">Cape Town {formatNumber(cpt ?? 0)}</Badge>
      <Badge colorPalette="blue">Johannesburg {formatNumber(jhb ?? 0)}</Badge>
      <Badge bg="gray.900" color="white" _dark={{ bg: 'gray.700' }}>
        Durban {formatNumber(dbn ?? 0)}
      </Badge>
    </Flex>
  )
}

function DashboardSelect({
  value,
  onChange,
  placeholder,
  options,
  width = '180px',
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: SearchableSelectOption[]
  width?: string
}) {
  return (
    <Box minW="0" w={{ base: 'full', sm: width }}>
      <SearchableSelect value={value} onChange={onChange} placeholder={placeholder} options={options} />
    </Box>
  )
}

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
  icon: Icon = BarChart3,
}: {
  label: string
  value: string
  secondary: Array<{ label: string; value: string }>
  detail?: string
  valueColor?: string
  icon?: LucideIcon
}) {
  return (
    <Card.Root variant="outline" minW="0">
      <Card.Body>
        <Flex align="center" justify="space-between" gap="2">
          <Text color="fg.muted" fontSize="sm">
            {label}
          </Text>
          <Icon size={18} aria-hidden="true" />
        </Flex>
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

type OverviewSlice = { name: string; value: number; color: string; detail: string }

function OverviewDonutCard({
  title,
  description,
  icon: Icon,
  totalLabel,
  total,
  unit,
  slices,
  metrics = [],
}: {
  title: string
  description: string
  icon: LucideIcon
  totalLabel: string
  total: number
  unit: string
  slices: OverviewSlice[]
  metrics?: Array<{ label: string; value: string; detail: string; color?: string }>
}) {
  const [hiddenSlices, setHiddenSlices] = useState<Set<string>>(() => new Set())
  const visibleSlices = slices.filter((slice) => !hiddenSlices.has(slice.name))
  const option: EChartsOption = {
    animationDuration: 450,
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [
      {
        type: 'pie',
        radius: ['52%', '78%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 3, borderRadius: 6 },
        data: visibleSlices.map((slice) => ({
          name: slice.name,
          value: slice.value,
          itemStyle: { color: slice.color },
        })),
      },
    ],
  }

  return (
    <MotionCard
      variant="outline"
      minW="0"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      <Card.Header>
        <Flex align="start" justify="space-between" gap="3" wrap="wrap">
          <Box>
            <Flex align="center" gap="2">
              <Icon size={17} aria-hidden="true" />
              <Card.Title>{title}</Card.Title>
            </Flex>
            <Card.Description mt="1">{description}</Card.Description>
          </Box>
          <Box textAlign={{ base: 'start', sm: 'end' }}>
            <Text fontSize="xs" color="fg.muted">
              {totalLabel}
            </Text>
            <Heading size="lg">{formatNumber(total)}</Heading>
          </Box>
        </Flex>
      </Card.Header>
      <Card.Body pt="0">
        <Grid
          templateColumns={{ base: 'minmax(0, 1fr)', md: 'minmax(180px, 0.75fr) minmax(0, 1.5fr)' }}
          alignItems="center"
          gap={{ base: '3', md: '6' }}
        >
          <Box minW="0">
            {visibleSlices.some((slice) => slice.value > 0) ? (
              <EChart option={option} height="230px" ariaLabel={`${title}; selected categories shown in the chart`} />
            ) : (
              <Flex h="230px" align="center" justify="center" textAlign="center" px="4">
                <Text fontSize="sm" color="fg.muted">
                  All categories are hidden. Select a legend item to display the chart.
                </Text>
              </Flex>
            )}
          </Box>
          <SimpleGrid columns={{ base: 1, sm: 2 }} gap="2" minW="0">
            {slices.map((slice) => {
              const hidden = hiddenSlices.has(slice.name)
              const share = total > 0 ? `${((slice.value / total) * 100).toFixed(1)}%` : '—'
              return (
                <Button
                  key={slice.name}
                  type="button"
                  variant="ghost"
                  justifyContent="start"
                  h="auto"
                  minH="16"
                  minW="0"
                  whiteSpace="normal"
                  textAlign="left"
                  px="3"
                  py="2"
                  opacity={hidden ? 0.55 : 1}
                  aria-pressed={!hidden}
                  aria-label={`${hidden ? 'Show' : 'Hide'} ${slice.name}: ${formatNumber(slice.value)} ${unit}`}
                  onClick={() =>
                    setHiddenSlices((current) => {
                      const next = new Set(current)
                      if (next.has(slice.name)) next.delete(slice.name)
                      else next.add(slice.name)
                      return next
                    })
                  }
                >
                  <Flex align="start" gap="2" w="full" minW="0">
                    <Box w="3" h="3" mt="1" borderRadius="sm" bg={slice.color} flexShrink="0" aria-hidden="true" />
                    <Box minW="0" flex="1">
                      <Flex justify="space-between" gap="2">
                        <Text fontSize="sm" fontWeight="semibold" textDecoration={hidden ? 'line-through' : undefined}>
                          {slice.name}
                        </Text>
                        <Text fontSize="sm" fontWeight="bold" flexShrink="0">
                          {formatNumber(slice.value)}
                        </Text>
                      </Flex>
                      <Flex justify="space-between" gap="2" mt="1">
                        <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                          {slice.detail}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" flexShrink="0">
                          {share}
                        </Text>
                      </Flex>
                    </Box>
                  </Flex>
                </Button>
              )
            })}
          </SimpleGrid>
        </Grid>
        {metrics.length > 0 && (
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="3" mt="4">
            {metrics.map((metric) => (
              <Box key={metric.label} borderWidth="1px" borderColor="border" borderRadius="md" p="3" minW="0">
                <Text fontSize="xs" color="fg.muted">
                  {metric.label}
                </Text>
                <Heading size="md" mt="1" color={metric.color}>
                  {metric.value}
                </Heading>
                <Text fontSize="xs" color="fg.muted" mt="1">
                  {metric.detail}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Card.Body>
    </MotionCard>
  )
}

function OverviewValueCard({
  values,
  margin,
}: {
  values: Array<{ name: string; value: number; color: string; detail: string }>
  margin: number | null
}) {
  const [hiddenValues, setHiddenValues] = useState<Set<string>>(() => new Set())
  const visibleValues = values.filter((item) => !hiddenValues.has(item.name))
  const option: EChartsOption = {
    animationDuration: 450,
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      valueFormatter: (value) => formatCurrency(Number(value)),
    },
    grid: { left: 132, right: 24, top: 12, bottom: 30 },
    xAxis: {
      type: 'value',
      axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) },
    },
    yAxis: { type: 'category', data: visibleValues.map((item) => item.name) },
    series: [
      {
        type: 'bar',
        barMaxWidth: 32,
        data: visibleValues.map((item) => ({ value: item.value, itemStyle: { color: item.color, borderRadius: 5 } })),
        label: {
          show: true,
          position: 'right',
          formatter: (params) => formatCurrency(Number(params.value)),
          fontSize: 11,
        },
      },
    ],
  }

  return (
    <MotionCard
      variant="outline"
      minW="0"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      <Card.Header>
        <Flex align="start" justify="space-between" gap="3" wrap="wrap">
          <Flex align="center" gap="2">
            <CircleDollarSign size={17} aria-hidden="true" />
            <Card.Title>Potential inventory value</Card.Title>
          </Flex>
          <Badge colorPalette={margin === null ? 'gray' : margin >= 0 ? 'green' : 'red'}>
            {margin === null ? 'Margin unavailable' : `${margin.toFixed(1)}% potential margin`}
          </Badge>
        </Flex>
        <Card.Description>
          Current stock valued at current prices and known costs; estimates, not realized sales or net profit.
        </Card.Description>
      </Card.Header>
      <Card.Body pt="0">
        <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="3" mb="3">
          {values.map((item) => (
            <Box key={item.name} borderWidth="1px" borderColor="border" borderRadius="md" p="3" minW="0">
              <Text fontSize="xs" color="fg.muted">
                {item.name}
              </Text>
              <Heading size="md" mt="1" color={item.color}>
                {formatCurrency(item.value)}
              </Heading>
              <Text fontSize="xs" color="fg.muted" mt="1">
                {item.detail}
              </Text>
            </Box>
          ))}
          <Box borderWidth="1px" borderColor="border" borderRadius="md" p="3" minW="0">
            <Text fontSize="xs" color="fg.muted">
              Potential gross margin
            </Text>
            <Heading size="md" mt="1">
              {margin === null ? 'Unavailable' : `${margin.toFixed(1)}%`}
            </Heading>
            <Text fontSize="xs" color="fg.muted" mt="1">
              Potential gross profit ÷ potential retail value.
            </Text>
          </Box>
        </SimpleGrid>
        <Grid templateColumns={{ base: 'minmax(0, 1fr)', md: 'minmax(0, 1.5fr) minmax(220px, 0.8fr)' }} gap="4">
          <Box minW="0">
            {visibleValues.length > 0 ? (
              <EChart option={option} height="220px" ariaLabel="Interactive comparison of potential inventory values" />
            ) : (
              <Flex h="220px" align="center" justify="center">
                <Text fontSize="sm" color="fg.muted">
                  All value categories are hidden. Select a legend item to show them.
                </Text>
              </Flex>
            )}
          </Box>
          <Stack gap="2" justify="center">
            {values.map((item) => {
              const hidden = hiddenValues.has(item.name)
              return (
                <Button
                  key={item.name}
                  type="button"
                  variant="ghost"
                  justifyContent="start"
                  h="auto"
                  minH="12"
                  whiteSpace="normal"
                  textAlign="left"
                  opacity={hidden ? 0.55 : 1}
                  aria-pressed={!hidden}
                  aria-label={`${hidden ? 'Show' : 'Hide'} ${item.name}`}
                  onClick={() =>
                    setHiddenValues((current) => {
                      const next = new Set(current)
                      if (next.has(item.name)) next.delete(item.name)
                      else next.add(item.name)
                      return next
                    })
                  }
                >
                  <Flex align="start" gap="2">
                    <Box w="3" h="3" mt="1" borderRadius="sm" bg={item.color} flexShrink="0" aria-hidden="true" />
                    <Box>
                      <Text fontSize="sm" fontWeight="semibold" textDecoration={hidden ? 'line-through' : undefined}>
                        {item.name}
                      </Text>
                      <Text fontSize="xs" color="fg.muted">
                        {item.detail}
                      </Text>
                    </Box>
                  </Flex>
                </Button>
              )
            })}
          </Stack>
        </Grid>
      </Card.Body>
    </MotionCard>
  )
}

function donutOption(data: Array<{ name: string; value: number; color?: string }>, showLegend = true): EChartsOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: showLegend ? { bottom: 0, left: 'center' } : { show: false },
    series: [
      {
        type: 'pie',
        radius: ['45%', '72%'],
        center: ['50%', showLegend ? '44%' : '50%'],
        avoidLabelOverlap: true,
        label: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 5 },
        data: data.map((item) => ({
          name: item.name,
          value: item.value,
          ...(item.color && { itemStyle: { color: item.color } }),
        })),
      },
    ],
  }
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

function SkeletonEntrance({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.24, delay: reducedMotion ? 0 : delay, ease: 'easeOut' }}
      style={{ minWidth: 0 }}
    >
      {children}
    </motion.div>
  )
}

function MetricSkeletonCard({ index }: { index: number }) {
  return (
    <SkeletonEntrance delay={index * 0.035}>
      <Card.Root variant="outline" h="full" minH="132px">
        <Card.Body p="4">
          <Flex justify="space-between" align="start" gap="3">
            <Stack flex="1" gap="3">
              <Skeleton h="3" w="28" />
              <Skeleton h="7" w="36" />
              <Skeleton h="3" w="full" />
            </Stack>
            <Skeleton h="10" w="10" borderRadius="md" flexShrink="0" />
          </Flex>
        </Card.Body>
      </Card.Root>
    </SkeletonEntrance>
  )
}

function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <SimpleGrid
      columns={{ base: 1, sm: 2, xl: 4 }}
      gap="4"
      aria-label="Loading Takealot dashboard metrics"
      aria-busy="true"
      role="status"
    >
      {Array.from({ length: count }, (_, index) => (
        <MetricSkeletonCard key={index} index={index} />
      ))}
    </SimpleGrid>
  )
}

function ChartSkeletonCard({ height = '300px', kind = 'line' }: { height?: string; kind?: 'line' | 'donut' }) {
  return (
    <SkeletonEntrance>
      <Card.Root variant="outline" minW="0" h="full">
        <Card.Header>
          <Skeleton h="5" w="48" />
          <Skeleton h="3" w="4/5" mt="2" />
        </Card.Header>
        <Card.Body pt="0">
          {kind === 'donut' ? (
            <Grid
              templateColumns={{
                base: 'minmax(96px, 0.8fr) minmax(0, 1.2fr)',
                sm: 'minmax(120px, 0.8fr) minmax(0, 1.2fr)',
              }}
              alignItems="center"
              gap="2"
              h={height}
            >
              <Flex justify="center" align="center">
                <Box
                  w="36"
                  h="36"
                  borderWidth="12px"
                  borderColor="bg.muted"
                  borderRadius="full"
                  display="grid"
                  placeItems="center"
                >
                  <Skeleton w="10" h="10" borderRadius="full" />
                </Box>
              </Flex>
              <Stack gap="3">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} h="3" w={index % 2 ? '4/5' : 'full'} />
                ))}
              </Stack>
            </Grid>
          ) : (
            <Box h={height} position="relative" px="2" py="4">
              <Stack h="full" justify="space-between" pb="6">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} h="1px" w="full" />
                ))}
              </Stack>
              <Flex position="absolute" insetX="8" top="5" bottom="12" align="end" justify="space-around" gap="3">
                {['34%', '52%', '43%', '75%', '60%', '88%', '49%', '68%'].map((bar, index) => (
                  <Skeleton key={index} h={bar} w="full" borderRadius="sm" />
                ))}
              </Flex>
            </Box>
          )}
        </Card.Body>
      </Card.Root>
    </SkeletonEntrance>
  )
}

function ChartSkeletons({ count = 2 }: { count?: number }) {
  return (
    <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4" aria-label="Loading Takealot charts" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <ChartSkeletonCard key={index} />
      ))}
    </SimpleGrid>
  )
}

function FilterSkeletons({ fields = 3 }: { fields?: number }) {
  return (
    <Grid
      templateColumns={{
        base: 'minmax(0, 1fr)',
        sm: 'repeat(2, minmax(0, 1fr))',
        xl: `repeat(${fields + 1}, minmax(0, 1fr))`,
      }}
      gap="3"
      aria-label="Loading filters"
      aria-busy="true"
    >
      {Array.from({ length: fields }, (_, index) => (
        <SkeletonEntrance key={index} delay={index * 0.035}>
          <Stack gap="2">
            <Skeleton h="3" w="20" />
            <Skeleton h="10" w="full" borderRadius="md" />
          </Stack>
        </SkeletonEntrance>
      ))}
      <Flex align="end">
        <Skeleton h="10" w={{ base: 'full', xl: '28' }} borderRadius="md" />
      </Flex>
    </Grid>
  )
}

function TableSkeleton({ titleWidth = '40%', rows = 6 }: { titleWidth?: string; rows?: number }) {
  return (
    <SkeletonEntrance>
      <Card.Root variant="outline" minW="0" w="full" aria-label="Loading table" aria-busy="true">
        <Card.Header>
          <Skeleton h="5" w={titleWidth} />
        </Card.Header>
        <Box px="4" pb="4">
          <Grid
            templateColumns={{
              base: 'minmax(0, 2fr) repeat(2, minmax(0, 1fr))',
              md: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))',
            }}
            gap="4"
            py="3"
            borderBottomWidth="1px"
            borderColor="border"
          >
            <Skeleton h="3" w="24" />
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} h="3" w="16" display={index > 1 ? { base: 'none', md: 'block' } : 'block'} />
            ))}
          </Grid>
          <Stack gap="0">
            {Array.from({ length: rows }, (_, index) => (
              <Grid
                key={index}
                templateColumns={{
                  base: 'minmax(0, 2fr) repeat(2, minmax(0, 1fr))',
                  md: 'minmax(0, 2fr) repeat(4, minmax(0, 1fr))',
                }}
                gap="4"
                alignItems="center"
                py="3"
                borderBottomWidth="1px"
                borderColor="border"
              >
                <Flex align="center" gap="3" minW="0">
                  <Skeleton h="10" w="10" borderRadius="md" flexShrink="0" />
                  <Stack gap="2" flex="1" minW="0">
                    <Skeleton h="3" w={index % 2 ? '4/5' : 'full'} />
                    <Skeleton h="2" w="3/5" />
                  </Stack>
                </Flex>
                {[0, 1, 2, 3].map((cell) => (
                  <Skeleton
                    key={cell}
                    h="3"
                    w={cell % 2 ? '4/5' : '3/5'}
                    justifySelf="end"
                    display={cell > 1 ? { base: 'none', md: 'block' } : 'block'}
                  />
                ))}
              </Grid>
            ))}
          </Stack>
        </Box>
      </Card.Root>
    </SkeletonEntrance>
  )
}

function SummarySkeleton({ titleWidth = '48%' }: { titleWidth?: string }) {
  return (
    <SkeletonEntrance>
      <Card.Root variant="outline" minW="0" w="full">
        <Card.Header>
          <Skeleton h="5" w={titleWidth} />
          <Skeleton h="3" w="40%" mt="2" />
        </Card.Header>
        <Card.Body pt="0">
          <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 280px' }} alignItems="center" gap="4">
            <Stack gap="4">
              <SimpleGrid columns={{ base: 2, sm: 4 }} gap="2">
                {Array.from({ length: 4 }, (_, index) => (
                  <Stack key={index} p="3" gap="2" borderRadius="md" bg="bg.subtle">
                    <Skeleton h="3" w="16" />
                    <Skeleton h="5" w="12" />
                    <Skeleton h="2" w="4/5" />
                  </Stack>
                ))}
              </SimpleGrid>
              <Stack gap="2">
                <Skeleton h="3" w="full" />
                <Skeleton h="3" w="4/5" />
              </Stack>
              <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3">
                {Array.from({ length: 3 }, (_, index) => (
                  <Stack key={index} gap="2">
                    <Skeleton h="3" w="24" />
                    <Skeleton h="5" w="32" />
                  </Stack>
                ))}
              </SimpleGrid>
            </Stack>
            <Flex justify="center" align="center" minH="220px">
              <Box
                w="40"
                h="40"
                borderWidth="16px"
                borderColor="bg.muted"
                borderRadius="full"
                display="grid"
                placeItems="center"
              >
                <Skeleton w="14" h="14" borderRadius="full" />
              </Box>
            </Flex>
          </Grid>
        </Card.Body>
      </Card.Root>
    </SkeletonEntrance>
  )
}

function OverviewSkeleton() {
  return (
    <Stack gap="4" aria-label="Loading Takealot overview" aria-busy="true">
      <OverviewGroupSkeleton kind="donut" />
      <OverviewGroupSkeleton kind="donut" metrics />
      <OverviewGroupSkeleton kind="bars" />
      <LoadingCards count={4} />
      <TableSkeleton titleWidth="32%" rows={5} />
    </Stack>
  )
}

function OverviewGroupSkeleton({ kind, metrics = false }: { kind: 'donut' | 'bars'; metrics?: boolean }) {
  return (
    <SkeletonEntrance>
      <Card.Root variant="outline" minW="0" aria-hidden="true">
        <Card.Header>
          <Flex justify="space-between" gap="4">
            <Stack gap="2" flex="1">
              <Skeleton h="5" w="48" />
              <Skeleton h="3" w="4/5" />
            </Stack>
            <Stack gap="2" align="end">
              <Skeleton h="3" w="20" />
              <Skeleton h="7" w="28" />
            </Stack>
          </Flex>
        </Card.Header>
        <Card.Body pt="0">
          <Grid
            templateColumns={{ base: 'minmax(0, 1fr)', md: 'minmax(180px, 0.75fr) minmax(0, 1.5fr)' }}
            alignItems="center"
            gap="5"
          >
            <Flex justify="center" align="center">
              {kind === 'donut' ? (
                <Box
                  w="40"
                  h="40"
                  borderWidth="12px"
                  borderColor="bg.muted"
                  borderRadius="full"
                  display="grid"
                  placeItems="center"
                >
                  <Skeleton w="12" h="12" borderRadius="full" />
                </Box>
              ) : (
                <Stack w="full" gap="4" py="4">
                  {[0, 1, 2].map((index) => (
                    <Flex key={index} align="center" gap="3">
                      <Skeleton h="3" w="24" />
                      <Skeleton h="5" w={`${55 + index * 10}%`} borderRadius="sm" />
                    </Flex>
                  ))}
                </Stack>
              )}
            </Flex>
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3">
              {[0, 1, 2, 3].map((index) => (
                <Box key={index} borderWidth="1px" borderColor="border" borderRadius="md" p="3">
                  <Skeleton h="3" w="2/5" />
                  <Skeleton h="5" w="1/3" mt="2" />
                  <Skeleton h="3" w="4/5" mt="2" />
                </Box>
              ))}
            </SimpleGrid>
          </Grid>
          {metrics && (
            <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="3" mt="4">
              {[0, 1, 2, 3].map((index) => (
                <Box key={index} borderWidth="1px" borderColor="border" borderRadius="md" p="3">
                  <Skeleton h="3" w="2/5" />
                  <Skeleton h="5" w="1/3" mt="2" />
                  <Skeleton h="3" w="4/5" mt="2" />
                </Box>
              ))}
            </SimpleGrid>
          )}
        </Card.Body>
      </Card.Root>
    </SkeletonEntrance>
  )
}

function AnalyticsSkeleton() {
  return (
    <Stack gap="4" aria-label="Loading sales analytics" aria-busy="true">
      <LoadingCards count={4} />
      <ChartSkeletons />
    </Stack>
  )
}

function ProductPerformanceSkeleton() {
  return (
    <Stack gap="4" aria-label="Loading product performance" aria-busy="true">
      <FilterSkeletons fields={2} />
      <LoadingCards count={3} />
      <ChartSkeletonCard />
      <TableSkeleton titleWidth="36%" />
    </Stack>
  )
}

function OrdersSkeleton() {
  return (
    <Stack gap="4" aria-label="Loading orders" aria-busy="true">
      <FilterSkeletons fields={3} />
      <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 3fr) minmax(0, 1fr)' }} gap="4">
        <ChartSkeletonCard height="300px" />
        <ChartSkeletonCard height="220px" kind="donut" />
      </Grid>
      <TableSkeleton titleWidth="28%" />
    </Stack>
  )
}

function StockSkeleton() {
  return (
    <Stack gap="4" aria-label="Loading stock health" aria-busy="true">
      <LoadingCards count={4} />
      <TableSkeleton titleWidth="34%" rows={4} />
      <ChartSkeletons />
    </Stack>
  )
}

function OffersSkeleton() {
  return (
    <Stack gap="4" aria-label="Loading Takealot offers" aria-busy="true">
      <FilterSkeletons fields={5} />
      <TableSkeleton titleWidth="28%" />
      <SummarySkeleton />
    </Stack>
  )
}

function AlertsSkeleton() {
  return (
    <Stack gap="4" aria-label="Loading Takealot alerts" aria-busy="true">
      <FilterSkeletons fields={2} />
      <TableSkeleton titleWidth="26%" />
      <SummarySkeleton titleWidth="30%" />
    </Stack>
  )
}

function IntegrationSkeletons() {
  return (
    <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4" aria-label="Loading Takealot connections" aria-busy="true">
      {[0, 1].map((index) => (
        <SkeletonEntrance key={index} delay={index * 0.05}>
          <Card.Root variant="outline">
            <Card.Body p="4">
              <Stack gap="3">
                <Skeleton h="5" w="2/5" />
                <Skeleton h="3" w="4/5" />
                <Skeleton h="10" w="full" borderRadius="md" />
              </Stack>
            </Card.Body>
          </Card.Root>
        </SkeletonEntrance>
      ))}
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
  const key = cacheKey(identity, 'overview-v2')
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotDashboardOverview(identity.integrationId, signal),
    [identity.integrationId],
  )
  const [topOfferSort, setTopOfferSort] = useState<TableSort<TakealotTopOfferSortBy>>({
    key: 'reportedSalesUnits',
    direction: 'desc',
  })
  const pricingFilters = useMemo(
    () => ({ sortBy: topOfferSort.key, sortOrder: topOfferSort.direction }),
    [topOfferSort],
  )
  const pricingKey = cacheKey(identity, 'pricing-sales-analytics', pricingFilters)
  const pricingFetcher = useCallback(
    (signal: AbortSignal) => getTakealotPricingSalesAnalytics(identity.integrationId, pricingFilters, signal),
    [identity.integrationId, pricingFilters],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const pricing = useCachedResource(enabled, pricingKey, pricingFetcher, refreshToken, onMeta)
  const data = resource.data
  const topOfferRows = pricing.data?.topOffersByReportedSales ?? []
  const onTopOfferSort = (key: TakealotTopOfferSortBy) => {
    setTopOfferSort((current) => toggleTableSort(current, key))
  }

  if (resource.loading && !data) return <OverviewSkeleton />
  if (!data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />
  if (!data) return null

  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <OverviewDonutCard
        title="Listing status"
        description="All synchronized Takealot offers grouped by current listing status. Select legend items to show or hide chart segments."
        icon={Package}
        totalLabel="Total offers"
        total={data.totalOffers}
        unit="offers"
        slices={[
          {
            name: 'Buyable',
            value: data.listingStatusCounts.buyable,
            color: '#16a34a',
            detail: 'Can currently be purchased.',
          },
          {
            name: 'Not buyable',
            value: data.listingStatusCounts.notBuyable,
            color: '#f59e0b',
            detail: 'Currently unavailable to customers.',
          },
          {
            name: 'Disabled by Takealot',
            value: data.listingStatusCounts.disabledByTakealot,
            color: '#dc2626',
            detail: 'Disabled by the marketplace.',
          },
          {
            name: 'Disabled by seller',
            value: data.listingStatusCounts.disabledBySeller,
            color: '#2563eb',
            detail: 'Disabled by the seller.',
          },
          ...(data.listingStatusCounts.other > 0
            ? [
                {
                  name: 'Other / unmapped',
                  value: data.listingStatusCounts.other,
                  color: '#64748b',
                  detail: 'Statuses not mapped to the categories above.',
                },
              ]
            : []),
        ]}
      />
      <OverviewDonutCard
        title="Inventory and stock health"
        description="Warehouse distribution and stock health based on the current synchronized offer data."
        icon={Warehouse}
        totalLabel="Total stock units"
        total={data.totalStock}
        unit="units"
        slices={[
          {
            name: 'Cape Town',
            value: data.stockByWarehouse.CPT,
            color: '#2563eb',
            detail: 'Units held at CPT.',
          },
          {
            name: 'Johannesburg',
            value: data.stockByWarehouse.JHB,
            color: '#8b5cf6',
            detail: 'Units held at JHB.',
          },
          {
            name: 'Durban',
            value: data.stockByWarehouse.DBN,
            color: '#14b8a6',
            detail: 'Units held at DBN.',
          },
        ]}
        metrics={[
          {
            label: 'Incoming units',
            value: formatNumber(data.totalIncomingStock),
            detail: 'Units on the way to Takealot warehouses.',
          },
          {
            label: 'Out of stock',
            value: formatNumber(data.outOfStockOffers),
            detail: 'Offers with no stock across the three warehouses.',
            color: data.outOfStockOffers > 0 ? '#dc2626' : undefined,
          },
          {
            label: 'Low stock',
            value: formatNumber(data.lowStockOffers),
            detail: 'Offers at or below the configured low-stock threshold.',
            color: data.lowStockOffers > 0 ? '#d97706' : undefined,
          },
          {
            label: 'Excess stock',
            value: formatNumber(data.excessStockOffers),
            detail: 'Offers with Takealot-reported excess stock.',
          },
          {
            label: 'Missing unit cost',
            value: formatNumber(data.missingCostOffers),
            detail: 'Offers without usable SKU or catalog unit cost.',
          },
          {
            label: 'Missing RRP',
            value: formatNumber(data.missingRrpOffers),
            detail: 'Offers without a recommended retail price.',
          },
        ]}
      />
      <OverviewValueCard
        values={[
          {
            name: 'Inventory cost',
            value: data.inventoryCostValue,
            color: '#8b5cf6',
            detail: 'Stock × known unit cost; uncosted offers excluded.',
          },
          {
            name: 'Potential retail',
            value: data.potentialRetailInventoryValue,
            color: '#2563eb',
            detail: 'Stock × current selling price; estimate, not sales.',
          },
          {
            name: 'Potential gross profit',
            value: data.potentialGrossProfit,
            color: data.potentialGrossProfit >= 0 ? '#16a34a' : '#dc2626',
            detail: 'Known-cost stock × (selling price − unit cost); before fees.',
          },
        ]}
        margin={data.potentialGrossMarginPercent}
      />
      {pricing.data && (
        <>
          <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
            <MetricCard
              label="Offers below cost"
              value={formatNumber(pricing.data.pricing.sellingBelowCostOffers)}
              detail="Offers where current selling price is less than known unit cost."
              icon={AlertCircle}
            />
            <MetricCard
              label="Offers with positive potential margin"
              value={formatNumber(pricing.data.pricing.positivePotentialMarginOffers)}
              detail="Offers where selling price exceeds known unit cost."
              icon={CircleDollarSign}
            />
            <MetricCard
              label="Offers with negative potential margin"
              value={formatNumber(pricing.data.pricing.negativePotentialMarginOffers)}
              detail="Offers where selling price is below known unit cost."
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
              <Flex align="center" gap="2">
                <ShoppingCart size={17} aria-hidden="true" />
                <Heading size="sm">Top offers by reported sales units</Heading>
              </Flex>
              <Text fontSize="sm" color="fg.muted">
                {pricing.data.salesSemantics}
              </Text>
            </Card.Header>
            <Stack display={{ base: 'flex', lg: 'none' }} gap="3" px="4" pb="4">
              {topOfferRows.map((offer) => (
                <Card.Root key={offer.offerId} variant="subtle">
                  <Card.Body>
                    <Flex gap="3" align="center">
                      <ProductImage src={offer.imageUrl} alt={offer.title ?? offer.offerId} />
                      <Box minW="0">
                        <Text fontWeight="semibold" overflowWrap="anywhere">
                          {offer.title || offer.offerId}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {offer.sku || 'SKU unavailable'} · {formatNumber(offer.reportedSalesUnits)} reported units
                        </Text>
                      </Box>
                    </Flex>
                    <SimpleGrid columns={2} gap="2" mt="3">
                      <Text fontSize="sm">
                        Selling price: {offer.sellingPrice === null ? '—' : formatCurrency(offer.sellingPrice)}
                      </Text>
                      <Text fontSize="sm">
                        Unit cost: {offer.costPrice === null ? '—' : formatCurrency(offer.costPrice)}
                      </Text>
                      <Text
                        fontSize="sm"
                        color={
                          offer.potentialGrossProfitPerUnit === null
                            ? 'fg.muted'
                            : offer.potentialGrossProfitPerUnit >= 0
                              ? 'green.fg'
                              : 'fg.error'
                        }
                      >
                        Potential / unit:{' '}
                        {offer.potentialGrossProfitPerUnit === null
                          ? 'Unavailable'
                          : formatCurrency(offer.potentialGrossProfitPerUnit)}
                      </Text>
                    </SimpleGrid>
                  </Card.Body>
                </Card.Root>
              ))}
            </Stack>
            <Box display={{ base: 'none', lg: 'block' }} minW="0" w="full" overflow="hidden">
              <Table.Root size="sm" variant="line" tableLayout="fixed" w="full">
                <Table.Header>
                  <Table.Row>
                    <SortableColumnHeader label="Offer" sortKey="title" sort={topOfferSort} onSort={onTopOfferSort} />
                    <SortableColumnHeader
                      label="Reported units"
                      sortKey="reportedSalesUnits"
                      sort={topOfferSort}
                      onSort={onTopOfferSort}
                      textAlign="end"
                    />
                    <SortableColumnHeader
                      label="Selling price"
                      sortKey="sellingPrice"
                      sort={topOfferSort}
                      onSort={onTopOfferSort}
                      textAlign="end"
                    />
                    <SortableColumnHeader
                      label="Cost"
                      sortKey="costPrice"
                      sort={topOfferSort}
                      onSort={onTopOfferSort}
                      textAlign="end"
                    />
                    <SortableColumnHeader
                      label="Potential profit / unit"
                      sortKey="potentialGrossProfitPerUnit"
                      sort={topOfferSort}
                      onSort={onTopOfferSort}
                      textAlign="end"
                    />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {topOfferRows.map((offer) => (
                    <Table.Row key={offer.offerId}>
                      <Table.Cell>
                        <Flex align="center" gap="2" minW="0">
                          <ProductImage src={offer.imageUrl} alt={offer.title ?? offer.offerId} size={9} />
                          <Box minW="0" overflowWrap="anywhere">
                            <Text fontWeight="medium">{offer.title || offer.offerId}</Text>
                            <Text fontSize="xs" color="fg.muted">
                              {offer.sku || 'SKU unavailable'}
                            </Text>
                          </Box>
                        </Flex>
                      </Table.Cell>
                      <Table.Cell textAlign="end">{formatNumber(offer.reportedSalesUnits)}</Table.Cell>
                      <Table.Cell textAlign="end">
                        {offer.sellingPrice === null ? '—' : formatCurrency(offer.sellingPrice)}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        {offer.costPrice === null ? '—' : formatCurrency(offer.costPrice)}
                      </Table.Cell>
                      <Table.Cell textAlign="end">
                        {offer.potentialGrossProfitPerUnit === null ? (
                          'Unavailable'
                        ) : (
                          <Text color={offer.potentialGrossProfitPerUnit >= 0 ? 'green.fg' : 'fg.error'}>
                            {formatCurrency(offer.potentialGrossProfitPerUnit)}
                          </Text>
                        )}
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
    return <AnalyticsSkeleton />
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
      {trends.loading && !trends.data && <ChartSkeletonCard height="320px" />}
      {breakdown.loading && !breakdown.data && <ChartSkeletonCard height="320px" kind="donut" />}
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
        <DashboardSelect
          value={groupBy}
          onChange={(value) => setGroupBy(value as TakealotBreakdownGroup)}
          placeholder="Sales breakdown dimension"
          width="220px"
          options={[
            { value: 'promotion', label: 'Promotion' },
            { value: 'saleStatus', label: 'Sale status' },
            { value: 'dc', label: 'Distribution centre' },
            { value: 'customerDc', label: 'Customer distribution centre' },
            { value: 'stockSourceRegion', label: 'Stock source region' },
          ]}
        />
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
  const [sortBy, setSortBy] = useState<TakealotProductSortBy>('revenue')
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
  const productSort: TableSort<TakealotProductSortBy> = { key: sortBy, direction: order }
  const sortProductsBy = (key: TakealotProductSortBy) => {
    if (sortBy === key) setOrder((current) => (current === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(key)
      setOrder('desc')
    }
    setPage(1)
  }
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
  if (resource.loading && !resource.data) return <ProductPerformanceSkeleton />
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
            setOrder((current) => (current === 'desc' ? 'asc' : 'desc'))
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
              detail={productData.revenueDefinition}
              icon={CircleDollarSign}
            />
            <SummaryGroupCard
              label="Total orders"
              value={formatNumber(productData.summary.orders)}
              secondary={[
                { label: 'Units sold', value: formatNumber(productData.summary.units) },
                { label: 'Average units per order', value: formatNumber(productData.summary.unitsPerOrder) },
              ]}
              detail="Distinct order IDs, units sold, and units ÷ orders."
              icon={ShoppingCart}
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
              icon={ReceiptText}
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
              <Flex justify="space-between" align="center" gap="2">
                <Flex align="center" gap="2">
                  <Package size={17} aria-hidden="true" />
                  <Card.Title>Products</Card.Title>
                </Flex>
                <Badge variant="subtle">{formatNumber(productData.pagination.total)} products</Badge>
              </Flex>
            </Card.Header>
            <Stack display={{ base: 'flex', lg: 'none' }} gap="3" px="4" pb="4">
              {products.map((product, index) => {
                return (
                  <Card.Root key={`${product.sku ?? 'product'}-${product.tsin ?? index}`} variant="subtle">
                    <Card.Body gap="3">
                      <Flex gap="3" align="center">
                        <ProductImage src={product.imageUrl} alt={product.title ?? product.sku ?? 'Product'} />
                        <Box minW="0">
                          <Text fontWeight="semibold" overflowWrap="anywhere">
                            {product.title ?? 'Untitled product'}
                          </Text>
                          <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                            SKU {product.sku ?? '—'} · TSIN {product.tsin === undefined ? '—' : String(product.tsin)}
                          </Text>
                        </Box>
                      </Flex>
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
                    <SortableColumnHeader label="Product" sortKey="title" sort={productSort} onSort={sortProductsBy} />
                    <SortableColumnHeader
                      label="Sales value"
                      sortKey="revenue"
                      sort={productSort}
                      onSort={sortProductsBy}
                      textAlign="end"
                    />
                    <SortableColumnHeader
                      label="Total fee"
                      sortKey="totalFee"
                      sort={productSort}
                      onSort={sortProductsBy}
                      textAlign="end"
                    />
                    <SortableColumnHeader
                      label="Total cost"
                      sortKey="totalCost"
                      sort={productSort}
                      onSort={sortProductsBy}
                      textAlign="end"
                    />
                    <SortableColumnHeader
                      label="Profit / loss"
                      sortKey="profit"
                      sort={productSort}
                      onSort={sortProductsBy}
                      textAlign="end"
                    />
                    <SortableColumnHeader
                      label="Orders"
                      sortKey="orders"
                      sort={productSort}
                      onSort={sortProductsBy}
                      textAlign="end"
                    />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {products.map((product, index) => {
                    return (
                      <Table.Row key={`${product.sku ?? 'product'}-${product.tsin ?? index}`}>
                        <Table.Cell overflowWrap="anywhere">
                          <Flex align="center" gap="2" minW="0">
                            <ProductImage
                              src={product.imageUrl}
                              alt={product.title ?? product.sku ?? 'Product'}
                              size={9}
                            />
                            <Box minW="0">
                              <Text fontWeight="medium" overflowWrap="anywhere">
                                {product.title ?? 'Untitled product'}
                              </Text>
                              <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                                SKU {product.sku ?? '—'} · TSIN{' '}
                                {product.tsin === undefined ? '—' : String(product.tsin)}
                              </Text>
                            </Box>
                          </Flex>
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
  imageUrl?: string | null
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
        imageUrl: item.image_url ?? null,
        quantity: item.quantity,
        price: item.selling_price,
        status: item.sale_status,
        dc: item.dc,
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
        imageUrl: sale.image_url ?? null,
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
  const [hiddenOrderStatuses, setHiddenOrderStatuses] = useState<Set<string>>(() => new Set())
  const [filter, setFilter] = useState<{ sku?: string; productTitle?: string; orderId?: number }>({})
  const [limit, setLimit] = useState(10)
  const [orderSort, setOrderSort] = useState<TableSort<TakealotOrderSortBy>>({
    key: 'date',
    direction: 'desc',
  })
  const filters = useMemo(
    () => ({
      ...range,
      ...filter,
      page,
      limit,
      sortBy: orderSort.key,
      sortOrder: orderSort.direction,
    }),
    [range.from, range.to, filter, page, limit, orderSort],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'orders-v2', filters)
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotOrders(identity.integrationId, filters, signal),
    [identity.integrationId, requestKey],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const ordersData = resource.data
  const rows = useMemo(() => normalizeOrders(ordersData?.orders ?? []), [ordersData])
  const sortedRows = rows
  const sortOrdersBy = (key: TakealotOrderSortBy) => {
    setOrderSort((current) => toggleTableSort(current, key))
    setPage(1)
  }
  const orderTrend = ordersData?.analytics.trend ?? []
  const orderTrendOption: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' },
      legend: { bottom: 0 },
      grid: { left: 72, right: 68, top: 24, bottom: 55 },
      xAxis: {
        type: 'category',
        data: orderTrend.map((point) => point.date),
        axisLabel: { formatter: (value: string) => dateLabel(value) },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Sales value',
          axisLabel: { formatter: (value: number) => formatCurrency(Number(value)) },
        },
        { type: 'value', name: 'Units', axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
      ],
      series: [
        {
          name: 'Sales value',
          type: 'line',
          smooth: true,
          yAxisIndex: 0,
          data: orderTrend.map((point) => point.revenue),
        },
        { name: 'Units', type: 'line', smooth: true, yAxisIndex: 1, data: orderTrend.map((point) => point.units) },
      ],
    }),
    [orderTrend],
  )
  const orderStatusCounts = ordersData?.analytics.statusCounts ?? []
  const statusPalette = [
    '#5470c6',
    '#91cc75',
    '#fac858',
    '#ee6666',
    '#73c0de',
    '#3ba272',
    '#fc8452',
    '#9a60b4',
    '#ea7ccc',
  ]
  const orderStatusChartData = orderStatusCounts.map((item, index) => ({
    ...item,
    color: statusPalette[index % statusPalette.length],
  }))
  const visibleOrderStatusChartData = orderStatusChartData.filter((item) => !hiddenOrderStatuses.has(item.name))
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

  if (resource.loading && !resource.data) return <OrdersSkeleton />
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
      {(orderTrend.length > 0 || orderStatusCounts.length > 0) && (
        <Grid
          templateColumns={{
            base: 'minmax(0, 1fr)',
            lg:
              orderTrend.length > 0 && orderStatusCounts.length > 0
                ? 'minmax(0, 3fr) minmax(0, 1fr)'
                : 'minmax(0, 1fr)',
          }}
          gap="4"
          alignItems="stretch"
        >
          {orderTrend.length > 0 && (
            <ChartCard
              title="Sales value and units for selected range"
              description={`Daily totals for all matching sale items from ${formatReportDate(range.from)} to ${formatReportDate(range.to)}. The chart is not limited to the current table page.`}
              option={orderTrendOption}
              icon={Activity}
            />
          )}
          {orderStatusCounts.length > 0 && (
            <MotionCard variant="outline">
              <Card.Header>
                <Flex align="center" gap="2">
                  <ReceiptText size={17} aria-hidden="true" />
                  <Card.Title>Order status mix for selected range</Card.Title>
                </Flex>
                <Card.Description>
                  Click a status to show or hide its slice. Counts cover all matching sale items in the selected date
                  range, not only the visible table page.
                </Card.Description>
              </Card.Header>
              <Card.Body>
                <Grid
                  templateColumns={{
                    base: 'minmax(96px, 0.8fr) minmax(0, 1.2fr)',
                    sm: 'minmax(120px, 0.8fr) minmax(0, 1.2fr)',
                  }}
                  alignItems="center"
                  gap="2"
                >
                  {visibleOrderStatusChartData.length > 0 ? (
                    <EChart
                      option={donutOption(visibleOrderStatusChartData, false)}
                      height="220px"
                      ariaLabel="Visible order status mix for all matching sale items in the selected range"
                    />
                  ) : (
                    <Flex h="220px" align="center" justify="center" textAlign="center" px="3">
                      <Text fontSize="xs" color="fg.muted">
                        All statuses are hidden. Select a legend item to show it.
                      </Text>
                    </Flex>
                  )}
                  <Stack gap="2" maxH="220px" overflowY="auto" minW="0">
                    {orderStatusChartData.map((item) => (
                      <Button
                        key={item.name}
                        type="button"
                        variant="ghost"
                        size="xs"
                        w="full"
                        minW="0"
                        h="auto"
                        minH="8"
                        justifyContent="start"
                        textAlign="left"
                        whiteSpace="normal"
                        px="2"
                        py="1"
                        opacity={hiddenOrderStatuses.has(item.name) ? 0.55 : 1}
                        aria-pressed={!hiddenOrderStatuses.has(item.name)}
                        aria-label={`${hiddenOrderStatuses.has(item.name) ? 'Show' : 'Hide'} ${item.name}, ${formatNumber(item.value)} items`}
                        onClick={() =>
                          setHiddenOrderStatuses((current) => {
                            const next = new Set(current)
                            if (next.has(item.name)) next.delete(item.name)
                            else next.add(item.name)
                            return next
                          })
                        }
                      >
                        <Flex align="start" gap="2" w="full" minW="0">
                          <Box
                            w="2.5"
                            h="2.5"
                            mt="1"
                            borderRadius="sm"
                            bg={item.color}
                            flexShrink="0"
                            aria-hidden="true"
                          />
                          <Text
                            fontSize="xs"
                            lineHeight="short"
                            overflowWrap="anywhere"
                            minW="0"
                            flex="1"
                            textDecoration={hiddenOrderStatuses.has(item.name) ? 'line-through' : undefined}
                          >
                            {item.name}
                          </Text>
                          <Text fontSize="xs" fontWeight="medium" flexShrink="0">
                            {formatNumber(item.value)}
                          </Text>
                        </Flex>
                      </Button>
                    ))}
                  </Stack>
                </Grid>
              </Card.Body>
            </MotionCard>
          )}
        </Grid>
      )}
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
            {sortedRows.map((row) => (
              <Card.Root key={row.key} variant="subtle">
                <Card.Body gap="3">
                  <Flex justify="space-between" align="start" gap="3">
                    <Flex gap="3" minW="0" align="center">
                      <ProductImage src={row.imageUrl} alt={row.title ?? row.sku ?? 'Product'} />
                      <Box minW="0">
                        <Text fontWeight="semibold" overflowWrap="anywhere">
                          {row.title ?? 'Untitled product'}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                          SKU {row.sku ?? '—'}
                        </Text>
                      </Box>
                    </Flex>
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
                  <SortableColumnHeader label="Order / item" sortKey="orderId" sort={orderSort} onSort={sortOrdersBy} />
                  <SortableColumnHeader label="Date" sortKey="date" sort={orderSort} onSort={sortOrdersBy} />
                  <SortableColumnHeader label="Product / SKU" sortKey="title" sort={orderSort} onSort={sortOrdersBy} />
                  <SortableColumnHeader
                    label="Quantity"
                    sortKey="quantity"
                    sort={orderSort}
                    onSort={sortOrdersBy}
                    textAlign="end"
                  />
                  <SortableColumnHeader
                    label="Selling price"
                    sortKey="price"
                    sort={orderSort}
                    onSort={sortOrdersBy}
                    textAlign="end"
                  />
                  <SortableColumnHeader label="Status" sortKey="status" sort={orderSort} onSort={sortOrdersBy} />
                  <SortableColumnHeader label="DC" sortKey="dc" sort={orderSort} onSort={sortOrdersBy} />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedRows.map((row) => (
                  <Table.Row key={row.key}>
                    <Table.Cell whiteSpace="nowrap">
                      {String(row.orderId)} / {row.itemId === undefined ? '—' : String(row.itemId)}
                    </Table.Cell>
                    <Table.Cell whiteSpace="nowrap">{row.date ? formatReportDate(row.date) : '—'}</Table.Cell>
                    <Table.Cell overflowWrap="anywhere">
                      <Flex gap="2" align="center" minW="0">
                        <ProductImage src={row.imageUrl} alt={row.title ?? row.sku ?? 'Product'} size={9} />
                        <Box minW="0">
                          <Text overflowWrap="anywhere">{row.title ?? '—'}</Text>
                          <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                            SKU {row.sku ?? '—'}
                          </Text>
                        </Box>
                      </Flex>
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
  const [costState, setCostState] = useState<'known' | 'missing' | 'all'>('all')
  const [marginState, setMarginState] = useState<'positive' | 'negative' | 'zero' | 'all'>('all')
  const [sortBy, setSortBy] = useState<TakealotOfferSortBy>('title')
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
      ...(costState !== 'all' ? { costState } : {}),
      marginState,
      sortBy,
      sortOrder,
    }),
    [page, pageSize, search, warehouse, stockState, costState, marginState, sortBy, sortOrder],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'offers-v2', filters)
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotOffers(identity.integrationId, filters, signal),
    [identity.integrationId, requestKey],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const data = resource.data
  const offerRows = data?.items ?? []
  const offerTableSort: TableSort<TakealotOfferSortBy> = { key: sortBy, direction: sortOrder }
  const sortOfferBy = (key: TakealotOfferSortBy) => {
    setSortOrder((current) => (sortBy === key ? (current === 'asc' ? 'desc' : 'asc') : 'asc'))
    setSortBy(key)
    setPage(1)
  }
  const accountSummary = data?.summary
  const activeFilterCount =
    Number(search.trim().length > 0) +
    Number(warehouse !== 'ALL') +
    Number(stockState !== 'all') +
    Number(costState !== 'all') +
    Number(marginState !== 'all')
  const clearFilters = () => {
    setSearch('')
    setWarehouse('ALL')
    setStockState('all')
    setCostState('all')
    setMarginState('all')
    setPage(1)
  }

  if (resource.loading && !data) return <OffersSkeleton />
  if (!data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />

  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <Grid
        templateColumns={{
          base: 'minmax(0, 1fr)',
          sm: 'repeat(2, minmax(0, 1fr))',
          xl: 'minmax(280px, 2fr) repeat(4, minmax(160px, 1fr))',
        }}
        gap="3"
        alignItems="end"
      >
        <Box minW="0">
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
        <DashboardSelect
          value={warehouse}
          onChange={(value) => {
            setWarehouse(value ? (value as typeof warehouse) : 'ALL')
            setPage(1)
          }}
          placeholder="Warehouse filter"
          width="full"
          options={[
            { value: 'ALL', label: 'All warehouses' },
            { value: 'CPT', label: 'Cape Town (CPT)' },
            { value: 'JHB', label: 'Johannesburg (JHB)' },
            { value: 'DBN', label: 'Durban (DBN)' },
          ]}
        />
        <DashboardSelect
          value={stockState}
          onChange={(value) => {
            setStockState((value || 'all') as typeof stockState)
            setPage(1)
          }}
          placeholder="Stock filter"
          width="full"
          options={[
            { value: 'all', label: 'All stock' },
            { value: 'in_stock', label: 'In stock' },
            { value: 'low_stock', label: 'Low stock' },
            { value: 'out_of_stock', label: 'Out of stock' },
          ]}
        />
        <DashboardSelect
          value={costState}
          onChange={(value) => {
            setCostState((value || 'all') as typeof costState)
            setPage(1)
          }}
          placeholder="Cost filter"
          width="full"
          options={[
            { value: 'all', label: 'All costs' },
            { value: 'known', label: 'Cost known' },
            { value: 'missing', label: 'Cost missing' },
          ]}
        />
        <DashboardSelect
          value={marginState}
          onChange={(value) => {
            setMarginState((value || 'all') as typeof marginState)
            setPage(1)
          }}
          placeholder="Margin filter"
          width="full"
          options={[
            { value: 'all', label: 'All margins' },
            { value: 'positive', label: 'Positive' },
            { value: 'negative', label: 'Negative' },
            { value: 'zero', label: 'Zero' },
          ]}
        />
      </Grid>
      <Flex justify="space-between" align="center" gap="3" wrap="wrap">
        <Flex align="center" gap="3" wrap="wrap">
          <Text fontSize="sm" color="fg.muted">
            {activeFilterCount === 0
              ? 'Showing all offers.'
              : `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}.`}{' '}
            Click a column heading to sort all matching offers.
          </Text>
          <Button size="sm" variant="outline" disabled={activeFilterCount === 0} onClick={clearFilters}>
            <RotateCcw size={15} aria-hidden="true" />
            Clear filters
          </Button>
        </Flex>
      </Flex>
      {resource.error && <ErrorPanel message={resource.error} retry={resource.refresh} />}
      {data && (
        <Stack gap="4" minW="0">
          <Card.Root variant="outline" minW="0">
            <Stack display={{ base: 'flex', lg: 'none' }} gap="3" p="4">
              {offerRows.map((offer) => (
                <Card.Root key={offer.offerId} variant="subtle">
                  <Card.Body>
                    <Flex gap="3" align="center">
                      <ProductImage src={offer.imageUrl} alt={offer.title ?? offer.offerId} />
                      <Box minW="0">
                        {offer.offerUrl ? (
                          <a href={offer.offerUrl} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>
                            {offer.title || offer.offerId}
                          </a>
                        ) : (
                          <Text fontWeight="semibold" overflowWrap="anywhere">
                            {offer.title || offer.offerId}
                          </Text>
                        )}
                        <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                          SKU {offer.sku || '—'} · Offer {offer.offerId}
                        </Text>
                      </Box>
                    </Flex>
                    <SimpleGrid columns={2} gap="2" mt="3">
                      <Text fontSize="sm">Status: {offer.status || '—'}</Text>
                      <Text fontSize="sm">
                        Selling: {offer.sellingPrice === null ? '—' : formatCurrency(offer.sellingPrice)}
                      </Text>
                      <Text fontSize="sm">
                        Cost: {offer.costPrice === null ? '—' : formatCurrency(offer.costPrice)}
                      </Text>
                      <Text
                        fontSize="sm"
                        color={
                          offer.potentialGrossProfitPerUnit === null
                            ? 'fg.muted'
                            : offer.potentialGrossProfitPerUnit >= 0
                              ? 'green.fg'
                              : 'fg.error'
                        }
                      >
                        Profit / unit:{' '}
                        {offer.potentialGrossProfitPerUnit === null
                          ? 'Unavailable'
                          : formatCurrency(offer.potentialGrossProfitPerUnit)}
                      </Text>
                    </SimpleGrid>
                    <Flex gap="2" wrap="wrap" mt="3">
                      <WarehouseStockBadges cpt={offer.stockCpt} jhb={offer.stockJhb} dbn={offer.stockDbn} />
                      <Text fontSize="xs" color="fg.muted" alignSelf="center">
                        Incoming: Cape Town {formatNumber(offer.stockOnWayCpt ?? 0)} · Johannesburg{' '}
                        {formatNumber(offer.stockOnWayJhb ?? 0)} · Durban {formatNumber(offer.stockOnWayDbn ?? 0)}
                      </Text>
                    </Flex>
                  </Card.Body>
                </Card.Root>
              ))}
              {data.items.length === 0 && (
                <Text textAlign="center" color="fg.muted">
                  No offers matched these filters.
                </Text>
              )}
            </Stack>
            <Box display={{ base: 'none', lg: 'block' }} minW="0" w="full" overflow="hidden">
              <Table.Root size="sm" variant="line" tableLayout="fixed" w="full">
                <Table.Header>
                  <Table.Row>
                    <SortableColumnHeader
                      label="Offer"
                      sortKey="title"
                      sort={offerTableSort}
                      onSort={sortOfferBy}
                      width="30%"
                    />
                    <SortableColumnHeader
                      label="Status"
                      sortKey="status"
                      sort={offerTableSort}
                      onSort={sortOfferBy}
                      width="11%"
                    />
                    <SortableColumnHeader
                      label="Selling price"
                      sortKey="sellingPrice"
                      sort={offerTableSort}
                      onSort={sortOfferBy}
                      textAlign="end"
                      width="12%"
                    />
                    <SortableColumnHeader
                      label="Cost"
                      sortKey="costPrice"
                      sort={offerTableSort}
                      onSort={sortOfferBy}
                      textAlign="end"
                      width="11%"
                    />
                    <SortableColumnHeader
                      label="Profit / unit"
                      sortKey="potentialGrossProfitPerUnit"
                      sort={offerTableSort}
                      onSort={sortOfferBy}
                      textAlign="end"
                      width="16%"
                    />
                    <SortableColumnHeader
                      label="Warehouse stock"
                      sortKey="totalStock"
                      sort={offerTableSort}
                      onSort={sortOfferBy}
                      textAlign="end"
                      width="20%"
                    />
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {offerRows.map((offer) => (
                    <Table.Row key={offer.offerId}>
                      <Table.Cell overflowWrap="anywhere">
                        {offer.offerUrl ? (
                          <a
                            href={offer.offerUrl}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontWeight: 500, color: 'var(--chakra-colors-blue-600)' }}
                          >
                            <Flex align="center" gap="2" minW="0">
                              <ProductImage src={offer.imageUrl} alt={offer.title ?? offer.offerId} size={9} />
                              <Text overflowWrap="anywhere">{offer.title || offer.offerId}</Text>
                            </Flex>
                          </a>
                        ) : (
                          <Flex align="center" gap="2" minW="0">
                            <ProductImage src={offer.imageUrl} alt={offer.title ?? offer.offerId} size={9} />
                            <Text fontWeight="medium" overflowWrap="anywhere">
                              {offer.title || offer.offerId}
                            </Text>
                          </Flex>
                        )}
                        <Text fontSize="xs" color="fg.muted">
                          SKU {offer.sku || '—'}
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
                        {offer.potentialGrossProfitPerUnit === null ? (
                          'Unavailable'
                        ) : (
                          <Text color={offer.potentialGrossProfitPerUnit >= 0 ? 'green.fg' : 'fg.error'}>
                            {formatCurrency(offer.potentialGrossProfitPerUnit)}
                          </Text>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        <WarehouseStockBadges cpt={offer.stockCpt} jhb={offer.stockJhb} dbn={offer.stockDbn} />
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
          {accountSummary && accountSummary.totalOffers > 0 && (
            <Card.Root variant="outline" minW="0" w="full">
              <Card.Header pb="2">
                <Card.Title>Account-wide potential inventory value</Card.Title>
                <Text fontSize="xs" color="fg.muted">
                  All synchronized offers · {formatNumber(accountSummary.totalOffers)} offers
                </Text>
              </Card.Header>
              <Card.Body pt="0">
                <Grid
                  templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' }}
                  alignItems="center"
                  gap="4"
                >
                  <Stack gap="3" minW="0">
                    <SimpleGrid columns={{ base: 2, sm: 4 }} gap="2">
                      <Box p="2" borderRadius="md" bg="green.subtle">
                        <Text fontSize="xs" color="fg.muted">
                          Above cost
                        </Text>
                        <Text fontWeight="semibold" color="green.fg">
                          {formatNumber(accountSummary.positiveProfitOffers)}
                        </Text>
                      </Box>
                      <Box p="2" borderRadius="md" bg="red.subtle">
                        <Text fontSize="xs" color="fg.muted">
                          Below cost
                        </Text>
                        <Text fontWeight="semibold" color="fg.error">
                          {formatNumber(accountSummary.negativeProfitOffers)}
                        </Text>
                      </Box>
                      <Box p="2" borderRadius="md" bg="bg.subtle">
                        <Text fontSize="xs" color="fg.muted">
                          Break-even
                        </Text>
                        <Text fontWeight="semibold">{formatNumber(accountSummary.breakEvenOffers)}</Text>
                      </Box>
                      <Box p="2" borderRadius="md" bg="bg.subtle">
                        <Text fontSize="xs" color="fg.muted">
                          Unavailable
                        </Text>
                        <Text fontWeight="semibold">{formatNumber(accountSummary.unavailableProfitOffers)}</Text>
                      </Box>
                    </SimpleGrid>
                    <Text fontSize="xs" color="fg.muted">
                      Profit counts compare selling price with unit cost before Takealot fees. The values below estimate
                      all synchronized stock, not realized sales profit.
                    </Text>
                    <SimpleGrid columns={{ base: 1, sm: 3 }} gap="3">
                      <Box>
                        <Text fontSize="xs" color="fg.muted">
                          Potential retail value
                        </Text>
                        <Text fontWeight="medium">{formatCurrency(accountSummary.potentialRetailValue)}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="fg.muted">
                          Inventory cost value
                        </Text>
                        <Text fontWeight="medium">{formatCurrency(accountSummary.inventoryCostValue)}</Text>
                      </Box>
                      <Box>
                        <Text fontSize="xs" color="fg.muted">
                          Potential gross profit
                        </Text>
                        <Text
                          fontWeight="semibold"
                          color={accountSummary.potentialGrossProfitOnCurrentStock >= 0 ? 'green.fg' : 'fg.error'}
                        >
                          {formatCurrency(accountSummary.potentialGrossProfitOnCurrentStock)}
                        </Text>
                      </Box>
                    </SimpleGrid>
                    <Text fontSize="xs" color="fg.muted">
                      Stock: Cape Town {formatNumber(accountSummary.stockByWarehouse.capeTown)} · Johannesburg{' '}
                      {formatNumber(accountSummary.stockByWarehouse.johannesburg)} · Durban{' '}
                      {formatNumber(accountSummary.stockByWarehouse.durban)}
                    </Text>
                  </Stack>
                  <EChart
                    option={donutOption([
                      { name: 'Above cost', value: accountSummary.positiveProfitOffers, color: '#16a34a' },
                      { name: 'Below cost', value: accountSummary.negativeProfitOffers, color: '#dc2626' },
                      { name: 'Break-even', value: accountSummary.breakEvenOffers, color: '#64748b' },
                      { name: 'Unavailable', value: accountSummary.unavailableProfitOffers, color: '#f59e0b' },
                    ])}
                    height="220px"
                    ariaLabel="Account-wide profit mix across all synchronized offers"
                  />
                </Grid>
              </Card.Body>
            </Card.Root>
          )}
        </Stack>
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
  const [alertSort, setAlertSort] = useState<TableSort<TakealotAlertSortBy>>({
    key: 'severity',
    direction: 'desc',
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const filters = useMemo(
    () => ({
      page,
      pageSize,
      ...(severity ? { severity } : {}),
      warehouse,
      sortBy: alertSort.key,
      sortOrder: alertSort.direction,
    }),
    [page, pageSize, severity, warehouse, alertSort],
  )
  const requestKey = JSON.stringify(filters)
  const key = cacheKey(identity, 'alerts-v2', filters)
  const fetcher = useCallback(
    (signal: AbortSignal) => getTakealotAlerts(identity.integrationId, filters, signal),
    [identity.integrationId, requestKey],
  )
  const resource = useCachedResource(enabled, key, fetcher, refreshToken, onMeta)
  const data = resource.data
  const sortedAlerts = data?.items ?? []
  const alertSeverityBreakdown = data
    ? [
        { name: 'Critical', count: data.summary.critical, color: '#991b1b', background: 'red.subtle' },
        { name: 'High', count: data.summary.high, color: '#dc2626', background: 'orange.subtle' },
        { name: 'Medium', count: data.summary.medium, color: '#f97316', background: 'yellow.subtle' },
        { name: 'Low', count: data.summary.low, color: '#64748b', background: 'bg.subtle' },
      ]
    : []
  const sortAlertsBy = (key: TakealotAlertSortBy) => {
    setAlertSort((current) => toggleTableSort(current, key))
    setPage(1)
  }
  if (resource.loading && !data) return <AlertsSkeleton />
  if (!data && resource.error) return <ErrorPanel message={resource.error} retry={resource.refresh} />

  return (
    <Stack gap="4">
      <ResourceNotice resource={resource} retry={resource.refresh} />
      <Flex gap="3" wrap="wrap" align="end">
        <DashboardSelect
          value={severity}
          onChange={(value) => {
            setSeverity(value as typeof severity)
            setPage(1)
          }}
          placeholder="Alert severity"
          width="170px"
          options={[
            { value: '', label: 'All severities' },
            { value: 'critical', label: 'Critical' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />
        <DashboardSelect
          value={warehouse}
          onChange={(value) => {
            setWarehouse(value ? (value as typeof warehouse) : 'ALL')
            setPage(1)
          }}
          placeholder="Alert warehouse"
          width="150px"
          options={[
            { value: 'ALL', label: 'All warehouses' },
            { value: 'CPT', label: 'Cape Town (CPT)' },
            { value: 'JHB', label: 'Johannesburg (JHB)' },
            { value: 'DBN', label: 'Durban (DBN)' },
          ]}
        />
        {data?.isStale && <Badge colorPalette="orange">Offer data is stale</Badge>}
      </Flex>
      {resource.error && <ErrorPanel message={resource.error} retry={resource.refresh} />}
      {data && (
        <Card.Root variant="outline">
          <Stack display={{ base: 'flex', lg: 'none' }} gap="3" p="4">
            {sortedAlerts.map((alert, index) => (
              <Card.Root key={`${alert.offerId}-${alert.type}-${alert.warehouse ?? 'all'}-${index}`} variant="subtle">
                <Card.Body gap="3">
                  <Flex align="center" gap="3">
                    <ProductImage src={alert.imageUrl} alt={alert.title ?? alert.offerId} />
                    <Box minW="0">
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
                      <Text fontWeight="semibold" mt="1" overflowWrap="anywhere">
                        {alert.title || alert.offerId}
                      </Text>
                      <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                        {alert.sku || 'SKU unavailable'}
                      </Text>
                    </Box>
                  </Flex>
                  <Text fontSize="sm">
                    {alert.type.replaceAll('_', ' ')} · {alert.message}
                  </Text>
                  <SimpleGrid columns={2} gap="2">
                    <Text fontSize="sm">Warehouse: {alert.warehouse || '—'}</Text>
                    <Text fontSize="sm">Quantity: {alert.quantity === null ? '—' : formatNumber(alert.quantity)}</Text>
                    <Text fontSize="sm">
                      Selling price: {alert.sellingPrice === null ? '—' : formatCurrency(alert.sellingPrice)}
                    </Text>
                    <Text fontSize="sm">Cost: {alert.costPrice === null ? '—' : formatCurrency(alert.costPrice)}</Text>
                  </SimpleGrid>
                </Card.Body>
              </Card.Root>
            ))}
            {sortedAlerts.length === 0 && (
              <Text textAlign="center" color="fg.muted">
                No alerts match these filters.
              </Text>
            )}
          </Stack>
          <Box display={{ base: 'none', lg: 'block' }} minW="0" w="full" overflow="hidden">
            <Table.Root size="sm" variant="line" tableLayout="fixed" w="full">
              <Table.Header>
                <Table.Row>
                  <SortableColumnHeader
                    label="Product / SKU"
                    sortKey="title"
                    sort={alertSort}
                    onSort={sortAlertsBy}
                    width="36%"
                  />
                  <SortableColumnHeader
                    label="Severity"
                    sortKey="severity"
                    sort={alertSort}
                    onSort={sortAlertsBy}
                    width="10%"
                  />
                  <SortableColumnHeader
                    label="Alert"
                    sortKey="type"
                    sort={alertSort}
                    onSort={sortAlertsBy}
                    width="25%"
                  />
                  <SortableColumnHeader
                    label="Warehouse"
                    sortKey="warehouse"
                    sort={alertSort}
                    onSort={sortAlertsBy}
                    width="11%"
                  />
                  <SortableColumnHeader
                    label="Quantity"
                    sortKey="quantity"
                    sort={alertSort}
                    onSort={sortAlertsBy}
                    textAlign="end"
                    width="9%"
                  />
                  <SortableColumnHeader
                    label="Selling price"
                    sortKey="sellingPrice"
                    sort={alertSort}
                    onSort={sortAlertsBy}
                    textAlign="end"
                    width="9%"
                  />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedAlerts.map((alert, index) => (
                  <Table.Row key={`${alert.offerId}-${alert.type}-${alert.warehouse ?? 'all'}-${index}`}>
                    <Table.Cell>
                      <Flex align="center" gap="2" minW="0">
                        <ProductImage src={alert.imageUrl} alt={alert.title ?? alert.offerId} size={9} />
                        <Box minW="0">
                          <Text overflowWrap="anywhere">{alert.title || alert.offerId}</Text>
                          <Text fontSize="xs" color="fg.muted" overflowWrap="anywhere">
                            {alert.sku || 'SKU unavailable'}
                          </Text>
                        </Box>
                      </Flex>
                    </Table.Cell>
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
      {data && data.summary.total > 0 && (
        <Card.Root variant="outline" minW="0" w="full">
          <Card.Header pb="2">
            <Card.Title>Alert severity overview</Card.Title>
            <Text fontSize="xs" color="fg.muted">
              {formatNumber(data.summary.total)} matching alerts · current filters · all pages
            </Text>
          </Card.Header>
          <Card.Body pt="0">
            <Grid templateColumns={{ base: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 320px' }} alignItems="center" gap="4">
              <Stack gap="3" minW="0">
                <SimpleGrid columns={{ base: 2, sm: 4 }} gap="2">
                  {alertSeverityBreakdown.map((item) => {
                    const percentage = (item.count / data.summary.total) * 100
                    return (
                      <Box key={item.name} p="2" borderRadius="md" bg={item.background}>
                        <Text fontSize="xs" color="fg.muted">
                          {item.name}
                        </Text>
                        <Text fontWeight="semibold" color={item.color}>
                          {formatNumber(item.count)}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                          {percentage.toFixed(1)}% of matches
                        </Text>
                      </Box>
                    )
                  })}
                </SimpleGrid>
                <Text fontSize="xs" color="fg.muted">
                  Critical indicates an immediate stock issue; high flags urgent pricing or stock risk; medium covers
                  product, listing, and inventory issues; low covers review and informational notices. Counts are
                  calculated server-side from the current filters; percentages are each severity count divided by the
                  matching-alert total. Pagination and sort order do not change this breakdown.
                </Text>
              </Stack>
              <EChart
                option={donutOption(
                  alertSeverityBreakdown.map((item) => ({
                    name: item.name,
                    value: item.count,
                    color: item.color,
                  })),
                )}
                height="220px"
                ariaLabel="Server-calculated alert severity distribution across all alerts matching the active filters"
              />
            </Grid>
          </Card.Body>
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
  const [warehouseSort, setWarehouseSort] = useState<TableSort<TakealotWarehouseSortBy>>({
    key: 'stockUnits',
    direction: 'desc',
  })
  const warehouseFilters = useMemo(
    () => ({ sortBy: warehouseSort.key, sortOrder: warehouseSort.direction }),
    [warehouseSort],
  )
  const warehouseKey = cacheKey(identity, 'warehouse-analytics', warehouseFilters)
  const getSummary = useCallback(
    (signal: AbortSignal) => getTakealotInventorySummary(identity.integrationId, signal),
    [identity.integrationId],
  )
  const getWarehouseAnalytics = useCallback(
    (signal: AbortSignal) => getTakealotInventoryAnalytics(identity.integrationId, warehouseFilters, signal),
    [identity.integrationId, warehouseFilters],
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
  const warehouses = warehouseAnalytics.data?.warehouses ?? []
  const sortedWarehouses = warehouses
  const sortWarehousesBy = (key: TakealotWarehouseSortBy) => {
    setWarehouseSort((current) => toggleTableSort(current, key))
  }
  const chart: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', valueFormatter: (value) => formatNumber(Number(value)) },
      legend: { data: ['Total stock units', 'Unbalanced stock'], bottom: 0 },
      grid: { left: 70, right: 24, top: 24, bottom: 60 },
      xAxis: {
        type: 'category',
        data: inventoryPoints.map((point) => point.date),
        axisLabel: { formatter: (value: string) => dateLabel(value) },
      },
      yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
      series: [
        {
          name: 'Total stock units',
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
  const stockByWarehouseChart: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0 },
      grid: { left: 68, right: 20, top: 24, bottom: 55 },
      xAxis: {
        type: 'category',
        data: warehouses.map((warehouse) => warehouseLabel(warehouse.warehouse)),
        axisLabel: { interval: 0, rotate: 20 },
      },
      yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatNumber(Number(value)) } },
      series: [
        { name: 'In stock', type: 'bar', data: warehouses.map((warehouse) => warehouse.stockUnits) },
        { name: 'Incoming', type: 'bar', data: warehouses.map((warehouse) => warehouse.incomingUnits) },
      ],
    }),
    [warehouses],
  )

  if (enabled && summary.loading && !summary.data && !fallback) return <StockSkeleton />
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
          label="Total stock units"
          value={total === undefined ? undefined : formatNumber(total)}
          detail={
            stockCounts?.total_stock_count_source === 'synchronized_offers'
              ? 'Sum of available CPT, JHB, and DBN units from synchronized Takealot offers.'
              : 'Total stock count reported by Takealot.'
          }
          icon={Package}
        />
        <MetricCard
          label="Unbalanced stock"
          value={unbalanced === undefined ? undefined : formatNumber(unbalanced)}
          detail="Offers with stock distribution flagged as unbalanced by Takealot."
          icon={Activity}
        />
        <MetricCard
          label="Storage-fee-enabled offers"
          value={fees === undefined ? undefined : formatNumber(fees)}
          detail="Offers currently marked as subject to storage fees."
          icon={ReceiptText}
        />
        <MetricCard
          label="Recommended for replenishment"
          value={replenishment === undefined ? undefined : formatNumber(replenishment)}
          detail="Offers Takealot recommends replenishing."
          icon={Warehouse}
        />
      </SimpleGrid>
      {warehouseAnalytics.data && (
        <Card.Root variant="outline">
          <Card.Header>
            <Flex align="center" gap="2">
              <Warehouse size={17} aria-hidden="true" />
              <Heading size="sm">Warehouse inventory</Heading>
            </Flex>
            <Text fontSize="sm" color="fg.muted">
              Current inventory values derived from synchronized offers; values are potential, not realized sales.
            </Text>
          </Card.Header>
          <Stack display={{ base: 'flex', lg: 'none' }} gap="3" px="4">
            {sortedWarehouses.map((warehouse) => (
              <Card.Root key={warehouse.warehouse} variant="subtle">
                <Card.Body>
                  <Text fontWeight="semibold">{warehouseLabel(warehouse.warehouse)}</Text>
                  <SimpleGrid columns={2} gap="2" mt="2">
                    <Text fontSize="sm">Stock: {formatNumber(warehouse.stockUnits)}</Text>
                    <Text fontSize="sm">Incoming: {formatNumber(warehouse.incomingUnits)}</Text>
                    <Text fontSize="sm">
                      Reported sales:{' '}
                      {warehouse.reportedSalesUnits === undefined ? '—' : formatNumber(warehouse.reportedSalesUnits)}
                    </Text>
                    <Text fontSize="sm">Inventory cost: {formatCurrency(warehouse.inventoryCostValue)}</Text>
                    <Text fontSize="sm">Potential retail: {formatCurrency(warehouse.potentialRetailValue)}</Text>
                    <Text fontSize="sm" color={warehouse.potentialGrossProfit >= 0 ? 'green.fg' : 'fg.error'}>
                      Potential profit: {formatCurrency(warehouse.potentialGrossProfit)}
                    </Text>
                  </SimpleGrid>
                </Card.Body>
              </Card.Root>
            ))}
          </Stack>
          <Box display={{ base: 'none', lg: 'block' }} minW="0" w="full" overflow="hidden">
            <Table.Root size="sm" variant="line" tableLayout="fixed" w="full">
              <Table.Header>
                <Table.Row>
                  <SortableColumnHeader
                    label="Warehouse"
                    sortKey="warehouse"
                    sort={warehouseSort}
                    onSort={sortWarehousesBy}
                  />
                  <SortableColumnHeader
                    label="Stock units"
                    sortKey="stockUnits"
                    sort={warehouseSort}
                    onSort={sortWarehousesBy}
                    textAlign="end"
                  />
                  <SortableColumnHeader
                    label="Incoming units"
                    sortKey="incomingUnits"
                    sort={warehouseSort}
                    onSort={sortWarehousesBy}
                    textAlign="end"
                  />
                  <SortableColumnHeader
                    label="Reported sales units"
                    sortKey="reportedSalesUnits"
                    sort={warehouseSort}
                    onSort={sortWarehousesBy}
                    textAlign="end"
                  />
                  <SortableColumnHeader
                    label="Inventory cost"
                    sortKey="inventoryCostValue"
                    sort={warehouseSort}
                    onSort={sortWarehousesBy}
                    textAlign="end"
                  />
                  <SortableColumnHeader
                    label="Potential retail value"
                    sortKey="potentialRetailValue"
                    sort={warehouseSort}
                    onSort={sortWarehousesBy}
                    textAlign="end"
                  />
                  <SortableColumnHeader
                    label="Potential gross profit"
                    sortKey="potentialGrossProfit"
                    sort={warehouseSort}
                    onSort={sortWarehousesBy}
                    textAlign="end"
                  />
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {sortedWarehouses.map((warehouse) => (
                  <Table.Row key={warehouse.warehouse}>
                    <Table.Cell>{warehouseLabel(warehouse.warehouse)}</Table.Cell>
                    <Table.Cell textAlign="end">{formatNumber(warehouse.stockUnits)}</Table.Cell>
                    <Table.Cell textAlign="end">{formatNumber(warehouse.incomingUnits)}</Table.Cell>
                    <Table.Cell textAlign="end">
                      {warehouse.reportedSalesUnits === undefined ? '—' : formatNumber(warehouse.reportedSalesUnits)}
                    </Table.Cell>
                    <Table.Cell textAlign="end">{formatCurrency(warehouse.inventoryCostValue)}</Table.Cell>
                    <Table.Cell textAlign="end">{formatCurrency(warehouse.potentialRetailValue)}</Table.Cell>
                    <Table.Cell textAlign="end">
                      <Text color={warehouse.potentialGrossProfit >= 0 ? 'green.fg' : 'fg.error'}>
                        {formatCurrency(warehouse.potentialGrossProfit)}
                      </Text>
                    </Table.Cell>
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
      {warehouses.length > 0 && (
        <ChartCard
          title="Stock and incoming units by warehouse"
          description="Current synchronized units held by Takealot versus units on the way."
          option={stockByWarehouseChart}
          icon={ChartNoAxesCombined}
        />
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
        <ChartSkeletonCard height="320px" />
      ) : null}
    </Stack>
  )
}

export function TakealotDashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const reducedMotion = useReducedMotion()
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
    return () => {
      window.removeEventListener('pos-company-updated', reloadIntegrations)
      window.removeEventListener('pos-integrations-updated', reloadIntegrations)
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
  const sectionUsesDateRange = ['analytics', 'products', 'orders', 'stock'].includes(activeSection)
  const sectionUsesGranularity = activeSection === 'analytics' || activeSection === 'stock'
  return (
    <PageContainer className="takealot-dashboard-page">
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
        <IntegrationSkeletons />
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
              <DashboardSelect
                value={identity.integrationId}
                onChange={selectIntegration}
                placeholder="Choose a connection"
                width="320px"
                options={integrations.map((integration) => ({ value: integration.id, label: integration.name }))}
              />
            </Stack>
          </Card.Body>
        </Card.Root>
      ) : (
        <Stack gap="5">
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

          <Stack gap="2">
            <Flex gap="3" wrap="wrap" align="center">
              {integrations.length > 1 ? (
                <DashboardSelect
                  value={identity.integrationId}
                  onChange={selectIntegration}
                  placeholder="Takealot connection"
                  width="240px"
                  options={integrations.map((integration) => ({ value: integration.id, label: integration.name }))}
                />
              ) : (
                <Badge colorPalette="blue" variant="subtle">
                  {integrations[0]?.name ?? 'Takealot connection'}
                </Badge>
              )}
              {sectionUsesDateRange && <TakealotDateRangePicker value={range} onApply={setRange} />}
              {sectionUsesGranularity && (
                <DashboardSelect
                  value={granularity}
                  onChange={(value) => setGranularity(value as Granularity)}
                  placeholder="Chart granularity"
                  width="140px"
                  options={[
                    { value: 'day', label: 'Day' },
                    { value: 'week', label: 'Week' },
                    { value: 'month', label: 'Month' },
                  ]}
                />
              )}
            </Flex>
            {sectionUsesDateRange && (
              <Text fontSize="xs" color="fg.muted">
                Date range applies to this section. Offer and alert sections use the latest synchronized data.
              </Text>
            )}
          </Stack>

          <Box role="tabpanel" id={`takealot-panel-${activeSection}`} aria-labelledby={`takealot-tab-${activeSection}`}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeSection}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' }}
                style={{ minWidth: 0 }}
              >
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
              </motion.div>
            </AnimatePresence>
          </Box>
        </Stack>
      )}
    </PageContainer>
  )
}
