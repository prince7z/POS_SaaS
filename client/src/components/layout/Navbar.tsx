import { Box, Button, Flex, HStack } from '@chakra-ui/react'
import { motion } from 'motion/react'
import { Bell, Menu } from 'lucide-react'
import { UserMenu } from '@/components/common/UserMenu'

const MotionFlex = motion.create(Flex)

export function Navbar({ onMobileMenuToggle }: { onMobileMenuToggle: () => void }) {
  return (
    <MotionFlex
      as="header"
      h="navbar"
      px={{ base: '4', md: '6' }}
      py={{ base: '1', md: '2' }}
      align="center"
      justify="space-between"
      gap="4"
      bg="surface"
      borderBottomWidth="2px"
      position="sticky"
      top="0"
      zIndex="10"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <HStack gap="3" flex="1">
        <Button display={{ base: 'inline-flex', md: 'none' }} variant="ghost" size="sm" aria-label="Open navigation" onClick={onMobileMenuToggle}>
          <Menu size={18} />
        </Button>
      </HStack>
      <HStack gap="2">
        <Button variant="ghost" size="sm" aria-label="Notifications" position="relative"><Bell size={17} /><Box position="absolute" top="2" right="2" w="5px" h="5px" bg="danger" borderRadius="full" /></Button>
        <UserMenu compact />
      </HStack>
    </MotionFlex>
  )
}
