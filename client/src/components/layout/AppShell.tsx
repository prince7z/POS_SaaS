import { useEffect, useState } from 'react'
import { Box, Flex } from '@chakra-ui/react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { MobileNavigation } from './MobileNavigation'
import { AgentPanel } from '@/features/agent/components/AgentPanel'
import { STORAGE_KEYS } from '@/config/constants'
import { isAuthenticated, setStoredCompany } from '@/lib/auth'
import { getMe } from '@/api/endpoints/auth'
import { playInteractionSound } from '@/lib/interaction-sounds'

export function AppShell() {
  const location = useLocation()
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEYS.SIDEBAR_STATE) === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiWidth, setAiWidth] = useState(380)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/auth/login', { replace: true })
      return
    }

    getMe()
      .then((data) => {
        if (data.user) {
          localStorage.setItem('pos-user', JSON.stringify(data.user))
          const accesses = Array.isArray(data.user.accesses) ? data.user.accesses : []
          localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(accesses))
          window.dispatchEvent(new CustomEvent('pos-permissions-updated', { detail: accesses }))
        }
        if (data.company) {
          setStoredCompany(data.company)
        }
        if (data.companies) {
          localStorage.setItem('pos-companies', JSON.stringify(data.companies))
        }
      })
      .catch((err) => {
        console.warn('Failed to refresh user profile:', err)
      })
  }, [navigate])

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const target = event.target.closest<HTMLElement>(
        'a[href], button, [role="button"], [role="tab"], [role="menuitem"], [role="option"], input[type="checkbox"], input[type="radio"], select',
      )
      if (target?.closest('[data-sound-preview]')) return
      if (!target || target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return
      const activity = target.closest('a[href]')
        ? 'navigation'
        : target.closest(
              '[role="tab"], [role="menuitem"], [role="option"], input[type="checkbox"], input[type="radio"], select',
            )
          ? 'selection'
          : 'button'
      playInteractionSound(activity)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_STATE, String(next))
      return next
    })
  }

  return (
    <Flex minH="100vh" h="100dvh" w="full" minW="0" maxW="100%" overflowX="hidden">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <Flex flex="1" direction="column" minW="0" maxW="100%" h="100dvh" overflowX="hidden" overflowY="auto">
        <Navbar
          onMobileMenuToggle={() => setMobileOpen(true)}
          isAiOpen={aiOpen}
          onAiToggle={() => setAiOpen((prev) => !prev)}
        />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2, ease: 'easeOut' }}
            style={{ flex: 1, minWidth: 0, width: '100%', maxWidth: '100%' }}
          >
            <Box minH="calc(100vh - 64px)" minW="0" maxW="100%">
              <Outlet />
            </Box>
          </motion.main>
        </AnimatePresence>
      </Flex>
      <AgentPanel isOpen={aiOpen} onClose={() => setAiOpen(false)} width={aiWidth} onWidthChange={setAiWidth} />
      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </Flex>
  )
}
