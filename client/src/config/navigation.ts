import {
  LayoutDashboard,
  Package,
  Warehouse,
  Users,
  ShoppingCart,
  Truck,
  FileText,
  BarChart3,
  Receipt,
  RotateCcw,
  Settings,
  ArrowDownUp,
  SlidersHorizontal,
  Tags,
} from 'lucide-react'
import { ROUTES } from './constants'
import type { NavGroup } from '@/types/navigation'

export const navigationConfig: NavGroup[] = [
  {
    id: 'main',
    label: 'Main',
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        path: ROUTES.DASHBOARD,
        icon: LayoutDashboard,
      },
      { id: 'pos', label: 'POS', path: ROUTES.POS, icon: ShoppingCart },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    items: [
      {
        id: 'catalog',
        label: 'Catalog',
        path: '#',
        icon: Package,
        children: [
          { id: 'products', label: 'Products', path: ROUTES.PRODUCTS, icon: Package },
          { id: 'categories', label: 'Categories', path: ROUTES.CATEGORIES, icon: Tags },
          { id: 'brands', label: 'Brands', path: ROUTES.BRANDS, icon: Tags },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory',
        path: '#',
        icon: Warehouse,
        children: [
          { id: 'inventory-dashboard', label: 'Dashboard', path: ROUTES.INVENTORY, icon: LayoutDashboard },
          { id: 'stock-movements', label: 'Stock Movements', path: ROUTES.STOCK_MOVEMENTS, icon: ArrowDownUp },
          {
            id: 'stock-adjustments',
            label: 'Stock Adjustments',
            path: ROUTES.STOCK_ADJUSTMENTS,
            icon: SlidersHorizontal,
          },
        ],
      },
      {
        id: 'customers',
        label: 'Customers',
        path: ROUTES.CUSTOMERS,
        icon: Users,
      },
    ],
  },
  {
    id: 'transactions',
    label: 'Transactions',
    items: [
      {
        id: 'purchases',
        label: 'Purchases',
        path: '#',
        icon: Truck,
        children: [
          { id: 'suppliers', label: 'Suppliers', path: ROUTES.SUPPLIERS, icon: Truck },
          { id: 'purchase-orders', label: 'Purchase Orders', path: ROUTES.PURCHASE_ORDERS, icon: Truck },
        ],
      },
      {
        id: 'invoices',
        label: 'Invoices',
        path: ROUTES.INVOICES,
        icon: FileText,
      },
      {
        id: 'returns',
        label: 'Returns',
        path: ROUTES.RETURNS,
        icon: RotateCcw,
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance & Reports',
    items: [
      {
        id: 'expenses',
        label: 'Expenses',
        path: ROUTES.EXPENSES,
        icon: Receipt,
      },
      {
        id: 'reports',
        label: 'Reports',
        path: '#',
        icon: BarChart3,
        children: [
          { id: 'sales-report', label: 'Sales', path: ROUTES.SALES_REPORT, icon: BarChart3 },
          {
            id: 'inventory-customers-report',
            label: 'Inventory & Customers',
            path: ROUTES.INVENTORY_CUSTOMERS_REPORT,
            icon: BarChart3,
          },
          { id: 'profit-loss-report', label: 'Profit & Loss', path: ROUTES.PROFIT_LOSS_REPORT, icon: BarChart3 },
        ],
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        id: 'settings',
        label: 'Settings',
        path: ROUTES.SETTINGS,
        icon: Settings,
      },
    ],
  },
]
