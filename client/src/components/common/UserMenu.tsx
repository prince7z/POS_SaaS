import { Avatar, Button, Menu, Text, VStack } from '@chakra-ui/react'
import { ChevronDown, LogOut, Settings, User } from 'lucide-react'
import { clearAuthSession, getStoredUser } from '@/lib/auth'
import { useNavigate } from 'react-router-dom'

export function UserMenu({ collapsed = false, compact = false }: { collapsed?: boolean; compact?: boolean }) {
  const user = getStoredUser()
  const navigate = useNavigate()

  const handleLogout = () => {
    clearAuthSession()
    navigate('/auth/login')
  }

  const displayName = user?.fullName || 'John Doe'
  const displayRole = user?.roleName || 'Store Manager'

  return (
    <Menu.Root positioning={{ placement: 'bottom-end' }}>
      <Menu.Trigger asChild>
        <Button variant="ghost" w={collapsed ? 'full' : 'auto'} justifyContent="flex-start" px="2">
          <Avatar.Root size="sm">
            <Avatar.Fallback name={displayName} />
          </Avatar.Root>
          {!collapsed && !compact && (
            <VStack align="start" gap="0" ml="2">
              <Text fontSize="sm">{displayName}</Text>
              <Text fontSize="xs" color="secondary">
                {displayRole}
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
          <Menu.Item value="settings" onClick={() => navigate('/settings')}>
            <Settings size={15} />
            Settings
          </Menu.Item>
          <Menu.Item value="logout" color="danger" onClick={handleLogout}>
            <LogOut size={15} />
            Log out
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  )
}
