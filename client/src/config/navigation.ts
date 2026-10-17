import { useEffect, useMemo, useState } from 'react'
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
  ChartNoAxesCombined,
} from 'lucide-react'
import { ROUTES } from './constants'
import type { NavGroup, NavItem } from '@/types/navigation'
import { getStoredPermissions } from '@/lib/auth'
import { getIntegrations } from '@/api/endpoints/integrations'
import { showError } from '@/components/feedback/notifications'

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
      {
        id: 'pos',
        label: 'POS',
        path: ROUTES.POS,
        icon: ShoppingCart,
        permissions: ['POS'],
      },
      {
        id: 'takealot-dashboard',
        label: 'Takealot Dashboard',
        path: ROUTES.TAKEALOT,
        icon: ChartNoAxesCombined,
        permissions: ['TAKEALOT'],
        children: [],
      },
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
        permissions: ['PRODUCTS', 'CATEGORIES', 'BRANDS'],
        children: [
          { id: 'products', label: 'Products', path: ROUTES.PRODUCTS, icon: Package, permissions: ['PRODUCTS'] },
          { id: 'categories', label: 'Categories', path: ROUTES.CATEGORIES, icon: Tags, permissions: ['CATEGORIES'] },
          { id: 'brands', label: 'Brands', path: ROUTES.BRANDS, icon: Tags, permissions: ['BRANDS'] },
        ],
      },
      {
        id: 'inventory',
        label: 'Inventory',
        path: '#',
        icon: Warehouse,
        permissions: ['INVENTORY'],
        children: [
          {
            id: 'inventory-dashboard',
            label: 'Dashboard',
            path: ROUTES.INVENTORY,
            icon: LayoutDashboard,
            permissions: ['INVENTORY'],
          },
          {
            id: 'stock-movements',
            label: 'Stock Movements',
            path: ROUTES.STOCK_MOVEMENTS,
            icon: ArrowDownUp,
            permissions: ['INVENTORY'],
          },
          {
            id: 'stock-adjustments',
            label: 'Stock Adjustments',
            path: ROUTES.STOCK_ADJUSTMENTS,
            icon: SlidersHorizontal,
            permissions: ['INVENTORY'],
          },
        ],
      },
      {
        id: 'customers',
        label: 'Customers',
        path: ROUTES.CUSTOMERS,
        icon: Users,
        permissions: ['CUSTOMERS'],
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
        permissions: ['PURCHASES', 'SUPPLIERS'],
        children: [
          { id: 'suppliers', label: 'Suppliers', path: ROUTES.SUPPLIERS, icon: Truck, permissions: ['SUPPLIERS'] },
          {
            id: 'purchase-orders',
            label: 'Purchase Orders',
            path: ROUTES.PURCHASE_ORDERS,
            icon: Truck,
            permissions: ['PURCHASES'],
          },
        ],
      },
      {
        id: 'invoices',
        label: 'Invoices',
        path: ROUTES.INVOICES,
        icon: FileText,
        permissions: ['INVOICES'],
      },
      {
        id: 'returns',
        label: 'Returns',
        path: ROUTES.RETURNS,
        icon: RotateCcw,
        permissions: ['RETURNS'],
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
        permissions: ['EXPENSES'],
      },
      {
        id: 'reports',
        label: 'Reports',
        path: '#',
        icon: BarChart3,
        permissions: ['REPORT_SALES', 'REPORT_INVENTORY_CUSTOMER', 'REPORT_PROFIT_LOSS'],
        children: [
          {
            id: 'sales-report',
            label: 'Sales',
            path: ROUTES.SALES_REPORT,
            icon: BarChart3,
            permissions: ['REPORT_SALES'],
          },
          {
            id: 'inventory-customers-report',
            label: 'Inventory & Customers',
            path: ROUTES.INVENTORY_CUSTOMERS_REPORT,
            icon: BarChart3,
            permissions: ['REPORT_INVENTORY_CUSTOMER'],
          },
          {
            id: 'profit-loss-report',
            label: 'Profit & Loss',
            path: ROUTES.PROFIT_LOSS_REPORT,
            icon: BarChart3,
            permissions: ['REPORT_PROFIT_LOSS'],
          },
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
        permissions: ['SETTINGS', 'USERS_ROLES'],
      },
    ],
  },
]

export function filterNavigationByPermissions(groups: NavGroup[], permissions: string[]): NavGroup[] {
  const permSet = new Set(permissions)

  return groups
    .map((group) => {
      const filteredItems = group.items
        .map((item) => {
          if (item.children && item.children.length > 0) {
            const visibleChildren = item.children.filter((child) => {
              if (!child.permissions || child.permissions.length === 0) return true
              return child.permissions.some((p) => permSet.has(p))
            })
            if (visibleChildren.length === 0) return null
            return {
              ...item,
              children: visibleChildren,
            }
          }

          if (!item.permissions || item.permissions.length === 0) {
            return item
          }

          const hasAccess = item.permissions.some((p) => permSet.has(p))
          return hasAccess ? item : null
        })
        .filter((item): item is NavItem => item !== null)

      return {
        ...group,
        items: filteredItems,
      }
    })
    .filter((group) => group.items.length > 0)
}

export function useFilteredNavigation(): NavGroup[] {
  const [permissions, setPermissions] = useState<string[]>(() => getStoredPermissions())
  const [takealotItems, setTakealotItems] = useState<NavItem[]>([])

  useEffect(() => {
    const handleUpdate = () => {
      setPermissions(getStoredPermissions())
    }
    window.addEventListener('pos-permissions-updated', handleUpdate)
    window.addEventListener('pos-company-updated', handleUpdate)
    window.addEventListener('storage', handleUpdate)
    return () => {
      window.removeEventListener('pos-permissions-updated', handleUpdate)
      window.removeEventListener('pos-company-updated', handleUpdate)
      window.removeEventListener('storage', handleUpdate)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadTakealotItems = async () => {
      try {
        const integrations = (await getIntegrations()).filter(
          (integration) =>
            integration.type === 'TAKEALOT' &&
            integration.configured &&
            integration.isActive &&
            integration.name.trim().toLowerCase() !== 'dashboard',
        )
        if (cancelled) return
        setTakealotItems(
          integrations.map((integration) => ({
            id: `takealot-integration-${integration.id}`,
            label: integration.name,
            path: `${ROUTES.TAKEALOT}?integrationId=${encodeURIComponent(integration.id)}`,
            icon: ChartNoAxesCombined,
            permissions: ['TAKEALOT'],
          })),
        )
      } catch (cause) {
        if (!cancelled) showError('Unable to load Takealot connections', cause)
      }
    }
    void loadTakealotItems()

    const reload = () => void loadTakealotItems()
    window.addEventListener('pos-company-updated', reload)
    window.addEventListener('pos-integrations-updated', reload)
    return () => {
      cancelled = true
      window.removeEventListener('pos-company-updated', reload)
      window.removeEventListener('pos-integrations-updated', reload)
    }
  }, [])

  return useMemo(
    () =>
      filterNavigationByPermissions(
        navigationConfig.map((group) => ({
          ...group,
          items: group.items.map((item) =>
            item.id === 'takealot-dashboard' ? { ...item, children: takealotItems } : item,
          ),
        })),
        permissions,
      ),
    [permissions, takealotItems],
  )
}

export function isNavigationItemActive(item: NavItem, pathname: string, search: string): boolean {
  const [itemPath, itemQuery] = item.path.split('?')
  if (pathname !== itemPath) return false
  if (!itemQuery) return search.length === 0

  const currentParams = new URLSearchParams(search)
  return [...new URLSearchParams(itemQuery)].every(([key, value]) => currentParams.get(key) === value)
}
