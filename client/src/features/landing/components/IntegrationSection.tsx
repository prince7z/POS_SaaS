import { motion } from 'framer-motion'
import { ArrowLeftRight, ShoppingBag } from 'lucide-react'

export function IntegrationSection() {
  return (
    <section id="integrations" className="py-20 md:py-32 bg-zinc-50 border-t border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-200 text-xs font-semibold text-zinc-900 font-mono mb-3">
            MARKETPLACE INTEGRATION
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
            Native Takealot Seller Sync.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600">
            Automatically synchronize product catalogs, live inventory allocations, seller orders, and sales revenue directly with your Takealot seller account.
          </p>
        </div>

        {/* Integration Connection Diagram */}
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-zinc-200 p-8 sm:p-12 shadow-xs">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative">
            {/* Jcom Core */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="flex flex-col items-center text-center space-y-3"
            >
              <div className="w-20 h-20 rounded-2xl bg-zinc-950 text-white flex items-center justify-center shadow-lg">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <div>
                <div className="text-base font-bold text-zinc-950" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Jcom Core Engine</div>
                <div className="text-xs text-zinc-500 font-mono">Retail OS & Master Catalog</div>
              </div>
            </motion.div>

            {/* Animated Connection Pipeline */}
            <div className="flex flex-col items-center justify-center space-y-2 flex-1 w-full max-w-xs">
              <div className="w-full relative flex items-center justify-center">
                {/* Line */}
                <div className="w-full h-0.5 bg-zinc-200" />
                {/* Pulse */}
                <motion.div
                  animate={{ x: [-100, 100] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="w-4 h-4 rounded-full bg-zinc-950 absolute"
                />
              </div>
              <div className="flex items-center gap-1 text-xs font-mono font-bold text-zinc-700 bg-zinc-100 px-3 py-1 rounded-full border border-zinc-200">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                Bidirectional API Sync
              </div>
            </div>

            {/* Takealot Node */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center text-center space-y-3"
            >
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 text-white border border-zinc-800 flex items-center justify-center shadow-lg font-bold font-mono text-xl">
                TA
              </div>
              <div>
                <div className="text-base font-bold text-zinc-950">Takealot Seller Portal</div>
                <div className="text-xs text-zinc-500 font-mono">E-Commerce Marketplace</div>
              </div>
            </motion.div>
          </div>

          {/* 4 Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 pt-8 border-t border-zinc-100">
            {[
              { title: 'Product Synchronization', desc: 'Sync SKUs, barcodes, images & pricing automatically' },
              { title: 'Seller Integration', desc: 'Connect Takealot Seller API with instant authentication' },
              { title: 'Inventory Synchronization', desc: 'Reserve stock for Takealot orders to prevent overselling' },
              { title: 'Order Synchronization', desc: 'Pull customer orders & payouts straight into Jcom' },
            ].map((pillar) => (
              <div key={pillar.title} className="p-3 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                <div className="text-xs font-bold text-zinc-950">{pillar.title}</div>
                <div className="text-[11px] text-zinc-600 leading-relaxed">{pillar.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
