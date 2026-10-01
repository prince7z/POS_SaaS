import { useState } from 'react'
import { Box, Flex } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Outlet } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { MobileNavigation } from './MobileNavigation'
import { STORAGE_KEYS } from '@/config/constants'

export function AppShell() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEYS.SIDEBAR_STATE) === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_STATE, String(next))
      return next
    })
  }

  return (
    <Flex minH="100vh">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <Box flex="1" minW="0">
        <Navbar onMobileMenuToggle={() => setMobileOpen(true)} />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Box minH="calc(100vh - 64px)"><Outlet /></Box>
          </motion.main>
        </AnimatePresence>
      </Box>
      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </Flex>
  )
}
