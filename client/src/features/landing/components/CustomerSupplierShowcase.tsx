import { motion } from 'framer-motion'
import { Users, Truck } from 'lucide-react'

export function CustomerSupplierShowcase() {
  return (
    <section className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-900 font-mono mb-3">
            RELATIONSHIP MANAGEMENT
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
            Connected customer profiles & vendor accounts.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600">
            Maintain complete 360-degree visibility over customer store credits, outstanding balances, order history, and supplier account settlements.
          </p>
        </div>

        {/* 2 Large Side-by-Side Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: CUSTOMERS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-zinc-50 rounded-2xl border border-zinc-200 p-6 sm:p-8 space-y-6 hover:border-zinc-400 transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Customer CRM</span>
                  <h3 className="text-xl font-bold text-zinc-950">Customer Profiles & Credits</h3>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-white border border-zinc-200 text-zinc-900 text-xs font-mono font-semibold rounded-md">
                1,240 Accounts
              </span>
            </div>

            {/* Profile UI Snippet */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-2xs space-y-4 font-sans">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-zinc-950">Acme Retail Enterprises</div>
                  <div className="text-xs text-zinc-500 font-mono">Contact: Sarah Connor &bull; sarah@acmeretail.com</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500 font-mono">Account Balance</div>
                  <div className="text-sm font-bold text-zinc-900 font-mono">$340.00 Outstanding</div>
                </div>
              </div>

              {/* Purchase History */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 text-xs">
                <div className="text-[11px] font-bold text-zinc-400 uppercase font-mono">Recent Invoices</div>
                {[
                  { id: 'INV-2026-089', date: '2026-10-04', amount: '$1,245.00', status: 'Paid' },
                  { id: 'INV-2026-074', date: '2026-09-28', amount: '$340.00', status: 'Pending Payment' },
                  { id: 'INV-2026-051', date: '2026-09-15', amount: '$890.00', status: 'Paid' },
                ].map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-none font-mono">
                    <div>
                      <span className="font-semibold text-zinc-950">{inv.id}</span>
                      <span className="text-zinc-400 ml-2 text-[11px]">{inv.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-zinc-900">{inv.amount}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${inv.status === 'Paid' ? 'bg-zinc-100 text-zinc-900' : 'bg-zinc-900 text-white'}`}>
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Card 2: SUPPLIERS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-zinc-50 rounded-2xl border border-zinc-200 p-6 sm:p-8 space-y-6 hover:border-zinc-400 transition-all"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider font-mono">Vendor Hub</span>
                  <h3 className="text-xl font-bold text-zinc-950">Supplier Directory & POs</h3>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-white border border-zinc-200 text-zinc-900 text-xs font-mono font-semibold rounded-md">
                48 Suppliers
              </span>
            </div>

            {/* Vendor UI Snippet */}
            <div className="bg-white rounded-xl border border-zinc-200 p-4 shadow-2xs space-y-4 font-sans">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-base font-bold text-zinc-950">Global Logistics & Electronics Ltd</div>
                  <div className="text-xs text-zinc-500 font-mono">Terms: Net 30 &bull; Vendor Code: V-908</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500 font-mono">Payable Balance</div>
                  <div className="text-sm font-bold text-zinc-900 font-mono">$1,250.00 Due</div>
                </div>
              </div>

              {/* Purchase Orders */}
              <div className="space-y-2 pt-2 border-t border-zinc-100 text-xs">
                <div className="text-[11px] font-bold text-zinc-400 uppercase font-mono">Active Purchase Orders</div>
                {[
                  { id: 'PO-2026-088', date: '2026-10-02', amount: '$4,850.00', status: 'Received' },
                  { id: 'PO-2026-079', date: '2026-09-25', amount: '$1,250.00', status: 'Partially Paid' },
                  { id: 'PO-2026-061', date: '2026-09-10', amount: '$3,100.00', status: 'Completed' },
                ].map((po) => (
                  <div key={po.id} className="flex items-center justify-between py-1 border-b border-zinc-50 last:border-none font-mono">
                    <div>
                      <span className="font-semibold text-zinc-950">{po.id}</span>
                      <span className="text-zinc-400 ml-2 text-[11px]">{po.date}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-zinc-900">{po.amount}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-900 text-white font-sans">
                        {po.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
