import { InventoryDashboard } from './components/InventoryDashboard'
import { StockAdjustmentPage } from './components/StockAdjustmentPage'
import { StockMovementsPage as StockMovementsScreen } from './components/StockMovementsPage'

export function InventoryPage() {
  return <InventoryDashboard />
}

export function StockAdjustmentsPage() {
  return <StockAdjustmentPage />
}

export function StockMovementsPage() {
  return <StockMovementsScreen />
}
