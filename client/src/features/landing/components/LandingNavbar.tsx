import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Store, Menu, X, ArrowRight } from 'lucide-react'

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { label: 'Product', href: '#hero' },
    { label: 'Features', href: '#features' },
    { label: 'Solutions', href: '#pos' },
    { label: 'Reports', href: '#reports' },
    { label: 'Integrations', href: '#integrations' },
    { label: 'Pricing', href: '#cta' },
  ]

  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault()
    setMobileMenuOpen(false)
    const element = document.querySelector(href)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-xs py-3.5'
          : 'bg-white/80 backdrop-blur-sm border-b border-zinc-100 py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between h-11">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center text-white shadow-sm group-hover:bg-zinc-800 transition-colors">
              <Store className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-xl text-zinc-950 tracking-tight leading-none" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                ShopPro
              </span>
              <span className="text-[10px] text-zinc-400 font-semibold tracking-widest uppercase mt-0.5 font-mono">
                RETAIL OS
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1 bg-zinc-100/90 p-1.5 rounded-full border border-zinc-200/80">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => scrollToSection(e, link.href)}
                className="px-4 py-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950 hover:bg-white rounded-full transition-all duration-150"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-4">
            <Link
              to="/login"
              className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 px-3 py-2 transition-colors"
            >
              Login
            </Link>

            <button
              onClick={() => navigate('/login?demo=true')}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-zinc-950 hover:bg-zinc-800 rounded-xl transition-all shadow-sm active:scale-98"
            >
              Get Started
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2.5 rounded-xl text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-zinc-200 overflow-hidden"
          >
            <div className="px-6 pt-4 pb-8 space-y-4">
              <div className="grid grid-cols-2 gap-2 pb-2">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => scrollToSection(e, link.href)}
                    className="px-4 py-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 rounded-lg"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="pt-3 border-t border-zinc-200 flex flex-col gap-2.5">
                <Link
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center px-4 py-2 text-xs font-semibold text-zinc-700 border border-zinc-200 rounded-xl"
                >
                  Login
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false)
                    navigate('/login?demo=true')
                  }}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 text-xs font-bold text-white bg-zinc-950 rounded-xl"
                >
                  Get Started
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
