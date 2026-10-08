import { useEffect } from 'react'
import { LandingNavbar } from './components/LandingNavbar'
import { Hero } from './components/Hero'
import { CapabilityStrip } from './components/CapabilityStrip'
import { FeatureBento } from './components/FeatureBento'
import { POSShowcase } from './components/POSShowcase'
import { InventoryShowcase } from './components/InventoryShowcase'
import { PurchasingWorkflow } from './components/PurchasingWorkflow'
import { CustomerSupplierShowcase } from './components/CustomerSupplierShowcase'
import { InvoiceShowcase } from './components/InvoiceShowcase'
import { ReportsShowcase } from './components/ReportsShowcase'
import { IntegrationSection } from './components/IntegrationSection'
import { ReturnsExpensesSection } from './components/ReturnsExpensesSection'
import { AutomationFlow } from './components/AutomationFlow'
import { RolesSection } from './components/RolesSection'
import { FinalCTA } from './components/FinalCTA'
import { LandingFooter } from './components/LandingFooter'

export function LandingPage() {
  useEffect(() => {
    document.title = 'Jcom — All You Need'
  }, [])

  return (
    <div className="min-h-screen bg-white text-zinc-950 font-sans selection:bg-zinc-200 selection:text-zinc-950">
      {/* 1. Sticky Navbar */}
      <LandingNavbar />

      {/* 2. Hero Section */}
      <Hero />

      {/* 3. Capability Strip */}
      <CapabilityStrip />

      {/* 4. One System Bento Grid */}
      <FeatureBento />

      {/* 5. POS Feature Section */}
      <POSShowcase />

      {/* 6. Inventory Control */}
      <InventoryShowcase />

      {/* 7. Purchasing Workflow */}
      <PurchasingWorkflow />

      {/* 8. Customer & Supplier Hub */}
      <CustomerSupplierShowcase />

      {/* 9. Tax Invoicing Engine */}
      <InvoiceShowcase />

      {/* 10. Reports & Analytics */}
      <ReportsShowcase />

      {/* 11. Takealot Integration */}
      <IntegrationSection />

      {/* 12. Returns & Expenses */}
      <ReturnsExpensesSection />

      {/* 13. End-to-End Business Automation */}
      <AutomationFlow />

      {/* 14. Roles & Permissions */}
      <RolesSection />

      {/* 15. Final Call to Action */}
      <FinalCTA />

      {/* 16. Footer */}
      <LandingFooter />
    </div>
  )
}

export default LandingPage
