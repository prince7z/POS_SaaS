import { motion } from 'framer-motion'
import {
  ShoppingCart,
  Warehouse,
  Truck,
  Users,
  FileText,
  BarChart3,
} from 'lucide-react'

export function CapabilityStrip() {
  const capabilities = [
    { label: 'POS', icon: ShoppingCart, desc: 'Barcode & instant checkout' },
    { label: 'Inventory', icon: Warehouse, desc: 'Multi-branch stock levels' },
    { label: 'Purchasing', icon: Truck, desc: 'Supplier POs & receiving' },
    { label: 'Customers', icon: Users, desc: 'Profiles & store credits' },
    { label: 'Invoices', icon: FileText, desc: 'Tax compliant A4 invoices' },
    { label: 'Reports', icon: BarChart3, desc: 'Profit & sales analytics' },
  ]

  return (
    <section className="py-8 bg-zinc-50 border-y border-zinc-200 overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-2 md:grid-cols-6 divide-y md:divide-y-0 md:divide-x divide-zinc-200/80">
          {capabilities.map((cap, idx) => {
            const Icon = cap.icon
            return (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                className="flex items-center gap-3 px-3 py-3 md:py-1 group cursor-default justify-center"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-900 group-hover:bg-zinc-950 group-hover:text-white transition-all shadow-2xs shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-zinc-950 tracking-tight leading-tight">
                    {cap.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 line-clamp-1 mt-0.5">
                    {cap.desc}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
