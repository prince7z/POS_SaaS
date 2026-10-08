import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Plus,
  Minus,
  CreditCard,
  CheckCircle2,
  Barcode,
  Tag,
  UserCheck,
  RotateCcw,
} from 'lucide-react'

interface POSItem {
  id: string
  name: string
  price: number
  stock: number
  sku: string
}

export function POSShowcase() {
  const [products, setProducts] = useState<POSItem[]>([
    { id: '1', name: 'Logitech MX Master 3S', price: 99.0, stock: 18, sku: 'SKU-8821' },
    { id: '2', name: 'Keychron K2 Wireless Keyboard', price: 119.0, stock: 12, sku: 'SKU-4412' },
    { id: '3', name: 'Dell UltraSharp 27 4K Monitor', price: 449.0, stock: 5, sku: 'SKU-9901' },
    { id: '4', name: 'Anker 737 Power Bank 24,000mAh', price: 129.0, stock: 22, sku: 'SKU-3120' },
  ])

  const [cart, setCart] = useState<{ item: POSItem; qty: number }[]>([
    { item: { id: '1', name: 'Logitech MX Master 3S', price: 99.0, stock: 18, sku: 'SKU-8821' }, qty: 1 },
  ])

  const [lastSaleSuccess, setLastSaleSuccess] = useState(false)
  const [lastSaleAmount, setLastSaleAmount] = useState<number>(0)

  const addToCart = (product: POSItem) => {
    if (product.stock <= 0) return
    setCart((prev) => {
      const existing = prev.find((c) => c.item.id === product.id)
      if (existing) {
        return prev.map((c) => (c.item.id === product.id ? { ...c, qty: c.qty + 1 } : c))
      }
      return [...prev, { item: product, qty: 1 }]
    })
  }

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => {
          if (c.item.id === id) {
            const newQty = c.qty + delta
            return newQty > 0 ? { ...c, qty: newQty } : null
          }
          return c
        })
        .filter(Boolean) as { item: POSItem; qty: number }[]
    )
  }

  const subtotal = cart.reduce((acc, c) => acc + c.item.price * c.qty, 0)
  const tax = subtotal * 0.15
  const total = subtotal + tax

  const handleCheckout = () => {
    if (cart.length === 0) return

    // Deduct stock
    setProducts((prev) =>
      prev.map((p) => {
        const cartMatch = cart.find((c) => c.item.id === p.id)
        if (cartMatch) {
          return { ...p, stock: Math.max(0, p.stock - cartMatch.qty) }
        }
        return p
      })
    )

    setLastSaleAmount(total)
    setLastSaleSuccess(true)
    setCart([])

    setTimeout(() => {
      setLastSaleSuccess(false)
    }, 4000)
  }

  return (
    <section id="pos" className="py-20 md:py-32 bg-zinc-50 border-t border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Feature Description */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-200 text-xs font-semibold text-zinc-900 font-mono">
              POINT OF SALE
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
              Checkout built for speed.
            </h2>

            <p className="text-base text-zinc-600 leading-relaxed">
              Designed for high-volume retail operations. Perform instant barcode lookups, select customers, apply line-item discounts, split payments and generate tax invoices in seconds.
            </p>

            {/* Feature List */}
            <div className="space-y-3 pt-2">
              {[
                { title: 'Barcode & SKU Instant Search', desc: 'Scan items using standard USB/Bluetooth barcode scanners', icon: Barcode },
                { title: 'Customer & Account Lookup', desc: 'Attach customer profiles, store credit & credit limits', icon: UserCheck },
                { title: 'Flexible Discount Engine', desc: 'Apply percentage or fixed amount discounts instantly', icon: Tag },
                { title: 'Multi-Payment & Split Tender', desc: 'Accept cash, card, EFT or split across multiple methods', icon: CreditCard },
                { title: 'Automatic Inventory Deduction', desc: 'Stock quantities update instantly upon sale completion', icon: RotateCcw },
              ].map((feat) => {
                const Icon = feat.icon
                return (
                  <div key={feat.title} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded bg-zinc-950 text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-950">{feat.title}</div>
                      <div className="text-xs text-zinc-500">{feat.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Column: Interactive POS Checkout Simulator */}
          <div className="lg:col-span-7">
            <div className="bg-zinc-950 rounded-2xl border border-zinc-800 shadow-2xl p-4 sm:p-6 text-white relative">
              {/* Top Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  <span className="text-xs font-mono text-zinc-400">Terminal 01 &bull; Interactive Simulator</span>
                </div>
                <div className="text-xs font-mono text-zinc-400">
                  Click product to test sale flow
                </div>
              </div>

              {/* Toast Success Notification */}
              <AnimatePresence>
                {lastSaleSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="my-3 p-3 bg-zinc-900 border border-zinc-700 rounded-lg flex items-center justify-between text-xs text-white"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="font-bold">Sale Completed Successfully!</span>
                        <span className="text-zinc-400 ml-1.5 font-mono">${lastSaleAmount.toFixed(2)}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400">Inventory updated</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Grid + Cart Layout */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 mt-4">
                {/* Product Select Grid (7 cols) */}
                <div className="sm:col-span-7 space-y-3">
                  <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-400">
                    <Search className="w-4 h-4 text-zinc-500" />
                    <span>Search product catalog...</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {products.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => addToCart(p)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                          p.stock > 0
                            ? 'bg-zinc-900 border-zinc-800 hover:border-zinc-500 active:scale-98'
                            : 'bg-zinc-900/50 border-zinc-800/50 opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <div className="text-xs font-semibold text-zinc-200 line-clamp-1">{p.name}</div>
                        <div className="text-[10px] font-mono text-zinc-500 mt-0.5">{p.sku}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-bold font-mono text-white">${p.price.toFixed(2)}</span>
                          <span className={`text-[10px] font-mono font-medium ${p.stock <= 3 ? 'text-amber-400' : 'text-zinc-400'}`}>
                            {p.stock} in stock
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cart View (5 cols) */}
                <div className="sm:col-span-5 bg-zinc-900 rounded-xl border border-zinc-800 p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-zinc-200">Current Cart</span>
                      <span className="text-xs font-mono text-zinc-400">{cart.length} items</span>
                    </div>

                    <div className="space-y-2 mt-3 max-h-44 overflow-y-auto pr-1">
                      {cart.length === 0 ? (
                        <div className="text-center py-8 text-xs text-zinc-500">
                          Cart is empty. Click any product on left to add.
                        </div>
                      ) : (
                        cart.map(({ item, qty }) => (
                          <div key={item.id} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-800/80">
                            <div className="flex-1 pr-2">
                              <div className="font-medium text-white line-clamp-1">{item.name}</div>
                              <div className="text-[10px] font-mono text-zinc-400">${item.price.toFixed(2)} each</div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => updateQty(item.id, -1)}
                                className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-mono text-xs font-bold w-4 text-center">{qty}</span>
                              <button
                                onClick={() => updateQty(item.id, 1)}
                                className="w-5 h-5 rounded bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Checkout Action */}
                  <div className="pt-3 border-t border-zinc-800 space-y-2 mt-4">
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Subtotal</span>
                      <span className="font-mono">${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>Tax (15% VAT)</span>
                      <span className="font-mono">${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-1">
                      <span>Total</span>
                      <span className="font-mono text-sm">${total.toFixed(2)}</span>
                    </div>

                    <button
                      disabled={cart.length === 0}
                      onClick={handleCheckout}
                      className={`w-full py-2.5 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        cart.length > 0
                          ? 'bg-white text-zinc-950 hover:bg-zinc-200 active:scale-98'
                          : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      Complete Checkout (${total.toFixed(2)})
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
