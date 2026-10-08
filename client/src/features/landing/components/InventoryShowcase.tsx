import { motion } from 'framer-motion'
import {
  Warehouse,
  AlertTriangle,
  Search,
} from 'lucide-react'

export function InventoryShowcase() {
  const stockItems = [
    { name: 'Wireless Ergonomic Mouse', sku: 'SKU-8821', category: 'Accessories', qty: 42, min: 10, status: 'In Stock' },
    { name: 'Mechanical Keyboard RGB', sku: 'SKU-4412', category: 'Peripherals', qty: 4, min: 10, status: 'Low Stock' },
    { name: 'Dell UltraSharp 4K Monitor', sku: 'SKU-9901', category: 'Monitors', qty: 15, min: 5, status: 'In Stock' },
    { name: 'Anker 737 Power Bank 24k', sku: 'SKU-3120', category: 'Power', qty: 0, min: 8, status: 'Out of Stock' },
    { name: 'USB-C Multiport Adapter 8-in-1', sku: 'SKU-1102', category: 'Accessories', qty: 65, min: 15, status: 'In Stock' },
  ]

  return (
    <section id="inventory" className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Large Inventory Dashboard UI (7 cols) */}
          <div className="lg:col-span-7">
            <div className="bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl p-5 sm:p-6 text-white space-y-5">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white">
                    <Warehouse className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">Stock Control Hub</h3>
                    <p className="text-[11px] text-zinc-400 font-mono">Multi-Branch Sync Active</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 rounded-lg border border-zinc-800 text-xs text-zinc-400 font-mono">
                  <Search className="w-3.5 h-3.5" />
                  <span>Filter SKUs...</span>
                </div>
              </div>

              {/* Table */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-[11px] text-zinc-400 font-mono">
                  <span>ITEM / SKU</span>
                  <span>STOCK LEVEL</span>
                </div>

                <div className="space-y-2">
                  {stockItems.map((item, i) => (
                    <motion.div
                      key={item.sku}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between py-1.5 border-b border-zinc-800/60 text-xs last:border-none"
                    >
                      <div>
                        <div className="font-semibold text-white line-clamp-1">{item.name}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{item.sku} &bull; {item.category}</div>
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <div>
                          <div className="font-mono font-bold text-white text-xs">{item.qty} pcs</div>
                          <div className="text-[9px] text-zinc-500">Min: {item.min}</div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase font-semibold ${
                            item.status === 'In Stock'
                              ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                              : item.status === 'Low Stock'
                              ? 'bg-zinc-800 text-zinc-200 border border-zinc-600'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700 opacity-60'
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Monochrome Stock Distribution Chart */}
              <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-200 pb-2 border-b border-zinc-800 font-mono">
                  Stock Category Valuation
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Peripherals', pct: 45 },
                    { label: 'Monitors', pct: 28 },
                    { label: 'Power Accessories', pct: 17 },
                    { label: 'POS Hardware', pct: 10 },
                  ].map((cat) => (
                    <div key={cat.label} className="space-y-1">
                      <div className="flex justify-between text-xs text-zinc-400">
                        <span>{cat.label}</span>
                        <span className="font-mono font-bold text-white">{cat.pct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div style={{ width: `${cat.pct}%` }} className="h-full bg-white rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Copy & Stat Metrics (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-900 font-mono">
              INVENTORY CONTROL
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
              Always know what's in stock.
            </h2>

            <p className="text-base text-zinc-600 leading-relaxed">
              Track stock levels across branches in real time. Get automated low stock reorder alerts, prevent stockouts, and audit inventory valuation on demand.
            </p>

            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-1"
              >
                <div className="text-xs font-semibold text-zinc-500">Total Products</div>
                <div className="text-2xl font-bold font-mono text-zinc-950">1,420 SKUs</div>
                <div className="text-[11px] text-zinc-500">Across all branches</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-1"
              >
                <div className="text-xs font-semibold text-zinc-500">Inventory Value</div>
                <div className="text-2xl font-bold font-mono text-zinc-950">$184,200</div>
                <div className="text-[11px] text-zinc-500">Cost basis valuation</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-1"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-500">
                  <span>Low Stock</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-zinc-900" />
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-950">8 Items</div>
                <div className="text-[11px] text-zinc-500">Requires PO reorder</div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 space-y-1"
              >
                <div className="text-xs font-semibold text-zinc-500">Out of Stock</div>
                <div className="text-2xl font-bold font-mono text-zinc-950">2 Items</div>
                <div className="text-[11px] text-zinc-500">0 quantity remaining</div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
