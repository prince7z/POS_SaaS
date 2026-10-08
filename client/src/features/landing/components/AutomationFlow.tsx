import { motion } from 'framer-motion'
import {
  ShoppingCart,
  Warehouse,
  FileText,
  Users,
  BarChart3,
  CheckCircle2,
  ArrowDown,
} from 'lucide-react'

export function AutomationFlow() {
  const steps = [
    { title: 'Sale Completed', desc: 'Cashier checks out transaction at POS terminal', icon: ShoppingCart },
    { title: 'Inventory Deducted', desc: 'Stock quantities update in real time across catalog', icon: Warehouse },
    { title: 'Invoice Generated', desc: 'Official tax invoice issued with QR verification', icon: FileText },
    { title: 'Customer Ledger Updated', desc: 'Purchase recorded on customer account profile', icon: Users },
    { title: 'Analytics & P&L Updated', desc: 'Revenue, margin & COGS immediately sync', icon: BarChart3 },
  ]

  return (
    <section className="py-20 md:py-32 bg-zinc-50 border-t border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-200 text-xs font-semibold text-zinc-900 font-mono mb-3">
            BUSINESS AUTOMATION PIPELINE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950">
            One action keeps everything in sync.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600">
            Every transaction executed at checkout automatically updates every downstream module with zero manual data entry.
          </p>
        </div>

        {/* Sequential Vertical Flow */}
        <div className="max-w-3xl mx-auto space-y-4">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div key={step.title} className="flex flex-col items-center">
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className="w-full bg-white rounded-xl border border-zinc-200 p-4 sm:p-5 flex items-center justify-between hover:border-zinc-400 transition-all shadow-xs"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center font-bold text-sm shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-950">{step.title}</div>
                      <div className="text-xs text-zinc-500">{step.desc}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                    <CheckCircle2 className="w-4 h-4 text-zinc-900" />
                    <span className="hidden sm:inline">Auto-Executed</span>
                  </div>
                </motion.div>

                {idx < steps.length - 1 && (
                  <div className="py-2">
                    <ArrowDown className="w-4 h-4 text-zinc-400 animate-bounce" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
