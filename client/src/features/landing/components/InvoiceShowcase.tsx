import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Printer,
  Download,
  Save,
  Plus,
  Trash2,
  QrCode,
} from 'lucide-react'

export function InvoiceShowcase() {
  const [customerName, setCustomerName] = useState('Apex Retail Solutions Ltd')
  const [items, setItems] = useState([
    { description: 'Jcom POS Terminal Hardware', qty: 2, rate: 499.0 },
    { description: 'Laser Barcode Scanner Module', qty: 2, rate: 89.0 },
  ])

  const addItem = () => {
    setItems([...items, { description: 'Thermal Paper Rolls (50 Pack)', qty: 1, rate: 45.0 }])
  }

  const removeItem = (idx: number) => {
    if (items.length <= 1) return
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateItem = (idx: number, field: string, val: any) => {
    setItems(
      items.map((item, i) => (i === idx ? { ...item, [field]: val } : item))
    )
  }

  const subtotal = items.reduce((sum, item) => sum + item.qty * item.rate, 0)
  const vat = subtotal * 0.15
  const grandTotal = subtotal + vat

  return (
    <section id="invoices" className="py-20 md:py-32 bg-zinc-50 border-t border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-200 text-xs font-semibold text-zinc-900 font-mono mb-3">
            TAX INVOICING ENGINE
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-950">
            Compliant A4 invoices generated in real time.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-zinc-600">
            Generate, preview, print, download PDF or email official tax invoices with instant line-item calculations and verification QR codes.
          </p>
        </div>

        {/* Animated Split View Container */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Interactive Form (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-zinc-200 p-6 shadow-xs space-y-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">Invoice Generator Form</span>
              <span className="text-xs font-mono font-bold text-zinc-900">Live Preview Interactive</span>
            </div>

            {/* Customer Input */}
            <div>
              <label className="text-xs font-semibold text-zinc-950">Customer Name / Organization</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full mt-1 px-3 py-1.5 text-xs font-medium bg-zinc-50 border border-zinc-200 rounded-md focus:outline-none focus:border-zinc-950"
              />
            </div>

            {/* Items List Form */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-950">Line Items</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="text-xs text-zinc-900 font-semibold hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Line Item
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      className="w-full px-2 py-1 bg-white border border-zinc-200 rounded text-xs font-medium"
                    />
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="ml-2 text-zinc-400 hover:text-zinc-950"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <div className="w-1/2">
                      <span className="text-[10px] text-zinc-400">Qty</span>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) => updateItem(idx, 'qty', parseInt(e.target.value) || 1)}
                        className="w-full px-2 py-1 bg-white border border-zinc-200 rounded text-xs"
                      />
                    </div>
                    <div className="w-1/2">
                      <span className="text-[10px] text-zinc-400">Rate ($)</span>
                      <input
                        type="number"
                        min="0"
                        value={item.rate}
                        onChange={(e) => updateItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 bg-white border border-zinc-200 rounded text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Summary */}
            <div className="pt-3 border-t border-zinc-200 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>VAT (15%)</span>
                <span>${vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-zinc-950 text-sm pt-1 border-t border-zinc-100">
                <span>Grand Total</span>
                <span>${grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Realistic A4 Invoice Preview (7 cols) */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-zinc-300 shadow-2xl p-6 sm:p-10 font-sans text-zinc-950 space-y-6 relative overflow-hidden">
              {/* Invoice Header */}
              <div className="flex justify-between items-start pb-6 border-b border-zinc-200">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded border border-zinc-300 bg-white text-black flex items-center justify-center font-extrabold text-[10px]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                      Jcom
                    </div>
                    <span className="font-extrabold text-xl tracking-tight text-zinc-950" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Jcom Retail</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-2 space-y-0.5">
                    <div>100 Commerce Boulevard, Suite 400</div>
                    <div>VAT Registration: 4901928374</div>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <div className="text-xs font-bold text-zinc-400 uppercase">TAX INVOICE</div>
                  <div className="text-lg font-bold text-zinc-950 mt-0.5">INV-2026-0089</div>
                  <div className="text-xs text-zinc-500 mt-1">Date: 2026-10-08</div>
                  <div className="text-xs text-zinc-500">Due Date: Net 15 Days</div>
                </div>
              </div>

              {/* Bill To */}
              <div className="grid grid-cols-2 gap-4 py-2 border-b border-zinc-100">
                <div>
                  <div className="text-[11px] font-bold uppercase text-zinc-400 font-mono">Billed To</div>
                  <div className="text-sm font-bold text-zinc-950 mt-1">{customerName}</div>
                  <div className="text-xs text-zinc-500">Commercial Account &bull; Tax ID: 90281</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-bold uppercase text-zinc-400 font-mono">Verification</div>
                  <div className="inline-flex items-center gap-1 text-xs font-mono text-zinc-700 bg-zinc-100 px-2 py-1 rounded mt-1">
                    <QrCode className="w-3.5 h-3.5 text-zinc-900" /> Verified QR Code
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-zinc-400 pb-2 border-b border-zinc-200">
                  <span>ITEM DESCRIPTION</span>
                  <div className="flex gap-8">
                    <span>QTY</span>
                    <span>PRICE</span>
                    <span>TOTAL</span>
                  </div>
                </div>

                <div className="space-y-2 min-h-[120px]">
                  {items.map((item, idx) => (
                    <motion.div
                      key={idx}
                      layout
                      className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-100 last:border-none"
                    >
                      <span className="font-semibold text-zinc-900">{item.description}</span>
                      <div className="flex items-center gap-8 font-mono text-zinc-800">
                        <span className="w-8 text-center">{item.qty}</span>
                        <span className="w-16 text-right">${item.rate.toFixed(2)}</span>
                        <span className="w-20 text-right font-bold text-zinc-950">
                          ${(item.qty * item.rate).toFixed(2)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="flex justify-end pt-4 border-t border-zinc-200">
                <div className="w-64 space-y-2 text-xs font-mono">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal</span>
                    <span>${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>VAT (15%)</span>
                    <span>${vat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-zinc-950 pt-2 border-t border-zinc-200 font-sans">
                    <span>Total Amount Due</span>
                    <span>${grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-6 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-200">
                    <Save className="w-3.5 h-3.5" /> Save Draft
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-200">
                    <Printer className="w-3.5 h-3.5" /> Print
                  </button>
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded border border-zinc-200">
                    <Download className="w-3.5 h-3.5" /> Download PDF
                  </button>
                </div>
                <button className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-zinc-950 hover:bg-zinc-800 rounded">
                  Generate Invoice
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
