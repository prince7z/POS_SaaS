import type {
  AgentEvent,
  ConversationSummary,
  InteractionPayload,
  StreamAgentOptions,
} from '../types/agent'

export const MOCK_CONVERSATIONS: ConversationSummary[] = [
  {
    id: 'conv_today_1',
    title: 'Sales & Revenue Analysis',
    createdAt: Date.now() - 1000 * 60 * 30,
    updatedAt: Date.now() - 1000 * 60 * 5,
    group: 'Today',
  },
  {
    id: 'conv_today_2',
    title: 'Inventory Summary & Low Stock',
    createdAt: Date.now() - 1000 * 60 * 180,
    updatedAt: Date.now() - 1000 * 60 * 60,
    group: 'Today',
  },
  {
    id: 'conv_yesterday_1',
    title: 'Top Customers Overview',
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    updatedAt: Date.now() - 1000 * 60 * 60 * 25,
    group: 'Yesterday',
  },
  {
    id: 'conv_yesterday_2',
    title: 'Product Performance Report',
    createdAt: Date.now() - 1000 * 60 * 60 * 30,
    updatedAt: Date.now() - 1000 * 60 * 60 * 28,
    group: 'Yesterday',
  },
  {
    id: 'conv_earlier_1',
    title: 'Monthly Revenue Breakdown',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 5,
    group: 'Earlier',
  },
]

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function mockListConversations(): Promise<ConversationSummary[]> {
  await delay(200)
  return MOCK_CONVERSATIONS
}

export async function mockGetConversation(conversationId: string): Promise<ConversationSummary | null> {
  await delay(150)
  return MOCK_CONVERSATIONS.find((c) => c.id === conversationId) || null
}

export async function mockSubmitAgentInteraction(payload: InteractionPayload): Promise<{ success: boolean; message: string }> {
  await delay(300)
  return {
    success: true,
    message: `Received response for ${payload.questionId || payload.confirmationId}`,
  }
}

export async function mockStreamAgent(options: StreamAgentOptions): Promise<void> {
  const { message, signal, onEvent, onComplete } = options
  const msgLower = message.toLowerCase()

  const emit = (event: AgentEvent) => {
    if (signal?.aborted) return
    onEvent(event)
  }

  const checkAbort = () => {
    return signal?.aborted ?? false
  }

  // Determine scenario based on message keyword
  if (msgLower.includes('question') || msgLower.includes('store') || msgLower.includes('branch')) {
    // Scenario D: Interactive Question
    emit({
      id: 'e1',
      type: 'thinking',
      data: { status: 'running', message: 'Analyzing query details...' },
    })
    await delay(500)
    if (checkAbort()) return

    emit({
      id: 'e2',
      type: 'question',
      data: {
        questionId: `q_${Date.now()}`,
        message: 'Which store branch or location would you like me to analyze?',
        options: [
          { id: 'main', label: 'Main Store (HQ)', value: 'main' },
          { id: 'downtown', label: 'Downtown Branch', value: 'downtown' },
          { id: 'warehouse', label: 'Central Warehouse', value: 'warehouse' },
          { id: 'all', label: 'All Branches Combined', value: 'all' },
        ],
        allowTextInput: true,
      },
    })
    emit({ id: 'e_done', type: 'done', data: null })
    onComplete?.()
    return
  }

  if (msgLower.includes('confirm') || msgLower.includes('price') || msgLower.includes('update')) {
    // Scenario F: Confirmation / Approval
    emit({
      id: 'e1',
      type: 'thinking',
      data: { status: 'running', message: 'Verifying requested catalog action...' },
    })
    await delay(600)
    if (checkAbort()) return

    emit({
      id: 'e2',
      type: 'confirmation',
      data: {
        confirmationId: `confirm_${Date.now()}`,
        message: 'Are you sure you want to bulk update retail prices for the selected category by +5%?',
        action: { label: 'Bulk Update Retail Prices (+5%)' },
        options: [
          { id: 'approve', label: 'Approve & Execute', value: true },
          { id: 'reject', label: 'Cancel Action', value: false },
        ],
      },
    })
    emit({ id: 'e_done', type: 'done', data: null })
    onComplete?.()
    return
  }

  if (msgLower.includes('tool') || msgLower.includes('customer') || msgLower.includes('fetch')) {
    // Scenario C: Tool Call & Tool Result
    emit({
      id: 'e1',
      type: 'thinking',
      data: { status: 'running', message: 'Initializing data tool execution...' },
    })
    await delay(400)
    if (checkAbort()) return

    const toolId = `tool_${Date.now()}`
    emit({
      id: 'e2',
      type: 'tool_call',
      data: {
        toolCallId: toolId,
        name: 'fetch_top_customers',
        label: 'Fetching Top Customer Accounts',
        status: 'running',
        input: { limit: 5, timeRange: 'this_month' },
      },
    })
    await delay(800)
    if (checkAbort()) return

    emit({
      id: 'e3',
      type: 'tool_result',
      data: {
        toolCallId: toolId,
        status: 'completed',
        result: { count: 5, status: 'OK' },
        message: 'Successfully retrieved 5 customer records.',
      },
    })
    await delay(400)
    if (checkAbort()) return

    const msgId = `m_${Date.now()}`
    emit({
      id: 'e4',
      type: 'text',
      data: { messageId: msgId, delta: 'Top customers fetched successfully. Total high-value accounts retrieved: 5.' },
    })
    emit({ id: 'e_done', type: 'done', data: null })
    onComplete?.()
    return
  }

  if (msgLower.includes('batch') || msgLower.includes('overview') || msgLower.includes('charts')) {
    // Scenario G: Batch Charts & Table
    emit({
      id: 'e1',
      type: 'thinking',
      data: { status: 'running', message: 'Generating multi-chart analytics batch...' },
    })
    await delay(500)
    if (checkAbort()) return

    emit({
      id: 'e2',
      type: 'chart_batch',
      data: {
        title: 'Sales & Orders Overview Batch',
        charts: [
          {
            id: 'c_sales',
            chartType: 'line',
            title: 'Monthly Revenue Growth',
            xKey: 'month',
            series: [{ dataKey: 'revenue', label: 'Revenue (₹)' }],
            data: [
              { month: 'Jul', revenue: 320000 },
              { month: 'Aug', revenue: 380000 },
              { month: 'Sep', revenue: 450000 },
              { month: 'Oct', revenue: 510000 },
            ],
          },
          {
            id: 'c_orders',
            chartType: 'bar',
            title: 'Order Volume by Month',
            xKey: 'month',
            series: [{ dataKey: 'orders', label: 'Completed Orders' }],
            data: [
              { month: 'Jul', orders: 140 },
              { month: 'Aug', orders: 175 },
              { month: 'Sep', orders: 210 },
              { month: 'Oct', orders: 245 },
            ],
          },
        ],
      },
    })
    await delay(600)
    if (checkAbort()) return

    emit({
      id: 'e3',
      type: 'table',
      data: {
        title: 'Branch Performance Summary',
        columns: [
          { key: 'branch', label: 'Branch Location' },
          { key: 'revenue', label: 'Revenue (₹)' },
          { key: 'growth', label: 'MoM Growth' },
          { key: 'orders', label: 'Total Orders' },
        ],
        rows: [
          { branch: 'Main Store (HQ)', revenue: '₹310,000', growth: '+18.4%', orders: '154' },
          { branch: 'Downtown Branch', revenue: '₹140,000', growth: '+12.1%', orders: '68' },
          { branch: 'Express Outlet', revenue: '₹60,000', growth: '+8.5%', orders: '23' },
        ],
      },
    })
    await delay(400)
    if (checkAbort()) return

    const msgId = `m_${Date.now()}`
    emit({
      id: 'e4',
      type: 'text',
      data: { messageId: msgId, delta: 'Both overall revenue trajectory and branch breakdowns indicate steady quarter-over-quarter expansion.' },
    })
    emit({ id: 'e_done', type: 'done', data: null })
    onComplete?.()
    return
  }

  // Default Full Scenario (Scenario B / H / I): Thinking -> Todos -> Text Deltas -> Chart -> Text -> Table -> Done
  emit({
    id: 'e1',
    type: 'thinking',
    data: { status: 'running', message: 'Analyzing sales data and compiling store performance...' },
  })
  await delay(400)
  if (checkAbort()) return

  // Todo items
  emit({
    id: 'e2',
    type: 'todo',
    data: { id: 't1', title: 'Fetch sales records for current month', status: 'running' },
  })
  await delay(500)
  if (checkAbort()) return

  emit({
    id: 'e2_up',
    type: 'todo',
    data: { id: 't1', title: 'Fetch sales records for current month', status: 'completed' },
  })
  emit({
    id: 'e3',
    type: 'todo',
    data: { id: 't2', title: 'Calculate revenue growth and top products', status: 'running' },
  })
  await delay(500)
  if (checkAbort()) return

  emit({
    id: 'e3_up',
    type: 'todo',
    data: { id: 't2', title: 'Calculate revenue growth and top products', status: 'completed' },
  })

  emit({
    id: 'e_think_done',
    type: 'thinking',
    data: { status: 'completed', message: 'Analysis complete.' },
  })

  // First Text block (progressive deltas)
  const m1 = `m1_${Date.now()}`
  const chunks1 = [
    'Sales increased **17.1%** this month compared to last month. ',
    'Total revenue reached **₹510,000** across all retail categories. ',
    'Here is the monthly breakdown visualised below:',
  ]
  for (const chunk of chunks1) {
    emit({
      id: `e_t1_${Math.random()}`,
      type: 'text',
      data: { messageId: m1, delta: chunk },
    })
    await delay(180)
    if (checkAbort()) return
  }

  // Single Chart
  emit({
    id: 'e_chart1',
    type: 'chart',
    data: {
      id: 'chart_sales_monthly',
      chartType: 'line',
      title: 'Monthly Revenue Trend (2026)',
      xKey: 'month',
      series: [{ dataKey: 'sales', label: 'Sales (₹)' }],
      data: [
        { month: 'Jul', sales: 320000 },
        { month: 'Aug', sales: 360000 },
        { month: 'Sep', sales: 435000 },
        { month: 'Oct', sales: 510000 },
      ],
    },
  })
  await delay(400)
  if (checkAbort()) return

  // Second Text block
  const m2 = `m2_${Date.now()}`
  const chunks2 = [
    'Below are the top performing product items for this period:\n',
  ]
  for (const chunk of chunks2) {
    emit({
      id: `e_t2_${Math.random()}`,
      type: 'text',
      data: { messageId: m2, delta: chunk },
    })
    await delay(150)
    if (checkAbort()) return
  }

  // Table
  emit({
    id: 'e_table1',
    type: 'table',
    data: {
      title: 'Top Performing Products',
      columns: [
        { key: 'product', label: 'Product Name' },
        { key: 'category', label: 'Category' },
        { key: 'units', label: 'Units Sold' },
        { key: 'revenue', label: 'Revenue' },
      ],
      rows: [
        { product: 'Wireless POS Terminal X1', category: 'Hardware', units: '142', revenue: '₹213,000' },
        { product: 'Thermal Receipt Paper (Pack)', category: 'Supplies', units: '580', revenue: '₹87,000' },
        { product: 'Barcode Scanner Pro', category: 'Hardware', units: '89', revenue: '₹124,600' },
        { product: 'Cash Drawer Heavy Duty', category: 'Hardware', units: '45', revenue: '₹85,400' },
      ],
    },
  })
  await delay(400)
  if (checkAbort()) return

  // Final Text block
  const m3 = `m3_${Date.now()}`
  emit({
    id: 'e_t3',
    type: 'text',
    data: { messageId: m3, delta: 'Overall operational performance remains robust with positive momentum leading into next month.' },
  })

  emit({ id: 'e_done', type: 'done', data: null })
  onComplete?.()
}
