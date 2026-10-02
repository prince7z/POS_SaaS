import { Avatar, Button, Menu, Text, VStack } from '@chakra-ui/react'
import { ChevronDown, LogOut, Settings, User } from 'lucide-react'

export function UserMenu({ collapsed = false, compact = false }: { collapsed?: boolean; compact?: boolean }) {
  return (
    <Menu.Root positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button variant="ghost" w={collapsed ? 'full' : 'auto'} justifyContent="flex-start" px="2">
          <Avatar.Root size="sm">
            <Avatar.Fallback name="John Doe" />
          </Avatar.Root>
          {!collapsed && !compact && (
            <VStack align="start" gap="0" ml="2">
              <Text fontSize="sm">John Doe</Text>
              <Text fontSize="xs" color="secondary">
                Store Manager
              </Text>
            </VStack>
          )}
          {!collapsed && !compact && <ChevronDown size={15} />}
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          <Menu.Item value="profile">
            <User size={15} />
            Profile
          </Menu.Item>
          <Menu.Item value="settings">
            <Settings size={15} />
            Settings
          </Menu.Item>
          <Menu.Item value="logout" color="danger">
            <LogOut size={15} />
            Log out
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
