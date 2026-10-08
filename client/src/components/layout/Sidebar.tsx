import { useEffect, useState } from 'react'
import { Box, Button, Flex, HStack, Text, VStack } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import type { NavItem } from '@/types/navigation'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useFilteredNavigation } from '@/config/navigation'
import { Logo } from '@/components/common/Logo'
import { UserMenu } from '@/components/common/UserMenu'

const MotionBox = motion.create(Box)

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation()
  const filteredGroups = useFilteredNavigation()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  useEffect(() => {
    const activeParentIds = filteredGroups
      .flatMap((group) => group.items)
      .filter((item) => item.children?.some((child) => child.path === location.pathname))
      .map((item) => item.id)

    setExpandedItems(new Set(activeParentIds))
  }, [location.pathname, filteredGroups])

  const toggleItem = (id: string) => {
    setExpandedItems((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderItem = (item: NavItem, depth = 0) => {
    const hasChildren = Boolean(item.children?.length)
    const active = !hasChildren && location.pathname === item.path
    const expanded = expandedItems.has(item.id)

    return (
      <Box key={item.id} w="full">
        <HStack
          as={hasChildren ? 'button' : 'div'}
          onClick={hasChildren ? () => toggleItem(item.id) : undefined}
          aria-expanded={hasChildren ? expanded : undefined}
          px={collapsed ? '0' : depth ? '4' : '3'}
          py="2"
          justify={collapsed ? 'center' : 'flex-start'}
          align="center"
          gap="3"
          borderRadius="md"
          color={active ? 'primary' : 'secondary'}
          bg={active ? 'blue.50' : 'transparent'}
          position="relative"
          _hover={{ bg: 'background', color: 'foreground' }}
          transition="background 140ms ease, color 140ms ease"
          h={collapsed ? '40px' : 'auto'}
          w="full"
        >
          {hasChildren ? (
            <HStack gap="3" flex="1" justify={collapsed ? 'center' : 'flex-start'}>
              <item.icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <Text fontSize="sm" fontWeight={active ? '600' : '500'} truncate flex="1" textAlign="left">
                  {item.label}
                </Text>
              )}
            </HStack>
          ) : (
            <NavLink
              to={item.path}
              title={collapsed ? item.label : undefined}
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: collapsed ? 'center' : 'flex-start',
                alignItems: 'center',
                width: '100%',
                overflow: 'hidden',
              }}
            >
              <HStack gap="3" justify={collapsed ? 'center' : 'flex-start'} align="center" w="full">
                <item.icon size={18} style={{ flexShrink: 0 }} />
                {!collapsed && (
                  <Text fontSize="sm" fontWeight={active ? '600' : '500'} truncate textAlign="left">
                    {item.label}
                  </Text>
                )}
              </HStack>
            </NavLink>
          )}
          {!collapsed && hasChildren && (
            <Button
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
              variant="ghost"
              size="xs"
              minW="auto"
              p="1"
              onClick={(event) => {
                event.stopPropagation()
                toggleItem(item.id)
              }}
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
      animate={{ width: collapsed ? '68px' : '240px' }}
      transition={{ duration: 0.22, ease: 'easeInOut' }}
      flexShrink={0}
      minH="100vh"
      maxH="100vh"
      h="100vh"
      bg="surface"
      borderRightWidth="1px"
      borderColor="border"
      position="sticky"
      top="0"
      zIndex={20}
      boxSizing="border-box"
    >
      {/* Top Header - exactly 64px matching Navbar height & 1px border */}
      <Flex
        h="64px"
        minH="64px"
        maxH="64px"
        boxSizing="border-box"
        borderBottomWidth="1px"
        borderColor="border"
        align="center"
        justify={collapsed ? 'center' : 'space-between'}
        px={collapsed ? '0' : '3.5'}
        position="relative"
        flexShrink={0}
      >
        <Logo collapsed={collapsed} />
        {!collapsed && (
          <Button
            aria-label="Collapse sidebar"
            variant="ghost"
            size="xs"
            onClick={onToggle}
            p="1.5"
            minW="auto"
            color="secondary"
            _hover={{ color: 'foreground', bg: 'bg.muted' }}
          >
            <ChevronLeft size={16} />
          </Button>
        )}

        {/* Floating toggle button on the right edge of sidebar when collapsed */}
        <Button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          variant="outline"
          size="2xs"
          onClick={onToggle}
          position="absolute"
          top="21px"
          right="-11px"
          zIndex={30}
          borderRadius="full"
          bg="surface"
          borderColor="border"
          boxShadow="sm"
          p="0"
          boxSize="22px"
          display={collapsed ? 'grid' : 'none'}
          placeItems="center"
          cursor="pointer"
          _hover={{ bg: 'blue.50', color: 'primary', borderColor: 'primary' }}
        >
          <ChevronRight size={13} strokeWidth={2.4} />
        </Button>
      </Flex>

      {/* Navigation List - with minH=0 so flexbox scrolls cleanly and bottom user card never gets pushed off */}
      <VStack
        as="nav"
        align="stretch"
        gap="4"
        flex="1"
        minH="0"
        overflowY="auto"
        overflowX="hidden"
        py="4"
        px={collapsed ? '2' : '3'}
      >
        {filteredGroups.map((group) => (
          <Box key={group.id} w="full">
            {!collapsed && (
              <Text textStyle="label" color="muted" px="3" mb="1.5" fontSize="11px" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em">
                {group.label}
              </Text>
            )}
            <VStack align="stretch" gap="1">
              {group.items.map((item) => renderItem(item))}
            </VStack>
          </Box>
        ))}
      </VStack>

      {/* Bottom User Profile Section - firmly anchored, zero shrink, always fully visible */}
      <Box
        p={collapsed ? '2' : '3'}
        flexShrink={0}
        borderTopWidth="1px"
        borderColor="border"
        bg="surface"
        mt="auto"
        boxSizing="border-box"
      >
        <UserMenu collapsed={collapsed} />
      </Box>
    </MotionBox>
  )
}
