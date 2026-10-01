// ─── Shared Entity Types ───────────────────────────────────────────────

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

// ─── Money / Currency ──────────────────────────────────────────────────

export interface Money {
  amount: number
  currency: string
}

// ─── Pagination ────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

// ─── Status ────────────────────────────────────────────────────────────

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'overdue'

export type PaymentMethod =
  | 'cash'
  | 'card'
  | 'upi'
  | 'bank_transfer'
  | 'wallet'

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock'

// ─── Product ───────────────────────────────────────────────────────────

export interface Product extends BaseEntity {
  name: string
  sku: string
  barcode?: string
  description?: string
  categoryId: string
  categoryName: string
  price: number
  costPrice: number
  quantity: number
  unit: string
  minStockLevel: number
  image?: string
  status: 'active' | 'inactive'
  stockStatus: StockStatus
}

export interface Category extends BaseEntity {
  name: string
  slug: string
  description?: string
  productCount: number
  parentId?: string
}

// ─── Customer ──────────────────────────────────────────────────────────

export interface Customer extends BaseEntity {
  name: string
  email: string
  phone: string
  address?: string
  city?: string
  totalOrders: number
  totalSpent: number
  loyaltyPoints: number
  status: 'active' | 'inactive'
}

// ─── Sale / Order ──────────────────────────────────────────────────────

export interface SaleItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
}

export interface Sale extends BaseEntity {
  invoiceNumber: string
  customerId?: string
  customerName: string
  items: SaleItem[]
  subtotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  paidAmount: number
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  notes?: string
}

// ─── Purchase ──────────────────────────────────────────────────────────

export interface PurchaseItem {
  productId: string
  productName: string
  sku: string
  quantity: number
  unitCost: number
  total: number
}

export interface Purchase extends BaseEntity {
  referenceNumber: string
  supplierId: string
  supplierName: string
  items: PurchaseItem[]
  subtotal: number
  taxAmount: number
  totalAmount: number
  paidAmount: number
  paymentStatus: PaymentStatus
  status: 'draft' | 'ordered' | 'received' | 'cancelled'
  expectedDate?: string
  receivedDate?: string
}

// ─── Invoice ───────────────────────────────────────────────────────────

export interface Invoice extends BaseEntity {
  invoiceNumber: string
  saleId: string
  customerId: string
  customerName: string
  issueDate: string
  dueDate: string
  items: SaleItem[]
  subtotal: number
  taxAmount: number
  discountAmount: number
  totalAmount: number
  paidAmount: number
  paymentStatus: PaymentStatus
  notes?: string
}

// ─── Expense ───────────────────────────────────────────────────────────

export interface Expense extends BaseEntity {
  category: string
  description: string
  amount: number
  date: string
  paymentMethod: PaymentMethod
  receipt?: string
  notes?: string
}

// ─── Return ────────────────────────────────────────────────────────────

export interface Return extends BaseEntity {
  saleId: string
  invoiceNumber: string
  customerName: string
  items: SaleItem[]
  reason: string
  refundAmount: number
  refundMethod: PaymentMethod
  status: 'pending' | 'approved' | 'rejected' | 'completed'
}

// ─── Dashboard ─────────────────────────────────────────────────────────

export interface KpiCard {
  id: string
  title: string
  value: string
  change: number
  changeLabel: string
  icon: string
  trend: 'up' | 'down' | 'neutral'
}

export interface RecentActivity {
  id: string
  type: 'sale' | 'purchase' | 'return' | 'expense'
  description: string
  amount: number
  time: string
  status: string
}

export interface ChartDataPoint {
  label: string
  value: number
  secondaryValue?: number
}

// ─── User / Auth ───────────────────────────────────────────────────────

export interface User {
  id: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'cashier'
  avatar?: string
  storeId: string
}

export interface Store {
  id: string
  name: string
  address: string
  phone: string
  currency: string
  timezone: string
}
