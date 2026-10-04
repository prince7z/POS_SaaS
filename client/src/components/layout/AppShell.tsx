import { useState } from 'react'
import { Box, Flex } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'
import { MobileNavigation } from './MobileNavigation'
import { AgentPanel } from '@/features/agent/components/AgentPanel'
import { STORAGE_KEYS } from '@/config/constants'

export function AppShell() {
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEYS.SIDEBAR_STATE) === 'true')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiWidth, setAiWidth] = useState(380)

  const toggleSidebar = () => {
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_STATE, String(next))
      return next
    })
  }

  return (
    <Flex minH="100vh" w="100vw" overflowX="hidden">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <Flex flex="1" direction="column" minW="0" h="100vh" overflowY="auto">
        <Navbar
          onMobileMenuToggle={() => setMobileOpen(true)}
          isAiOpen={aiOpen}
          onAiToggle={() => setAiOpen((prev) => !prev)}
        />
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ flex: 1 }}
          >
            <Box minH="calc(100vh - 64px)">
              <Outlet />
            </Box>
          </motion.main>
        </AnimatePresence>
      </Flex>
      <AgentPanel
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        width={aiWidth}
        onWidthChange={setAiWidth}
      />
      <MobileNavigation open={mobileOpen} onClose={() => setMobileOpen(false)} />
    </Flex>
  )
}
