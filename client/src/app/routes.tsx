import { lazy, Suspense } from 'react'
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

const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((module) => ({ default: module.ReportsPage })),
)
const SuppliersPage = lazy(() => import('@/features/purchases/SuppliersPage'))
const PurchaseOrdersPage = lazy(() => import('@/features/purchases/PurchaseOrdersPage'))
const ExpensesPage = lazy(() => import('@/features/expenses/ExpensesPage'))
const ReturnsPage = lazy(() => import('@/features/returns/ReturnsPage'))
const InvoicePage = lazy(() =>
  import('@/features/invoices/InvoicePage').then((module) => ({ default: module.InvoicePage })),
)
const InvoiceVerificationPage = lazy(() =>
  import('@/features/invoices/InvoiceVerificationPage').then((module) => ({ default: module.InvoiceVerificationPage })),
)
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const MobileUploadPage = lazy(() =>
  import('@/features/qr-upload/MobileUploadPage').then((module) => ({ default: module.MobileUploadPage })),
)

function PlaceholderRoute() {
  return (
    <PageContainer>
      <PageHeader title="Coming soon" description="This POS module is prepared for implementation." />
      <EmptyState title="Module not available yet" description="The shared foundation is ready for this feature." />
    </PageContainer>
  )
}

import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/auth/forgot-password/:token" element={<ResetPasswordPage />} />
      <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/mobile-upload"
        element={
          <Suspense fallback={<SkeletonPage />}>
            <MobileUploadPage />
          </Suspense>
        }
      />
      <Route
        path="/invoice-verification/:invoiceid"
        element={
          <Suspense fallback={<SkeletonPage />}>
            <InvoiceVerificationPage />
          </Suspense>
        }
      />
      <Route element={<AppShell />}>
        <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
        <Route path={ROUTES.CATALOG} element={<CatalogPage />} />
        <Route path={ROUTES.POS} element={<POSPage />} />
        <Route path={ROUTES.INVENTORY} element={<InventoryPage />} />
        <Route path={ROUTES.STOCK_MOVEMENTS} element={<StockMovementsPage />} />
        <Route path={ROUTES.STOCK_ADJUSTMENTS} element={<StockAdjustmentsPage />} />
        <Route path={ROUTES.CUSTOMERS} element={<CustomersPage />} />
        <Route
          path={ROUTES.EXPENSES}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <ExpensesPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.RETURNS}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <ReturnsPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.INVOICES}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <InvoicePage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.SETTINGS}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <SettingsPage />
            </Suspense>
          }
        />
        <Route path={ROUTES.PRODUCTS} element={<CatalogPage />} />
        <Route path={ROUTES.CATEGORIES} element={<CatalogPage />} />
        <Route path={ROUTES.BRANDS} element={<CatalogPage />} />
        <Route
          path={ROUTES.SUPPLIERS}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <SuppliersPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.PURCHASE_ORDERS}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <PurchaseOrdersPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.PURCHASES}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <PurchaseOrdersPage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.SALES_REPORT}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <ReportsPage kind="sales" />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.PROFIT_LOSS_REPORT}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <ReportsPage kind="profit-loss" />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.INVENTORY_CUSTOMERS_REPORT}
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <ReportsPage kind="inventory-customer" />
            </Suspense>
          }
        />
        <Route
          path="/reports/inventory-customer"
          element={
            <Suspense
              fallback={
                <PageContainer>
                  <SkeletonPage />
                </PageContainer>
              }
            >
              <ReportsPage kind="inventory-customer" />
            </Suspense>
          }
        />
        <Route path="*" element={<PlaceholderRoute />} />
      </Route>
    </Routes>
  )
}

function SkeletonPage() {
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <div style={{ height: '48px' }} />
      <div style={{ height: '120px', background: 'var(--chakra-colors-bg-subtle)' }} />
      <div style={{ height: '320px', background: 'var(--chakra-colors-bg-subtle)' }} />
    </div>
  )
}
