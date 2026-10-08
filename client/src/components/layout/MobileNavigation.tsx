import { useEffect, useState } from 'react'
import { Drawer, VStack, Box, HStack, Text, CloseButton, Button } from '@chakra-ui/react'
import { AnimatePresence, motion } from 'motion/react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useFilteredNavigation } from '@/config/navigation'
import { Logo } from '@/components/common/Logo'
import type { NavItem } from '@/types/navigation'

const MotionBox = motion.create(Box)

export function MobileNavigation({ open, onClose }: { open: boolean; onClose: () => void }) {
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
    const active = location.pathname === item.path
    const hasChildren = Boolean(item.children?.length)
    const expanded = expandedItems.has(item.id)

    return (
      <Box key={item.id}>
        <HStack
          px={depth ? '6' : '3'}
          py="2"
          borderRadius="md"
          bg={active ? 'blue.50' : 'transparent'}
          color={active ? 'primary' : 'secondary'}
        >
          <NavLink to={item.path} onClick={onClose} style={{ flex: 1 }}>
            <HStack gap="3">
              <item.icon size={17} />
              <Text fontSize="sm">{item.label}</Text>
            </HStack>
          </NavLink>
          {hasChildren && (
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
          {hasChildren && expanded && (
            <MotionBox
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
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
    <Drawer.Root open={open} onOpenChange={(event) => !event.open && onClose()} placement="start">
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <MotionBox
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.22 }}
            h="full"
          >
            <Drawer.Header>
              <HStack justify="space-between" w="full">
                <Logo />
                <CloseButton onClick={onClose} />
              </HStack>
            </Drawer.Header>
            <Drawer.Body>
              <VStack align="stretch" gap="5">
                {filteredGroups.map((group) => (
                  <Box key={group.id}>
                    <Text textStyle="label" color="muted" mb="2">
                      {group.label}
                    </Text>
                    <VStack align="stretch" gap="1">
                      {group.items.map((item) => renderItem(item))}
                    </VStack>
                  </Box>
                ))}
              </VStack>
            </Drawer.Body>
          </MotionBox>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  )
}
