import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  TrendingUp,
  ShoppingCart,
  Package,
  CheckCircle2,
  Search,
  CreditCard,
  Building2,
} from 'lucide-react'

export function Hero() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos'>('dashboard')

  const scrollToFeatures = () => {
    const element = document.querySelector('#features')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <section id="hero" className="relative pt-16 pb-24 md:pt-28 md:pb-40 overflow-hidden bg-white">
      {/* Subtle Monochrome Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-25 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 relative z-10">
        {/* Eyebrow Pill */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-8"
        >
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-zinc-100 border border-zinc-200/90 text-xs font-mono font-semibold text-zinc-900 tracking-wider uppercase">
            <span className="w-2 h-2 rounded-full bg-zinc-950 animate-pulse" />
            <span>ALL-IN-ONE RETAIL OPERATING SYSTEM</span>
          </div>
        </motion.div>

        {/* Hero Headline & Body */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center max-w-5xl mx-auto space-y-6"
        >
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-zinc-950 leading-[1.08]">
            Run your entire retail business from one place.
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl text-zinc-600 font-normal leading-relaxed max-w-3xl mx-auto">
            Point of sale, inventory, purchasing, customers, invoices and reporting — connected in one simple system.
          </p>

          {/* CTA Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 text-sm font-bold text-white bg-zinc-950 hover:bg-zinc-800 rounded-xl transition-all shadow-md active:scale-98 group"
            >
              Get Started
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={scrollToFeatures}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-sm font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200/80 rounded-xl border border-zinc-200/90 transition-all"
            >
              Explore Product
            </button>
          </div>
        </motion.div>

        {/* Large Product Preview Window Frame (Centerpiece) */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-16 sm:mt-20 max-w-6xl mx-auto"
        >
          <div className="rounded-2xl border border-zinc-300 bg-zinc-950 shadow-2xl overflow-hidden text-zinc-100">
            {/* Window Bar Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-zinc-700" />
                <span className="w-3 h-3 rounded-full bg-zinc-700" />
                <span className="w-3 h-3 rounded-full bg-zinc-700" />
                <span className="text-xs font-mono text-zinc-400 ml-3">shoppro.app/dashboard</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'dashboard'
                      ? 'bg-zinc-800 text-white border border-zinc-700 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Overview Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('pos')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === 'pos'
                      ? 'bg-zinc-800 text-white border border-zinc-700 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  POS Checkout Simulator
                </button>
              </div>
            </div>

            {/* Application Interface Body */}
            <div className="bg-zinc-950 p-6 sm:p-8 text-zinc-900">
              {activeTab === 'dashboard' ? (
                <div className="space-y-6">
                  {/* Dashboard Header Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800 text-white">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono uppercase tracking-wider">
                        <Building2 className="w-4 h-4 text-zinc-400" />
                        <span>MAIN RETAIL STORE &bull; TERMINAL 01</span>
                      </div>
                      <h2 className="text-2xl font-extrabold text-white tracking-tight mt-1">Operational Overview</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono font-semibold text-emerald-400">
                        ● All Systems Active
                      </span>
                    </div>
                  </div>

                  {/* 4 Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Today's Sales Revenue</span>
                        <TrendingUp className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="text-3xl font-extrabold font-mono text-white tracking-tight">$24,850.00</div>
                      <div className="text-xs text-zinc-400 font-mono">+14.2% vs yesterday</div>
                    </div>

                    <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Completed Orders</span>
                        <ShoppingCart className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="text-3xl font-extrabold font-mono text-white tracking-tight">142</div>
                      <div className="text-xs text-zinc-400 font-mono">100% fulfillment rate</div>
                    </div>

                    <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Active SKUs</span>
                        <Package className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="text-3xl font-extrabold font-mono text-white tracking-tight">1,420</div>
                      <div className="text-xs text-zinc-400 font-mono">8 items require reorder</div>
                    </div>

                    <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Gross Profit Margin</span>
                        <CheckCircle2 className="w-4 h-4 text-zinc-400" />
                      </div>
                      <div className="text-3xl font-extrabold font-mono text-white tracking-tight">38.5%</div>
                      <div className="text-xs text-zinc-400 font-mono">Gross Profit: $9,567.25</div>
                    </div>
                  </div>

                  {/* Main Velocity Chart + Activity */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-zinc-900 p-6 rounded-xl border border-zinc-800 flex flex-col justify-between space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs font-mono text-zinc-300">
                        <span className="font-bold uppercase tracking-wider">Hourly Sales Velocity ($)</span>
                        <span>Peak: 17:00 ($3,200)</span>
                      </div>
                      <div className="h-48 pt-6 pb-2 flex items-end justify-between gap-3 px-2">
                        {[45, 65, 35, 90, 110, 75, 130, 150, 95, 160, 140, 180].map((val, i) => (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1.5 group">
                            <div
                              style={{ height: `${val * 0.8}px` }}
                              className="w-full bg-zinc-700 group-hover:bg-white transition-colors rounded-t"
                            />
                            <span className="text-[10px] text-zinc-500 font-mono">{i + 8}h</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-800 space-y-4">
                      <div className="text-xs font-bold font-mono uppercase tracking-wider text-zinc-300 pb-3 border-b border-zinc-800">
                        Live POS Activity
                      </div>
                      <div className="space-y-3">
                        {[
                          { id: '#INV-1049', customer: 'Walk-in Customer', amount: '$149.00', method: 'Card' },
                          { id: '#INV-1048', customer: 'Acme Retail Ltd', amount: '$1,250.00', method: 'Account' },
                          { id: '#INV-1047', customer: 'Sarah Connor', amount: '$89.50', method: 'Cash' },
                        ].map((tx) => (
                          <div key={tx.id} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-800/80 last:border-none">
                            <div>
                              <div className="font-mono font-bold text-white">{tx.id}</div>
                              <div className="text-zinc-400 text-[11px]">{tx.customer} &bull; {tx.method}</div>
                            </div>
                            <div className="font-mono font-bold text-zinc-100">{tx.amount}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* POS Checkout Interface Mockup */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-white">
                  <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center gap-3 bg-zinc-900 p-3.5 rounded-xl border border-zinc-800 text-xs text-zinc-400">
                      <Search className="w-4 h-4 text-zinc-400" />
                      <span>Search catalog by SKU, barcode, or title...</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { title: 'Wireless Laser Scanner', price: '$89.00', stock: '24 in stock' },
                        { title: 'Mechanical Keyboard RGB', price: '$129.00', stock: '12 in stock' },
                        { title: '4K USB-C Monitor Dock', price: '$189.00', stock: '8 in stock' },
                        { title: 'Thermal Paper Roll (Pack 10)', price: '$30.00', stock: '100 in stock' },
                        { title: 'Aluminum Laptop Stand', price: '$45.00', stock: '30 in stock' },
                        { title: 'Bluetooth Receipt Printer', price: '$199.00', stock: '15 in stock' },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 hover:border-zinc-500 cursor-pointer transition-all space-y-2"
                        >
                          <div className="text-xs font-semibold text-zinc-200 line-clamp-1">{item.title}</div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-sm font-bold font-mono text-white">{item.price}</span>
                            <span className="text-[10px] font-mono text-zinc-400">{item.stock}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-3 border-b border-zinc-800 text-xs font-mono font-bold text-zinc-200">
                        <span>Current Cart</span>
                        <span>2 Items</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-zinc-800/80">
                          <div>
                            <div className="font-semibold text-white">Wireless Laser Scanner</div>
                            <div className="text-[10px] text-zinc-400">1 x $89.00</div>
                          </div>
                          <span className="font-mono font-bold">$89.00</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-zinc-800/80">
                          <div>
                            <div className="font-semibold text-white">Thermal Paper Roll</div>
                            <div className="text-[10px] text-zinc-400">1 x $30.00</div>
                          </div>
                          <span className="font-mono font-bold">$30.00</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-zinc-800 space-y-2 text-xs font-mono">
                      <div className="flex justify-between text-zinc-400">
                        <span>Subtotal</span>
                        <span>$119.00</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Tax (15% VAT)</span>
                        <span>$17.85</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-zinc-800 font-sans">
                        <span>Total Payable</span>
                        <span>$136.85</span>
                      </div>
                      <button
                        onClick={() => navigate('/login')}
                        className="w-full mt-2 py-3 bg-white text-zinc-950 font-bold text-xs rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <CreditCard className="w-4 h-4" />
                        Complete Checkout ($136.85)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
