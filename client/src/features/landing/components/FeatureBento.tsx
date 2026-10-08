import { motion } from 'framer-motion'
import {
  ShoppingCart,
  Warehouse,
  Truck,
  Users,
  FileText,
  BarChart3,
} from 'lucide-react'

export function FeatureBento() {
  return (
    <section id="features" className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-800 mb-3 font-mono">
            CORE CAPABILITIES
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950">
            Everything your store needs. Nothing you don't.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600">
            Six essential tools united in one cohesive operating system.
          </p>
        </div>

        {/* Bento Grid Container */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: POS (Large 2 Columns) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="md:col-span-2 bg-zinc-50 rounded-2xl p-6 sm:p-8 border border-zinc-200 hover:border-zinc-400 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-4">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Point of Sale</span>
              <h3 className="text-xl sm:text-2xl font-bold text-zinc-950 mt-1">
                Sell faster with a simple checkout experience.
              </h3>
              <p className="text-sm text-zinc-600 mt-2 max-w-lg">
                Barcode scanning, quick search, multi-payment options, customer profiles and real-time inventory deduction built right into every transaction.
              </p>
            </div>

            {/* UI Mockup Snippet */}
            <div className="mt-6 bg-white rounded-xl border border-zinc-200 p-4 shadow-2xs font-mono text-xs text-zinc-800 space-y-2">
              <div className="flex items-center justify-between pb-2 border-b border-zinc-100 font-sans">
                <span className="font-bold text-zinc-950">Terminal #01 - Active Cart</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 font-mono">Receipt #1042</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Wireless Laser Barcode Scanner x1</span>
                <span>$89.00</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Thermal Receipt Roll (Pack of 10) x2</span>
                <span>$30.00</span>
              </div>
              <div className="pt-2 border-t border-zinc-100 flex justify-between font-bold text-zinc-950 font-sans text-sm">
                <span>Total Paid (Split Cash/Card)</span>
                <span>$119.00</span>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Inventory */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="bg-zinc-50 rounded-2xl p-6 sm:p-8 border border-zinc-200 hover:border-zinc-400 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-4">
                <Warehouse className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Inventory</span>
              <h3 className="text-xl font-bold text-zinc-950 mt-1">
                Know exactly what is in stock.
              </h3>
              <p className="text-sm text-zinc-600 mt-2">
                Know what is moving, what needs reordering, and prevent stockouts across all store locations.
              </p>
            </div>

            {/* UI Mockup Snippet */}
            <div className="mt-6 bg-white rounded-xl border border-zinc-200 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-950">Stock Health Index</span>
                <span className="font-mono font-bold text-zinc-900">98.4%</span>
              </div>
              <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                <div className="w-[98%] h-full bg-zinc-900" />
              </div>
              <div className="flex justify-between text-[11px] text-zinc-500 font-mono">
                <span>1,420 Active Items</span>
                <span>8 Low Stock</span>
              </div>
            </div>
          </motion.div>

          {/* Card 3: Purchasing */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-zinc-50 rounded-2xl p-6 sm:p-8 border border-zinc-200 hover:border-zinc-400 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-4">
                <Truck className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Purchasing</span>
              <h3 className="text-xl font-bold text-zinc-950 mt-1">
                Manage suppliers & orders.
              </h3>
              <p className="text-sm text-zinc-600 mt-2">
                Manage suppliers, purchase orders, receiving shipments, and vendor balance settlements seamlessly.
              </p>
            </div>

            {/* UI Mockup Snippet */}
            <div className="mt-6 bg-white rounded-xl border border-zinc-200 p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-500">PO #PO-2026-08</span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 text-white text-[10px] font-sans">Received</span>
              </div>
              <div className="text-xs font-semibold text-zinc-950">Global Tech Wholesalers</div>
              <div className="text-[11px] text-zinc-500 font-mono">50 units received &bull; $2,450.00</div>
            </div>
          </motion.div>

          {/* Card 4: Customers */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-zinc-50 rounded-2xl p-6 sm:p-8 border border-zinc-200 hover:border-zinc-400 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-4">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Customers</span>
              <h3 className="text-xl font-bold text-zinc-950 mt-1">
                Connected customer profiles.
              </h3>
              <p className="text-sm text-zinc-600 mt-2">
                Keep customer profiles, complete purchase history, store credits and account balances connected.
              </p>
            </div>

            {/* UI Mockup Snippet */}
            <div className="mt-6 bg-white rounded-xl border border-zinc-200 p-3 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-950">Sarah Connor</span>
                <span className="text-xs font-mono font-semibold text-zinc-700">$340 Balance</span>
              </div>
              <div className="text-[11px] text-zinc-500">14 Orders total &bull; VIP Tier Account</div>
            </div>
          </motion.div>

          {/* Card 5: Invoices & Reports (Large 2 Columns) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="md:col-span-2 bg-zinc-50 rounded-2xl p-6 sm:p-8 border border-zinc-200 hover:border-zinc-400 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="w-10 h-10 rounded-lg bg-zinc-800 text-white flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
              </div>
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Invoices & Reports</span>
              <h3 className="text-xl sm:text-2xl font-bold text-zinc-950 mt-1">
                Professional invoicing & deep profit analysis.
              </h3>
              <p className="text-sm text-zinc-600 mt-2 max-w-lg">
                Create tax-compliant A4 invoices with single-click printing or PDF download. Analyze sales trend, profit & loss, expenses and margin per SKU.
              </p>
            </div>

            {/* UI Mockup Snippet */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-zinc-200 p-3 text-xs font-mono space-y-1">
                <div className="font-bold font-sans text-zinc-950">Tax Invoice Preview</div>
                <div className="text-[11px] text-zinc-500">INV-2026-0089 &bull; VAT Included</div>
                <div className="text-zinc-950 font-bold pt-1">$1,245.00 Ready to Print</div>
              </div>
              <div className="bg-white rounded-xl border border-zinc-200 p-3 text-xs font-mono space-y-1">
                <div className="font-bold font-sans text-zinc-950">Profit & Loss Summary</div>
                <div className="text-[11px] text-zinc-500">Revenue: $128,450 &bull; COGS: $76,200</div>
                <div className="text-zinc-950 font-bold pt-1">Net Margin: +38.5%</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
