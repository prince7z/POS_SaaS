import { Routes, Route } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { EmptyState } from '@/components/common/EmptyState'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/common/PageHeader'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { ROUTES } from '@/config/constants'
import { POSPage } from '@/features/pos/POSPage'
import { CatalogPage } from '@/features/catalog/CatalogPage'
import { InventoryPage, StockAdjustmentsPage, StockMovementsPage } from '@/features/inventory/InventoryPage'
import { CustomersPage } from '@/features/customers/CustomersPage'

function PlaceholderRoute() {
  return (
    <PageContainer>
      <PageHeader title="Coming soon" description="This POS module is prepared for implementation." />
      <EmptyState title="Module not available yet" description="The shared foundation is ready for this feature." />
    </PageContainer>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        <Route path={ROUTES.CATALOG} element={<CatalogPage />} />
        <Route path={ROUTES.POS} element={<POSPage />} />
        <Route path={ROUTES.INVENTORY} element={<InventoryPage />} />
        <Route path={ROUTES.STOCK_MOVEMENTS} element={<StockMovementsPage />} />
        <Route path={ROUTES.STOCK_ADJUSTMENTS} element={<StockAdjustmentsPage />} />
        <Route path={ROUTES.CUSTOMERS} element={<CustomersPage />} />
        <Route path={ROUTES.PRODUCTS} element={<CatalogPage />} />
        <Route path={ROUTES.CATEGORIES} element={<CatalogPage />} />
        <Route path={ROUTES.BRANDS} element={<CatalogPage />} />
        <Route path="*" element={<PlaceholderRoute />} />
      </Route>
    </Routes>
  )
}
