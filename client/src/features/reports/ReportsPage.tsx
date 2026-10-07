import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  Activity,
  BarChart3,
  CalendarDays,
  CreditCard,
  Download,
  FileText,
  Image as ImageIcon,
  Mail,
  MessageCircle,
  Package,
  ReceiptText,
  RefreshCw,
  Share2,
  ShoppingCart,
  Tag,
  Trophy,
  WalletCards,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { showSuccess, showError } from '@/components/feedback/notifications'
import {
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Heading,
  Image,
  Input,
  Menu,
  NativeSelect,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
} from '@chakra-ui/react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { EChart } from '@/components/charts/EChart'
import {
  exportInventoryReport,
  exportProfitLossReport,
  exportSalesReport,
  getInventoryCustomerReport,
  getLowStockItems,
  getProfitLossReport,
  getProfitableProducts,
  getRecentCustomers,
  getRecentExpenses,
  getSalesReport,
  getSalesTransactions,
  getTopCustomers,
  type Metric,
  type ReportFilters,
} from '@/api/endpoints/reports'
import { formatCurrency, formatNumber, formatReportDate } from '@/lib/formatters'
import type { EChartsOption } from 'echarts'

type ReportKind = 'sales' | 'profit-loss' | 'inventory-customer'
type DateRange = { from: string; to: string }

const iso = (date: Date) => date.toISOString().slice(0, 10)
const initialRange = (): DateRange => {
  const to = new Date()
  const from = new Date(to)
  from.setDate(to.getDate() - 29)
  return { from: iso(from), to: iso(to) }
}
const money = formatCurrency
const formatDate = formatReportDate
const MotionCard = motion.create(Card.Root)
const chartDate = (value: string) => formatReportDate(value)
const chartDateTime = (value: string) =>
  value.includes('T')
    ? `${formatReportDate(value)} ${new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : formatReportDate(value)
const currencyAxis = { formatter: (value: number) => money(Number(value)) }
const numberAxis = { formatter: (value: number) => formatNumber(Number(value)) }
const percentAxis = { formatter: (value: number) => `${Number(value).toFixed(1)}%` }

function MetricCard({
  label,
  metric,
  value,
  icon: Icon = BarChart3,
  detail,
}: {
  label: string
  metric?: Metric
  value?: string
  icon?: LucideIcon
  detail?: string
}) {
  const change = metric?.changePercent
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
          <Text color="fg.muted" fontSize="sm">
            {label}
          </Text>
          <Icon size={18} aria-hidden="true" />
        </Flex>
        <Heading size="lg" mt="2">
          {value ?? money(metric?.value ?? 0)}
        </Heading>
        {detail && (
          <Text fontSize="xs" color="fg.muted" mt="1">
            {detail}
          </Text>
        )}
        {metric && (
          <Badge
            mt="2"
            colorPalette={metric.direction === 'down' ? 'red' : metric.direction === 'up' ? 'green' : 'gray'}
            variant="subtle"
          >
            {change == null
              ? `Previous: ${money(metric.previousValue)}`
              : `${change >= 0 ? '+' : ''}${change}% vs prior`}
          </Badge>
        )}
      </Card.Body>
    </MotionCard>
  )
}

function ReportFilters({
  range,
  onChange,
  onRefresh,
  loading,
  granularity,
  onGranularityChange,
  onExport,
  exportName = 'sales-report.csv',
  onExportPdf,
  onExportHtml,
  onShare,
}: {
  range: DateRange
  onChange: (range: DateRange) => void
  onRefresh: () => void
  loading: boolean
  granularity: ReportFilters['granularity']
  onGranularityChange: (value: ReportFilters['granularity']) => void
  onExport?: () => Promise<Blob>
  exportName?: string
  onExportPdf: () => Promise<void>
  onExportHtml: () => Promise<void>
  onShare: (format: 'csv' | 'pdf', channel: 'whatsapp' | 'email') => Promise<void>
}) {
  const download = async () => {
    if (!onExport) return
    try {
      const blob = await onExport()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = exportName
      link.click()
      URL.revokeObjectURL(url)
      showSuccess('CSV Exported', `Report ${exportName} downloaded.`)
    } catch (cause) {
      showError('Export failed', cause)
    }
  }
  return (
    <Flex gap="3" wrap="wrap" align="end" mb="6" data-export-ignore="true">
      <Box>
        <Flex align="center" gap="1" mb="1">
          <CalendarDays size={14} />
          <Text fontSize="sm">From</Text>
        </Flex>
        <Input
          aria-label="From date"
          type="date"
          size="sm"
          value={range.from}
          onChange={(event) => onChange({ ...range, from: event.target.value })}
        />
      </Box>
      <Box>
        <Flex align="center" gap="1" mb="1">
          <CalendarDays size={14} />
          <Text fontSize="sm">To</Text>
        </Flex>
        <Input
          aria-label="To date"
          type="date"
          size="sm"
          value={range.to}
          onChange={(event) => onChange({ ...range, to: event.target.value })}
        />
      </Box>
      <Box>
        <Flex align="center" gap="1" mb="1">
          <BarChart3 size={14} />
          <Text fontSize="sm">Granularity</Text>
        </Flex>
        <NativeSelect.Root size="sm">
          <NativeSelect.Field
            value={granularity}
            onChange={(event) => onGranularityChange(event.target.value as ReportFilters['granularity'])}
          >
            <option value="DAY">Day</option>
            <option value="WEEK">Week</option>
            <option value="MONTH">Month</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Box>
      <Button size="sm" variant="outline" onClick={onRefresh} loading={loading}>
        <RefreshCw size={15} />
        Refresh
      </Button>
      {onExport && (
        <Menu.Root positioning={{ placement: 'bottom-end' }}>
          <Menu.Trigger asChild>
            <Button size="sm" variant="outline">
              <Download size={15} />
              Download
            </Button>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.Item value="csv" onClick={download}>
                <Download size={15} />
                CSV
              </Menu.Item>
              <Menu.Item value="pdf" onClick={onExportPdf}>
                <FileText size={15} />
                PDF
              </Menu.Item>
              <Menu.Item value="html" onClick={onExportHtml}>
                <FileText size={15} />
                HTML
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      )}
      {onExport && (
        <Menu.Root positioning={{ placement: 'bottom-end' }}>
          <Menu.Trigger asChild>
            <Button size="sm" variant="outline">
              <Share2 size={15} />
              Share
            </Button>
          </Menu.Trigger>
          <Menu.Positioner>
            <Menu.Content>
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>PDF</Menu.ItemGroupLabel>
                <Menu.Item value="pdf-whatsapp" onClick={() => onShare('pdf', 'whatsapp')}>
                  <MessageCircle size={15} />
                  WhatsApp
                </Menu.Item>
                <Menu.Item value="pdf-email" onClick={() => onShare('pdf', 'email')}>
                  <Mail size={15} />
                  Email
                </Menu.Item>
              </Menu.ItemGroup>
              <Menu.Separator />
              <Menu.ItemGroup>
                <Menu.ItemGroupLabel>CSV</Menu.ItemGroupLabel>
                <Menu.Item value="csv-whatsapp" onClick={() => onShare('csv', 'whatsapp')}>
                  <MessageCircle size={15} />
                  WhatsApp
                </Menu.Item>
                <Menu.Item value="csv-email" onClick={() => onShare('csv', 'email')}>
                  <Mail size={15} />
                  Email
                </Menu.Item>
              </Menu.ItemGroup>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
      )}
    </Flex>
  )
}

function ChartCard({
  title,
  description,
  option,
  height = '280px',
  icon: Icon = BarChart3,
  gridColumn,
}: {
  title: string
  description?: string
  option: EChartsOption
  height?: string
  icon?: LucideIcon
  gridColumn?: string | Record<string, string>
}) {
  return (
    <MotionCard
      variant="outline"
      gridColumn={gridColumn}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
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

function LoadingGrid() {
  return (
    <Stack gap="4">
      <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} gap="4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} h="120px" borderRadius="md" />
        ))}
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
        <Skeleton h="340px" />
        <Skeleton h="340px" />
      </SimpleGrid>
    </Stack>
  )
}

function ErrorPanel({ message, retry }: { message: string; retry: () => void }) {
  return (
    <Card.Root variant="outline">
      <Card.Body>
        <Text color="fg.error">{message}</Text>
        <Button mt="3" size="sm" onClick={retry}>
          Retry
        </Button>
      </Card.Body>
    </Card.Root>
  )
}

function SalesReport({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getSalesReport>>>()
  const [transactions, setTransactions] = useState<Awaited<ReturnType<typeof getSalesTransactions>>>()
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<'total' | 'date'>('date')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([getSalesReport(filters), getSalesTransactions({ ...filters, page, limit: 8 })])
      .then(([sales, rows]) => {
        setData(sales)
        setTransactions(rows)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Sales report could not be loaded.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [filters.from, filters.to, filters.granularity, page])
  const trend: EChartsOption = useMemo(
    () => ({
      legend: { data: ['Sales', 'Orders', 'AOV'] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        formatter: (params) => {
          const items = Array.isArray(params) ? params : [params]
          const index = items[0]?.dataIndex ?? 0
          const period = data?.trend[index]?.period
          return `${period ? chartDateTime(period) : ''}<br/>${items.map((item) => `${item.marker ?? ''}${item.seriesName}: ${item.seriesName === 'Orders' ? formatNumber(Number(item.value)) : money(Number(item.value))}`).join('<br/>')}`
        },
      },
      xAxis: { type: 'category', name: 'Period', data: data?.trend.map((item) => chartDate(item.period)) ?? [] },
      yAxis: [
        { type: 'value', name: 'Sales', axisLabel: currencyAxis },
        { type: 'value', name: 'Orders', position: 'right', axisLabel: numberAxis },
      ],
      series: [
        { name: 'Sales', type: 'line', smooth: true, areaStyle: {}, data: data?.trend.map((item) => item.sales) ?? [] },
        {
          name: 'Orders',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: data?.trend.map((item) => item.orders) ?? [],
        },
        { name: 'AOV', type: 'line', smooth: true, data: data?.trend.map((item) => item.averageOrderValue) ?? [] },
      ],
    }),
    [data],
  )
  const categories: EChartsOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          return `${item.name}<br/>${money(Number(item.value))} (${(Number(item.percent) || 0).toFixed(1)}%)`
        },
      },
      legend: { orient: 'horizontal', bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          data: data?.byCategory.map((item) => ({ name: item.categoryName, value: item.sales })) ?? [],
        },
      ],
    }),
    [data],
  )
  const payments: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value) => money(Number(value)) },
      xAxis: { type: 'category', data: data?.byPaymentMethod.map((item) => item.paymentMethod) ?? [] },
      yAxis: { type: 'value', name: 'Amount', axisLabel: currencyAxis },
      series: [{ name: 'Payment amount', type: 'bar', data: data?.byPaymentMethod.map((item) => item.amount) ?? [] }],
    }),
    [data],
  )
  const activity: EChartsOption = useMemo(
    () => ({
      tooltip: {
        position: 'top',
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          const values = Array.isArray(item.value) ? item.value : []
          return `${values[1] ?? ''} ${values[0] ?? ''}<br/>Sales: ${money(Number(values[2] ?? 0))}`
        },
      },
      visualMap: {
        min: 0,
        max: Math.max(...(data?.salesActivity.map((item) => item.salesAmount) ?? [1])),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        text: ['High', 'Low'],
      },
      xAxis: { type: 'category', name: 'Hour', data: Array.from({ length: 24 }, (_, hour) => `${hour}:00`) },
      yAxis: { type: 'category', name: 'Day', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      series: [
        {
          type: 'heatmap',
          data: (data?.salesActivity ?? []).map((item) => [`${item.hour}:00`, item.dayOfWeek, item.salesAmount]),
          label: { show: false },
        },
      ],
    }),
    [data],
  )
  const performance: EChartsOption = useMemo(
    () => ({
      legend: { data: ['Products'] },
      tooltip: {
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          const row = data?.productPerformance[item.dataIndex ?? 0]
          return row
            ? `${row.product}<br/>Units: ${formatNumber(row.unitsSold)}<br/>Revenue: ${money(row.revenue)}<br/>Cost: ${money(row.cost)}<br/>Profit: ${money(row.profit)}`
            : ''
        },
      },
      xAxis: { name: 'Units sold', type: 'value', axisLabel: numberAxis },
      yAxis: { name: 'Revenue', type: 'value', axisLabel: currencyAxis },
      series: [
        {
          name: 'Products',
          type: 'scatter',
          symbolSize: (value: number[]) => Math.max(10, Math.sqrt(value[2]) / 2),
          data: (data?.productPerformance ?? []).map((item) => [
            item.unitsSold,
            item.revenue,
            Math.max(0, item.profit),
          ]),
        },
      ],
    }),
    [data],
  )
  if (loading && !data) return <LoadingGrid />
  if (error && !data) return <ErrorPanel message={error} retry={load} />
  return (
    <Stack gap="4">
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <MetricCard
          label="Total sales"
          metric={data?.kpis.totalSales}
          icon={WalletCards}
          detail={`${formatNumber(data?.kpis.totalOrders.value ?? 0)} completed orders`}
        />
        <MetricCard
          label="Total orders"
          metric={data?.kpis.totalOrders}
          value={formatNumber(data?.kpis.totalOrders.value ?? 0)}
          icon={ReceiptText}
          detail={`${formatNumber(data?.kpis.totalItemsSold ?? 0)} items across orders`}
        />
        <MetricCard
          label="Items sold"
          value={formatNumber(data?.kpis.totalItemsSold ?? 0)}
          icon={Package}
          detail={`${formatNumber(data?.kpis.totalItemsSold ? data.kpis.totalItemsSold / Math.max(data.kpis.totalOrders.value, 1) : 0)} items per order`}
        />
        <MetricCard
          label="Average order value"
          metric={data?.kpis.averageOrderValue}
          icon={ShoppingCart}
          detail="Average revenue per completed order"
        />
      </SimpleGrid>
      <ChartCard
        title="Sales trend"
        description="Revenue, order volume and average order value by period."
        option={trend}
        height="340px"
        icon={Activity}
      />
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
        <ChartCard
          title="Sales by category"
          description="Revenue mix across product categories."
          option={categories}
          height="300px"
          icon={Tag}
        />
        <ChartCard title="Sales by payment method" option={payments} height="300px" icon={CreditCard} />
        <ChartCard
          title="Sales activity"
          description="Sales intensity by local day and hour."
          option={activity}
          height="320px"
          icon={Activity}
        />
        <ChartCard
          title="Product performance"
          description="Bubble size represents profit."
          option={performance}
          height="320px"
          icon={Trophy}
        />
      </SimpleGrid>
      <Card.Root variant="outline">
        <Card.Header>
          <Flex justify="space-between" align="center">
            <Flex align="center" gap="2">
              <Trophy size={17} />
              <Card.Title>Top selling products</Card.Title>
            </Flex>
            <Button size="xs" variant="ghost" onClick={() => setSort(sort === 'total' ? 'date' : 'total')}>
              Sort by {sort === 'total' ? 'date' : 'sales'}
            </Button>
          </Flex>
        </Card.Header>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Product</Table.ColumnHeader>
              <Table.ColumnHeader>SKU</Table.ColumnHeader>
              <Table.ColumnHeader>Units</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Sales</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {[...(data?.topProducts ?? [])]
              .sort((a, b) => (sort === 'total' ? b.totalSales - a.totalSales : b.quantitySold - a.quantitySold))
              .map((item) => (
                <Table.Row key={item.productId}>
                  <Table.Cell>
                    <Flex align="center" gap="3">
                      {item.imageUrls?.[0] || item.imageKeys?.[0] ? (
                        <Image src={item.imageUrls?.[0] || item.imageKeys[0]} alt="" boxSize="36px" objectFit="cover" borderRadius="md" />
                      ) : (
                        <Flex boxSize="36px" align="center" justify="center" borderRadius="md" bg="bg.muted">
                          <ImageIcon size={17} />
                        </Flex>
                      )}
                      <Text>{item.productName}</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>{item.sku}</Table.Cell>
                  <Table.Cell>{formatNumber(item.quantitySold)}</Table.Cell>
                  <Table.Cell textAlign="end">{money(item.totalSales)}</Table.Cell>
                </Table.Row>
              ))}
          </Table.Body>
        </Table.Root>
      </Card.Root>
      <Card.Root variant="outline">
        <Card.Header>
          <Flex align="center" gap="2">
            <ReceiptText size={17} />
            <Card.Title>Recent sales transactions</Card.Title>
          </Flex>
        </Card.Header>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Invoice</Table.ColumnHeader>
              <Table.ColumnHeader>Date</Table.ColumnHeader>
              <Table.ColumnHeader>Customer</Table.ColumnHeader>
              <Table.ColumnHeader>Items</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Total</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {(transactions?.items ?? []).map((item, index) => (
              <Table.Row key={String(item.saleId ?? item.invoiceNumber ?? index)}>
                <Table.Cell>{String(item.invoiceNumber ?? item.saleId ?? '—')}</Table.Cell>
                <Table.Cell>{item.soldAt ? formatDate(String(item.soldAt)) : '—'}</Table.Cell>
                <Table.Cell>{String(item.customerName ?? 'Walk-in customer')}</Table.Cell>
                <Table.Cell>{formatNumber(Number(item.itemsCount ?? 0))}</Table.Cell>
                <Table.Cell textAlign="end">{money(Number(item.total ?? item.totalAmount ?? 0))}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        <Flex justify="space-between" align="center" p="3">
          <Text fontSize="sm" color="fg.muted">
            Page {transactions?.pagination.page ?? page} of {transactions?.pagination.totalPages ?? 1}
          </Text>
          <Flex gap="2">
            <Button size="xs" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={page >= (transactions?.pagination.totalPages ?? 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </Flex>
        </Flex>
      </Card.Root>
    </Stack>
  )
}

function ProfitLossReport({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getProfitLossReport>>>()
  const [products, setProducts] = useState<Awaited<ReturnType<typeof getProfitableProducts>>>()
  const [recentExpenses, setRecentExpenses] = useState<Awaited<ReturnType<typeof getRecentExpenses>>>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([getProfitLossReport(filters), getProfitableProducts(filters), getRecentExpenses(filters)])
      .then(([report, productRows, expenseRows]) => {
        setData(report)
        setProducts(productRows)
        setRecentExpenses(expenseRows)
      })
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Profit and loss report could not be loaded.'),
      )
      .finally(() => setLoading(false))
  }
  useEffect(load, [filters.from, filters.to, filters.categoryId, filters.granularity])
  const periods = data?.trend.map((item) => item.period) ?? []
  const expensePeriods = [...new Set(data?.expenseTrend.map((item) => item.period) ?? [])]
  const trend: EChartsOption = useMemo(
    () => ({
      legend: { data: ['Revenue', 'Cost', 'Expenses', 'Net profit'] },
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const items = Array.isArray(params) ? params : [params]
          const period = periods[items[0]?.dataIndex ?? 0]
          return `${period ? chartDateTime(period) : ''}<br/>${items.map((item) => `${item.seriesName}: ${money(Number(item.value))}`).join('<br/>')}`
        },
      },
      xAxis: { type: 'category', data: periods.map(chartDate) },
      yAxis: { type: 'value', name: 'Amount', axisLabel: currencyAxis },
      series: ['revenue', 'cost', 'expenses', 'netProfit'].map((key) => ({
        name: key === 'netProfit' ? 'Net profit' : key[0].toUpperCase() + key.slice(1),
        type: 'line',
        smooth: true,
        data: data?.trend.map((item) => item[key as 'revenue' | 'cost' | 'expenses' | 'netProfit']) ?? [],
      })),
    }),
    [data, periods],
  )
  const breakdown: EChartsOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          return `${item.name}: ${money(Number(item.value))} (${Number(item.percent ?? 0).toFixed(1)}%)`
        },
      },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          data:
            data?.expenseBreakdown.map((item) => ({
              name: String(item.category ?? item.name ?? 'Other'),
              value: Number(item.amount ?? 0),
            })) ?? [],
        },
      ],
    }),
    [data],
  )
  const expenseTrend: EChartsOption = useMemo(() => {
    const categories = [...new Set(data?.expenseTrend.map((item) => item.category) ?? [])]
    return {
      legend: { data: categories },
      tooltip: { trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
      xAxis: { type: 'category', data: expensePeriods.map(chartDate) },
      yAxis: { type: 'value', name: 'Expenses', axisLabel: currencyAxis },
      series: categories.map((category) => ({
        name: category,
        type: 'line',
        stack: 'expenses',
        areaStyle: {},
        data: expensePeriods.map(
          (period) =>
            data?.expenseTrend.find((item) => item.period === period && item.category === category)?.amount ?? 0,
        ),
      })),
    }
  }, [data, expensePeriods])
  const profitability: EChartsOption = useMemo(
    () => ({
      tooltip: {
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          const row = products?.items[item.dataIndex ?? 0]
          return row
            ? `${String(row.productName ?? 'Product')}<br/>Revenue: ${money(Number(row.revenue ?? 0))}<br/>Profit: ${money(Number(row.profit ?? 0))}<br/>Units: ${formatNumber(Number(row.quantitySold ?? 0))}`
            : ''
        },
      },
      xAxis: { type: 'value', name: 'Revenue', axisLabel: currencyAxis },
      yAxis: { type: 'value', name: 'Profit', axisLabel: currencyAxis },
      series: [
        {
          type: 'scatter',
          symbolSize: (value: number[]) => Math.max(10, Math.sqrt(value[2]) * 2),
          data: (products?.items ?? []).map((item) => [
            Number(item.revenue ?? 0),
            Number(item.profit ?? 0),
            Number(item.quantitySold ?? 0),
          ]),
        },
      ],
    }),
    [products],
  )
  const waterfall: EChartsOption = useMemo(
    () => ({
      xAxis: { type: 'category', data: ['Revenue', 'Cost', 'Expenses', 'Net profit'] },
      yAxis: { type: 'value', name: 'Amount', axisLabel: currencyAxis },
      tooltip: { trigger: 'axis', valueFormatter: (value) => money(Number(value)) },
      series: [
        {
          type: 'bar',
          data: [
            data?.kpis.revenue.value ?? 0,
            -(data?.kpis.cost.value ?? 0),
            -(data?.kpis.expenses.value ?? 0),
            data?.kpis.netProfit.value ?? 0,
          ],
          itemStyle: {
            color: (params: { dataIndex: number }) =>
              params.dataIndex === 0 || params.dataIndex === 3 ? '#2f855a' : '#c53030',
          },
        },
      ],
    }),
    [data],
  )
  const margin: EChartsOption = useMemo(
    () => ({
      xAxis: { type: 'category', data: periods.map(chartDate) },
      yAxis: { type: 'value', name: 'Margin %', axisLabel: percentAxis },
      tooltip: { valueFormatter: (value) => `${Number(value).toFixed(1)}%` },
      series: [
        {
          name: 'Net margin',
          type: 'line',
          smooth: true,
          data: data?.trend.map((item) => (item.revenue ? (item.netProfit / item.revenue) * 100 : 0)) ?? [],
        },
      ],
    }),
    [data, periods],
  )
  if (loading && !data) return <LoadingGrid />
  if (error && !data) return <ErrorPanel message={error} retry={load} />
  return (
    <Stack gap="4">
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 5 }} gap="4">
        <MetricCard label="Revenue" metric={data?.kpis.revenue} icon={WalletCards} detail="Sales minus returns" />
        <MetricCard label="Cost" metric={data?.kpis.cost} icon={Package} detail="Units sold × unit cost" />
        <MetricCard
          label="Expenses"
          metric={data?.kpis.expenses}
          icon={ReceiptText}
          detail="Sum of recorded expenses"
        />
        <MetricCard label="Net profit" metric={data?.kpis.netProfit} icon={Trophy} detail="Revenue − cost − expenses" />
        <MetricCard
          label="Net margin"
          value={`${Number(data?.kpis.netMargin ?? 0).toFixed(1)}%`}
          icon={Activity}
          detail="Net profit ÷ revenue × 100"
        />
      </SimpleGrid>
      <ChartCard title="Revenue vs cost vs expenses vs profit" option={trend} height="340px" icon={Activity} />
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
        <ChartCard title="Expense breakdown" option={breakdown} icon={Tag} />
        <ChartCard title="Expense trend by category" option={expenseTrend} icon={Activity} />
        <ChartCard title="Product revenue vs profit" option={profitability} icon={Trophy} />
        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4" gridColumn="1 / -1">
          <ChartCard title="Profit waterfall" option={waterfall} icon={BarChart3} />
          <ChartCard title="Profit margin trend" option={margin} icon={Activity} />
        </SimpleGrid>
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
        <Card.Root variant="outline">
          <Card.Header>
            <Card.Title>Top profitable products</Card.Title>
          </Card.Header>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                {' '}
                <Table.ColumnHeader>Product</Table.ColumnHeader>
                <Table.ColumnHeader>Units</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Profit (revenue − cost)</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(products?.items ?? []).map((item, index) => (
                <Table.Row key={String(item.productId ?? index)}>
                  {' '}
                  <Table.Cell>
                    <Flex align="center" gap="3">
                      {Array.isArray(item.imageKeys) && item.imageKeys[0] ? (
                        <Image
                          src={String(item.imageKeys[0])}
                          alt=""
                          boxSize="36px"
                          objectFit="cover"
                          borderRadius="md"
                        />
                      ) : (
                        <Flex boxSize="36px" align="center" justify="center" borderRadius="md" bg="bg.muted">
                          <ImageIcon size={17} />
                        </Flex>
                      )}
                      {String(item.productName ?? '—')}
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>{formatNumber(Number(item.quantitySold ?? 0))}</Table.Cell>
                  <Table.Cell textAlign="end">{money(Number(item.profit ?? 0))}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Card.Root>
        <SimpleGrid columns={{ base: 1, xl: 2 }} gap="4">
          <Card.Root variant="outline">
            <Card.Header>
              <Card.Title>Top expenses</Card.Title>
            </Card.Header>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Category</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Amount</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(data?.expenseBreakdown ?? []).slice(0, 5).map((item, index) => (
                  <Table.Row key={String(item.category ?? index)}>
                    <Table.Cell>{String(item.name ?? item.category ?? 'Other')}</Table.Cell>
                    <Table.Cell textAlign="end">{money(Number(item.amount ?? 0))}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card.Root>
          <Card.Root variant="outline">
            <Card.Header>
              <Card.Title>Recent expenses</Card.Title>
            </Card.Header>
            <Table.Root size="sm">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Date</Table.ColumnHeader>
                  <Table.ColumnHeader>Description</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Amount</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(recentExpenses?.items ?? []).map((item, index) => (
                  <Table.Row key={String(item.id ?? index)}>
                    <Table.Cell>{item.date ? formatDate(String(item.date)) : '—'}</Table.Cell>
                    <Table.Cell>{String(item.description ?? item.category ?? 'Expense')}</Table.Cell>
                    <Table.Cell textAlign="end">{money(Number(item.amount ?? 0))}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Card.Root>{' '}
        </SimpleGrid>
      </SimpleGrid>
    </Stack>
  )
}

function InventoryCustomerReport({ filters }: { filters: ReportFilters }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getInventoryCustomerReport>>>()
  const [lowStock, setLowStock] = useState<Awaited<ReturnType<typeof getLowStockItems>>>()
  const [topCustomers, setTopCustomers] = useState<Awaited<ReturnType<typeof getTopCustomers>>>()
  const [recentCustomers, setRecentCustomers] = useState<Awaited<ReturnType<typeof getRecentCustomers>>>()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sortLowStock, setSortLowStock] = useState<'stock' | 'name'>('stock')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const load = () => {
    setLoading(true)
    setError('')
    Promise.all([
      getInventoryCustomerReport(filters),
      getLowStockItems({ ...filters, page, limit: 8, search }),
      getTopCustomers(filters),
      getRecentCustomers(filters),
    ])
      .then(([summary, rows, top, recent]) => {
        setData(summary)
        setLowStock(rows)
        setTopCustomers(top)
        setRecentCustomers(recent)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Inventory report could not be loaded.'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [filters.from, filters.to, filters.granularity, page, search])
  const stock: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'item' },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          data: [
            { name: 'In stock', value: data?.stockStatus.inStock ?? 0 },
            { name: 'Low stock', value: data?.stockStatus.lowStock ?? 0 },
            { name: 'Out of stock', value: data?.stockStatus.outOfStock ?? 0 },
          ],
        },
      ],
    }),
    [data],
  )
  const categoryValues: EChartsOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (value) => money(Number(value)) },
      xAxis: { type: 'value', name: 'Value', axisLabel: currencyAxis },
      yAxis: { type: 'category', data: data?.inventoryValueByCategory.map((item) => item.category).reverse() ?? [] },
      series: [
        {
          name: 'Inventory value',
          type: 'bar',
          data: data?.inventoryValueByCategory.map((item) => item.value).reverse() ?? [],
        },
      ],
    }),
    [data],
  )
  const treemap: EChartsOption = useMemo(
    () => ({
      tooltip: {
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          return `${item.name}<br/>Value: ${money(Number(item.value ?? 0))}`
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          breadcrumb: { show: false },
          data: data?.inventoryValueByCategory.map((item) => ({ name: item.category, value: item.value })) ?? [],
        },
      ],
    }),
    [data],
  )
  const lowStockChart: EChartsOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        valueFormatter: (value) => formatNumber(Number(value)),
      },
      xAxis: { type: 'value', name: 'Units remaining' },
      yAxis: {
        type: 'category',
        data: lowStock?.items.map((item) => String(item.productName ?? item.name ?? 'Product')).reverse() ?? [],
      },
      series: [
        {
          name: 'Units remaining',
          type: 'bar',
          data: lowStock?.items.map((item) => Number(item.stockQuantity ?? 0)).reverse() ?? [],
        },
      ],
    }),
    [lowStock],
  )
  const customerTrend: EChartsOption = useMemo(
    () => ({
      legend: { data: ['New customers', 'Returning customers'] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        valueFormatter: (value) => formatNumber(Number(value)),
      },
      xAxis: {
        type: 'category',
        name: 'Period',
        data: data?.newVsReturning.map((item) => chartDate(item.period)) ?? [],
      },
      yAxis: { type: 'value', name: 'Customers', axisLabel: numberAxis },
      series: [
        {
          name: 'New customers',
          type: 'line',
          smooth: true,
          data: data?.newVsReturning.map((item) => item.newCustomers) ?? [],
        },
        {
          name: 'Returning customers',
          type: 'line',
          smooth: true,
          data: data?.newVsReturning.map((item) => item.returningCustomers) ?? [],
        },
      ],
    }),
    [data],
  )
  const customerTypes: EChartsOption = useMemo(
    () => ({
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          return `${item.name}<br/>Customers: ${formatNumber(Number(item.value ?? 0))} (${(Number(item.percent) || 0).toFixed(1)}%)`
        },
      },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['42%', '70%'],
          data: data?.customerTypeDistribution.map((item) => ({ name: item.type, value: item.customers })) ?? [],
        },
      ],
    }),
    [data],
  )
  const customerValue: EChartsOption = useMemo(
    () => ({
      legend: { data: ['Customers'] },
      tooltip: {
        formatter: (params) => {
          const item = Array.isArray(params) ? params[0] : params
          const row = data?.customerPerformance[item.dataIndex ?? 0]
          return row
            ? `${row.name}<br/>Orders: ${formatNumber(row.orders)}<br/>Purchase value: ${money(row.purchaseValue)}<br/>AOV: ${money(row.averageOrderValue)}`
            : ''
        },
      },
      xAxis: { type: 'value', name: 'Orders', axisLabel: numberAxis },
      yAxis: { type: 'value', name: 'Purchase value', axisLabel: currencyAxis },
      series: [
        {
          name: 'Customers',
          type: 'scatter',
          symbolSize: (value: number[]) => Math.max(10, Math.sqrt(value[2]) / 2),
          data: (data?.customerPerformance ?? []).map((item) => [
            item.orders,
            item.purchaseValue,
            Math.max(0, item.averageOrderValue),
          ]),
        },
      ],
    }),
    [data],
  )
  if (loading && !data) return <LoadingGrid />
  if (error && !data) return <ErrorPanel message={error} retry={load} />
  const sortedLowStock = [...(lowStock?.items ?? [])].sort((a, b) =>
    sortLowStock === 'name'
      ? String(a.productName ?? '').localeCompare(String(b.productName ?? ''))
      : Number(a.stockQuantity ?? 0) - Number(b.stockQuantity ?? 0),
  )
  return (
    <Stack gap="4">
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <MetricCard
          label="Inventory products"
          value={formatNumber(data?.kpis.totalProducts ?? 0)}
          icon={Package}
          detail={`${formatNumber(data?.kpis.totalUnits ?? 0)} total units`}
        />
        <MetricCard
          label="Inventory health"
          value={`${formatNumber((data?.kpis.totalProducts ?? 0) - (data?.kpis.lowStockItems ?? 0) - (data?.kpis.outOfStock ?? 0))} healthy`}
          icon={Activity}
          detail={`${formatNumber(data?.kpis.lowStockItems ?? 0)} low stock · ${formatNumber(data?.kpis.outOfStock ?? 0)} out of stock`}
        />
        <MetricCard
          label="Inventory value"
          value={money(data?.kpis.totalStockValue ?? 0)}
          icon={WalletCards}
          detail="Cost value of current stock"
        />
        <MetricCard
          label="Total purchases"
          value={money(data?.customerKpis.totalPurchases ?? 0)}
          icon={ReceiptText}
          detail={`${formatNumber(data?.customerKpis.activeCustomers ?? 0)} active customers`}
        />
      </SimpleGrid>
      <SimpleGrid columns={{ base: 1, sm: 2, xl: 4 }} gap="4">
        <MetricCard
          label="Total customers"
          value={formatNumber(data?.customerKpis.totalCustomers ?? 0)}
          icon={ShoppingCart}
          detail="Registered, non-walk-in customers"
        />
        <MetricCard
          label="New customers"
          value={formatNumber(data?.customerKpis.newCustomers ?? 0)}
          icon={ReceiptText}
          detail={`During the selected ${filters.granularity?.toLowerCase() ?? 'period'}`}
        />
        <MetricCard
          label="Active customers"
          value={formatNumber(data?.customerKpis.activeCustomers ?? 0)}
          icon={Activity}
          detail="Customers currently marked active"
        />
        <MetricCard
          label="Average purchase"
          value={money((data?.customerKpis.totalPurchases ?? 0) / Math.max(data?.customerKpis.totalCustomers ?? 0, 1))}
          icon={WalletCards}
          detail="Purchases per registered customer"
        />
      </SimpleGrid>{' '}
      <SimpleGrid order={2} columns={{ base: 1, xl: 2 }} gap="4">
        {' '}
        <ChartCard
          title="Stock status"
          description="Current product availability across the catalogue."
          option={stock}
          icon={Package}
        />
        <ChartCard title="Customer type distribution" option={customerTypes} icon={Tag} />
        <ChartCard title="Inventory value by category" option={categoryValues} icon={BarChart3} />
        <ChartCard
          title="Inventory value composition"
          description="Relative value of each product category."
          option={treemap}
          icon={Tag}
        />
        <ChartCard title="Low stock products" option={lowStockChart} icon={Activity} />
        <ChartCard
          title="Customer value vs orders"
          description="Bubble size represents average order value."
          option={customerValue}
          icon={Trophy}
        />{' '}
      </SimpleGrid>
      <Card.Root order={3} variant="outline">
        <Card.Header>
          <Flex justify="space-between" align="center">
            <Flex align="center" gap="2">
              <Package size={17} />
              <Card.Title>Low stock items</Card.Title>
            </Flex>
            <Flex gap="2">
              <Input
                size="xs"
                placeholder="Search products"
                value={search}
                onChange={(event) => {
                  setPage(1)
                  setSearch(event.target.value)
                }}
              />
              <Button
                size="xs"
                variant="ghost"
                onClick={() => setSortLowStock(sortLowStock === 'stock' ? 'name' : 'stock')}
              >
                Sort by {sortLowStock === 'stock' ? 'name' : 'stock'}
              </Button>
            </Flex>
          </Flex>
        </Card.Header>
        <Table.Root size="sm">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Product</Table.ColumnHeader>
              <Table.ColumnHeader>SKU</Table.ColumnHeader>
              <Table.ColumnHeader>Status</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Stock</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {sortedLowStock.map((item, index) => (
              <Table.Row key={String(item.productId ?? item.id ?? index)}>
                <Table.Cell>
                  <Flex align="center" gap="3">
                    {Array.isArray(item.imageKeys) && item.imageKeys[0] ? (
                      <Image
                        src={String(item.imageKeys[0])}
                        alt=""
                        boxSize="36px"
                        objectFit="cover"
                        borderRadius="md"
                      />
                    ) : (
                      <Flex boxSize="36px" align="center" justify="center" borderRadius="md" bg="bg.muted">
                        <ImageIcon size={17} />
                      </Flex>
                    )}
                    {String(item.productName ?? item.name ?? '—')}
                  </Flex>
                </Table.Cell>
                <Table.Cell>{String(item.sku ?? '—')}</Table.Cell>
                <Table.Cell>
                  <Badge colorPalette={String(item.status) === 'OUT_OF_STOCK' ? 'red' : 'orange'}>
                    {String(item.status ?? 'LOW_STOCK').replaceAll('_', ' ')}
                  </Badge>
                </Table.Cell>
                <Table.Cell textAlign="end">{formatNumber(Number(item.stockQuantity ?? item.stock ?? 0))}</Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
        <Flex justify="space-between" align="center" p="3">
          <Text fontSize="sm" color="fg.muted">
            Page {lowStock?.pagination.page ?? page} of {lowStock?.pagination.totalPages ?? 1}
          </Text>
          <Flex gap="2">
            <Button size="xs" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button
              size="xs"
              variant="outline"
              disabled={page >= (lowStock?.pagination.totalPages ?? 1)}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </Flex>
        </Flex>{' '}
      </Card.Root>
      <ChartCard
        title="New vs returning customers"
        description="Customer acquisition and repeat activity over time."
        option={customerTrend}
        icon={Activity}
        height="340px"
      />
      <SimpleGrid order={1} columns={{ base: 1, xl: 2 }} gap="4">
        <Card.Root variant="outline">
          <Card.Header>
            <Flex align="center" gap="2">
              <Trophy size={17} />
              <Card.Title>Top customers</Card.Title>
            </Flex>
          </Card.Header>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Customer</Table.ColumnHeader>
                <Table.ColumnHeader>Orders</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Purchases</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(topCustomers?.items ?? []).map((item, index) => (
                <Table.Row key={String(item.customerId ?? index)}>
                  <Table.Cell>{String(item.name ?? '—')}</Table.Cell>
                  <Table.Cell>{formatNumber(Number(item.orders ?? 0))}</Table.Cell>
                  <Table.Cell textAlign="end">{money(Number(item.totalSpent ?? 0))}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Card.Root>
        <Card.Root variant="outline">
          <Card.Header>
            <Flex align="center" gap="2">
              <ReceiptText size={17} />
              <Card.Title>Recent customers</Card.Title>
            </Flex>
          </Card.Header>
          <Table.Root size="sm">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Customer</Table.ColumnHeader>
                <Table.ColumnHeader>Last purchase</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Purchases</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {(recentCustomers?.items ?? []).map((item, index) => (
                <Table.Row key={String(item.customerId ?? index)}>
                  <Table.Cell>{String(item.name ?? '—')}</Table.Cell>
                  <Table.Cell>{item.lastPurchaseAt ? formatDate(String(item.lastPurchaseAt)) : '—'}</Table.Cell>
                  <Table.Cell textAlign="end">{money(Number(item.totalPurchases ?? 0))}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Card.Root>
      </SimpleGrid>
    </Stack>
  )
}

export function ReportsPage({ kind }: { kind: ReportKind }) {
  const [range, setRange] = useState<DateRange>(initialRange)
  const [granularity, setGranularity] = useState<ReportFilters['granularity']>('DAY')
  const reportRef = useRef<HTMLDivElement>(null)
  const filters = useMemo(() => ({ ...range, granularity }), [range, granularity])
  const title =
    kind === 'sales'
      ? 'Sales Report'
      : kind === 'profit-loss'
        ? 'Profit, Loss & Expenses'
        : 'Inventory & Customer Report'
  return (
    <PageContainer>
      <ReportFilters
        range={range}
        onChange={setRange}
        onRefresh={() => setRange({ ...range })}
        loading={false}
        granularity={granularity}
        onGranularityChange={setGranularity}
        exportName={
          kind === 'sales'
            ? 'sales-report.csv'
            : kind === 'profit-loss'
              ? 'profit-loss-report.csv'
              : 'inventory-customer-report.csv'
        }
        onExport={
          kind === 'sales'
            ? () => exportSalesReport({ ...range, granularity })
            : kind === 'profit-loss'
              ? () => exportProfitLossReport({ ...range, granularity, page: 1, limit: 100 })
              : () => exportInventoryReport({ ...range, granularity, page: 1, limit: 100 })
        }
        onExportPdf={async () => {
          if (!reportRef.current) return
          const canvas = await html2canvas(reportRef.current, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            ignoreElements: (element) => (element as HTMLElement).dataset.exportIgnore === 'true',
          })
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
          const pageWidth = pdf.internal.pageSize.getWidth()
          const pageHeight = pdf.internal.pageSize.getHeight()
          const imageWidth = pageWidth
          const imageHeight = (canvas.height * imageWidth) / canvas.width
          const image = canvas.toDataURL('image/jpeg', 0.92)
          for (let offset = 0; offset < imageHeight; offset += pageHeight) {
            if (offset > 0) pdf.addPage()
            pdf.addImage(image, 'JPEG', 0, -offset, imageWidth, imageHeight)
          }
          pdf.save(`${kind}-report.pdf`)
        }}
        onExportHtml={async () => {
          if (!reportRef.current) return
          const clone = reportRef.current.cloneNode(true) as HTMLElement
          clone.querySelectorAll('[data-export-ignore="true"]').forEach((element) => element.remove())
          const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;color:#111;padding:24px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:6px;text-align:left}</style></head><body>${clone.innerHTML}</body></html>`
          const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
          const link = document.createElement('a')
          link.href = url
          link.download = `${kind}-report.html`
          link.click()
          URL.revokeObjectURL(url)
        }}
        onShare={async (format, channel) => {
          let file: File
          if (format === 'csv') {
            const blob = await (kind === 'sales'
              ? exportSalesReport({ ...range, granularity })
              : kind === 'profit-loss'
                ? exportProfitLossReport({ ...range, granularity, page: 1, limit: 100 })
                : exportInventoryReport({ ...range, granularity, page: 1, limit: 100 }))
            file = new File([blob], `${kind}-report.csv`, { type: 'text/csv' })
          } else {
            if (!reportRef.current) return
            const canvas = await html2canvas(reportRef.current, {
              scale: 2,
              useCORS: true,
              backgroundColor: '#ffffff',
              ignoreElements: (element) => (element as HTMLElement).dataset.exportIgnore === 'true',
            })
            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const imageWidth = pageWidth
            const imageHeight = (canvas.height * imageWidth) / canvas.width
            const image = canvas.toDataURL('image/jpeg', 0.92)
            for (let offset = 0; offset < imageHeight; offset += pageHeight) {
              if (offset > 0) pdf.addPage()
              pdf.addImage(image, 'JPEG', 0, -offset, imageWidth, imageHeight)
            }
            file = new File([pdf.output('blob')], `${kind}-report.pdf`, { type: 'application/pdf' })
          }
          if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
            await navigator.share({ title, text: `${title} report`, files: [file] })
            return
          }
          const text = `${title} report is ready. Please attach ${file.name}.`
          window.open(
            channel === 'whatsapp'
              ? `https://wa.me/?text=${encodeURIComponent(text)}`
              : `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`,
            '_blank',
            'noopener,noreferrer',
          )
        }}
      />
      <Box ref={reportRef}>
        <PageHeader title={title} description="Understand performance across your POS business." />
        {kind === 'sales' ? (
          <SalesReport filters={filters} />
        ) : kind === 'profit-loss' ? (
          <ProfitLossReport filters={filters} />
        ) : (
          <InventoryCustomerReport filters={filters} />
        )}
      </Box>
    </PageContainer>
  )
}
