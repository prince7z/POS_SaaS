// ─── Route Paths ───────────────────────────────────────────────────────

export const ROUTES = {
  DASHBOARD: '/',
  POS: '/pos',
  CATALOG: '/catalog',
  PRODUCTS: '/catalog/products',
  CATEGORIES: '/catalog/categories',
  BRANDS: '/catalog/brands',
  INVENTORY: '/inventory',
  STOCK_MOVEMENTS: '/inventory/movements',
  STOCK_ADJUSTMENTS: '/inventory/adjustments',
  CUSTOMERS: '/customers',
  SALES: '/sales',
  PURCHASES: '/purchases',
  PURCHASE_ORDERS: '/purchases/orders',
  SUPPLIERS: '/purchases/suppliers',
  INVOICES: '/invoices',
  REPORTS: '/reports',
  SALES_REPORT: '/reports/sales',
  INVENTORY_CUSTOMERS_REPORT: '/reports/inventory-customers',
  PROFIT_LOSS_REPORT: '/reports/profit-loss',
  EXPENSES: '/expenses',
  RETURNS: '/returns',
  SETTINGS: '/settings',
} as const

// ─── Layout ────────────────────────────────────────────────────────────

export const SIDEBAR_WIDTH = 260
export const SIDEBAR_COLLAPSED_WIDTH = 72
export const NAVBAR_HEIGHT = 64
export const MOBILE_BREAKPOINT = 768

// ─── Storage Keys ──────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  THEME: 'pos-theme',
  SIDEBAR_STATE: 'pos-sidebar-collapsed',
  AUTH_TOKEN: 'pos-auth-token',
  PERMISSIONS: 'pos-permissions',
} as const

// ─── Status Colors (Tailwind classes) ──────────────────────────────────

export const STATUS_COLORS = {
  // Order
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  processing: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  cancelled: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  refunded: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  // Payment
  paid: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  unpaid: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  partial: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  overdue: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  // Stock
  in_stock: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  low_stock: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  out_of_stock: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  // Generic
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  inactive: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30' },
  draft: { bg: 'bg-zinc-500/10', text: 'text-zinc-400', border: 'border-zinc-500/30' },
  ordered: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  received: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  rejected: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
} as const
