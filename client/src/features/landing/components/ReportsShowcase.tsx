import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3,
  DollarSign,
  Warehouse,
} from 'lucide-react'

export function ReportsShowcase() {
  const [activeTab, setActiveTab] = useState<'sales' | 'profit' | 'inventory'>('sales')

  return (
    <section id="reports" className="py-20 md:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-semibold text-zinc-900 font-mono mb-3">
            RETAIL ANALYTICS & INTELLIGENCE
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-zinc-950">
            See what is happening inside your business.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600">
            Track daily sales velocity, monitor gross profit margins, audit operating expenses, and identify high-value VIP customer segments.
          </p>
        </div>

        {/* Tab Controls Bar */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 rounded-xl bg-zinc-100 border border-zinc-200 gap-2">
            {[
              { id: 'sales', label: 'Sales & Revenue', icon: BarChart3 },
              { id: 'profit', label: 'Profit & Loss (P&L)', icon: DollarSign },
              { id: 'inventory', label: 'Inventory & Customers', icon: Warehouse },
            ].map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-zinc-950 text-white shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl p-6 sm:p-8 text-white max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'sales' && (
              <motion.div
                key="sales"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* 4 Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Total Revenue</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">$128,450.00</div>
                    <div className="text-[10px] text-zinc-400 mt-1">+18.4% vs last month</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Completed Orders</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">842</div>
                    <div className="text-[10px] text-zinc-400 mt-1">100% fulfilled</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Items Sold</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">2,410</div>
                    <div className="text-[10px] text-zinc-400 mt-1">Avg 2.86 items/order</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Average Order Value</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">$152.55</div>
                    <div className="text-[10px] text-zinc-400 mt-1">+$12.30 YoY</div>
                  </div>
                </div>

                {/* Sales Chart + Payment Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-zinc-900 rounded-xl border border-zinc-800 p-4 flex flex-col justify-between">
                    <div className="flex justify-between items-center pb-3 border-b border-zinc-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">
                        Monthly Revenue Velocity ($)
                      </span>
                      <span className="text-xs font-mono text-zinc-400">2026 Fiscal Year</span>
                    </div>

                    <div className="h-44 pt-6 pb-2 flex items-end justify-between gap-3 px-2">
                      {[75, 90, 85, 110, 100, 130, 120, 145, 135, 160, 175, 190].map((val, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                          <div
                            style={{ height: `${val * 0.7}px` }}
                            className="w-full bg-zinc-700 group-hover:bg-white transition-colors rounded-t"
                          />
                          <span className="text-[10px] font-mono text-zinc-500">
                            {['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'][i]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-zinc-200 pb-3 border-b border-zinc-800">
                      Payment Method Share
                    </div>
                    <div className="space-y-3">
                      {[
                        { method: 'Credit & Debit Card', pct: 62 },
                        { method: 'Cash POS Checkout', pct: 28 },
                        { method: 'Customer Account Credit', pct: 10 },
                      ].map((pm) => (
                        <div key={pm.method} className="space-y-1">
                          <div className="flex justify-between text-xs text-zinc-400">
                            <span>{pm.method}</span>
                            <span className="font-mono font-bold text-white">{pm.pct}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div style={{ width: `${pm.pct}%` }} className="h-full bg-white" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'profit' && (
              <motion.div
                key="profit"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* P&L Statement Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Total Gross Revenue</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">$128,450</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Cost of Goods Sold (COGS)</div>
                    <div className="text-2xl font-bold font-mono text-zinc-300 mt-1">-$76,200</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Operating Expenses</div>
                    <div className="text-2xl font-bold font-mono text-zinc-300 mt-1">-$14,300</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Net Operating Profit</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">$37,950</div>
                  </div>
                </div>

                {/* Profit Margin Breakdown */}
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-zinc-800 text-xs">
                    <span className="font-bold text-zinc-200 uppercase font-mono">Margin Efficiency</span>
                    <span className="font-mono text-zinc-400">Net Profit Margin: 29.54%</span>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60">
                      <span>Gross Sales Revenue</span>
                      <span className="font-bold text-white">$128,450.00</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60">
                      <span>Direct Product Cost (COGS)</span>
                      <span className="text-zinc-400">-$76,200.00</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 font-bold text-zinc-200">
                      <span>Gross Profit</span>
                      <span>$52,250.00 (40.67%)</span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-zinc-800/60">
                      <span>Store Rent, Utilities & Shipping</span>
                      <span className="text-zinc-400">-$14,300.00</span>
                    </div>
                    <div className="flex justify-between items-center py-2 text-sm font-bold text-white pt-2 border-t border-zinc-700">
                      <span>Net Profit</span>
                      <span>$37,950.00 (29.54%)</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'inventory' && (
              <motion.div
                key="inventory"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Inventory & Customer Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Active SKU Count</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">1,420</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Low Stock Reorder</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">8 Items</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Customer Base</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">1,240</div>
                  </div>
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                    <div className="text-xs text-zinc-400">Repeat Buyers Rate</div>
                    <div className="text-2xl font-bold font-mono text-white mt-1">64.2%</div>
                  </div>
                </div>

                {/* VIP Customers Table */}
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4 space-y-3">
                  <div className="flex justify-between items-center pb-2 border-b border-zinc-800 text-xs font-mono text-zinc-400">
                    <span>TOP VIP CUSTOMERS BY REVENUE</span>
                    <span>LIFETIME SPEND</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {[
                      { name: 'Acme Retail Enterprises', orders: 24, spend: '$18,450.00' },
                      { name: 'Sarah Connor (Individual)', orders: 14, spend: '$8,290.00' },
                      { name: 'Apex Logistics Corp', orders: 19, spend: '$14,120.00' },
                      { name: 'TechSupply South Africa', orders: 11, spend: '$6,840.00' },
                    ].map((cust) => (
                      <div key={cust.name} className="flex justify-between items-center py-1.5 border-b border-zinc-800/60 last:border-none">
                        <div>
                          <div className="font-semibold text-white">{cust.name}</div>
                          <div className="text-[11px] text-zinc-500 font-mono">{cust.orders} Orders Completed</div>
                        </div>
                        <span className="font-mono font-bold text-white">{cust.spend}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  )
}
