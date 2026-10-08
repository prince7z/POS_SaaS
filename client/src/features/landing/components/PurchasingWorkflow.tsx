import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Truck,
  FileSpreadsheet,
  PackageCheck,
  Database,
  CreditCard,
} from 'lucide-react'

export function PurchasingWorkflow() {
  const [activeStep, setActiveStep] = useState<number>(2)

  const steps = [
    {
      id: 1,
      name: 'Supplier',
      title: 'Vendor Directory',
      desc: 'Select authorized supplier or import vendor price lists.',
      icon: Truck,
      details: 'Global Tech Wholesalers',
    },
    {
      id: 2,
      name: 'Purchase Order',
      title: 'Issue PO',
      desc: 'Create multi-line POs with payment terms.',
      icon: FileSpreadsheet,
      details: 'PO #PO-2026-088',
    },
    {
      id: 3,
      name: 'Receive Stock',
      title: 'GRN Receiving',
      desc: 'Scan incoming shipments and record quantities.',
      icon: PackageCheck,
      details: 'GRN #GRN-4412 (50 Units)',
    },
    {
      id: 4,
      name: 'Inventory Updated',
      title: 'Stock Sync',
      desc: 'Stock levels and average unit cost auto-update.',
      icon: Database,
      details: '+50 Units Added',
    },
    {
      id: 5,
      name: 'Supplier Payment',
      title: 'Settle Account',
      desc: 'Record vendor invoice payments & update balance.',
      icon: CreditCard,
      details: 'EFT Settled',
    },
  ]

  return (
    <section id="purchasing" className="py-20 md:py-32 bg-zinc-50 border-t border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-200 text-xs font-semibold text-zinc-900 font-mono mb-3">
            PURCHASING WORKFLOW
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950">
            From supplier to stock, without the spreadsheets.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600">
            A continuous automated replenishment pipeline connecting suppliers, purchase orders, stock receiving, and payments.
          </p>
        </div>

        {/* Horizontal Workflow Stepper */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon
            const isActive = activeStep === step.id
            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                onMouseEnter={() => setActiveStep(step.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                  isActive
                    ? 'bg-zinc-950 text-white border-zinc-950 shadow-xl scale-[1.02]'
                    : 'bg-white text-zinc-950 border-zinc-200 hover:border-zinc-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                        isActive ? 'bg-white text-zinc-950' : 'bg-zinc-100 text-zinc-900'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        isActive ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-600'
                      }`}
                    >
                      0{step.id}
                    </span>
                  </div>

                  <div className="text-xs font-bold uppercase tracking-wider font-mono opacity-60">
                    {step.name}
                  </div>
                  <h3 className="text-base font-bold mt-1 tracking-tight">{step.title}</h3>
                  <p className={`text-xs mt-2 leading-relaxed ${isActive ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {step.desc}
                  </p>
                </div>

                <div
                  className={`mt-4 pt-3 border-t text-[11px] font-mono line-clamp-1 ${
                    isActive ? 'border-zinc-800 text-zinc-300' : 'border-zinc-100 text-zinc-500'
                  }`}
                >
                  {step.details}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Realistic Purchase Order Card */}
        <div className="mt-12 max-w-3xl mx-auto bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs font-sans">
          <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
            <div>
              <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase">OFFICIAL PURCHASE ORDER</span>
              <h4 className="text-lg font-bold text-zinc-950 mt-0.5">PO #PO-2026-088</h4>
            </div>
            <span className="px-3 py-1 bg-zinc-950 text-white rounded text-xs font-mono font-bold">
              STATUS: RECEIVED & SYNCED
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 py-4 text-xs font-mono border-b border-zinc-100">
            <div>
              <span className="text-zinc-400">SUPPLIER</span>
              <div className="font-bold text-zinc-950 font-sans mt-0.5">Global Tech Wholesalers Ltd</div>
            </div>
            <div className="text-right">
              <span className="text-zinc-400">EXPECTED DELIVERY</span>
              <div className="font-bold text-zinc-950 mt-0.5">2026-10-10</div>
            </div>
          </div>

          <div className="space-y-2 pt-3 text-xs">
            <div className="flex justify-between font-mono font-bold text-zinc-400 text-[11px] pb-1 border-b border-zinc-100">
              <span>ORDERED SKUs</span>
              <span>QTY / AMOUNT</span>
            </div>
            <div className="flex justify-between text-zinc-900 font-medium py-1 border-b border-zinc-50">
              <span>Logitech MX Master 3S (Wireless Mouse)</span>
              <span className="font-mono">50 units &bull; $2,450.00</span>
            </div>
            <div className="flex justify-between text-zinc-900 font-medium py-1">
              <span>Mechanical Keyboard RGB Module</span>
              <span className="font-mono">20 units &bull; $2,400.00</span>
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-zinc-200 flex justify-between items-center text-xs font-mono">
            <span className="text-zinc-500">Warehouse Receiving Location: Main Store Terminal</span>
            <span className="font-bold text-zinc-950 font-sans text-sm">Total Value: $4,850.00</span>
          </div>
        </div>
      </div>
    </section>
  )
}
