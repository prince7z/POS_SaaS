import { Link, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { JcomLogo } from '@/components/common/JcomLogo'

export function LandingFooter() {
  const navigate = useNavigate()

  return (
    <footer className="bg-white border-t border-zinc-200 py-12 text-zinc-950 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-12 border-b border-zinc-200">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <Link to="/" className="flex items-center">
              <JcomLogo size="sm" />
            </Link>
            <p className="text-xs text-zinc-600 leading-relaxed max-w-xs">
              All-in-one connected retail operating system. Point of sale, inventory control, purchasing, customer CRM, invoicing and analytics.
            </p>
          </div>

          {/* Core Modules */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-950 font-mono mb-3">
              Core OS Modules
            </div>
            <ul className="space-y-2 text-xs text-zinc-600">
              <li><a href="#pos" className="hover:text-zinc-950">Point of Sale (POS)</a></li>
              <li><a href="#inventory" className="hover:text-zinc-950">Inventory & Stock Control</a></li>
              <li><a href="#purchasing" className="hover:text-zinc-950">Purchasing & POs</a></li>
              <li><a href="#invoices" className="hover:text-zinc-950">Compliant Tax Invoices</a></li>
            </ul>
          </div>

          {/* Analytics & Integrations */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-950 font-mono mb-3">
              System & Reports
            </div>
            <ul className="space-y-2 text-xs text-zinc-600">
              <li><a href="#reports" className="hover:text-zinc-950">Sales Velocity Analytics</a></li>
              <li><a href="#reports" className="hover:text-zinc-950">Profit & Loss (P&L) Reports</a></li>
              <li><a href="#integrations" className="hover:text-zinc-950">Takealot Seller Sync</a></li>
              <li><a href="#features" className="hover:text-zinc-950">User Roles & Permissions</a></li>
            </ul>
          </div>

          {/* Access & Demo Account */}
          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-zinc-950 font-mono mb-3">
              Live Workspace Access
            </div>
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-zinc-950">
                <ShieldCheck className="w-4 h-4 text-zinc-900" /> Interactive Demo
              </div>
              <p className="text-[11px] text-zinc-600">
                Test the full Jcom retail suite with pre-loaded products and transactions.
              </p>
              <button
                onClick={() => navigate('/login?demo=true')}
                className="w-full mt-1 py-1.5 bg-zinc-950 text-white rounded text-[11px] font-bold hover:bg-zinc-800 transition-colors"
              >
                Launch Demo Session
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 font-mono">
          <div>&copy; {new Date().getFullYear()} Jcom Retail OS. All rights reserved.</div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-zinc-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> All Systems Operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
