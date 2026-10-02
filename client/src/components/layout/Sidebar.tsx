import { useEffect, useState } from 'react'
import { Box, Button, Flex, HStack, Separator, Text, VStack } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import type { NavItem } from '@/types/navigation'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { navigationConfig } from '@/config/navigation'
import { Logo } from '@/components/common/Logo'
import { UserMenu } from '@/components/common/UserMenu'

const MotionBox = motion.create(Box)

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    const activeParentIds = navigationConfig
      .flatMap((group) => group.items)
      .filter((item) => item.children?.some((child) => child.path === location.pathname))
      .map((item) => item.id)

    setExpandedItems(new Set(activeParentIds))
  }, [location.pathname])

  const toggleItem = (id: string) => {
    setExpandedItems((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderItem = (item: NavItem, depth = 0) => {
    const active = location.pathname === item.path
    const hasChildren = Boolean(item.children?.length)
    const expanded = expandedItems.has(item.id)

    return (
      <Box key={item.id}>
        <HStack
          as="div"
          px={collapsed ? '0' : depth ? '6' : '3'}
          py="2"
          justify={collapsed ? 'center' : 'flex-start'}
          gap="3"
          borderRadius="md"
          color={active ? 'primary' : 'secondary'}
          bg={active ? 'blue.50' : 'transparent'}
          position="relative"
          _hover={{ bg: 'background', color: 'foreground' }}
          transition="background 140ms ease, color 140ms ease"
        >
          <NavLink to={item.path} title={collapsed ? item.label : undefined} style={{ flex: 1 }}>
            <HStack gap="3">
              <item.icon size={17} />
              {!collapsed && (
                <Text fontSize="sm" fontWeight={active ? '600' : '500'}>
                  {item.label}
                </Text>
              )}
            </HStack>
          </NavLink>
          {!collapsed && hasChildren && (
            <Button
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
              variant="ghost"
              size="xs"
              minW="auto"
              p="1"
              onClick={() => toggleItem(item.id)}
            >
              <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.18 }}>
                <ChevronDown size={14} />
              </motion.span>
            </Button>
          )}
        </HStack>
        <AnimatePresence initial={false}>
          {!collapsed && hasChildren && expanded && (
            <MotionBox
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              overflow="hidden"
            >
              <VStack align="stretch" gap="1" pt="1">
                {item.children?.map((child) => renderItem(child, depth + 1))}
              </VStack>
            </MotionBox>
          )}
        </AnimatePresence>
      </Box>
    )
  }

  return (
    <MotionBox
      as="aside"
      display={{ base: 'none', md: 'flex' }}
      flexDirection="column"
      animate={{ width: collapsed ? '68px' : '232px' }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      flexShrink="0"
      minH="100vh"
      bg="surface"
      borderRightWidth="1px"
      position="sticky"
      top="0"
      h="100vh"
      overflow="hidden"
    >
      <Flex h="navbar" px="4" align="center" justify="space-between">
        <Logo collapsed={collapsed} />
        <Button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          variant="ghost"
          size="sm"
          onClick={onToggle}
          px="2"
        >
          <motion.span animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.18 }}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </motion.span>
        </Button>
      </Flex>
      <Separator />
      <VStack as="nav" align="stretch" gap="5" flex="1" overflowY="auto" py="5" px="3">
        {navigationConfig.map((group) => (
          <Box key={group.id}>
            {!collapsed && (
              <Text textStyle="label" color="muted" px="3" mb="2">
                {group.label}
              </Text>
            )}
            <VStack align="stretch" gap="1">
              {group.items.map((item) => renderItem(item))}
            </VStack>
          </Box>
        ))}
      </VStack>
      <Separator />
      <Box p="3">
        <UserMenu collapsed={collapsed} />
      </Box>
    </MotionBox>
  )
}
