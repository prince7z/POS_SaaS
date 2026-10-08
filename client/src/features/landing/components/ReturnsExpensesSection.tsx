import { motion } from 'framer-motion'
import { RotateCcw, Receipt, ArrowRight } from 'lucide-react'

export function ReturnsExpensesSection() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: RETURNS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-zinc-50 rounded-2xl border border-zinc-200 p-6 sm:p-8 space-y-6 hover:border-zinc-400 transition-all"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
              <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Customer Returns</span>
                <h3 className="text-xl font-bold text-zinc-950">Returns & Refund Workflow</h3>
              </div>
            </div>

            {/* Sequence Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
              <span className="px-2.5 py-1 rounded bg-white border border-zinc-200 text-zinc-900">Invoice Lookup</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              <span className="px-2.5 py-1 rounded bg-white border border-zinc-200 text-zinc-900">Select Items</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              <span className="px-2.5 py-1 rounded bg-white border border-zinc-200 text-zinc-900">Restock / Damage</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              <span className="px-2.5 py-1 rounded bg-zinc-950 text-white">Refund / Store Credit</span>
            </div>

            {/* Realistic UI Snippet */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center font-mono">
                <span className="font-bold text-zinc-950">Return #RET-1042</span>
                <span className="text-zinc-500">Ref: INV-2026-089</span>
              </div>
              <div className="flex justify-between text-zinc-700">
                <span>Wireless Mouse (Returned to Stock)</span>
                <span className="font-mono font-bold">$49.00 Refunded</span>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">Method: Store Credit Voucher #CR-9012 Issued</div>
            </div>
          </motion.div>

          {/* Card 2: EXPENSES */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-50 rounded-2xl border border-zinc-200 p-6 sm:p-8 space-y-6 hover:border-zinc-400 transition-all"
          >
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
              <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Operating Expenses</span>
                <h3 className="text-xl font-bold text-zinc-950">Expense Tracking & Audit</h3>
              </div>
            </div>

            {/* Sequence Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono font-bold">
              <span className="px-2.5 py-1 rounded bg-white border border-zinc-200 text-zinc-900">Date</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              <span className="px-2.5 py-1 rounded bg-white border border-zinc-200 text-zinc-900">Category</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              <span className="px-2.5 py-1 rounded bg-white border border-zinc-200 text-zinc-900">Amount & Receipt</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
              <span className="px-2.5 py-1 rounded bg-zinc-950 text-white">Expense Report</span>
            </div>

            {/* Realistic UI Snippet */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 space-y-3 font-sans text-xs">
              <div className="flex justify-between items-center font-mono">
                <span className="font-bold text-zinc-950">Expense #EXP-9081</span>
                <span className="text-zinc-500">Utilities & Electricity</span>
              </div>
              <div className="flex justify-between text-zinc-700">
                <span>Monthly Store Power Supply</span>
                <span className="font-mono font-bold">$640.00 Paid</span>
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">Logged by: Master Admin &bull; Receipt Attached</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
